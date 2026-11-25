// @vitest-environment node
/**
 * POST /api/decks/autofill — the route's first test (Y6b, WAVE4 D7), over
 * mocked IO with the REAL planner and the real Magic adapter: the gathers,
 * the facts, the tournament read, the combo read, the fillers and the wires
 * are stand-ins, so these pin what the ROUTE decides about goals:
 *
 * - with no target (goals absent, goals without one, a budget alone) the
 *   shell is the no-goals plan exactly and no combo read runs;
 * - a target checks the body against the game (400 "Invalid goals" before
 *   any read), reads the entry facts with the adapter's flags, loads every
 *   combo complete within keep ∪ the pool (one read), keeps the shell inside
 *   the target, and says what it kept out — counted against the same seed's
 *   no-goals shell;
 * - the lock tier: on with no target and at 4, off at 3 and below;
 * - a target of 4 or 5 changes no pick.
 *
 * The live halves are smoke:autofill's goal cases and the seed-1,234,567
 * shell recorded before and after.
 *
 * AUTOFILL-OWNED (`ownedOnly`), with the session and the collection check
 * as stand-ins too:
 *
 * - without the flag nothing about the player is read, both gathers get the
 *   options they always got, and the answer has no `owned`;
 * - with it the answer is a filtered list or none: 401 signed out, 409 with
 *   no collection, 429 past the player's own limit, each before anything is
 *   read for the list;
 * - a collector's ask hands both gathers the player and no per-card budget,
 *   says `owned.applied`, and leads its notes with the adapter's line about
 *   the fillers;
 * - a collection too small for the deck gets exactly its cards and the
 *   fillers, the open slots counted, and at a target the reach note says
 *   where Autofill found no more.
 *
 * The live half is smoke:collection's owned checks.
 *
 * AUTOFILL-TOTAL (`totalUsd`), with the pools, the entry facts and the
 * fillers priced by the test:
 *
 * - without it nothing runs: no `deck` in the answer, the fillers read once;
 * - with it the answer carries the whole deck's figure against the total
 *   (the commander, the kept cards and every pick), and that figure is the
 *   list's own; inside the total the picks are the plan's;
 * - over it the list is fitted, or a note says how far over and why, naming
 *   the commander and the kept cards when they alone are over;
 * - a card with no known price is counted beside the figure;
 * - under a total a target is kept where it fits, and the reach notes are
 *   counted after the fit and name the total;
 * - `ownedOnly` ignores it, and a total that is no amount is a 400.
 *
 * The live half is smoke:autofill's two examples.
 */
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GAME_ID } from "@/db/seed-data";
import type { MtgAttrs } from "@/lib/games/mtg/attrs";
import { mtgAdapter } from "@/lib/games/mtg/adapter";
import { mtgShellNotes } from "@/lib/games/mtg/brackets";
import { mtgAutofill } from "@/lib/games/mtg/recommend";
import { card, type MtgCard } from "@/lib/games/mtg/test-fixtures";
import type { RateLimit } from "@/lib/rate-limit";
import type { CandidateCard } from "@/lib/recommend/types";

const mocks = vi.hoisted(() => ({
  loadEntryFacts: vi.fn(),
  loadFillerRows: vi.fn(),
  loadTournamentSignals: vi.fn(),
  gatherSignals: vi.fn(),
  loadCompleteCombos: vi.fn(),
  loadCardWires: vi.fn(),
  enforceRateLimit: vi.fn(),
  getSessionUserId: vi.fn(),
  hasCollection: vi.fn(),
}));

vi.mock("@/lib/recommend/queries", () => ({
  loadEntryFacts: mocks.loadEntryFacts,
  loadFillerRows: mocks.loadFillerRows,
  loadTournamentSignals: mocks.loadTournamentSignals,
}));
vi.mock("@/lib/recommend/engine", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/recommend/engine")>()),
  gatherSignals: mocks.gatherSignals,
}));
vi.mock("@/lib/combos/queries", () => ({ loadCompleteCombos: mocks.loadCompleteCombos }));
vi.mock("@/lib/cards/wire", () => ({ loadCardWires: mocks.loadCardWires }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  enforceRateLimit: mocks.enforceRateLimit,
}));
// AUTOFILL-OWNED: who is asking and whether they hold a collection.
vi.mock("@/lib/auth", () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock("@/lib/collection/owned", () => ({ hasCollection: mocks.hasCollection }));

const { POST } = await import("./route");

const WU = 1 | 2;
const named = (
  name: string,
  over: Omit<Partial<MtgCard>, "attrs"> & { attrs?: Partial<MtgAttrs> } = {},
): MtgCard =>
  card({
    ciMask: 1,
    colorsMask: 1,
    cheapestUsd: 1,
    ...over,
    name,
    externalKey: `oracle-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    attrs: {
      type_line: `${over.primaryType ?? "Creature"} — Test`,
      oracle_text: "",
      ...over.attrs,
    },
  });

const leader = named("Test Commander", { ciMask: WU, isLeaderCandidate: true, costValue: 3 });
// The curve pool: Game Changers and land denial among the most popular, two
// extra-turn cards, a measured staple far down the popularity order, and
// plain cards across the curve.
const gcs = [1, 2, 3].map((cv) =>
  named(`Changer ${cv}`, { costValue: cv, attrs: { game_changer: true } }),
);
const ruin = named("Ruin", { costValue: 4, attrs: { mld: "clear" } });
const turns = [5, 6].map((cv) =>
  named(`Time ${cv}`, { costValue: cv, attrs: { extra_turn: true } }),
);
const staple = named("Measured Staple", { costValue: 2 });
const plains = Array.from({ length: 70 }, (_, i) => named(`Plain ${i}`, { costValue: i % 8 }));
const curvePool = [...gcs, ruin, ...turns, ...plains, staple];
const popularity = new Map(curvePool.map((c, i) => [c.id, c === staple ? 5000 : i + 1]));
const lands = Array.from({ length: 12 }, (_, i) =>
  named(i === 0 ? "Cradle" : `Field ${i}`, {
    primaryType: "Land",
    costValue: null,
    attrs: i === 0 ? { game_changer: true } : {},
  }),
);
const basics = ["Plains", "Island", "Swamp", "Mountain", "Forest", "Wastes"].map((n) =>
  named(n, { primaryType: "Land", costValue: null, ciMask: 0 }),
);
const every = new Map([leader, ...curvePool, ...lands, ...basics].map((c) => [c.id, c]));

const candidate = (c: MtgCard, rank: number): CandidateCard => ({
  id: c.id,
  name: c.name,
  primaryType: c.primaryType,
  costValue: c.costValue,
  ciMask: c.ciMask,
  cheapestUsd: "1.00",
  popularity: rank,
  externalKey: c.externalKey,
  flags: Object.fromEntries(
    (["game_changer", "mld", "extra_turn"] as const).flatMap((k) =>
      c.attrs[k] !== undefined ? [[k, c.attrs[k]]] : [],
    ),
  ),
});

async function post(body: unknown) {
  const res = await POST(
    new NextRequest("http://localhost/api/decks/autofill", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
  return {
    res,
    body: (await res.json()) as {
      picks: { cardId: string; tier: string; qty: number }[];
      notes: string[];
      error?: string;
      reason?: string;
      owned?: { applied: boolean };
    },
  };
}
const BASE = { game: "mtg", format: "commander", leaderIds: [leader.id], seed: 1_234_567 };

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.enforceRateLimit.mockResolvedValue(null);
  // Signed out with no collection unless a test says otherwise.
  mocks.getSessionUserId.mockResolvedValue(null);
  mocks.hasCollection.mockResolvedValue(false);
  mocks.loadEntryFacts.mockImplementation(async (_gameId: number, ids: string[]) => {
    return new Map(
      ids
        .filter((id) => every.has(id))
        .map((id) => {
          const c = every.get(id)!;
          const { primaryType, costValue, ...rest } = candidate(c, 1);
          return [
            id,
            {
              ...rest,
              primaryType,
              costValue,
              colorsMask: c.colorsMask,
              isLeaderCandidate: c.isLeaderCandidate,
              isPreview: false,
            },
          ];
        }),
    );
  });
  mocks.gatherSignals.mockImplementation(
    async (_snapshot: unknown, opts: { scope?: { op: string } }) => ({
      candidates:
        opts.scope?.op === "eq"
          ? lands.map((c, i) => candidate(c, i + 1))
          : curvePool.map((c) => candidate(c, popularity.get(c.id)!)),
      combosByCandidate: new Map(),
      combosTruncated: false,
    }),
  );
  mocks.loadTournamentSignals.mockResolvedValue({
    context: { commanderNames: ["Test Commander"], lists: 10, since: null },
    byCandidate: new Map([[staple.id, { lists: 9, top4: 3 }]]),
  });
  mocks.loadCompleteCombos.mockResolvedValue([]);
  mocks.loadFillerRows.mockResolvedValue(basics.map((c) => candidate(c, 1)));
  mocks.loadCardWires.mockImplementation(async (ids: string[]) =>
    [...new Set(ids)]
      .filter((id) => every.has(id))
      .map((id) => ({ ...every.get(id)!, image: null })),
  );
});

const flaggedIn = (picks: { cardId: string; qty: number }[], key: keyof MtgAttrs) =>
  picks.filter((p) => every.get(p.cardId)?.attrs[key] !== undefined).length;

describe("POST /api/decks/autofill — goals (Y6b)", () => {
  it("no target — goals absent, without one, or a budget alone — is the no-goals plan exactly; no combo read", async () => {
    const plain = await post(BASE);
    expect(plain.res.status).toBe(200);
    expect(plain.res.headers.get("cache-control")).toBe("no-store");
    expect(plain.body.notes).toEqual([]);
    for (const goals of [{ v: 1 }, { v: 1, budget: { perCardUsd: 5 } }, null]) {
      const { body } = await post({ ...BASE, goals });
      expect(body.picks).toEqual(plain.body.picks);
      expect(body.notes).toEqual([]);
    }
    expect(mocks.loadCompleteCombos).not.toHaveBeenCalled();
    // The facts carry the adapter's flags either way (one statement, wider).
    expect(mocks.loadEntryFacts).toHaveBeenCalledWith(
      GAME_ID.mtg,
      [leader.id],
      mtgAdapter.brackets!.flagPaths,
    );
    // The measured staple locks in with no target (WAVE4 F's other side).
    expect(plain.body.picks.find((p) => p.cardId === staple.id)?.tier).toBe("locked");
  });

  it("a target of 2: ONE combo read over keep ∪ the pool; no Game Changer, no land denial, one extra-turn card at most, the lock off — and notes for what it kept out", async () => {
    const free = await post(BASE);
    const { res, body } = await post({ ...BASE, goals: { v: 1, targetLevel: 2 } });
    expect(res.status).toBe(200);
    expect(mocks.loadCompleteCombos).toHaveBeenCalledTimes(1);
    const [ids] = mocks.loadCompleteCombos.mock.calls[0] as [string[]];
    expect(new Set(ids)).toEqual(
      new Set([leader.id, ...curvePool.map((c) => c.id), ...lands.map((c) => c.id)]),
    );

    expect(body.picks.reduce((n, p) => n + p.qty, 0)).toBe(99);
    expect(flaggedIn(body.picks, "game_changer")).toBe(0);
    expect(flaggedIn(body.picks, "mld")).toBe(0);
    expect(flaggedIn(body.picks, "extra_turn")).toBeLessThanOrEqual(1);
    expect(body.picks.some((p) => p.tier === "locked")).toBe(false);

    // Counted against the same seed's no-goals shell.
    const gcFree = flaggedIn(free.body.picks, "game_changer");
    const mldFree = flaggedIn(free.body.picks, "mld");
    const turnsFree = flaggedIn(free.body.picks, "extra_turn");
    expect(gcFree).toBeGreaterThan(0);
    expect(body.notes).toEqual(
      mtgShellNotes(
        {
          "game-changers": gcFree,
          "land-denial": mldFree,
          "extra-turns": Math.max(0, turnsFree - 1),
        },
        2,
      ),
    );
    expect(body.notes[0]).toBe(
      `Skipped ${gcFree} Game Changers. Your Bracket 2 target allows none (Wizards' list)`,
    );
  });

  it("the lock tier: off at 3 and below, on at 4 — and a target of 4 or 5 changes no pick", async () => {
    const plain = await post(BASE);
    const at3 = await post({ ...BASE, goals: { v: 1, targetLevel: 3 } });
    expect(at3.body.picks.some((p) => p.tier === "locked")).toBe(false);
    expect(flaggedIn(at3.body.picks, "game_changer")).toBeLessThanOrEqual(3);
    for (const targetLevel of [4, 5]) {
      const { body } = await post({ ...BASE, goals: { v: 1, targetLevel } });
      expect(body.picks).toEqual(plain.body.picks);
      expect(body.notes).toEqual([]);
    }
  });

  it("goals that don't fit the game answer 400 before any read", async () => {
    for (const goals of [{ v: 1, targetLevel: 9 }, { v: 2 }, { v: 1, budget: { perCardUsd: 3 } }]) {
      const { res, body } = await post({ ...BASE, goals });
      expect(res.status).toBe(400);
      expect(body.error).toBe("Invalid goals");
    }
    expect(mocks.loadEntryFacts).not.toHaveBeenCalled();
    expect(mocks.gatherSignals).not.toHaveBeenCalled();
  });

  it("a keep in the Tokens zone answers 400 before any read (DECK-TOKENS: no part of the plan)", async () => {
    const keep = [{ cardId: "00000000-0000-4000-8000-0000000000aa", zone: "tokens", qty: 3 }];
    const { res, body } = await post({ ...BASE, keep });
    expect(res.status).toBe(400);
    expect(body.error).toBe('Zone "tokens" is not part of the plan');
    expect(mocks.loadEntryFacts).not.toHaveBeenCalled();
  });

  it("One Piece answers 400 whatever its goals — no autofill, nothing read", async () => {
    const { res } = await post({ ...BASE, game: "optcg", format: "standard", goals: { v: 1 } });
    expect(res.status).toBe(400);
    expect(mocks.loadEntryFacts).not.toHaveBeenCalled();
  });
});

describe("POST /api/decks/autofill — only cards I own (AUTOFILL-OWNED)", () => {
  const PLAYER = "11111111-1111-4111-8111-111111111111";
  const collector = () => {
    mocks.getSessionUserId.mockResolvedValue(PLAYER);
    mocks.hasCollection.mockResolvedValue(true);
  };
  /** The options each gather was handed: the curve gather first, then the base one. */
  const gatherOptions = () =>
    mocks.gatherSignals.mock.calls.map(([, opts]) => opts as Record<string, unknown>);
  /** The buckets each limiter call spent, in order. */
  const limiterKeys = () =>
    mocks.enforceRateLimit.mock.calls.map(([limits]) => (limits as RateLimit[]).map((l) => l.key));
  const LAND = { column: "primary_type", value: "Land" };

  it("without the flag, absent or false, nothing about the player is read: both gathers get the options they always got, and the answer has no `owned`", async () => {
    collector(); // even for a signed-in collector
    for (const extra of [{}, { ownedOnly: false }]) {
      mocks.gatherSignals.mockClear();
      const { res, body } = await post({ ...BASE, ...extra });
      expect(res.status).toBe(200);
      expect("owned" in body).toBe(false);
      expect(body.notes).toEqual([]);
      // Key for key: no `ownedBy`, not even an undefined one.
      expect(gatherOptions()).toStrictEqual([
        {
          poolLimit: 600,
          tournamentPoolLimit: 200,
          scope: { ...LAND, op: "ne" },
          maxPriceUsd: undefined,
        },
        {
          poolLimit: 150,
          tournamentPoolLimit: 100,
          scope: { ...LAND, op: "eq" },
          maxPriceUsd: undefined,
          includeCombos: false,
        },
      ]);
    }
    expect(mocks.getSessionUserId).not.toHaveBeenCalled();
    expect(mocks.hasCollection).not.toHaveBeenCalled();
    // One limiter call an ask, the address's alone.
    expect(limiterKeys()).toEqual([
      ["deck-autofill:ip:unknown", "deck-autofill:ip-hour:unknown"],
      ["deck-autofill:ip:unknown", "deck-autofill:ip-hour:unknown"],
    ]);

    // A per-card budget still reaches both gathers when the box is not ticked.
    mocks.gatherSignals.mockClear();
    await post({ ...BASE, budgetUsd: 5 });
    expect(gatherOptions().map((o) => o.maxPriceUsd)).toEqual([5, 5]);
  });

  it("signed out: 401 with one sentence and no list; the player's limit is not spent and nothing is read for the list", async () => {
    const { res, body } = await post({ ...BASE, ownedOnly: true });
    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ error: "Sign in to build a list from your collection" });
    expect(mocks.getSessionUserId).toHaveBeenCalledTimes(1);
    expect(mocks.hasCollection).not.toHaveBeenCalled();
    expect(limiterKeys()).toEqual([["deck-autofill:ip:unknown", "deck-autofill:ip-hour:unknown"]]);
    expect(mocks.loadEntryFacts).not.toHaveBeenCalled();
    expect(mocks.gatherSignals).not.toHaveBeenCalled();
  });

  it("signed in with no collection: 409 with `reason: no-collection` and no list, never an unfiltered one", async () => {
    mocks.getSessionUserId.mockResolvedValue(PLAYER);
    const { res, body } = await post({ ...BASE, ownedOnly: true });
    expect(res.status).toBe(409);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      error: "This account has no collection to build a list from",
      reason: "no-collection",
    });
    expect(mocks.hasCollection).toHaveBeenCalledTimes(1);
    expect(mocks.hasCollection).toHaveBeenCalledWith(PLAYER);
    // The address first, then the player, once the session is proven.
    expect(limiterKeys()).toEqual([
      ["deck-autofill:ip:unknown", "deck-autofill:ip-hour:unknown"],
      [`deck-autofill-owned:user:${PLAYER}`, `deck-autofill-owned:user-hour:${PLAYER}`],
    ]);
    expect(mocks.loadEntryFacts).not.toHaveBeenCalled();
    expect(mocks.gatherSignals).not.toHaveBeenCalled();
  });

  it("a body the route refuses anyway is a 400 before the session is read", async () => {
    collector();
    for (const bad of [{ goals: { v: 2 } }, { format: "nope" }]) {
      const { res } = await post({ ...BASE, ownedOnly: true, ...bad });
      expect(res.status).toBe(400);
    }
    expect(mocks.getSessionUserId).not.toHaveBeenCalled();
  });

  it("past the player's own limit: the 429, and nothing is read for the list", async () => {
    collector();
    mocks.enforceRateLimit.mockImplementation(async (limits: RateLimit[]) =>
      limits.some((l) => l.key.startsWith("deck-autofill-owned:"))
        ? NextResponse.json(
            { error: "Too many requests. Try again shortly." },
            { status: 429, headers: { "Retry-After": "12" } },
          )
        : null,
    );
    const { res, body } = await post({ ...BASE, ownedOnly: true });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
    expect("picks" in body).toBe(false);
    expect(mocks.hasCollection).not.toHaveBeenCalled();
    expect(mocks.gatherSignals).not.toHaveBeenCalled();
    // The same player's unticked ask is not held by it.
    const plain = await post(BASE);
    expect(plain.res.status).toBe(200);
  });

  it("a collector's ask: both gathers get the player and no per-card budget, the answer says `owned.applied`, and the notes lead with the basic-lands line", async () => {
    collector();
    const { res, body } = await post({ ...BASE, ownedOnly: true, budgetUsd: 1 });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(gatherOptions()).toStrictEqual([
      {
        poolLimit: 600,
        tournamentPoolLimit: 200,
        scope: { ...LAND, op: "ne" },
        maxPriceUsd: undefined,
        ownedBy: PLAYER,
      },
      {
        poolLimit: 150,
        tournamentPoolLimit: 100,
        scope: { ...LAND, op: "eq" },
        maxPriceUsd: undefined,
        includeCombos: false,
        ownedBy: PLAYER,
      },
    ]);
    expect(mocks.hasCollection).toHaveBeenCalledTimes(1);
    expect(body.owned).toEqual({ applied: true });
    expect(body.picks.reduce((n, p) => n + p.qty, 0)).toBe(99);
    // The fillers are in the list, so the adapter's line about them is too: first, and alone.
    expect(body.picks.some((p) => p.tier === "filler")).toBe(true);
    expect(body.notes).toEqual([mtgAutofill.base.collectionNote]);
    expect(body.notes).toEqual([
      "Basic lands are added as needed and aren't checked against your collection.",
    ]);
  });

  it("no fillers in the list, no line about them: a full deck says only that it is full", async () => {
    collector();
    // 99 kept copies of a basic beside the commander: nothing left to plan.
    const keep = [{ cardId: basics[1].id, zone: "main", qty: 99 }];
    const { res, body } = await post({ ...BASE, ownedOnly: true, keep });
    expect(res.status).toBe(200);
    expect(body.picks).toEqual([]);
    expect(body.notes).toEqual(["The deck is already full. Nothing to add."]);
    expect(body.owned).toEqual({ applied: true });
  });

  it("a collection too small for the deck, at a target of 4: its thirty cards and the basics, the open slots counted and named, and no more Game Changers to bring in", async () => {
    collector();
    // What the engine's filter would leave: thirty ranked cards in colour, no
    // Game Changer among them, and no land.
    const mine = plains.slice(0, 30);
    mocks.gatherSignals.mockImplementation(
      async (_snapshot: unknown, opts: { scope?: { op: string }; ownedBy?: string }) => ({
        candidates:
          opts.ownedBy !== PLAYER
            ? []
            : opts.scope?.op === "eq"
              ? []
              : mine.map((c) => candidate(c, popularity.get(c.id)!)),
        combosByCandidate: new Map(),
        combosTruncated: false,
      }),
    );
    const { res, body } = await post({
      ...BASE,
      ownedOnly: true,
      goals: { v: 1, targetLevel: 4 },
    });
    expect(res.status).toBe(200);

    const ranked = body.picks.filter((p) => p.tier !== "filler");
    const fillers = body.picks.filter((p) => p.tier === "filler");
    // Every card the collection holds, and nothing else but the basics: no topping up.
    expect(new Set(ranked.map((p) => p.cardId))).toEqual(new Set(mine.map((c) => c.id)));
    expect(ranked).toHaveLength(30);
    expect(fillers.reduce((n, p) => n + p.qty, 0)).toBe(37);
    expect(fillers.every((p) => basics.some((b) => b.id === p.cardId))).toBe(true);
    expect(body.picks.reduce((n, p) => n + p.qty, 0)).toBe(67);

    expect(body.notes).toEqual([
      "Basic lands are added as needed and aren't checked against your collection.",
      "Filled 67 of 99. Your collection ran out of cards that fit, leaving 32 slots open in Mana value 1, Mana value 2, Mana value 3, Mana value 4, Mana value 5, Mana value 6, Mana value 7+.",
      "Still 4 Game Changers short of Bracket 4. Autofill had no more to bring in from your collection (Wizards' list)",
    ]);
  });

  it("at a target, Game Changers the collection holds come in, and the note says where from", async () => {
    collector();
    // Three owned Game Changers the plan would never sample: free spells far
    // down the popularity order, behind nine plain ones for a bucket of two.
    const mineChangers = ["A", "B", "C"].map((n) =>
      named(`Owned Changer ${n}`, { costValue: 0, attrs: { game_changer: true } }),
    );
    for (const c of mineChangers) every.set(c.id, c);
    mocks.gatherSignals.mockImplementation(
      async (_snapshot: unknown, opts: { scope?: { op: string }; ownedBy?: string }) => ({
        candidates:
          opts.ownedBy !== PLAYER
            ? []
            : opts.scope?.op === "eq"
              ? lands.map((c, i) => candidate(c, i + 1))
              : [
                  ...plains.map((c) => candidate(c, popularity.get(c.id)!)),
                  ...mineChangers.map((c, i) => candidate(c, 6000 + i)),
                ],
        combosByCandidate: new Map(),
        combosTruncated: false,
      }),
    );
    try {
      const { body } = await post({ ...BASE, ownedOnly: true, goals: { v: 1, targetLevel: 4 } });
      // Cradle, a land, is in the plan already; the three spells come in for it to read as Bracket 4.
      expect(flaggedIn(body.picks, "game_changer")).toBe(4);
      // Each takes a pick's place, so the list's order is the plan's, not theirs.
      expect(new Set(body.picks.filter((p) => p.tier === "reach").map((p) => p.cardId))).toEqual(
        new Set(mineChangers.map((c) => c.id)),
      );
      expect(body.notes).toEqual([
        "Basic lands are added as needed and aren't checked against your collection.",
        "Added 3 Game Changers from your collection to show your Bracket 4 target (Wizards' list)",
      ]);
    } finally {
      for (const c of mineChangers) every.delete(c.id);
    }
  });
});

describe("POST /api/decks/autofill — a deck total (AUTOFILL-TOTAL)", () => {
  interface Deck {
    totalUsd: number;
    estUsd: number;
    unpriced: number;
    keptUsd: number;
    keptUnpriced: number;
  }
  const deckOf = (body: unknown) => (body as { deck?: Deck }).deck;
  const qtyOf = (picks: { qty: number; tier: string }[], tier?: string) =>
    picks.filter((p) => tier === undefined || p.tier === tier).reduce((n, p) => n + p.qty, 0);
  /** The pools with a price per card; anything unnamed keeps the fixture's $1.00. */
  const price = (usd: (c: MtgCard) => string | null | undefined) => {
    mocks.gatherSignals.mockImplementation(
      async (_snapshot: unknown, opts: { scope?: { op: string } }) => ({
        candidates: (opts.scope?.op === "eq"
          ? lands.map((c, i) => candidate(c, i + 1))
          : curvePool.map((c) => candidate(c, popularity.get(c.id)!))
        ).map((row) => {
          const set = usd(every.get(row.id)!);
          return set === undefined ? row : { ...row, cheapestUsd: set };
        }),
        combosByCandidate: new Map(),
        combosTruncated: false,
      }),
    );
  };
  /** The entry facts with a price per card (the leader's and the kept cards'). */
  const priceKept = (usd: (c: MtgCard) => string | null | undefined) => {
    const base = mocks.loadEntryFacts.getMockImplementation()!;
    mocks.loadEntryFacts.mockImplementation(async (...args: unknown[]) => {
      const facts = (await base(...args)) as Map<string, { cheapestUsd: string | null }>;
      for (const [id, fact] of facts) {
        const set = usd(every.get(id)!);
        if (set !== undefined) fact.cheapestUsd = set;
      }
      return facts;
    });
  };
  /** The fillers' rows at one price, a name or two apart (`over`). */
  const fillersAt = (usd: string | null, over: Record<string, string> = {}) =>
    mocks.loadFillerRows.mockResolvedValue(
      basics.map((c) => ({ ...candidate(c, 1), cheapestUsd: over[c.name] ?? usd })),
    );
  const isLand = (c: MtgCard) => c.primaryType === "Land";

  it("without `totalUsd` nothing runs: no `deck` in the answer, and the fillers are read once, as before", async () => {
    const { body } = await post(BASE);
    expect("deck" in body).toBe(false);
    expect(mocks.loadFillerRows).toHaveBeenCalledTimes(1);
  });

  it("a total the list is already inside: the same picks, the whole deck's figure, and no note", async () => {
    const plain = await post(BASE);
    mocks.loadFillerRows.mockClear();
    const { res, body } = await post({ ...BASE, totalUsd: 500 });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(body.picks).toEqual(plain.body.picks);
    expect(body.notes).toEqual([]);
    // Ninety-nine picks and the commander at the fixture's $1.00 each.
    expect(deckOf(body)).toEqual({
      totalUsd: 500,
      estUsd: 100,
      unpriced: 0,
      keptUsd: 1,
      keptUnpriced: 0,
    });
    // The same one read of the fillers, moved ahead of the plan: never a second.
    expect(mocks.loadFillerRows).toHaveBeenCalledTimes(1);
  });

  it("over the total the list is fitted: the priciest picks give way, the figure is at or under the total, and it is the list's own", async () => {
    // Twelve ranked lands at $3 with no cheaper ranked land behind them, and
    // basics at $0.10: $1 + 62 × $1 + 12 × $3 + 25 × $0.10 = $101.50.
    price((c) => (isLand(c) ? "3.00" : undefined));
    // Wastes is dearer than a land here, and no white-blue deck is filled
    // with it: a filler is counted at the dearest the adapter may USE.
    fillersAt("0.10", { Wastes: "5.00" });
    const plain = await post(BASE);
    expect(qtyOf(plain.body.picks, "filler")).toBe(25);

    const { body } = await post({ ...BASE, totalUsd: 80 });
    // Eight lands give their slots to basics, $2.90 each: $78.30.
    expect(deckOf(body)).toEqual({
      totalUsd: 80,
      estUsd: 78.3,
      unpriced: 0,
      keptUsd: 1,
      keptUnpriced: 0,
    });
    expect(qtyOf(body.picks)).toBe(99);
    expect(qtyOf(body.picks, "filler")).toBe(33);
    expect(
      body.picks.filter((p) => isLand(every.get(p.cardId)!) && p.tier !== "filler"),
    ).toHaveLength(4);
    expect(body.notes).toEqual([]);
    // Every other pick is the plan's own.
    const was = new Set(plain.body.picks.map((p) => p.cardId));
    expect(body.picks.every((p) => was.has(p.cardId))).toBe(true);
    // One figure, worked out one way: the answer's picks at their own prices, and the commander.
    const picksCents = (
      body.picks as { cardId: string; qty: number; cheapestUsd?: string }[]
    ).reduce((sum, p) => sum + Math.round(Number(p.cheapestUsd) * 100) * p.qty, 0);
    expect((picksCents + 100) / 100).toBe(78.3);
  });

  it("the commander and the kept cards never leave and their cost counts: alone over the total, they are named, and the picks are the cheapest that fit", async () => {
    // The plan's edge case: a $40 commander, twelve kept cards worth $30 and
    // a $50 total. The twelve are two spells at $10 and ten copies of Plains
    // at $1, so copies are what is priced and counted.
    const keptCards = ["Kept A", "Kept B"].map((n) => named(n, { costValue: 2 }));
    for (const c of keptCards) every.set(c.id, c);
    try {
      price((c) => (isLand(c) ? "3.00" : undefined));
      fillersAt("0.10");
      priceKept((c) =>
        c === leader
          ? "40.00"
          : keptCards.includes(c)
            ? "10.00"
            : c === basics[0]
              ? "1.00"
              : undefined,
      );
      const keep = [
        ...keptCards.map((c) => ({ cardId: c.id, zone: "main", qty: 1 })),
        { cardId: basics[0].id, zone: "main", qty: 10 },
      ];
      const { res, body } = await post({ ...BASE, keep, totalUsd: 50 });
      expect(res.status).toBe(200);
      const deck = deckOf(body)!;
      expect(deck.keptUsd).toBe(70);
      // Every land slot went to a basic: nothing cheaper is left to take.
      expect(body.picks.filter((p) => isLand(every.get(p.cardId)!) && p.tier !== "filler")).toEqual(
        [],
      );
      expect(qtyOf(body.picks)).toBe(87);
      // $70 kept, sixty curve picks at $1, and twenty-seven more basics at $0.10.
      expect(qtyOf(body.picks, "filler")).toBe(27);
      expect(deck.estUsd).toBe(132.7);
      expect(body.notes).toEqual([
        "Your commander and the 12 cards you kept come to about $70, already over your $50 deck total. Autofill picked the cheapest cards that fit, and the deck comes to about $133.",
      ]);
      // The kept cards are in the answer's list, never among its picks.
      expect(body.picks.some((p) => keptCards.some((c) => c.id === p.cardId))).toBe(false);
    } finally {
      for (const c of keptCards) every.delete(c.id);
    }
  });

  it("over the total with the commander inside it: how far over, and that nothing cheaper fit", async () => {
    fillersAt("1.00");
    const { body } = await post({ ...BASE, totalUsd: 60 });
    // Every card is $1.00 here: nothing cheaper exists, so the list is the plan's.
    expect(deckOf(body)?.estUsd).toBe(100);
    expect(body.notes).toEqual([
      "With these added the deck comes to about $100, $40 over your $60 deck total. Autofill found no cheaper cards that fit.",
    ]);
  });

  it("a card with no known price is never counted as $0: it is left out of the figure and counted beside it", async () => {
    priceKept((c) => (c === leader ? null : undefined));
    fillersAt(null);
    const { body } = await post({ ...BASE, totalUsd: 500 });
    const deck = deckOf(body)!;
    expect(deck.keptUnpriced).toBe(1);
    expect(deck.keptUsd).toBe(0);
    // The commander and the 25 basics.
    expect(deck.unpriced).toBe(26);
    expect(deck.estUsd).toBe(74);
  });

  it("under a total, a target is kept where it fits and the notes are counted after the fit: the short line names the total", async () => {
    // Only a count of Game Changers shows Bracket 4 here: Cradle among the
    // lands and three spells far down the rank, at mana values whose buckets
    // have cards to spare (a card leaves only for one of its own group), all
    // at $50; every other card is $1.
    const dear = [0, 6, 7].map((cv) =>
      named(`Dear Changer ${cv}`, { costValue: cv, attrs: { game_changer: true } }),
    );
    for (const c of dear) every.set(c.id, c);
    mocks.gatherSignals.mockImplementation(
      async (_snapshot: unknown, opts: { scope?: { op: string } }) => ({
        candidates: (opts.scope?.op === "eq"
          ? lands.map((c, i) => candidate(c, i + 1))
          : [
              ...[...plains, staple].map((c) => candidate(c, popularity.get(c.id)!)),
              ...dear.map((c, i) => candidate(c, 6000 + i)),
            ]
        ).map((row) =>
          every.get(row.id)!.attrs.game_changer === true ? { ...row, cheapestUsd: "50.00" } : row,
        ),
        combosByCandidate: new Map(),
        combosTruncated: false,
      }),
    );
    try {
      const goals = { v: 1, targetLevel: 4 };
      const free = await post({ ...BASE, goals });
      expect(flaggedIn(free.body.picks, "game_changer")).toBe(4);
      // The plan sampled some of the spells and the build-up brought the rest.
      const brought = free.body.picks.filter((p) => p.tier === "reach").length;
      expect(brought).toBeGreaterThan(0);
      const built = `Added ${brought} Game Changer${brought === 1 ? "" : "s"} to show your Bracket 4 target (Wizards' list)`;
      expect(free.body.notes).toEqual([built]);

      // Roomy enough for all four ($1 + 4 × $50 + 95 × $1 = $296): the
      // target-4 list, pick for pick, with its note as it was.
      const roomy = await post({ ...BASE, goals, totalUsd: 500 });
      expect(roomy.body.picks).toEqual(free.body.picks);
      expect(roomy.body.notes).toEqual([built]);
      expect(deckOf(roomy.body)?.estUsd).toBe(296);

      // $160 has room for one of them: $1 + $50 + 98 × $1 = $149. The three
      // spells rank lowest and go first; Cradle stays, so the note no longer
      // claims a card the build-up brought.
      const one = await post({ ...BASE, goals, totalUsd: 160 });
      expect(deckOf(one.body)?.estUsd).toBe(149);
      expect(flaggedIn(one.body.picks, "game_changer")).toBe(1);
      expect(one.body.picks.some((p) => p.tier === "reach")).toBe(false);
      expect(one.body.notes).toEqual([
        "Still 3 Game Changers short of Bracket 4. Autofill had no more to bring in under your $160 deck total (Wizards' list)",
      ]);
      // $120 has room for none.
      const none = await post({ ...BASE, goals, totalUsd: 120 });
      expect(deckOf(none.body)?.estUsd).toBe(100);
      expect(flaggedIn(none.body.picks, "game_changer")).toBe(0);
      expect(none.body.notes).toEqual([
        "Still 4 Game Changers short of Bracket 4. Autofill had no more to bring in under your $120 deck total (Wizards' list)",
      ]);
      // With a per-card budget too, both are named.
      const both = await post({ ...BASE, goals, totalUsd: 120, budgetUsd: 5 });
      expect(both.body.notes).toEqual([
        "Still 4 Game Changers short of Bracket 4. Autofill had no more to bring in under the $5-a-card budget and your $120 deck total (Wizards' list)",
      ]);
    } finally {
      for (const c of dear) every.delete(c.id);
    }
  });

  it("what the target kept out is still counted against a list planned with no total: the budget's removals are never blamed on the target", async () => {
    price((c) => (isLand(c) ? "3.00" : undefined));
    fillersAt("0.10");
    const goals = { v: 1, targetLevel: 2 };
    const untotalled = await post({ ...BASE, goals });
    const fitted = await post({ ...BASE, goals, totalUsd: 80 });
    expect(deckOf(fitted.body)!.estUsd).toBeLessThanOrEqual(80);
    expect(untotalled.body.notes.length).toBeGreaterThan(0);
    expect(fitted.body.notes).toEqual(untotalled.body.notes);
  });

  it("with `ownedOnly` the total is ignored, as the per-card budget is (the owner's decision 5)", async () => {
    mocks.getSessionUserId.mockResolvedValue("11111111-1111-4111-8111-111111111111");
    mocks.hasCollection.mockResolvedValue(true);
    const owned = await post({ ...BASE, ownedOnly: true });
    const { res, body } = await post({ ...BASE, ownedOnly: true, totalUsd: 5 });
    expect(res.status).toBe(200);
    expect("deck" in body).toBe(false);
    expect(body.picks).toEqual(owned.body.picks);
    expect(body.notes).toEqual(owned.body.notes);
  });

  it("a total that is no amount of money answers 400 before any read", async () => {
    for (const totalUsd of [0, -5, 100_001, "50", null]) {
      const { res } = await post({ ...BASE, totalUsd });
      expect(res.status).toBe(400);
    }
    expect(mocks.loadEntryFacts).not.toHaveBeenCalled();
    expect(mocks.gatherSignals).not.toHaveBeenCalled();
    expect(mocks.loadFillerRows).not.toHaveBeenCalled();
  });
});
