/**
 * The starter-shell planner (W9a) — pure, IO-free, deterministic. Consumes
 * the adapter's AutofillMeta declaration plus score-ordered pools that the
 * route gathered through the P3.1/P3.2 rank machinery, so every ranked pick
 * arrives with its evidence already built — there is no second evidence
 * format.
 *
 * Two-phase by design: `buildShell` plans every ranked pick and reports how
 * many base slots need adapter fillers (their pip split needs the chosen
 * cards' cost texts, which the route only loads afterwards with the wire
 * read it needs anyway); `finishShell` appends the resolved fillers and
 * assembles groups, notes and totals. Both phases are pure, so a later
 * client-side reroll over a returned window stays an open door (LATER).
 *
 * Purity + the seed in the response make "same seed → identical list" a
 * contract, not a vibe; rng.ts pins the sequence.
 *
 * Goals (Y6b, WAVE4 D7): with the deck's target, every card is checked
 * before it's taken — the lock and combo tiers, a borrowed slot and a land
 * one at a time, a sampling window as a whole: it is built only from cards
 * that fit TOGETHER (each judged against the picks and the window before
 * it), so whatever the sample takes stays inside the target. Goals filter
 * before sampling and the sampler is untouched — one `rand()` per window
 * card — so with goals absent the windows, the stream and the shell are
 * exactly what they were (pinned by the fixed-seed golden). Below the
 * adapter's `lockMinTarget` the route turns the lock tier off.
 *
 * Reach (AUTOFILL-REACH, the owner's call of 2026-11-17: "autofill should
 * build up to the target if the target is set first"): once the shell is
 * planned, the goals say what it is still short of its target by the
 * adapter's own measure (shell-goals.ts' `missing`), and the best-ranked
 * candidates that count come in, each in the place of the weakest sampled
 * pick of its own group, so the size and the curve hold. Each passes the
 * same ceiling check as every other pick. Nothing is sampled: no `rand()`
 * runs, so a seed still means one list, and a shell that already shows its
 * target is the shell it was before this step existed. With no goals, or a
 * check that names nothing missing, the step does nothing.
 */
import type { AutofillMeta, RecommendMeta } from "@/lib/games/types";
import { deckCurve, type TournamentContext, type TournamentSignal } from "./rank";
import { mulberry32, sampleWeighted } from "./rng";
import type { ShellGoals } from "./shell-goals";
import type { Recommendation, RecommendationEvidence } from "./types";

/** Global cap on tier-B picks (combo completions with kept cards). */
export const COMBO_PICK_CAP = 6;
/** Tier C samples from the top `need × SAMPLE_WINDOW` of what's left. */
export const SAMPLE_WINDOW = 2;

/**
 * The notes[] vocabulary — W9b renders these verbatim (pinned in tests).
 *
 * AUTOFILL-OWNED: with `fromCollection` the candidates were the player's own
 * cards (the route's `ownedOnly`), so the shortfall says the collection ran
 * out and counts the slots it left open. A list built that way is never
 * topped up with cards to buy (the owner's decision 3), so this sentence is
 * what a small collection gets where a full list would be. No per-card
 * budget applies to owned cards, so it is never named here.
 */
export const FULL_NOTE = "The deck is already full. Nothing to add.";
export function shortfallNote(
  picked: number,
  slots: number,
  labels: readonly string[],
  budgetUsd?: number,
  fromCollection = false,
): string {
  const where = labels.join(", ");
  if (fromCollection) {
    const open = slots - picked;
    return `Filled ${picked} of ${slots}. Your collection ran out of cards that fit, leaving ${open} ${open === 1 ? "slot" : "slots"} open in ${where}.`;
  }
  return budgetUsd !== undefined
    ? `Filled ${picked} of ${slots}. The $${budgetUsd}-a-card budget leaves too few candidates in ${where}.`
    : `Filled ${picked} of ${slots}. Too few candidates in ${where}.`;
}

/** "reach": brought in after the plan because it counts toward the target (AUTOFILL-REACH). */
export type PickTier = "locked" | "combo" | "sampled" | "reach" | "filler";

/** What the reach step did: counting cards brought in, and how many the shell is still short. */
export interface ShellReach {
  added: number;
  /** Still missing when nothing more could come in (no candidate that counts and fits, or no pick to replace). */
  short: number;
}

export interface ShellPick {
  cardId: string;
  name: string;
  zone: string;
  qty: number;
  /** Group id: "base" or "curve-<bucket>". */
  group: string;
  tier: PickTier;
  score: number;
  cheapestUsd: string | null;
  evidence: RecommendationEvidence[];
}

export interface ShellGroup {
  id: string;
  label: string;
  /** Cards picked into the group (qty-weighted — the sheet's "· 37"). */
  picks: number;
}

export interface ShellInput {
  autofill: AutofillMeta;
  curve: NonNullable<RecommendMeta["curve"]>;
  /** deckSize.min − Σqty over countsTowardSize zones (computed by the route). */
  slots: number;
  /** Kept non-leader entries (curve/base state; leaders are the slot above). */
  keep: readonly { qty: number; card: { primaryType: string | null; costValue: number | null } }[];
  ciMask: number;
  /** Score-ordered nonbase pool (rankCandidates over the curve gather). */
  pool: readonly Recommendation[];
  /** Score-ordered base pool (rankCandidates over the base gather). */
  basePool: readonly Recommendation[];
  tournamentContext: TournamentContext | null;
  tournamentsByCandidate: ReadonlyMap<string, TournamentSignal>;
  /** Candidate ids that would complete a combo with kept cards. */
  comboCandidateIds: ReadonlySet<string>;
  /** Zone every pick lands in (the non-leader countsTowardSize zone). */
  zone: string;
  seed: number;
  /** The deck's target, held as the shell grows (Y6b, shell-goals.ts); absent = no goals. */
  goals?: ShellGoals;
  /** Whether tier A locks measured staples (default true; off below the adapter's lockMinTarget). */
  lockStaples?: boolean;
}

export interface ShellDraft {
  full: boolean;
  slots: number;
  seed: number;
  /** Ranked picks (curve + ranked base) in group order. */
  picks: ShellPick[];
  /** Base slots the caller must resolve through the adapter's fillers. */
  fillerNeed: number;
  /** Group labels still short after borrowing (before fillers). */
  shortLabels: string[];
  /** Group display order: base first, then curve buckets ascending. */
  groupOrder: { id: string; label: string }[];
  baseSource: string;
  baseLabel: string;
  /** Set when the shell was short of its target after planning (AUTOFILL-REACH); the route words it through the adapter. */
  reach?: ShellReach;
}

/** Resolved filler picks the route hands to `finishShell`. */
export interface FillerPick {
  cardId: string;
  name: string;
  qty: number;
  cheapestUsd: string | null;
  why: string;
}

export interface ShellResult {
  picks: ShellPick[];
  groups: ShellGroup[];
  notes: string[];
  totals: { picks: number; estUsd: number | null; unpriced: number };
  seed: number;
}

/** Largest-remainder scaling of integer weights to sum exactly `total`. */
export function scaleByLargestRemainder(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total <= 0 || sum <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / sum);
  const scaled = raw.map(Math.floor);
  let left = total - scaled.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ frac: r - Math.floor(r), i }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    scaled[i] += 1;
    left -= 1;
  }
  return scaled;
}

const popcount = (mask: number): number => {
  let n = 0;
  for (let m = mask >>> 0; m !== 0; m >>>= 1) n += m & 1;
  return n;
};

/**
 * Whether tier A locks measured staples for this target (Y6b, WAVE4 F
 * "Autofill at targets ≤ 3"): no target, or one at or above the adapter's
 * `lockMinTarget`. Below it they're ranked like any card — the weights stay.
 */
export function locksStaples(autofill: AutofillMeta, targetLevel: number | null): boolean {
  return (
    targetLevel === null ||
    autofill.lockMinTarget === undefined ||
    targetLevel >= autofill.lockMinTarget
  );
}

/** Tier-A lock: measured tournament staple for THIS commander set. */
function isLocked(
  rec: Recommendation,
  autofill: AutofillMeta,
  context: TournamentContext | null,
  byCandidate: ReadonlyMap<string, TournamentSignal>,
): boolean {
  if (!context || context.lists <= 0) return false;
  const signal = byCandidate.get(rec.cardId);
  if (!signal || signal.lists < autofill.lockMinLists) return false;
  return signal.lists / context.lists >= autofill.lockShare;
}

const toPick = (rec: Recommendation, zone: string, group: string, tier: PickTier): ShellPick => ({
  cardId: rec.cardId,
  name: rec.name,
  zone,
  qty: 1,
  group,
  tier,
  score: rec.score,
  cheapestUsd: rec.cheapestUsd,
  evidence: rec.evidence,
});

export function buildShell(input: ShellInput): ShellDraft {
  const { autofill, curve, slots, zone, seed } = input;
  const bucketLabelOf = (i: number) =>
    autofill.curveLabel(i === curve.buckets.length - 1 ? `${i}+` : String(i));
  const groupOrder = [
    { id: "base", label: autofill.base.label },
    ...curve.buckets.map((_, i) => ({ id: `curve-${i}`, label: bucketLabelOf(i) })),
  ];
  const draft: ShellDraft = {
    full: false,
    slots: Math.max(0, slots),
    seed,
    picks: [],
    fillerNeed: 0,
    shortLabels: [],
    groupOrder,
    baseSource: autofill.base.source,
    baseLabel: autofill.base.label,
  };
  if (slots <= 0) {
    draft.full = true;
    return draft;
  }

  // Current curve/base state from the KEPT cards (☑ Keep my N cards).
  const have = deckCurve(input.keep, curve).counts;
  const haveBase = input.keep.reduce((n, k) => n + (autofill.base.isBase(k.card) ? k.qty : 0), 0);
  const needBase = Math.min(Math.max(autofill.base.count - haveBase, 0), slots);

  // Curve needs scaled to the remaining slots by largest remainder (partner
  // pairs land on 98, off-template keeps still fill every slot). A deck
  // already matching the template redistributes along the template itself.
  const rawNeed = curve.buckets.map((target, i) => Math.max(0, target - (have[i] ?? 0)));
  const weights = rawNeed.some((n) => n > 0) ? rawNeed : [...curve.buckets];
  const needCurve = scaleByLargestRemainder(weights, slots - needBase);

  // Bucket the nonbase pool once, keeping score order within each bucket.
  const byBucket: Recommendation[][] = curve.buckets.map(() => []);
  for (const rec of input.pool) {
    const bucket = curve.bucketOf({ primaryType: rec.primaryType, costValue: rec.costValue });
    if (bucket === null) continue;
    byBucket[Math.min(bucket, curve.buckets.length - 1)].push(rec);
  }

  const rand = mulberry32(seed);
  const picked = new Set<string>();
  /** Every ranked pick so far, in pick order — the list the goals judge the next card against. */
  const chosen: string[] = [];
  let comboUsed = 0;
  const { goals } = input;
  /** Whether the card fits the goals beside every pick so far (and `alsoHeld`); no goals = always. */
  const fits = (rec: Recommendation, alsoHeld: readonly string[] = []): boolean =>
    !goals ||
    goals.conflicts(rec.cardId, alsoHeld.length > 0 ? [...chosen, ...alsoHeld] : chosen).length ===
      0;
  const lockStaples = input.lockStaples ?? true;
  const locked = (rec: Recommendation): boolean =>
    lockStaples && isLocked(rec, autofill, input.tournamentContext, input.tournamentsByCandidate);

  /** Tiers A → B → C over one bucket's remaining candidates. */
  const pickFromBucket = (bucket: number, need: number, tierForBorrow?: true): ShellPick[] => {
    if (need <= 0) return [];
    const group = `curve-${bucket}`;
    const remaining = byBucket[bucket].filter((r) => !picked.has(r.cardId));
    const out: ShellPick[] = [];
    const take = (rec: Recommendation, tier: PickTier) => {
      picked.add(rec.cardId);
      chosen.push(rec.cardId);
      out.push(toPick(rec, zone, group, tier));
    };

    // Borrowed slots skip the tier machinery: deterministic score order.
    if (tierForBorrow) {
      for (const rec of remaining) {
        if (out.length >= need) break;
        if (fits(rec)) take(rec, "sampled");
      }
      return out;
    }

    // A. locked tournament staples, rank order.
    for (const rec of remaining) {
      if (out.length >= need) break;
      if (locked(rec) && fits(rec)) take(rec, "locked");
    }
    // B. combo completions with kept cards, global cap.
    for (const rec of remaining) {
      if (out.length >= need || comboUsed >= COMBO_PICK_CAP) break;
      if (!picked.has(rec.cardId) && input.comboCandidateIds.has(rec.cardId) && fits(rec)) {
        take(rec, "combo");
        comboUsed += 1;
      }
    }
    // C. weighted sampling (w = score) from the top of what's left. With
    // goals the window holds only cards that fit together — each judged
    // against the picks and the window before it — so any sample from it
    // fits; without them it is the plain top of what's left.
    const left = need - out.length;
    if (left > 0) {
      const size = Math.ceil(left * SAMPLE_WINDOW);
      const window: Recommendation[] = [];
      const admitted: string[] = [];
      for (const rec of remaining) {
        if (window.length >= size) break;
        if (picked.has(rec.cardId) || !fits(rec, admitted)) continue;
        window.push(rec);
        if (goals) admitted.push(rec.cardId);
      }
      for (const rec of sampleWeighted(window, left, (r) => r.score, rand)) {
        take(rec, "sampled");
      }
    }
    return out;
  };

  // First pass per bucket, then nearest-bucket borrowing (b−1 first).
  const shortfall: number[] = curve.buckets.map(() => 0);
  for (let b = 0; b < curve.buckets.length; b++) {
    const got = pickFromBucket(b, needCurve[b]);
    draft.picks.push(...got);
    shortfall[b] = needCurve[b] - got.length;
  }
  for (let b = 0; b < curve.buckets.length; b++) {
    if (shortfall[b] <= 0) continue;
    for (let d = 1; d < curve.buckets.length && shortfall[b] > 0; d++) {
      for (const donor of [b - d, b + d]) {
        if (shortfall[b] <= 0 || donor < 0 || donor >= curve.buckets.length) continue;
        const got = pickFromBucket(donor, shortfall[b], true);
        draft.picks.push(...got);
        shortfall[b] -= got.length;
      }
    }
    if (shortfall[b] > 0) draft.shortLabels.push(bucketLabelOf(b));
  }

  // Base: locked first (score order already encodes rank), then score, with
  // the ranked-slot budget by color count and the colorless-identity cap.
  const colorCount = popcount(input.ciMask);
  const rankedBudget =
    autofill.base.rankedByColorCount[
      Math.min(colorCount, autofill.base.rankedByColorCount.length - 1)
    ] ?? 0;
  const rankedTarget = Math.min(needBase, rankedBudget);
  let colorlessUsed = 0;
  let baseTaken = 0;
  const baseOrdered = [
    ...input.basePool.filter((r) => locked(r)),
    ...input.basePool.filter((r) => !locked(r)),
  ];
  for (const rec of baseOrdered) {
    if (baseTaken >= rankedTarget) break;
    if (picked.has(rec.cardId)) continue;
    const colorless = rec.ciMask === 0;
    if (colorless && colorlessUsed >= autofill.base.maxColorlessIdentity) continue;
    if (!fits(rec)) continue;
    picked.add(rec.cardId);
    chosen.push(rec.cardId);
    draft.picks.push(toPick(rec, zone, "base", locked(rec) ? "locked" : "sampled"));
    if (colorless) colorlessUsed += 1;
    baseTaken += 1;
  }

  // Reach (AUTOFILL-REACH): the shell is planned; where it is short of its
  // target by the adapter's measure, the best-ranked candidates that count
  // come in, each in the place of the weakest sampled pick of its own group
  // (the nearest bucket's when its own has none, the planner's borrowing
  // order). A swap, so the size, the base count and the curve hold; kept
  // cards, locked staples, combo completions and cards that count never
  // leave. Deterministic: rank order and scores, never `rand()`.
  if (goals?.missing) {
    const colorlessIds = new Set(input.basePool.filter((r) => r.ciMask === 0).map((r) => r.cardId));
    const lastBucket = curve.buckets.length - 1;
    const order: { rec: Recommendation; group: string }[] = [];
    for (const rec of input.pool) {
      const bucket = curve.bucketOf({ primaryType: rec.primaryType, costValue: rec.costValue });
      if (bucket !== null) order.push({ rec, group: `curve-${Math.min(bucket, lastBucket)}` });
    }
    for (const rec of input.basePool) order.push({ rec, group: "base" });

    /** The weakest sampled pick of `group` that may leave (the later pick on a tie); −1 = none. */
    const weakestIn = (group: string, stays: (cardId: string) => boolean): number => {
      let at = -1;
      for (let k = 0; k < draft.picks.length; k++) {
        const p = draft.picks[k];
        if (p.group !== group || p.tier !== "sampled" || stays(p.cardId)) continue;
        if (at === -1 || p.score <= draft.picks[at].score) at = k;
      }
      return at;
    };
    /** The pick a card of `group` takes the place of: its own group's, then the nearest bucket's. */
    const leaverFor = (group: string, stays: (cardId: string) => boolean): number => {
      const own = weakestIn(group, stays);
      if (own !== -1 || group === "base") return own;
      const b = Number(group.slice("curve-".length));
      for (let d = 1; d <= lastBucket; d++) {
        for (const donor of [b - d, b + d]) {
          if (donor < 0 || donor > lastBucket) continue;
          const at = weakestIn(`curve-${donor}`, stays);
          if (at !== -1) return at;
        }
      }
      return -1;
    };

    let added = 0;
    let short = 0;
    for (;;) {
      const missing = goals.missing(chosen);
      short = missing?.more ?? 0;
      if (!missing) break;
      let took = false;
      for (const { rec, group } of order) {
        if (picked.has(rec.cardId) || !missing.counts(rec.cardId)) continue;
        // The colorless-identity cap on the base: at the cap, a colorless
        // card comes in only for a colorless one.
        const atCap =
          group === "base" &&
          colorlessIds.has(rec.cardId) &&
          colorlessUsed >= autofill.base.maxColorlessIdentity;
        const out = leaverFor(
          group,
          atCap ? (id) => missing.counts(id) || !colorlessIds.has(id) : (id) => missing.counts(id),
        );
        if (out === -1) continue;
        const leaving = draft.picks[out].cardId;
        // The ceiling, against the list as it would stand without the card that leaves.
        const without = chosen.filter((id) => id !== leaving);
        if (goals.conflicts(rec.cardId, without).length > 0) continue;
        draft.picks[out] = toPick(rec, zone, group, "reach");
        chosen[chosen.indexOf(leaving)] = rec.cardId;
        picked.add(rec.cardId);
        if (group === "base") {
          colorlessUsed +=
            (colorlessIds.has(rec.cardId) ? 1 : 0) - (colorlessIds.has(leaving) ? 1 : 0);
        }
        added += 1;
        took = true;
        break;
      }
      if (!took) break;
    }
    if (added > 0 || short > 0) draft.reach = { added, short };
  }

  draft.fillerNeed = needBase - baseTaken;
  return draft;
}

export function finishShell(
  draft: ShellDraft,
  fillers: readonly FillerPick[],
  opts: {
    zone: string;
    budgetUsd?: number;
    /** AUTOFILL-OWNED: the pools held only cards the player owns; the shortfall note says so. */
    fromCollection?: boolean;
  },
): ShellResult {
  const picks = [...draft.picks];
  let fillerQty = 0;
  for (const f of fillers) {
    if (f.qty <= 0) continue;
    fillerQty += f.qty;
    picks.push({
      cardId: f.cardId,
      name: f.name,
      zone: opts.zone,
      qty: f.qty,
      group: "base",
      tier: "filler",
      score: 0,
      cheapestUsd: f.cheapestUsd,
      evidence: [
        { source: draft.baseSource, why: f.why, with: [], howOften: null, confidence: "medium" },
      ],
    });
  }

  const notes: string[] = [];
  if (draft.full) notes.push(FULL_NOTE);

  const totalQty = picks.reduce((n, p) => n + p.qty, 0);
  if (!draft.full && totalQty < draft.slots) {
    const labels = [...draft.shortLabels];
    if (fillerQty < draft.fillerNeed) labels.unshift(draft.baseLabel);
    // A gap without a named group (borrowing emptied every pool) still says so.
    if (labels.length === 0) labels.push("the candidate pools");
    notes.push(
      shortfallNote(totalQty, draft.slots, labels, opts.budgetUsd, opts.fromCollection ?? false),
    );
  }

  const byGroup = new Map<string, number>();
  for (const p of picks) byGroup.set(p.group, (byGroup.get(p.group) ?? 0) + p.qty);
  const groups = draft.groupOrder
    .map((g) => ({ id: g.id, label: g.label, picks: byGroup.get(g.id) ?? 0 }))
    .filter((g) => g.picks > 0);

  let estUsd = 0;
  let priced = 0;
  let unpriced = 0;
  for (const p of picks) {
    if (p.cheapestUsd === null) unpriced += p.qty;
    else {
      estUsd += Number(p.cheapestUsd) * p.qty;
      priced += p.qty;
    }
  }

  return {
    picks,
    groups,
    notes,
    totals: {
      picks: totalQty,
      estUsd: priced > 0 ? Math.round(estUsd * 100) / 100 : null,
      unpriced,
    },
    seed: draft.seed,
  };
}
