/**
 * AUTOFILL-TOTAL: the planner's fit step, on a MINI declaration (template 3
 * base + [2, 3, 2] curve = 10 slots, prices chosen so every figure is
 * checkable by hand). What it pins:
 *
 * - with no total, and with one the list is already inside, nothing moves;
 * - over the total, the priciest pick leaves for the best-ranked cheaper card
 *   of its own group, one at a time, and it stops as soon as the deck is at
 *   or under it: the size, each group's count and every other pick hold;
 * - a base pick with no cheaper ranked card gives its slot to a filler;
 * - the leaders' and kept cards' cost is counted, and they never leave;
 * - a card coming in has a known price; a pick without one stays and is
 *   counted beside the figure;
 * - where the total cannot be reached, every pick is the cheapest its group
 *   holds, and `finishShell` says how far over the deck is and why;
 * - nothing is sampled: `Math.random` never runs and a seed means one list;
 * - with a target (a stub: some cards count), every run of the fit starts
 *   from every card not in the list, so a list that ends over its total is
 *   the cheapest its pools hold, and one that can get under it does; and the
 *   build-up's floor prices a card that counts at the cheapest of its group
 *   that counts (the fixes of 2026-11-26: the reported case, the floor's
 *   case, and 3,000 seeded cases).
 *
 * The rest of the target's half (a target kept under a total, and the total
 * winning where both cannot hold) runs over the real Magic adapter in
 * ./autofill-goals.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AutofillMeta, RecommendMeta } from "@/lib/games/types";
import {
  buildShell,
  finishShell,
  overTotalNote,
  type FillerPick,
  type ShellDraft,
  type ShellInput,
  type ShellTotalInput,
} from "./autofill";
import type { ShellGoals } from "./shell-goals";
import type { Recommendation } from "./types";

const AUTOFILL: AutofillMeta = {
  base: {
    label: "Lands",
    source: "land-template",
    count: 3,
    scope: { column: "primary_type", op: "eq", value: "Land" },
    isBase: (card) => card.primaryType === "Land",
    rankedByColorCount: [1, 2, 3],
    maxColorlessIdentity: 1,
    fillerNames: ["Plains"],
    fillers: ({ n }) => (n > 0 ? [{ name: "Plains", qty: n, why: "basic filler" }] : []),
  },
  lockShare: 0.5,
  lockMinLists: 5,
  costTextOf: () => null,
  curveLabel: (label) => `Mana value ${label}`,
};

const CURVE: NonNullable<RecommendMeta["curve"]> = {
  source: "curve-template",
  buckets: [2, 3, 2],
  bucketOf: (card) =>
    card.primaryType === "Land" || card.costValue === null
      ? null
      : Math.min(2, Math.max(0, card.costValue)),
  evidence: () => ({ why: "gap" }),
};

let seq = 0;
/** A planned card: `score` 1. An also-ran, in rank order behind them: `score` 1e-6 and less. */
function rec(
  name: string,
  costValue: number | null,
  usd: string | null,
  score = 1,
): Recommendation {
  seq += 1;
  return {
    cardId: `00000000-0000-0000-0000-${String(seq).padStart(12, "0")}`,
    name,
    primaryType: costValue === null ? "Land" : "Creature",
    costValue,
    // Colored, so the base's colorless cap never comes into it.
    ciMask: 1,
    cheapestUsd: usd,
    popularity: seq,
    score,
    confidence: "high",
    evidence: [{ source: "edhrec_rank", why: "why", with: [], howOften: null, confidence: "high" }],
  };
}
const alsoRan = (name: string, costValue: number | null, usd: string | null, rank: number) =>
  rec(name, costValue, usd, 1e-6 / rank);

// Mana value 0 (two slots), 1 (three) and 2 (two): the planned cards first,
// then the also-rans in rank order. A sampling window is twice the need, so
// each bucket's window is its planned cards and as many also-rans, and the
// weights (1 against a millionth) leave the sample no real choice.
const a0 = rec("A0", 0, "10.00");
const b0 = rec("B0", 0, "1.00");
const c0 = alsoRan("C0", 0, "5.00", 1);
const d0 = alsoRan("D0", 0, "0.50", 2);
const a1 = rec("A1", 1, "20.00");
const b1 = rec("B1", 1, "2.00");
const c1 = rec("C1", 1, "3.00");
const d1 = alsoRan("D1", 1, "8.00", 1);
const e1 = alsoRan("E1", 1, "1.00", 2);
const f1 = alsoRan("F1", 1, "0.25", 3);
// Never planned (outside the window) and dearer than every pick of its group:
// no fit may bring it in, least of all where nothing cheaper is left.
const g1 = alsoRan("G1", 1, "50.00", 4);
const a2 = rec("A2", 2, "4.00");
const b2 = rec("B2", 2, "6.00");
const c2 = alsoRan("C2", 2, "0.75", 1);
const d2 = alsoRan("D2", 2, "0.10", 2);
const POOL = [a0, b0, c0, d0, a1, b1, c1, d1, e1, f1, g1, a2, b2, c2, d2];
// The base takes its ranked cards in score order: three slots, three lands.
const l1 = rec("L1", null, "30.00", 0.9);
const l2 = rec("L2", null, "2.00", 0.8);
const l3 = rec("L3", null, "1.00", 0.7);
const l4 = rec("L4", null, null, 0.6);
const l5 = rec("L5", null, "0.50", 0.5);
const LANDS = [l1, l2, l3, l4, l5];

/** The list with no total: $79.00 of picks. */
const PLANNED = [a0, b0, a1, b1, c1, a2, b2, l1, l2, l3];
const PLANNED_USD = 79;

function input(over: Partial<ShellInput> = {}): ShellInput {
  return {
    autofill: AUTOFILL,
    curve: CURVE,
    slots: 10,
    keep: [],
    ciMask: 3,
    pool: POOL,
    basePool: LANDS,
    tournamentContext: null,
    tournamentsByCandidate: new Map(),
    comboCandidateIds: new Set(),
    zone: "main",
    seed: 42,
    ...over,
  };
}
const fit = (totalUsd: number, keptUsd = 0, fillerUsd: number | null = 0.1) => ({
  fit: { totalUsd, keptUsd, fillerUsd },
});
const names = (draft: ShellDraft) => draft.picks.map((p) => p.name);
const usdOf = (draft: ShellDraft) =>
  draft.picks.reduce((sum, p) => sum + Math.round(Number(p.cheapestUsd ?? 0) * 100), 0) / 100;
const groupCounts = (draft: ShellDraft) => {
  const counts: Record<string, number> = {};
  for (const p of draft.picks) counts[p.group] = (counts[p.group] ?? 0) + 1;
  return counts;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the fit step: a deck total the shell is fitted under (AUTOFILL-TOTAL)", () => {
  it("the fixture plans what it says: ten picks, $79.00, no fillers", () => {
    const draft = buildShell(input());
    expect(names(draft).sort()).toEqual(PLANNED.map((r) => r.name).sort());
    expect(usdOf(draft)).toBe(PLANNED_USD);
    expect(draft.fillerNeed).toBe(0);
    expect(draft.fit).toBeUndefined();
  });

  it("a total the list is already inside moves nothing: the same picks, in place, and no swap counted", () => {
    const plain = buildShell(input());
    for (const total of [79, 80, 1000]) {
      const draft = buildShell(input(fit(total)));
      expect(draft.picks).toEqual(plain.picks);
      expect(draft.fillerNeed).toBe(plain.fillerNeed);
      expect(draft.fit).toEqual({ swapped: 0, toFillers: 0 });
    }
  });

  it("over the total, the priciest pick leaves for the best-ranked cheaper card of its group, and it stops there", () => {
    const plain = buildShell(input());
    // $79.00 against $60: L1 ($30) is the priciest. L4 ranks next among the
    // lands but has no known price, so L5 ($0.50) comes in: $49.50.
    const draft = buildShell(input(fit(60)));
    expect(draft.fit).toEqual({ swapped: 1, toFillers: 0 });
    expect(usdOf(draft)).toBe(49.5);
    const at = plain.picks.findIndex((p) => p.name === "L1");
    expect(draft.picks[at]).toMatchObject({ name: "L5", group: "base", tier: "fit", zone: "main" });
    // Every other pick is the planned one, in its place.
    expect(draft.picks.filter((_, k) => k !== at)).toEqual(plain.picks.filter((_, k) => k !== at));
    expect(draft.fillerNeed).toBe(0);
  });

  it("one swap at a time, priciest first, each from its own group: the size and every group's count hold", () => {
    const plain = buildShell(input());
    // $79.00 against $30:
    //   L1 $30 → L5 $0.50 (base)           $49.50
    //   A1 $20 → D1 $8, the best-ranked cheaper card at mana value 1   $37.50
    //   A0 $10 → C0 $5 (mana value 0)      $32.50
    //   D1 $8  → E1 $1 (A1 never comes back, and it is dearer anyway)   $25.50
    const draft = buildShell(input(fit(30)));
    expect(draft.fit).toEqual({ swapped: 4, toFillers: 0 });
    expect(usdOf(draft)).toBe(25.5);
    expect(names(draft).sort()).toEqual(
      ["C0", "B0", "E1", "B1", "C1", "A2", "B2", "L5", "L2", "L3"].sort(),
    );
    expect(draft.picks).toHaveLength(plain.picks.length);
    expect(groupCounts(draft)).toEqual(groupCounts(plain));
    // What came in is marked, and stands where the card it replaced stood.
    for (const [out, into] of [
      ["L1", "L5"],
      ["A1", "E1"],
      ["A0", "C0"],
    ]) {
      const at = plain.picks.findIndex((p) => p.name === out);
      expect(draft.picks[at]).toMatchObject({
        name: into,
        tier: "fit",
        group: plain.picks[at].group,
      });
    }
    // It stopped at the first list inside the total: B2 ($6) had a cheaper stand-in too.
    expect(names(draft)).toContain("B2");
  });

  it("a base pick with no cheaper ranked card gives its slot to a filler, where a filler costs less", () => {
    // Without L5 the lands hold nothing cheaper than L1 with a known price.
    const lands = [l1, l2, l3, l4];
    const plain = buildShell(input({ basePool: lands }));
    const draft = buildShell(input({ basePool: lands, ...fit(60) }));
    expect(draft.fit).toEqual({ swapped: 0, toFillers: 1 });
    expect(names(draft)).not.toContain("L1");
    expect(draft.picks).toHaveLength(plain.picks.length - 1);
    // The base still fills its three slots: two ranked cards and one filler.
    expect(draft.fillerNeed).toBe(1);
    expect(groupCounts(draft).base).toBe(2);

    // No known price for a filler: no slot is given to one, and the next
    // priciest pick with a stand-in goes: A1 → D1, A0 → C0, and so on.
    const unpricedFiller = buildShell(input({ basePool: lands, ...fit(60, 0, null) }));
    expect(unpricedFiller.fit?.toFillers).toBe(0);
    expect(names(unpricedFiller)).toContain("L1");
    expect(unpricedFiller.fillerNeed).toBe(0);
    // A filler that costs as much as the card: nothing to gain, so it stays.
    const dearFiller = buildShell(input({ basePool: lands, ...fit(60, 0, 30) }));
    expect(names(dearFiller)).toContain("L1");
  });

  it("the fillers the plan already needs are counted at the filler's price", () => {
    // One color: two ranked lands (L1, L2) and one filler. $78.00 of picks,
    // plus the filler at $0.10 by the fit's count.
    const plain = buildShell(input({ ciMask: 1 }));
    expect(plain.fillerNeed).toBe(1);
    expect(usdOf(plain)).toBe(78);
    // Inside to the cent with the filler counted; a cent short and it must swap.
    expect(buildShell(input({ ciMask: 1, ...fit(78.1) })).fit?.swapped).toBe(0);
    expect(buildShell(input({ ciMask: 1, ...fit(78.09) })).fit?.swapped).toBe(1);
  });

  it("the leaders and the kept cards never leave, and their cost counts", () => {
    // The same list fits $79 alone and is $10 over it with $10 of kept cards.
    expect(buildShell(input(fit(79, 0))).fit?.swapped).toBe(0);
    const draft = buildShell(input(fit(79, 10)));
    expect(draft.fit).toEqual({ swapped: 1, toFillers: 0 });
    expect(usdOf(draft)).toBe(49.5);
  });

  it("a card coming in has a known price; a pick without one stays and never counts as $0 spent", () => {
    // L4 ranks ahead of L5 and is skipped (the swap test above). Here a
    // planned card has no price: it is never the priciest, so it stays.
    const pool = POOL.map((r) => (r === a1 ? { ...r, cheapestUsd: null } : r));
    const draft = buildShell(input({ pool, ...fit(1) }));
    expect(names(draft)).toContain("A1");
    const shell = finishShell(draft, [], { zone: "main" });
    expect(shell.totals.unpriced).toBe(1);
  });

  it("where the total cannot be reached it ends at the cheapest list the pools hold: no pick has a cheaper stand-in left", () => {
    const draft = buildShell(input(fit(1)));
    const held = new Set(draft.picks.map((p) => p.cardId));
    const cents = (usd: string | null) => (usd === null ? null : Math.round(Number(usd) * 100));
    for (const pick of draft.picks) {
      const pool =
        pick.group === "base" ? LANDS : POOL.filter((r) => `curve-${r.costValue}` === pick.group);
      const cheaper = pool.filter(
        (r) =>
          !held.has(r.cardId) &&
          cents(r.cheapestUsd) !== null &&
          cents(r.cheapestUsd)! < cents(pick.cheapestUsd)!,
      );
      expect(cheaper.map((r) => r.name)).toEqual([]);
      // A ranked base card stays only where a filler costs no less.
      if (pick.group === "base") expect(cents(pick.cheapestUsd)!).toBeLessThanOrEqual(10);
    }
    // A stand-in is always cheaper: G1 ($50) is free at mana value 1 and stays out.
    expect(names(draft)).not.toContain("G1");
    // Mana value 0: B0 $1 and D0 $0.50. Mana value 1: B1 $2, E1 $1, F1 $0.25.
    // Mana value 2: C2 $0.75 and D2 $0.10. The lands all give way to fillers
    // at $0.10 (L5 at $0.50 too).
    expect(names(draft).sort()).toEqual(["B0", "D0", "B1", "E1", "F1", "C2", "D2"].sort());
    expect(draft.fillerNeed).toBe(3);
    expect(usdOf(draft)).toBe(5.6);
  });

  it("anything Autofill planned may leave: a locked staple and a combo completion give way like any pick", () => {
    // A1 ($20) as a measured staple and A0 ($10) as a combo completion: both
    // are planned first by their tiers, and both are among the priciest.
    const tiers = {
      tournamentContext: { commanderNames: ["Test Commander"], lists: 10, since: null },
      tournamentsByCandidate: new Map([[a1.cardId, { lists: 9, top4: 4 }]]),
      comboCandidateIds: new Set([a0.cardId]),
    };
    const plain = buildShell(input(tiers));
    const tierOf = (draft: ShellDraft, name: string) =>
      draft.picks.find((p) => p.name === name)?.tier;
    expect(tierOf(plain, "A1")).toBe("locked");
    expect(tierOf(plain, "A0")).toBe("combo");
    const draft = buildShell(input({ ...tiers, ...fit(30) }));
    expect(names(draft)).not.toContain("A1");
    expect(names(draft)).not.toContain("A0");
    expect(usdOf(draft)).toBe(25.5);
  });

  it("nothing is sampled: Math.random never runs, and the same ask gives the same list", () => {
    const random = vi.spyOn(Math, "random");
    const first = buildShell(input(fit(30)));
    const second = buildShell(input(fit(30)));
    expect(second).toEqual(first);
    expect(random).not.toHaveBeenCalled();
    // Another seed plans the same heavy cards here, so it fits the same way.
    expect(names(buildShell(input({ seed: 7, ...fit(30) }))).sort()).toEqual(names(first).sort());
  });

  it("a full deck plans nothing, with or without a total", () => {
    const draft = buildShell(input({ slots: 0, ...fit(1, 500) }));
    expect(draft.full).toBe(true);
    expect(draft.picks).toEqual([]);
    expect(draft.fit).toBeUndefined();
  });
});

describe("finishShell with a total: one figure for the whole deck, and the note when it is over", () => {
  const total = (over: Partial<ShellTotalInput> = {}): ShellTotalInput => ({
    totalUsd: 100,
    keptUsd: 0,
    keptUnpriced: 0,
    leaderNoun: "Commander",
    leaders: 1,
    keptCards: 0,
    ...over,
  });
  const plains = (qty: number, usd: string | null = "0.10"): FillerPick[] => [
    { cardId: "plains", name: "Plains", qty, cheapestUsd: usd, why: "basic filler" },
  ];

  it("without a total the result has no `deck` and no note about one", () => {
    const shell = finishShell(buildShell(input()), [], { zone: "main" });
    expect(shell.deck).toBeUndefined();
    expect(shell.notes).toEqual([]);
  });

  it("the figure is what never leaves plus every pick, fillers at their own prices; inside the total it says nothing", () => {
    const draft = buildShell(input({ ciMask: 1, ...fit(100, 12.34) }));
    const shell = finishShell(draft, plains(1, "0.07"), {
      zone: "main",
      total: total({ keptUsd: 12.34 }),
    });
    // $78.00 of ranked picks, one filler at its own $0.07 (the fit counted
    // it at $0.10, the dearest it could be), $12.34 of kept cards.
    expect(shell.deck).toEqual({
      totalUsd: 100,
      estUsd: 90.41,
      unpriced: 0,
      keptUsd: 12.34,
      keptUnpriced: 0,
    });
    expect(shell.totals.estUsd).toBe(78.07);
    expect(shell.notes).toEqual([]);
  });

  it("exactly at the total is inside it; a cent over is over", () => {
    const at = finishShell(buildShell(input()), [], {
      zone: "main",
      total: total({ totalUsd: 79 }),
    });
    expect(at.notes).toEqual([]);
    const over = finishShell(buildShell(input()), [], {
      zone: "main",
      total: total({ totalUsd: 79, keptUsd: 0.01 }),
    });
    expect(over.notes).toEqual([
      "With these added the deck comes to about $79.01, $0.01 over your $79 deck total. Autofill found no cheaper cards that fit.",
    ]);
  });

  it("over the total with the picks at their cheapest: how far over, and that nothing cheaper fit", () => {
    const draft = buildShell(input(fit(1)));
    const shell = finishShell(draft, plains(3), { zone: "main", total: total({ totalUsd: 1 }) });
    // $5.60 of ranked picks and three fillers at $0.10.
    expect(shell.deck?.estUsd).toBe(5.9);
    expect(shell.notes).toEqual([
      "With these added the deck comes to about $6, $5 over your $1 deck total. Autofill found no cheaper cards that fit.",
    ]);
  });

  it("the plan's edge case: a $40 commander, twelve kept cards worth $30 and a $50 total", () => {
    // Over before the first pick: the note says so and names them, and the
    // picks are the cheapest that fit.
    const draft = buildShell(input(fit(50, 70)));
    const cheapest = buildShell(input(fit(1)));
    expect(names(draft)).toEqual(names(cheapest));
    const shell = finishShell(draft, plains(3), {
      zone: "main",
      total: total({ totalUsd: 50, keptUsd: 70, keptCards: 12 }),
    });
    expect(shell.deck).toMatchObject({ estUsd: 75.9, keptUsd: 70 });
    expect(shell.notes).toEqual([
      "Your commander and the 12 cards you kept come to about $70, already over your $50 deck total. Autofill picked the cheapest cards that fit, and the deck comes to about $76.",
    ]);
  });

  it("a full deck over its total: nothing was planned, so the note names what is kept and says nothing of picks", () => {
    const draft = buildShell(input({ slots: 0, ...fit(100, 640) }));
    const shell = finishShell(draft, [], {
      zone: "main",
      total: total({ keptUsd: 640, keptCards: 99 }),
    });
    expect(shell.picks).toEqual([]);
    expect(shell.deck).toMatchObject({ estUsd: 640, keptUsd: 640, totalUsd: 100 });
    expect(shell.notes).toEqual([
      "The deck is already full. Nothing to add.",
      "Your commander and the 99 cards you kept come to about $640, already over your $100 deck total.",
    ]);
    // Inside its total, a full deck says only that it is full.
    const inside = finishShell(draft, [], {
      zone: "main",
      total: total({ totalUsd: 700, keptUsd: 640, keptCards: 99 }),
    });
    expect(inside.notes).toEqual(["The deck is already full. Nothing to add."]);
  });

  it("cards with no known price are left out of the figure and counted beside it", () => {
    const pool = POOL.map((r) => (r === a1 ? { ...r, cheapestUsd: null } : r));
    const draft = buildShell(input({ pool, ...fit(1) }));
    const shell = finishShell(draft, plains(3, null), {
      zone: "main",
      total: total({ totalUsd: 1, keptUnpriced: 1 }),
    });
    // A1, the three fillers and one kept card: five without a price.
    expect(shell.deck?.unpriced).toBe(5);
    expect(shell.notes[0]).toMatch(/ 5 cards without a price aren't counted\.$/);
  });
});

describe("overTotalNote: the exact words", () => {
  const base = {
    totalUsd: 100,
    deckUsd: 131.2,
    keptUsd: 20,
    unpriced: 0,
    leaderNoun: "Commander",
    leaders: 1,
    keptCards: 0,
    picked: true,
  };

  it("the picks could not get low enough", () => {
    expect(overTotalNote(base)).toBe(
      "With these added the deck comes to about $131, $31 over your $100 deck total. Autofill found no cheaper cards that fit.",
    );
    // Whole dollars would read as the total itself: the cents show.
    expect(overTotalNote({ ...base, deckUsd: 100.4 })).toBe(
      "With these added the deck comes to about $100.40, $0.40 over your $100 deck total. Autofill found no cheaper cards that fit.",
    );
    expect(overTotalNote({ ...base, totalUsd: 1500, deckUsd: 2750 })).toBe(
      "With these added the deck comes to about $2,750, $1,250 over your $1,500 deck total. Autofill found no cheaper cards that fit.",
    );
  });

  it("what never leaves is over the total by itself: it is named, in the adapter's noun", () => {
    const over = { ...base, totalUsd: 50, deckUsd: 82, keptUsd: 70 };
    expect(overTotalNote(over)).toBe(
      "Your commander comes to about $70, already over your $50 deck total. Autofill picked the cheapest cards that fit, and the deck comes to about $82.",
    );
    expect(overTotalNote({ ...over, leaders: 2 })).toBe(
      "Your commanders come to about $70, already over your $50 deck total. Autofill picked the cheapest cards that fit, and the deck comes to about $82.",
    );
    expect(overTotalNote({ ...over, keptCards: 1 })).toBe(
      "Your commander and the 1 card you kept come to about $70, already over your $50 deck total. Autofill picked the cheapest cards that fit, and the deck comes to about $82.",
    );
    expect(overTotalNote({ ...over, leaderNoun: "Leader", keptCards: 12 })).toBe(
      "Your leader and the 12 cards you kept come to about $70, already over your $50 deck total. Autofill picked the cheapest cards that fit, and the deck comes to about $82.",
    );
    // A full deck: nothing was picked, so nothing is said of picks.
    expect(overTotalNote({ ...over, keptCards: 99, picked: false, deckUsd: 70 })).toBe(
      "Your commander and the 99 cards you kept come to about $70, already over your $50 deck total.",
    );
    // A cent over reads as cents, never as the total itself.
    expect(overTotalNote({ ...over, keptUsd: 50.3, deckUsd: 60 })).toMatch(
      /^Your commander comes to about \$50\.30, already over your \$50 deck total\./,
    );
  });

  it("cards without a price close the note, counted", () => {
    expect(overTotalNote({ ...base, unpriced: 1 })).toMatch(
      / Autofill found no cheaper cards that fit\. 1 card without a price isn't counted\.$/,
    );
    expect(overTotalNote({ ...base, unpriced: 3 })).toMatch(
      / 3 cards without a price aren't counted\.$/,
    );
  });

  it("U9's marks: no dash aside, no middle dot, and it names no game term of its own", () => {
    const lines = [
      overTotalNote(base),
      overTotalNote({ ...base, totalUsd: 50, keptUsd: 70, keptCards: 12, unpriced: 2 }),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/[—–·]/);
      expect(line).not.toMatch(/Game Changer|Bracket|land|mana/i);
    }
  });
});

/**
 * A target under a total: every run of the fit starts from every card that is
 * not in the list (found 2026-11-26 by a review of the shipped fit). The cards
 * one run takes out stay out for the rest of that run, which is what lets it
 * pass over a pick with nothing cheaper left; the next run may bring them back.
 * Before, they stayed out of every later run: the run where the total wins could
 * not put a card the run with the target kept had taken out in a Game Changer's
 * place, and a list ended over its total, saying no cheaper card fit, although
 * one under it existed. With that fixed, the corpus showed a second gap the old
 * runs had hidden: the build-up's floor held a card that counts at its own
 * price, though the fit may swap it for a cheaper one that counts, so a try
 * that would fit was skipped and a target that fit was not shown. Goals here
 * are a stub: some cards count, the target needs a number of them, nothing
 * conflicts.
 */
describe("the fit with a target: every run starts from every card not in the list", () => {
  const NO_BASE: AutofillMeta = {
    ...AUTOFILL,
    base: { ...AUTOFILL.base, count: 0, rankedByColorCount: [0, 0, 0] },
  };
  const needs = (n: number, counting: ReadonlySet<string>): ShellGoals => ({
    conflicts: () => [],
    missing: (picks) => {
      const have = picks.filter((id) => counting.has(id)).length;
      return have >= n ? null : { more: n - have, counts: (id) => counting.has(id) };
    },
  });

  it("the reported case: the total wins with a card the first run took out, and no note says nothing fit", () => {
    // One mana value, two slots. GC ($50) is the only card that counts, and
    // the target needs one; X ($5) is planned beside it; Y ($3) and Z ($1)
    // rank behind them, Y first.
    const gc = rec("GC", 0, "50.00");
    const x = rec("X", 0, "5.00");
    const y = alsoRan("Y", 0, "3.00", 1);
    const z = alsoRan("Z", 0, "1.00", 2);
    const shell = (over: Partial<ShellInput> = {}) =>
      buildShell(
        input({
          autofill: NO_BASE,
          curve: { ...CURVE, buckets: [2], bucketOf: () => 0 },
          slots: 2,
          pool: [gc, x, y, z],
          basePool: [],
          goals: needs(1, new Set([gc.cardId])),
          ...over,
        }),
      );
    expect(names(shell()).sort()).toEqual(["GC", "X"]);

    // $10: the run with GC kept takes X out for Y, then Y for Z, and still
    // costs $51; the run where the total wins puts X back in GC's place.
    const draft = shell(fit(10, 0, null));
    expect(names(draft).sort()).toEqual(["X", "Z"]);
    expect(usdOf(draft)).toBe(6);
    expect(draft.fit).toEqual({ swapped: 3, toFillers: 0 });
    // The target did not fit, and the list says so; nothing says it is over.
    expect(draft.reach).toEqual({ added: 0, short: 1 });
    const finished = finishShell(draft, [], {
      zone: "main",
      total: {
        totalUsd: 10,
        keptUsd: 0,
        keptUnpriced: 0,
        leaderNoun: "Commander",
        leaders: 1,
        keptCards: 0,
      },
    });
    expect(finished.deck?.estUsd).toBe(6);
    expect(finished.notes.join(" ")).not.toMatch(/deck total/);

    // Where the target fits, it is kept: at $54, X gives way to Y and GC stays.
    const kept = shell(fit(54, 0, null));
    expect(names(kept).sort()).toEqual(["GC", "Y"]);
    expect(usdOf(kept)).toBe(53);
    expect(kept.reach).toBeUndefined();
  });

  it("the build-up's floor counts a card that counts at the cheapest of its group that counts: one it took may give way to make room for the next", () => {
    // Four mana values of one slot. The target needs two cards that count.
    // GX and GY ($50 each) are planned and count; nothing cheaper in their
    // groups counts. GA ($9) and GA2 ($4) count beside A ($1); GB ($6)
    // counts beside B ($1).
    const gx = rec("GX", 0, "50.00");
    const x2 = alsoRan("X2", 0, "1.00", 1);
    const gy = rec("GY", 1, "50.00");
    const y2 = alsoRan("Y2", 1, "1.00", 1);
    const a = rec("A", 2, "1.00");
    const ga = alsoRan("GA", 2, "9.00", 1);
    const ga2 = alsoRan("GA2", 2, "4.00", 2);
    const b = rec("B", 3, "1.00");
    const gb = alsoRan("GB", 3, "6.00", 1);
    const counting = new Set([gx, gy, ga, ga2, gb].map((r) => r.cardId));
    const shell = (over: Partial<ShellInput> = {}) =>
      buildShell(
        input({
          autofill: NO_BASE,
          curve: { ...CURVE, buckets: [1, 1, 1, 1], bucketOf: (card) => card.costValue },
          slots: 4,
          pool: [gx, x2, gy, y2, a, ga, b, gb, ga2],
          basePool: [],
          goals: needs(2, counting),
          ...over,
        }),
      );
    expect(names(shell()).sort()).toEqual(["A", "B", "GX", "GY"]);

    // $14: the run with the target kept cannot get under it ($102), the
    // total wins (GX and GY give way: $4), and the build-up brings GA in for
    // A ($12). GB in B's place costs $17, which fits only if GA gives way to
    // GA2; the floor of that try is $12, so it runs, and the target shows.
    const draft = shell(fit(14, 0, null));
    expect(names(draft).sort()).toEqual(["GA2", "GB", "X2", "Y2"]);
    expect(usdOf(draft)).toBe(12);
    expect(draft.reach).toEqual({ added: 2, short: 0 });
  });

  it("a list that ends over its total is the cheapest its pools hold, and one that can get under it does (3,000 seeded cases)", () => {
    // Shallow pools, where the runs' set-aside cards matter: one to three
    // mana values of one to three slots, each with up to two more candidates
    // a slot, every card priced, a fifth of them counting, a target of one or
    // two, and a total from 3 % to 130 % of the list planned without one.
    let state = 20261126;
    const rand = () => {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));
    const cents = (r: Recommendation) => Math.round(Number(r.cheapestUsd) * 100);

    let overButReachable = 0;
    let overAndDearer = 0;
    let fitted = 0;
    for (let n = 0; n < 3000; n++) {
      const buckets = Array.from({ length: int(1, 3) }, () => int(1, 3));
      const pool: Recommendation[] = [];
      const byBucket: Recommendation[][] = buckets.map(() => []);
      buckets.forEach((slots, b) => {
        const count = slots + int(0, slots * 2);
        for (let k = 0; k < count; k++) {
          const card = rec(`B${b}-${k}`, b, (0.1 + rand() * 59.9).toFixed(2), rand());
          pool.push(card);
          byBucket[b].push(card);
        }
      });
      const counting = new Set(pool.filter(() => rand() < 0.2).map((r) => r.cardId));
      const base = {
        autofill: NO_BASE,
        curve: {
          ...CURVE,
          buckets,
          bucketOf: (card: { costValue: number | null }) => card.costValue,
        },
        slots: buckets.reduce((a, b) => a + b, 0),
        pool: [...pool].sort((a, b) => b.score - a.score),
        basePool: [],
        goals: needs(int(1, 2), counting),
        seed: n,
      };
      const planned = buildShell(input(base));
      const plannedCents = planned.picks.reduce(
        (sum, p) => sum + Math.round(Number(p.cheapestUsd) * 100),
        0,
      );
      const totalUsd = Math.max(1, Math.round(plannedCents * (0.03 + rand() * 1.27))) / 100;
      const draft = buildShell(input({ ...base, ...fit(totalUsd, 0, null) }));
      fitted += 1;

      // The size holds. (A group's count may not: the build-up can take the
      // nearest mana value's slot, AUTOFILL-REACH's rule.)
      expect(draft.picks).toHaveLength(planned.picks.length);
      // The cheapest list its pools hold, in the shape the fit started from:
      // each mana value's own cheapest cards. The fit swaps within a group,
      // so a list the build-up did not reshape ends at it or under its total.
      let floor = 0;
      for (const [group, slots] of Object.entries(groupCounts(planned))) {
        const prices = byBucket[Number(group.slice("curve-".length))]
          .map(cents)
          .sort((a, b) => a - b);
        floor += prices.slice(0, slots).reduce((a, b) => a + b, 0);
      }
      const cost = Math.round(usdOf(draft) * 100);
      const totalCents = Math.round(totalUsd * 100);
      // Over its total only where that cheapest list is too, and then never
      // dearer than it: "no cheaper cards fit" is true when the note says it.
      if (cost > totalCents && floor <= totalCents) overButReachable += 1;
      if (cost > totalCents && cost > floor) overAndDearer += 1;
    }
    expect(fitted).toBe(3000);
    expect({ overButReachable, overAndDearer }).toEqual({ overButReachable: 0, overAndDearer: 0 });
  });
});
