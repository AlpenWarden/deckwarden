// @vitest-environment node
/**
 * Y6a — the engine's order, over mocked IO (the loaders are stand-ins; the
 * ranker, the read and applyGoals are real): rank all → goals → slice. A
 * pool whose 25 best cards are all Game Changers, at a target of 2, answers
 * the 25 next ones with the 25 counted as hidden — never a list cut first
 * and then filtered short. Also: the list is read once, on the server, with
 * one more statement (the complete combos) and only where a read exists — a
 * leader, every entry's facts, a game with `brackets`. BRACKET-UP's power
 * first: the Game Changers a target needs lead, found past the 25 best and
 * never a land (the upgrade pairs by cost), the rest in their own order.
 *
 * COMMANDER-FIT — the list's themes: read first, with ONE statement for the
 * list's own texts, then handed to the gather (a pool per theme, the
 * strongest few, and each candidate row's text) and to the ranker. A list
 * read for no theme spends no pool statement and asks for no text.
 *
 * OWNED-FILTER — the owned hook: the player's id reaches the filter of every
 * statement that selects candidates, through both entry points (Suggestions'
 * and the gather Autofill calls), and no caller without one names a player.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { findFormat, GAME_ID } from "@/db/seed-data";
import type { ReadFacts } from "./queries";
import type { CandidateCard } from "./types";

const mocks = vi.hoisted(() => ({
  loadCandidatePool: vi.fn(),
  loadCandidateRows: vi.fn(),
  loadComboSignals: vi.fn(),
  loadDeckEntries: vi.fn(),
  loadThemeCandidates: vi.fn(),
  loadThemeRows: vi.fn(),
  loadTournamentCandidates: vi.fn(),
  loadTournamentSignals: vi.fn(),
  loadCompleteCombos: vi.fn(),
}));

vi.mock("./queries", () => ({
  loadCandidatePool: mocks.loadCandidatePool,
  loadCandidateRows: mocks.loadCandidateRows,
  loadComboSignals: mocks.loadComboSignals,
  loadDeckEntries: mocks.loadDeckEntries,
  loadThemeCandidates: mocks.loadThemeCandidates,
  loadThemeRows: mocks.loadThemeRows,
  loadTournamentCandidates: mocks.loadTournamentCandidates,
  loadTournamentSignals: mocks.loadTournamentSignals,
}));
vi.mock("@/lib/combos/queries", () => ({ loadCompleteCombos: mocks.loadCompleteCombos }));

const { gatherSignals, recommendForSnapshot, snapshotThemes, POOL_LIMIT } =
  await import("./engine");
const { THEME_POOL_LIMIT, THEME_POOL_THEMES } = await import("./themes");
const { mtgAdapter } = await import("@/lib/games/mtg/adapter");
const { analyzeMtg } = await import("@/lib/games/mtg/analyze");
const { mtgThemes } = await import("@/lib/games/mtg/themes");
const { card, cardMap, commanderDeck, entry } = await import("@/lib/games/mtg/test-fixtures");
type Fixture = ReturnType<typeof card>;

const LEADER = "10000000-0000-4000-8000-000000000000";
const facts = (name: string, flags: Record<string, unknown> = {}): ReadFacts => ({
  name,
  externalKey: `oracle-${name}`,
  colorsMask: 0,
  ciMask: 0,
  isLeaderCandidate: false,
  isPreview: false,
  cheapestUsd: "1.00",
  popularity: 100,
  flags,
});

/** 50 candidates by popularity: the 25 best are Game Changers. */
const POOL: CandidateCard[] = Array.from({ length: 50 }, (_, i) => ({
  id: `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  name: `Card ${String(i + 1).padStart(2, "0")}`,
  primaryType: "Land", // outside the curve: popularity alone orders them
  costValue: null,
  ciMask: 0,
  cheapestUsd: "1.00",
  popularity: i + 1,
  externalKey: `oracle-card-${i + 1}`,
  flags: i < 25 ? { game_changer: true } : {},
}));

const snapshot = (withFacts = true) => ({
  gameId: GAME_ID.mtg,
  formatId: findFormat("mtg", "commander")!.id,
  ciMask: 0,
  leaderIds: [LEADER],
  entries: [
    {
      cardId: LEADER,
      qty: 1,
      primaryType: "Creature",
      costValue: 3,
      ...(withFacts ? { facts: facts("Test Commander") } : {}),
    },
  ],
});

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.loadCandidatePool.mockResolvedValue(POOL);
  mocks.loadCandidateRows.mockResolvedValue([]);
  mocks.loadComboSignals.mockResolvedValue({ byCandidate: new Map(), truncated: false });
  mocks.loadTournamentCandidates.mockResolvedValue([]);
  mocks.loadTournamentSignals.mockResolvedValue({ context: null, byCandidate: new Map() });
  mocks.loadCompleteCombos.mockResolvedValue([]);
  // The list's own texts: a commander that names no type — no theme.
  mocks.loadThemeRows.mockResolvedValue([
    {
      id: LEADER,
      name: "Test Commander",
      text: "Legendary Creature — Human Wizard",
      rules: "Flying",
    },
  ]);
  mocks.loadThemeCandidates.mockResolvedValue([]);
});

describe("recommendForSnapshot — rank all → goals → slice (Y6a)", () => {
  it("the 25 best above a target of 2: 25 others come back, the 25 hidden and counted, each in rank order", async () => {
    const out = await recommendForSnapshot(snapshot(), { goals: { targetLevel: 2 } });
    expect(out.recommendations.map((r) => r.name)).toEqual(POOL.slice(25).map((c) => c.name));
    expect(out.hidden.map((r) => r.name)).toEqual(POOL.slice(0, 25).map((c) => c.name));
    expect(out.hidden[0].conflicts.map((c) => c.why)).toEqual([
      "A Game Changer (Wizards' list). Your Bracket 2 target allows none",
    ]);
    expect(out.combosTruncated).toBe(false);
  });

  it("no target: the same 25 best, flagged — nothing hidden", async () => {
    const out = await recommendForSnapshot(snapshot());
    expect(out.recommendations.map((r) => r.name)).toEqual(POOL.slice(0, 25).map((c) => c.name));
    expect(out.hidden).toEqual([]);
    expect(out.recommendations[0].conflicts.map((c) => [c.severity, c.why])).toEqual([
      ["flag", "Would make this deck at least Bracket 3: a Game Changer (Wizards' list)"],
    ]);
  });

  it("reads the list once: one complete-combos load over the entries, beside the gather; the flags ride every pool", async () => {
    await recommendForSnapshot(snapshot(), { goals: { targetLevel: 2 } });
    expect(mocks.loadCompleteCombos).toHaveBeenCalledTimes(1);
    expect(mocks.loadCompleteCombos).toHaveBeenCalledWith([LEADER]);
    const flagPaths = mtgAdapter.brackets!.flagPaths;
    expect(mocks.loadCandidatePool).toHaveBeenCalledWith(expect.anything(), POOL_LIMIT, flagPaths);
    expect(mocks.loadComboSignals).toHaveBeenCalledWith([LEADER], 0, [LEADER]);
  });

  it("no read without every entry's facts: no extra statement, no bracket goals — the budget still applies", async () => {
    const out = await recommendForSnapshot(snapshot(false), {
      goals: { targetLevel: 2, budget: { perCardUsd: 1 } },
      maxPriceUsd: 5,
    });
    expect(mocks.loadCompleteCombos).not.toHaveBeenCalled();
    expect(out.hidden).toEqual([]);
    expect(out.recommendations).toHaveLength(25);
  });

  it("the goals' answers reach the read: a list the owner says wins before turn 6 reads 4, so a Game Changer raises nothing", async () => {
    const out = await recommendForSnapshot(snapshot(), {
      goals: { answers: { rulesetVersion: 1, play: { fast: "yes" } } },
    });
    expect(out.recommendations.map((r) => r.name)).toEqual(POOL.slice(0, 25).map((c) => c.name));
    expect(out.recommendations.every((r) => r.conflicts.length === 0)).toBe(true);
  });

  it("a truncated combo scan is passed through for the panel to disclose", async () => {
    mocks.loadComboSignals.mockResolvedValue({ byCandidate: new Map(), truncated: true });
    const out = await recommendForSnapshot(snapshot());
    expect(out.combosTruncated).toBe(true);
  });

  it("One Piece: no signals, nothing loaded", async () => {
    const out = await recommendForSnapshot({ ...snapshot(), gameId: GAME_ID.optcg });
    expect(out).toEqual({ recommendations: [], hidden: [], combosTruncated: false });
    expect(mocks.loadCandidatePool).not.toHaveBeenCalled();
    expect(mocks.loadCompleteCombos).not.toHaveBeenCalled();
  });
});

describe("recommendForSnapshot — power first (BRACKET-UP)", () => {
  const card = (n: number, name: string, over: Partial<CandidateCard>): CandidateCard => ({
    id: `30000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name,
    primaryType: "Artifact",
    costValue: 2,
    ciMask: 0,
    cheapestUsd: "1.00",
    popularity: n,
    externalKey: `oracle-power-${n}`,
    flags: {},
    ...over,
  });
  /** 40 plain spells rank first; then two Game Changer lands, then six Game Changer spells. */
  const RANKED: CandidateCard[] = [
    ...Array.from({ length: 40 }, (_, i) =>
      card(i + 1, `Spell ${String(i + 1).padStart(2, "0")}`, {}),
    ),
    card(41, "Changer Land A", {
      primaryType: "Land",
      costValue: 0,
      flags: { game_changer: true },
    }),
    card(42, "Changer Land B", {
      primaryType: "Land",
      costValue: 0,
      flags: { game_changer: true },
    }),
    ...Array.from({ length: 6 }, (_, i) =>
      card(43 + i, `Changer ${i + 1}`, {
        primaryType: "Enchantment",
        costValue: 3,
        flags: { game_changer: true },
      }),
    ),
  ];
  const names = (rows: { name: string }[]) => rows.map((r) => r.name);

  beforeEach(() => mocks.loadCandidatePool.mockResolvedValue(RANKED));

  it("at a target of 4 the four Game Changers the list needs lead, from past the 25 best, lands passed over; the rest keep their order", async () => {
    const plain = await recommendForSnapshot(snapshot(), { goals: { targetLevel: 4 } });
    expect(names(plain.recommendations).some((n) => n.startsWith("Changer"))).toBe(false);
    const out = await recommendForSnapshot(snapshot(), {
      goals: { targetLevel: 4 },
      powerFirst: true,
    });
    expect(names(out.recommendations).slice(0, 4)).toEqual([
      "Changer 1",
      "Changer 2",
      "Changer 3",
      "Changer 4",
    ]);
    expect(names(out.recommendations).slice(4)).toEqual(names(plain.recommendations).slice(0, 21));
    expect(out.recommendations).toHaveLength(25);
    expect(out.hidden).toEqual(plain.hidden);
  });

  it("at a target of 3, the one Game Changer it needs", async () => {
    const out = await recommendForSnapshot(snapshot(), {
      goals: { targetLevel: 3 },
      powerFirst: true,
    });
    expect(names(out.recommendations)[0]).toBe("Changer 1");
    expect(names(out.recommendations).filter((n) => n.startsWith("Changer"))).toEqual([
      "Changer 1",
    ]);
  });

  it("nothing leads without a target, at a target no count shows (2), or without the ask", async () => {
    const plain = names((await recommendForSnapshot(snapshot())).recommendations);
    expect(
      names((await recommendForSnapshot(snapshot(), { powerFirst: true })).recommendations),
    ).toEqual(plain);
    const two = await recommendForSnapshot(snapshot(), {
      goals: { targetLevel: 2 },
      powerFirst: true,
    });
    expect(names(two.recommendations).some((n) => n.startsWith("Changer"))).toBe(false);
  });
});

describe("recommendForSnapshot — the list's themes (COMMANDER-FIT)", () => {
  /** A commander whose rules text names its own type: a theme from the first card. */
  const HIVEMIND = {
    id: LEADER,
    name: "Test Hivemind",
    text: "Legendary Creature — Sliver",
    rules: "Slivers you control have flying.",
  };
  const sliver = (n: number, over: Partial<CandidateCard> = {}): CandidateCard => ({
    id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    name: `Sliver ${n}`,
    primaryType: "Land", // outside the curve, like the pool
    costValue: null,
    ciMask: 0,
    cheapestUsd: "1.00",
    popularity: 60 + n, // past every pool card
    externalKey: `oracle-sliver-${n}`,
    flags: {},
    themeText: "Creature — Sliver",
    ...over,
  });

  it("reads the list's own texts with one statement, then asks a pool for the theme and the text on every row", async () => {
    mocks.loadThemeRows.mockResolvedValue([HIVEMIND]);
    mocks.loadThemeCandidates.mockResolvedValue([sliver(1), sliver(2)]);
    const out = await recommendForSnapshot(snapshot(false));

    expect(mocks.loadThemeRows).toHaveBeenCalledTimes(1);
    expect(mocks.loadThemeRows).toHaveBeenCalledWith(
      GAME_ID.mtg,
      [LEADER],
      [LEADER],
      mtgAdapter.recommend!.themes,
    );
    expect(mocks.loadThemeCandidates).toHaveBeenCalledTimes(1);
    const [filter, word, limit, flagPaths] = mocks.loadThemeCandidates.mock.calls[0];
    expect(word).toBe("Sliver");
    expect(limit).toBe(THEME_POOL_LIMIT);
    expect(filter.themePath).toBe("type_line");
    expect(flagPaths).toBe(mtgAdapter.brackets!.flagPaths);
    // The same filter as every other source, and the text rides their rows too.
    expect(filter.excludeCardIds).toEqual([LEADER]);
    expect(mocks.loadCandidatePool.mock.calls[0][0].themePath).toBe("type_line");

    // The theme's cards lead the list, and their own line leads their evidence.
    expect(out.recommendations.slice(0, 2).map((r) => r.name)).toEqual(["Sliver 1", "Sliver 2"]);
    expect(out.recommendations[0].evidence[0]).toMatchObject({
      source: "deck-types",
      why: "Has the Sliver type, which Test Hivemind's rules text names",
    });
    // A pool card outside the theme says nothing about it.
    expect(out.recommendations[2].evidence.map((e) => e.source)).toEqual(["edhrec_rank"]);
  });

  it("takes a card once when the theme's pool and the popularity pool both hold it", async () => {
    mocks.loadThemeRows.mockResolvedValue([HIVEMIND]);
    mocks.loadThemeCandidates.mockResolvedValue([
      { ...POOL[30], themeText: "Creature — Sliver" },
      sliver(1),
    ]);
    const out = await recommendForSnapshot(snapshot(false), { limit: 50 });
    const listed = out.recommendations.map((r) => r.name);
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed.filter((n) => n === POOL[30].name)).toHaveLength(1);
  });

  it("a list read for no theme spends no pool statement and asks for no text", async () => {
    const out = await recommendForSnapshot(snapshot(false));
    expect(mocks.loadThemeRows).toHaveBeenCalledTimes(1);
    expect(mocks.loadThemeCandidates).not.toHaveBeenCalled();
    expect(mocks.loadCandidatePool.mock.calls[0][0].themePath).toBeUndefined();
    expect(out.recommendations.map((r) => r.name)).toEqual(POOL.slice(0, 25).map((c) => c.name));
  });

  it("asks a pool for the strongest few themes only", async () => {
    const list = [
      { n: 22, text: "Creature — Sliver" },
      { n: 15, text: "Creature — Goblin" },
      { n: 12, text: "Creature — Bird" },
      { n: 10, text: "Creature — Cat" },
    ].flatMap(({ n, text }, group) =>
      Array.from({ length: n }, (_, i) => ({
        id: `5${group}000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
        text,
      })),
    );
    mocks.loadThemeRows.mockResolvedValue([
      { id: LEADER, name: "Test Commander", text: "Legendary Creature — Human", rules: "Flying" },
      ...list.map((c) => ({ id: c.id, name: c.id, text: c.text, rules: null })),
    ]);
    const base = snapshot(false);
    await recommendForSnapshot({
      ...base,
      entries: [
        ...base.entries,
        ...list.map((c) => ({ cardId: c.id, qty: 1, primaryType: "Creature", costValue: 2 })),
      ],
    });
    expect(THEME_POOL_THEMES).toBe(3);
    expect(mocks.loadThemeCandidates.mock.calls.map((call) => call[1])).toEqual([
      "Sliver",
      "Goblin",
      "Bird",
    ]);
  });
});

describe("the owned hook — the player reaches every candidate statement (OWNED-FILTER)", () => {
  const PLAYER = "00000000-0000-4000-8000-0000000000aa";
  /** A combo piece outside every pool: the gather rechecks it through the filter. */
  const COMBO_ONLY = "60000000-0000-4000-8000-000000000001";
  /** A commander whose rules text names its own type, so the list has a theme and a theme pool. */
  const HIVEMIND = {
    id: LEADER,
    name: "Test Hivemind",
    text: "Legendary Creature — Sliver",
    rules: "Slivers you control have flying.",
  };
  /** Every loader that takes the filter: the four statements that select candidates. */
  const candidateLoaders = () => [
    mocks.loadCandidatePool,
    mocks.loadTournamentCandidates,
    mocks.loadCandidateRows,
    mocks.loadThemeCandidates,
  ];

  beforeEach(() => {
    mocks.loadComboSignals.mockResolvedValue({
      byCandidate: new Map([[COMBO_ONLY, []]]),
      truncated: false,
    });
    mocks.loadThemeRows.mockResolvedValue([HIVEMIND]);
  });

  it("Suggestions: the popularity pool, the tournament candidates, the combo recheck and the theme pool each get the player", async () => {
    await recommendForSnapshot(snapshot(false), { ownedBy: PLAYER });
    for (const loader of candidateLoaders()) {
      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader.mock.calls[0][0].ownedBy).toBe(PLAYER);
    }
  });

  it("the gather Autofill calls: the same, whatever its scope and pool sizes", async () => {
    await gatherSignals(snapshot(false), {
      poolLimit: 600,
      tournamentPoolLimit: 200,
      scope: { column: "primary_type", op: "ne", value: "Land" },
      ownedBy: PLAYER,
    });
    // No themes here (they are Suggestions' alone): three statements, each with the player.
    for (const loader of candidateLoaders().slice(0, 3)) {
      expect(loader).toHaveBeenCalledTimes(1);
      expect(loader.mock.calls[0][0].ownedBy).toBe(PLAYER);
    }
    expect(mocks.loadThemeCandidates).not.toHaveBeenCalled();
  });

  it("no player given: no statement's filter names one", async () => {
    await recommendForSnapshot(snapshot(false));
    await gatherSignals(snapshot(false), { poolLimit: 600 });
    for (const loader of candidateLoaders()) {
      expect(loader.mock.calls.length).toBeGreaterThan(0);
      for (const [filter] of loader.mock.calls) expect(filter.ownedBy).toBeUndefined();
    }
  });
});

describe("DECK-FACTS — the type tile prints the count a Suggestions row prints", () => {
  /** The saved list as the server reads it: the snapshot, and the one statement's rows. */
  function serverRead(leaders: Fixture[], main: { card: Fixture; qty: number }[]) {
    const ids = new Set(leaders.map((c) => c.id));
    const all = [...leaders.map((c) => ({ card: c, qty: 1 })), ...main];
    mocks.loadThemeRows.mockResolvedValue(
      [...new Map(all.map((e) => [e.card.id, e.card])).values()].map((c) => ({
        id: c.id,
        name: c.name,
        text: c.attrs.type_line,
        rules: ids.has(c.id) ? c.attrs.oracle_text : null,
      })),
    );
    return snapshotThemes(mtgAdapter, {
      gameId: GAME_ID.mtg,
      formatId: findFormat("mtg", "commander")!.id,
      ciMask: 0,
      leaderIds: [...ids],
      entries: all.map((e) => ({
        cardId: e.card.id,
        qty: e.qty,
        primaryType: e.card.primaryType,
        costValue: e.card.costValue,
        zone: ids.has(e.card.id) ? "commander" : "main",
      })),
    });
  }

  function tile(leaders: Fixture[], main: { card: Fixture; qty: number }[]) {
    const blocks = analyzeMtg(
      commanderDeck(
        leaders,
        main.map((e) => entry(e.card, e.qty)),
      ),
      cardMap([...leaders, ...main.map((e) => e.card)]),
    );
    const b = blocks.find((x) => x.id === "deck-type");
    return b?.kind === "stat" ? b : null;
  }

  it('a type the commander names: one count, the row\'s "N of your cards share it"', async () => {
    const edgar = card({
      name: "Edgar Markov",
      costValue: 6,
      attrs: {
        type_line: "Legendary Creature — Vampire Knight",
        oracle_text:
          "Eminence — Whenever you cast another Vampire spell, if Edgar Markov is in the command zone or on the battlefield, create a 1/1 black Vampire creature token.",
      },
    });
    const main = [
      ...Array.from({ length: 11 }, (_, i) => ({
        card: card({
          name: `Vampire ${i + 1}`,
          attrs: { type_line: "Creature — Vampire", oracle_text: "" },
        }),
        qty: 1,
      })),
      // Copies, and a two-faced card whose back carries the type.
      {
        card: card({
          name: "Bloodline Keeper",
          attrs: { type_line: "Creature — Vampire", oracle_text: "" },
        }),
        qty: 2,
      },
      {
        card: card({
          name: "Westvale Initiate // Lord of Lineage",
          attrs: { type_line: "Creature — Human // Creature — Vampire", oracle_text: "" },
        }),
        qty: 1,
      },
      {
        card: card({ name: "Elf 1", attrs: { type_line: "Creature — Elf", oracle_text: "" } }),
        qty: 1,
      },
    ];
    const themes = await serverRead([edgar], main);
    const t = tile([edgar], main);
    expect(themes[0].word).toBe("Vampire");
    expect(themes[0].namedBy).toBe("Edgar Markov");
    expect(t).toMatchObject({ title: "Vampire cards", value: `${themes[0].count} of 16` });
    expect(themes[0].count).toBe(15); // Edgar, 11 Vampires, two copies, the back face
    expect(mtgThemes.evidence(themes[0]).howOften).toBe("15 of your cards share it");
  });

  it('a type counted on the list: one count, the row\'s "Shares the Sliver type with N of your cards"', async () => {
    const commander = card({
      name: "Test Commander",
      attrs: { type_line: "Legendary Creature — Human Wizard", oracle_text: "Flying" },
    });
    const main = Array.from({ length: 12 }, (_, i) => ({
      card: card({
        name: `Sliver ${i + 1}`,
        attrs: { type_line: "Creature — Sliver", oracle_text: "" },
      }),
      qty: 1,
    }));
    const themes = await serverRead([commander], main);
    const t = tile([commander], main);
    expect(themes.map((x) => x.word)).toEqual(["Sliver"]);
    expect(t).toMatchObject({ title: "Sliver cards", value: "12 of 13" });
    expect(mtgThemes.evidence(themes[0]).why).toBe("Shares the Sliver type with 12 of your cards");
  });

  it("a card in two zones: its copies summed per card, as the server sums them, and read once as a leader", async () => {
    const edgar = card({
      name: "Edgar Markov",
      costValue: 6,
      attrs: {
        type_line: "Legendary Creature — Vampire Knight",
        oracle_text: "Eminence — Whenever you cast another Vampire spell, create a Vampire token.",
      },
    });
    const main = [
      { card: edgar, qty: 1 },
      ...Array.from({ length: 3 }, (_, i) => ({
        card: card({
          name: `Vampire ${i + 1}`,
          attrs: { type_line: "Creature — Vampire", oracle_text: "" },
        }),
        qty: 1,
      })),
    ];
    const themes = await serverRead([edgar], main);
    expect(themes[0]).toMatchObject({ word: "Vampire", count: 5, namedBy: "Edgar Markov" });
    expect(tile([edgar], main)).toMatchObject({ title: "Vampire cards", value: "5 of 5" });
  });
});
