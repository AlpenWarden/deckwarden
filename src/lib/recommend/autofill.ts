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
 *
 * Fit (AUTOFILL-TOTAL, the owner's idea 5 of 2026-11-24: "a spot to type
 * your total budget to keep the deck in that range"): with a deck total
 * (`fit`), once the shell is planned and built up, it is fitted under the
 * total. While the deck costs more, the priciest pick that has a cheaper
 * stand-in leaves and the best-ranked cheaper card of its own group comes in;
 * a base pick with no cheaper ranked card gives its slot to a filler. The
 * leaders and the kept cards never leave (their cost is handed in, since the
 * planner never sees them as picks); anything planned may, a locked staple,
 * a combo completion and a card the build-up brought in included: the total
 * wins over the target (the owner's decision 17). A card coming in has a
 * known price and passes the goals check like every other pick. Each swap
 * makes the deck cheaper and no card that left comes back while it runs, so
 * it ends: at or under the total, or where no pick has a cheaper stand-in,
 * which is the cheapest list these pools hold. The build-up then runs once
 * more, under the total: a card that counts comes in only where the deck
 * stays at or under it. Nothing is sampled, so a seed still means one list,
 * and with no total none of this runs.
 */
import { formatUsd } from "@/lib/collection/ownership";
import type { AutofillMeta, RecommendMeta } from "@/lib/games/types";
import { usdBeside } from "./budget";
import { deckCurve, type TournamentContext, type TournamentSignal } from "./rank";
import { mulberry32, sampleWeighted } from "./rng";
import type { ShellGoals, ShellMissing } from "./shell-goals";
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

/**
 * The deck is over its total (AUTOFILL-TOTAL): how far, and why. Two cases,
 * both said after the fit step ran out of cheaper cards.
 * - The leaders and the kept cards alone cost more than the total (`kept`
 *   over `totalUsd`): nothing Autofill picks can bring the deck under it, so
 *   the sentence names them, in the adapter's noun, and says what the picks
 *   are.
 * - Otherwise the picks themselves could not get low enough: the figure, how
 *   far over, and that no cheaper card fit.
 * Whole dollars, as every estimate here, except where that would hide the
 * gap ("$100 of your $100"). Cards with no known price are never counted as
 * $0: they are left out of the figure and counted in a closing sentence.
 */
export function overTotalNote(i: {
  totalUsd: number;
  /** The whole deck: the leaders, the kept cards and every pick, priced ones only. */
  deckUsd: number;
  /** The leaders and the kept cards, priced ones only. */
  keptUsd: number;
  /** Cards (copies) with no known price anywhere in the deck. */
  unpriced: number;
  /** The adapter's noun for a leader ("Commander"). */
  leaderNoun: string;
  leaders: number;
  /** Kept cards beside the leaders (copies). */
  keptCards: number;
  /** Whether Autofill planned any card: a full deck has no picks to speak of. */
  picked: boolean;
}): string {
  const total = formatUsd(i.totalUsd);
  const overCents = toCents(i.deckUsd) - toCents(i.totalUsd);
  const over = overCents < 100 ? `$${(overCents / 100).toFixed(2)}` : formatUsd(overCents / 100);
  const deck = usdBeside(i.deckUsd, i.totalUsd);
  const noPrice =
    i.unpriced > 0
      ? ` ${i.unpriced} ${i.unpriced === 1 ? "card" : "cards"} without a price ${i.unpriced === 1 ? "isn't" : "aren't"} counted.`
      : "";
  if (toCents(i.keptUsd) > toCents(i.totalUsd)) {
    const noun = i.leaderNoun.toLowerCase();
    const leaders = i.leaders === 1 ? `your ${noun}` : `your ${noun}s`;
    const kept = `the ${i.keptCards} ${i.keptCards === 1 ? "card" : "cards"} you kept`;
    const who = i.leaders === 0 ? kept : i.keptCards === 0 ? leaders : `${leaders} and ${kept}`;
    const comes = i.leaders + i.keptCards === 1 ? "comes" : "come";
    const head = `${who.charAt(0).toUpperCase()}${who.slice(1)} ${comes} to about ${usdBeside(i.keptUsd, i.totalUsd)}, already over your ${total} deck total.`;
    return i.picked
      ? `${head} Autofill picked the cheapest cards that fit, and the deck comes to about ${deck}.${noPrice}`
      : `${head}${noPrice}`;
  }
  return `With these added the deck comes to about ${deck}, ${over} over your ${total} deck total. Autofill found no cheaper cards that fit.${noPrice}`;
}

const toCents = (usd: number): number => Math.round(usd * 100);
/** A pg numeric-as-string price in cents; null = no known price. */
const centsOf = (usd: string | null): number | null => {
  if (usd === null) return null;
  const n = Number(usd);
  return Number.isFinite(n) ? toCents(n) : null;
};

/**
 * "reach": brought in after the plan because it counts toward the target
 * (AUTOFILL-REACH). "fit": brought in for a pricier pick of its group, to
 * fit the deck under its total (AUTOFILL-TOTAL).
 */
export type PickTier = "locked" | "combo" | "sampled" | "reach" | "fit" | "filler";

/** What the reach step did: counting cards brought in, and how many the shell is still short. */
export interface ShellReach {
  added: number;
  /** Still missing when nothing more could come in (no candidate that counts and fits, or no pick to replace). */
  short: number;
}

/** The deck total a shell is fitted under (AUTOFILL-TOTAL). */
export interface ShellFitInput {
  /** The total, in dollars: the whole deck at its cheapest printings. */
  totalUsd: number;
  /**
   * What never leaves, priced: the leaders and the kept cards at their
   * cheapest printings. One with no known price adds nothing here (the
   * caller counts it beside the figure).
   */
  keptUsd: number;
  /**
   * What one filler costs: the dearest the adapter may use for this deck, so
   * the fit never counts the fillers low. Null = no price known: no base
   * slot is given to a filler, and the caller counts them beside the figure.
   */
  fillerUsd: number | null;
}

/** What the fit step did (AUTOFILL-TOTAL). */
export interface ShellFit {
  /** Picks that left for a cheaper card of their own group. */
  swapped: number;
  /** Base picks whose slot went to a filler. */
  toFillers: number;
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
  /** The deck total the shell is fitted under (AUTOFILL-TOTAL); absent = no fit step. */
  fit?: ShellFitInput;
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
  /**
   * Set when the shell was short of its target after planning
   * (AUTOFILL-REACH); the route words it through the adapter. With a deck
   * total it is counted after the fit: the cards the build-up brought in
   * that the list still holds, and what it is short then.
   */
  reach?: ShellReach;
  /** Set when a deck total was given (AUTOFILL-TOTAL): what fitting under it changed. */
  fit?: ShellFit;
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
  /**
   * The whole deck against its total (AUTOFILL-TOTAL), present only when one
   * was given: the leaders and the kept cards (`keptUsd`, `keptUnpriced`)
   * plus every pick. `estUsd` leaves cards with no known price out and
   * `unpriced` counts them (copies). The note and any footer read these.
   */
  deck?: {
    totalUsd: number;
    estUsd: number;
    unpriced: number;
    keptUsd: number;
    keptUnpriced: number;
  };
  seed: number;
}

/** The deck's total and what never leaves, for `finishShell`'s figure and its note (AUTOFILL-TOTAL). */
export interface ShellTotalInput {
  totalUsd: number;
  /** The leaders and the kept cards at their cheapest printings, priced ones only. */
  keptUsd: number;
  /** How many of them (copies) have no known price. */
  keptUnpriced: number;
  /** The adapter's noun for a leader, for the note. */
  leaderNoun: string;
  leaders: number;
  /** Kept cards beside the leaders (copies). */
  keptCards: number;
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
  const colorlessIds = new Set(input.basePool.filter((r) => r.ciMask === 0).map((r) => r.cardId));
  const lastBucket = curve.buckets.length - 1;
  /** Every candidate with its group, best-ranked first: the curve pool, then the base pool. */
  const reachOrder = (): { rec: Recommendation; group: string }[] => {
    const order: { rec: Recommendation; group: string }[] = [];
    for (const rec of input.pool) {
      const bucket = curve.bucketOf({ primaryType: rec.primaryType, costValue: rec.costValue });
      if (bucket !== null) order.push({ rec, group: `curve-${Math.min(bucket, lastBucket)}` });
    }
    for (const rec of input.basePool) order.push({ rec, group: "base" });
    return order;
  };
  /**
   * The weakest pick of `group` that may leave (the later pick on a tie);
   * −1 = none. A sampled pick, or one the fit step brought in: a locked
   * staple, a combo completion and a card the build-up brought never do.
   */
  const weakestIn = (group: string, stays: (cardId: string) => boolean): number => {
    let at = -1;
    for (let k = 0; k < draft.picks.length; k++) {
      const p = draft.picks[k];
      if (p.group !== group || (p.tier !== "sampled" && p.tier !== "fit") || stays(p.cardId)) {
        continue;
      }
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

  let short = 0;
  if (goals?.missing) {
    const order = reachOrder();
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
        took = true;
        break;
      }
      if (!took) break;
    }
  }

  // Fit (AUTOFILL-TOTAL): the shell is planned and built up; now it is
  // fitted under the deck total. Money is counted in cents. Deterministic:
  // prices, rank order and scores, never `rand()`.
  if (input.fit) {
    const totalCents = toCents(input.fit.totalUsd);
    const keptCents = toCents(input.fit.keptUsd);
    const fillerCents = input.fit.fillerUsd === null ? null : toCents(input.fit.fillerUsd);
    const poolOf = (group: string): readonly Recommendation[] =>
      group === "base" ? baseOrdered : (byBucket[Number(group.slice("curve-".length))] ?? []);

    // What the fit moves: the picks (`draft.picks`, with `chosen` beside
    // them), which cards are in the list and which the fit took out, the
    // base's counts, and the deck's cost with fillers at `fillerCents`.
    let cost = keptCents + (needBase - baseTaken) * (fillerCents ?? 0);
    for (const p of draft.picks) cost += centsOf(p.cheapestUsd) ?? 0;
    let held = new Set(draft.picks.map((p) => p.cardId));
    /** Cards the fit took out: none comes back as a stand-in, so every run ends. */
    let gone = new Set<string>();
    let swapped = 0;
    let toFillers = 0;
    const snapshot = () => ({
      picks: [...draft.picks],
      chosen: [...chosen],
      held: new Set(held),
      gone: new Set(gone),
      colorlessUsed,
      baseTaken,
      cost,
      swapped,
      toFillers,
    });
    const restore = (s: ReturnType<typeof snapshot>) => {
      draft.picks = s.picks;
      chosen.length = 0;
      chosen.push(...s.chosen);
      held = s.held;
      gone = s.gone;
      colorlessUsed = s.colorlessUsed;
      baseTaken = s.baseTaken;
      cost = s.cost;
      swapped = s.swapped;
      toFillers = s.toFillers;
    };

    /**
     * One run of the fit: while the deck costs more than `limit`, the
     * priciest pick that has a cheaper stand-in leaves for the best-ranked
     * cheaper card of its own group (so the curve and the base count hold),
     * and a base pick with none gives its slot to a filler. A card coming in
     * has a known price and passes the goals check. With `keepTarget`, a
     * swap never leaves the list shorter of its target than it was: a card
     * the target needs (without it the list would be shorter) leaves only
     * for a cheaper card that counts and makes the list whole again.
     *
     * The goals are asked as seldom as the rule allows, since each ask reads
     * the whole list. A pick is judged only once a cheaper candidate turns
     * up for it. One with nothing cheaper left is done for the run: the
     * cheaper candidates only ever get fewer. One the target needs, with no
     * stand-in, is passed over, with two checks so that it is not passed
     * over for long once it is free to leave. The priciest of them is
     * judged again every round: a card that came in may hold the target by
     * another road (a combo it completed), and then the dear cards go first
     * and that road is what stays (measured: without this check a list lost
     * a target it could have kept). And before a run ends with nothing
     * moved, every one of them is judged once more. So a run ends only
     * where no swap the rule allows is left.
     */
    const fitDown = (keepTarget: boolean, limit: number): void => {
      let missingOf = keepTarget && goals?.missing ? goals.missing.bind(goals) : null;
      // What counts, by the kept list alone. Nothing can be missing where
      // that list already shows the target, or where no count shows it.
      const counting = missingOf ? missingOf([]) : null;
      if (!counting) missingOf = null;
      // What the list is short of its target now. No swap here lets it grow.
      let moreNow = missingOf ? (missingOf(chosen)?.more ?? 0) : 0;
      /** Picks with nothing cheaper left: done for the run. */
      const spent = new Set<string>();
      /** Picks the target needs that have no stand-in: passed over, for now. */
      const kept = new Set<string>();
      let rechecked = false;
      const settle = (out: string, into: string | null) => {
        if (!missingOf || !counting) return;
        if (counting.counts(out) !== (into !== null && counting.counts(into))) kept.clear();
        if (moreNow > 0) moreNow = missingOf(chosen)?.more ?? 0;
      };
      while (cost > limit) {
        // Priciest first; at one price the weaker pick, then the later one.
        const order = draft.picks
          .map((pick, at) => ({ pick, at, price: centsOf(pick.cheapestUsd) }))
          .filter((x): x is { pick: ShellPick; at: number; price: number } => x.price !== null)
          .sort((a, b) => b.price - a.price || a.pick.score - b.pick.score || b.at - a.at);
        let moved = false;
        // The priciest card passed over as needed is judged again every
        // round: a card that came in since may hold the target by another
        // road, and then the dear cards are the ones to go. Where it is
        // still needed, the rest of them wait.
        let watched = false;
        for (const { pick, at, price } of order) {
          if (spent.has(pick.cardId)) continue;
          const wasKept = kept.has(pick.cardId);
          if (wasKept) {
            if (watched) continue;
            watched = true;
          }
          const base = pick.group === "base";
          const leavingColorless = colorlessIds.has(pick.cardId);
          // The list as it would stand without the card that leaves: what
          // the goals check judges a stand-in against, and what says whether
          // the target needs this card. Worked out on first need.
          const judged: {
            list: readonly string[] | null;
            missing: ShellMissing | null;
            needed: boolean;
          } = { list: null, missing: null, needed: false };
          const judge = (): readonly string[] => {
            if (judged.list === null) {
              judged.list = goals ? chosen.filter((id) => id !== pick.cardId) : chosen;
              judged.missing = missingOf ? missingOf(judged.list) : null;
              judged.needed = judged.missing !== null && judged.missing.more > moreNow;
            }
            return judged.list;
          };
          if (wasKept) {
            // No longer needed: none of them is taken on trust any more.
            judge();
            if (!judged.needed) kept.clear();
          }
          let cheaper = false;
          let into: Recommendation | null = null;
          let intoCents = 0;
          for (const rec of poolOf(pick.group)) {
            if (held.has(rec.cardId) || gone.has(rec.cardId)) continue;
            const usd = centsOf(rec.cheapestUsd);
            if (usd === null || usd >= price) continue;
            cheaper = true;
            // The colorless-identity cap on the base, as the plan holds it.
            if (
              base &&
              colorlessIds.has(rec.cardId) &&
              !leavingColorless &&
              colorlessUsed >= autofill.base.maxColorlessIdentity
            ) {
              continue;
            }
            const list = judge();
            if (judged.needed && !judged.missing?.counts(rec.cardId)) continue;
            if (goals && goals.conflicts(rec.cardId, list).length > 0) continue;
            // In a needed card's place, a card that counts must also make the
            // list whole: where the card held the target by another road,
            // one more that counts may not.
            if (
              judged.needed &&
              missingOf &&
              (missingOf([...list, rec.cardId])?.more ?? 0) > moreNow
            ) {
              continue;
            }
            into = rec;
            intoCents = usd;
            break;
          }
          if (into) {
            // A card standing in for one the build-up brought, where the
            // target needs it, is there for the target too: it keeps the mark.
            draft.picks[at] = toPick(
              into,
              zone,
              pick.group,
              judged.needed && pick.tier === "reach" ? "reach" : "fit",
            );
            chosen[chosen.indexOf(pick.cardId)] = into.cardId;
            held.delete(pick.cardId);
            held.add(into.cardId);
            gone.add(pick.cardId);
            if (base) {
              colorlessUsed += (colorlessIds.has(into.cardId) ? 1 : 0) - (leavingColorless ? 1 : 0);
            }
            cost += intoCents - price;
            swapped += 1;
            settle(pick.cardId, into.cardId);
            moved = true;
            break;
          }
          // No cheaper ranked card for a base slot: a filler takes it, where
          // one is known to cost less.
          const fillerCheaper = base && fillerCents !== null && fillerCents < price;
          if (fillerCheaper) {
            judge();
            if (!judged.needed) {
              draft.picks.splice(at, 1);
              chosen.splice(chosen.indexOf(pick.cardId), 1);
              held.delete(pick.cardId);
              gone.add(pick.cardId);
              if (leavingColorless) colorlessUsed -= 1;
              baseTaken -= 1;
              cost += fillerCents - price;
              toFillers += 1;
              settle(pick.cardId, null);
              moved = true;
              break;
            }
          }
          if (judged.needed) kept.add(pick.cardId);
          else if (!cheaper && !fillerCheaper) spent.add(pick.cardId);
        }
        if (moved) {
          rechecked = false;
          continue;
        }
        if (kept.size === 0 || rechecked) break;
        kept.clear();
        rechecked = true;
      }
    };

    // First with the target kept: the cards it needs stay and everything
    // else gives way. Where that cannot reach the total, the total wins (the
    // owner's decision 17): the cards the target needs may leave too.
    fitDown(true, totalCents);
    if (cost > totalCents && goals?.missing) fitDown(false, totalCents);

    // The build-up once more, under the total. The list is what the fit
    // left, so a card that counts may come in again: the best-ranked that
    // the deck can afford, the rest making room where it must (a run of the
    // fit with the target kept). A try that cannot get back inside the limit
    // is undone. The limit is the total, or, for a deck that is over it
    // anyway, what it costs now: it never gets dearer.
    if (goals?.missing) {
      const ascending = new Map<string, number[]>();
      const pricesOf = (group: string): number[] => {
        let prices = ascending.get(group);
        if (!prices) {
          prices = poolOf(group)
            .map((r) => centsOf(r.cheapestUsd))
            .filter((c): c is number => c !== null)
            .sort((a, b) => a - b);
          ascending.set(group, prices);
        }
        return prices;
      };
      /**
       * The least the deck could cost with the cards that count held where
       * they are: each other priced pick at its group's cheapest candidates
       * (a base slot at a filler's price where that is less). Never more
       * than the fit can reach, so a try it rules out is skipped unrun.
       */
      const floorWith = (counts: (cardId: string) => boolean): number => {
        let floor = keptCents + (needBase - baseTaken) * (fillerCents ?? 0);
        const open = new Map<string, number>();
        for (const p of draft.picks) {
          const price = centsOf(p.cheapestUsd);
          if (price === null) continue;
          if (counts(p.cardId)) floor += price;
          else open.set(p.group, (open.get(p.group) ?? 0) + 1);
        }
        for (const [group, slots] of open) {
          const prices = pricesOf(group);
          for (let k = 0; k < slots; k++) {
            const cheapest = prices[k] ?? 0;
            floor +=
              group === "base" && fillerCents !== null ? Math.min(cheapest, fillerCents) : cheapest;
          }
        }
        return floor;
      };

      const order = reachOrder();
      for (;;) {
        const missing = goals.missing(chosen);
        short = missing?.more ?? 0;
        if (!missing) break;
        let took = false;
        for (const { rec, group } of order) {
          if (held.has(rec.cardId) || !missing.counts(rec.cardId)) continue;
          const usd = centsOf(rec.cheapestUsd);
          if (usd === null) continue;
          const atCap =
            group === "base" &&
            colorlessIds.has(rec.cardId) &&
            colorlessUsed >= autofill.base.maxColorlessIdentity;
          const out = leaverFor(
            group,
            atCap
              ? (id) => missing.counts(id) || !colorlessIds.has(id)
              : (id) => missing.counts(id),
          );
          if (out === -1) continue;
          const left = draft.picks[out];
          const without = chosen.filter((id) => id !== left.cardId);
          if (goals.conflicts(rec.cardId, without).length > 0) continue;
          const limit = Math.max(totalCents, cost);
          const before = snapshot();
          draft.picks[out] = toPick(rec, zone, group, "reach");
          chosen[chosen.indexOf(left.cardId)] = rec.cardId;
          held.delete(left.cardId);
          held.add(rec.cardId);
          gone.delete(rec.cardId);
          if (group === "base") {
            colorlessUsed +=
              (colorlessIds.has(rec.cardId) ? 1 : 0) - (colorlessIds.has(left.cardId) ? 1 : 0);
          }
          cost += usd - (centsOf(left.cheapestUsd) ?? 0);
          if (cost > limit && floorWith((id) => id === rec.cardId || missing.counts(id)) <= limit) {
            fitDown(true, limit);
          }
          if (cost <= limit) {
            took = true;
            break;
          }
          restore(before);
        }
        if (!took) break;
      }
    }
    draft.fit = { swapped, toFillers };
  }
  // What the build-up brought in that the list holds, and what it is short.
  const added = draft.picks.reduce((n, p) => n + (p.tier === "reach" ? 1 : 0), 0);
  if (added > 0 || short > 0) draft.reach = { added, short };

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
    /** AUTOFILL-TOTAL: the deck's total and what never leaves; the result gains `deck`, and a note when the deck is over. */
    total?: ShellTotalInput;
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

  // The whole deck against its total (AUTOFILL-TOTAL): what never leaves
  // plus every pick, fillers at their own prices. One figure, worked out
  // here, for the note and for whoever shows it; over the total, the note
  // says how far and why.
  let deck: ShellResult["deck"];
  const { total } = opts;
  if (total) {
    let pickCents = 0;
    for (const p of picks) pickCents += (centsOf(p.cheapestUsd) ?? 0) * p.qty;
    const deckCents = toCents(total.keptUsd) + pickCents;
    deck = {
      totalUsd: total.totalUsd,
      estUsd: deckCents / 100,
      unpriced: total.keptUnpriced + unpriced,
      keptUsd: toCents(total.keptUsd) / 100,
      keptUnpriced: total.keptUnpriced,
    };
    if (deckCents > toCents(total.totalUsd)) {
      notes.push(
        overTotalNote({
          totalUsd: total.totalUsd,
          deckUsd: deck.estUsd,
          keptUsd: deck.keptUsd,
          unpriced: deck.unpriced,
          leaderNoun: total.leaderNoun,
          leaders: total.leaders,
          keptCards: total.keptCards,
          picked: totalQty > 0,
        }),
      );
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
    ...(deck ? { deck } : {}),
    seed: draft.seed,
  };
}
