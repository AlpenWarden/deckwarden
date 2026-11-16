/**
 * PRECON-OWNED's copy guard (the BRACKET_COPY guard's pattern): every
 * string PRECON_COPY can produce, its builders called with real product
 * names (the catalog's longest, a colon, a comma, parentheses, and the
 * three that begin with "The"), under U9's policy: no em or en dash, no
 * middle dot, never a multi-dot line, no notation, and a precon named so
 * that "The" never follows "the".
 *
 * PRECON-CHANGES adds the second line, the sheet and the row mark to the
 * same table: their builders are called over every count and case they
 * have (no changes, one copy, many, owned, unpriced, thousands).
 */
import { describe, expect, it } from "vitest";

import { ownershipMethod } from "./ownership";
import { PRECON_COPY } from "./precon-copy";

/** The table's word-builders: the guard calls each one (a new one must join it here). */
const BUILDERS = [
  "ask",
  "owned",
  "notOwned",
  "changed",
  "changesTitle",
  "each",
  "addCost",
  "rowMark",
];

/** Product names from the dev branch's 182 precons (2026-10-24). */
const NAMES = [
  "Breed Lethality",
  "Angels: They're Just Like Us but Cooler and with Wings",
  "Scions & Spellcraft (FINAL FANTASY XIV)",
  "Heads I Win, Tails You Lose",
  "The Hosts of Mordor",
  "The Fantastic Four",
  "The Ruinous Powers",
];

/** Every case the cost line has: the counts are copies. */
const COSTS = [
  { usd: 0, owned: 0, unpriced: 0, total: 0 },
  { usd: 66.76, owned: 0, unpriced: 0, total: 1 },
  { usd: 149.1, owned: 0, unpriced: 0, total: 3 },
  { usd: 1853.32, owned: 0, unpriced: 0, total: 24 },
  { usd: 82.34, owned: 1, unpriced: 0, total: 3 },
  { usd: 29.57, owned: 1, unpriced: 0, total: 2 },
  { usd: 0, owned: 1, unpriced: 0, total: 1 },
  { usd: 0, owned: 4, unpriced: 0, total: 4 },
  { usd: 0, owned: 0, unpriced: 1, total: 1 },
  { usd: 0, owned: 0, unpriced: 3, total: 3 },
  { usd: 0, owned: 2, unpriced: 2, total: 4 },
  { usd: 149.3, owned: 0, unpriced: 1, total: 6 },
  { usd: 12, owned: 2, unpriced: 2, total: 9 },
];

/** The cost line's sentences (nothing to add has no line). */
const costLines = () => COSTS.flatMap((c) => PRECON_COPY.addCost(c) ?? []);

/** Words that are a control, a heading, a title, a price or a mark's name: not sentences. */
function labels(): string[] {
  const C = PRECON_COPY;
  return [
    C.yes,
    C.no,
    C.change,
    C.seeChanges,
    C.takeOut,
    C.add,
    C.retry,
    C.unknownCard,
    C.inCollection,
    C.copy,
    C.added,
    ...NAMES.map((name) => C.changesTitle(name)),
    C.each("$0.10"),
    C.rowMark(1, 1),
    C.rowMark(2, 14),
  ];
}

function everyString(): string[] {
  const C = PRECON_COPY;
  return [
    ...Object.values(C).flatMap((v) => (typeof v === "string" ? [v] : [])),
    ...NAMES.flatMap((name) => [C.ask(name), C.owned(name), C.notOwned(name)]),
    ownershipMethod({ collection: false, precon: true }),
    ownershipMethod({ collection: true, precon: true }),
    C.changed(0, 2),
    C.changed(1, 1),
    C.changed(25, 25),
    C.changed(99, 100),
    ...costLines(),
    ...labels(),
  ];
}

describe("PRECON_COPY — the line's words", () => {
  it("unanswered: the precon's name and the brief's question; Yes and No", () => {
    expect(PRECON_COPY.ask("Breed Lethality")).toBe(
      "Started from Breed Lethality, a precon. Do you own it?",
    );
    expect([PRECON_COPY.yes, PRECON_COPY.no]).toEqual(["Yes", "No"]);
  });

  it("answered: a quiet line naming the precon, and Change", () => {
    expect(PRECON_COPY.owned("Breed Lethality")).toBe(
      "Started from Breed Lethality, a precon you own.",
    );
    expect(PRECON_COPY.notOwned("Breed Lethality")).toBe(
      "Started from Breed Lethality, a precon you don't own.",
    );
    expect(PRECON_COPY.change).toBe("Change");
  });

  it("the method's sentence: copies, up to the precon's own quantities", () => {
    expect(PRECON_COPY.method).toBe(
      "Cards from the precon you own count as owned, up to the precon's own quantities.",
    );
  });

  it("a name that begins with The reads as a name: never 'the The'", () => {
    expect(PRECON_COPY.ask("The Hosts of Mordor")).toBe(
      "Started from The Hosts of Mordor, a precon. Do you own it?",
    );
    expect(PRECON_COPY.changesTitle("The Hosts of Mordor")).toBe(
      "Changes from The Hosts of Mordor",
    );
    expect(everyString().filter((s) => /\bthe The\b/.test(s))).toEqual([]);
  });
});

describe("PRECON_COPY — what changed from the precon (PRECON-CHANGES)", () => {
  it("the second line: no changes yet, or the copies out and in, and See changes", () => {
    expect(PRECON_COPY.noChanges).toBe("No changes from the precon yet.");
    expect(PRECON_COPY.changed(25, 25)).toBe("Changed from the precon: 25 out, 25 in.");
    expect(PRECON_COPY.changed(0, 2)).toBe("Changed from the precon: 0 out, 2 in.");
    expect(PRECON_COPY.seeChanges).toBe("See changes");
  });

  it("the sheet: its title, its lead and the two lists' headings", () => {
    expect(PRECON_COPY.changesTitle("Breed Lethality")).toBe("Changes from Breed Lethality");
    expect(PRECON_COPY.changesLead).toBe(
      "What to take out of the precon and what to add to build this list.",
    );
    expect([PRECON_COPY.takeOut, PRECON_COPY.add]).toEqual(["Take out", "Add"]);
    expect(PRECON_COPY.markNote).toBe("A circled plus marks these cards in the deck list.");
    expect([PRECON_COPY.nothingOut, PRECON_COPY.nothingIn]).toEqual([
      "Nothing to take out.",
      "Nothing to add.",
    ]);
  });

  it("the cost line: the sum to the cent, thousands grouped, in copies", () => {
    const line = (usd: number, owned: number, unpriced: number, total: number) =>
      PRECON_COPY.addCost({ usd, owned, unpriced, total });
    expect(line(0, 0, 0, 0)).toBeNull();
    expect(line(66.76, 0, 0, 1)).toBe("The card to add costs $66.76.");
    expect(line(149.1, 0, 0, 3)).toBe("The cards to add cost $149.10.");
    expect(line(1853.32, 0, 0, 24)).toBe("The cards to add cost $1,853.32.");
  });

  it("the cost line: the copies you own are left out and said; all owned says so", () => {
    const line = (usd: number, owned: number, unpriced: number, total: number) =>
      PRECON_COPY.addCost({ usd, owned, unpriced, total });
    expect(line(82.34, 1, 0, 3)).toBe("The cards to add cost $82.34, not counting the 1 you own.");
    expect(line(29.57, 1, 0, 2)).toBe("The card to add costs $29.57, not counting the 1 you own.");
    expect(line(0, 1, 0, 1)).toBe("You own the card to add.");
    expect(line(0, 4, 0, 4)).toBe("You own every card to add.");
  });

  it("the cost line: a card with no price is never $0", () => {
    const line = (usd: number, owned: number, unpriced: number, total: number) =>
      PRECON_COPY.addCost({ usd, owned, unpriced, total });
    expect(line(0, 0, 1, 1)).toBe("No price is known for the card to add.");
    expect(line(0, 0, 3, 3)).toBe("No price is known for the 3 cards to add.");
    expect(line(0, 2, 2, 4)).toBe("No price is known for the 2 cards to add that you don't own.");
    expect(line(149.3, 0, 1, 6)).toBe("The cards to add cost $149.30. 1 more has no price yet.");
    expect(line(12, 2, 2, 9)).toBe(
      "The cards to add cost $12.00, not counting the 2 you own. 2 more have no price yet.",
    );
  });

  it("the row mark: every copy beyond the precon's, or only some of them", () => {
    expect(PRECON_COPY.rowMark(1, 1)).toBe("Not in the precon");
    expect(PRECON_COPY.rowMark(3, 3)).toBe("Not in the precon");
    expect(PRECON_COPY.rowMark(2, 14)).toBe("2 not in the precon");
    expect(PRECON_COPY.added).toBe("Added");
  });

  it("loading, its failure and the rest", () => {
    expect(PRECON_COPY.loading).toBe("Loading the precon's cards…");
    expect(PRECON_COPY.loadFailed).toBe("Couldn't load the precon's cards.");
    expect(PRECON_COPY.retry).toBe("Try again");
    expect(PRECON_COPY.unknownCard).toBe("Unknown card");
    expect(PRECON_COPY.inCollection).toBe("In your collection");
    expect(PRECON_COPY.each("$0.10")).toBe("$0.10 each");
    expect([PRECON_COPY.copy, PRECON_COPY.copyFailed]).toEqual(["Copy as text", "Couldn't copy."]);
  });
});

describe("copy guard (U9)", () => {
  it("reads every string the table has: each plain string and each builder", () => {
    const builders = Object.entries(PRECON_COPY)
      .filter(([, v]) => typeof v === "function")
      .map(([k]) => k);
    expect(builders.sort()).toEqual([...BUILDERS].sort());
    expect(everyString().length).toBeGreaterThan(Object.keys(PRECON_COPY).length);
  });

  it("no em or en dash, no middle dot, never a multi-dot line", () => {
    const words = everyString();
    expect(words.filter((w) => /[–—]|\d-\d/.test(w))).toEqual([]);
    expect(words.filter((w) => w.includes("·"))).toEqual([]);
    expect(words.filter((w) => /\.\./.test(w))).toEqual([]);
  });

  it("plain words, never notation: no '+', no 'est.', no '=' in the precon's own sentences", () => {
    const own = [
      ...Object.values(PRECON_COPY).flatMap((v) => (typeof v === "string" ? [v] : [])),
      ...NAMES.flatMap((n) => [PRECON_COPY.ask(n), PRECON_COPY.owned(n), PRECON_COPY.notOwned(n)]),
      PRECON_COPY.changed(25, 25),
      ...costLines(),
      ...labels(),
    ];
    expect(own.filter((s) => /\d\+|est\.|=|≈|→|×/i.test(s))).toEqual([]);
  });

  it("every sentence ends: a period, the question mark, or the ellipsis of a wait; the labels aside", () => {
    const aside = new Set(labels());
    const sentences = everyString().filter((s) => !aside.has(s));
    expect(sentences.filter((s) => !/[.?…]$/.test(s))).toEqual([]);
    // And a label is never a sentence in disguise.
    expect([...aside].filter((s) => /[.?…]$/.test(s))).toEqual([]);
  });
});
