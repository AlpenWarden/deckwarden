/**
 * AUTOFILL-TARGET's words, over the real adapter: the line under the
 * choice, the toast's second line, and the after-line's cases — each one a
 * row of step 0's table (REDESIGN.md, AUTOFILL-TARGET) or a case the corpus
 * could not hold (the commander or a kept card above the choice, a short
 * list, a card that isn't legal, a feed that couldn't be checked).
 */
import { describe, expect, it } from "vitest";

import {
  atraxa,
  card,
  cardMap,
  commanderDeck,
  entry,
  fillers,
} from "@/lib/games/mtg/test-fixtures";
import type { MtgCard } from "@/lib/games/mtg/test-fixtures";
import { getAdapter } from "@/lib/games/registry";
import type { BracketAnswers, BracketFreshness, BracketInput } from "@/lib/games/types";

import { autofillAfter, autofillTargetNote, autofillTargetToast } from "./autofill-target";
import { belowTargetBand } from "./target-bands";

const brackets = getAdapter("mtg").brackets!;

const feeds = (state: "ok" | "stale") =>
  Object.fromEntries(
    ["gameChangers", "landDenial", "extraTurns", "combos"].map((feed) => [
      feed,
      { state, asOf: "2026-11-15T00:00:00.000Z" },
    ]),
  );
const FRESH: BracketFreshness = { readAt: "2026-11-16T00:00:00.000Z", feeds: feeds("ok") };
const STALE: BracketFreshness = { readAt: "2026-11-30T00:00:00.000Z", feeds: feeds("stale") };

const changer = (name: string) =>
  card({ name, attrs: { type_line: "Sorcery", oracle_text: "", game_changer: true } });
const turn = card({
  name: "Time Warp",
  attrs: { type_line: "Sorcery", oracle_text: "", extra_turn: true },
});
/** A card the read asks about: land denial that depends on how it is played, a call up to Bracket 4. */
const edge = card({
  name: "Tectonic Edge",
  primaryType: "Land",
  costValue: null,
  attrs: { type_line: "Land", oracle_text: "", mld: "edge" },
});

/** A list of `size` cards with the commander: `changers` Game Changers, `extra` cards, fillers for the rest. */
function after({
  target,
  changers = 0,
  extra = [] as MtgCard[],
  size = 100,
  commander = atraxa,
  freshness = FRESH,
  answers = null as BracketAnswers | null,
  upgradeDoor = true,
}: {
  target: number | null;
  changers?: number;
  extra?: MtgCard[];
  size?: number;
  commander?: MtgCard;
  freshness?: BracketFreshness;
  answers?: BracketAnswers | null;
  upgradeDoor?: boolean;
}) {
  const held = [
    ...Array.from({ length: changers }, (_, i) => changer(`Changer ${i + 1}`)),
    ...extra,
  ];
  const main = [...held, ...fillers(size - 1 - held.length)];
  const deck = commanderDeck(
    [commander],
    main.map((c) => entry(c)),
  );
  const cards = cardMap([commander, ...main]);
  const input: BracketInput = { deck, cards, combos: [], freshness, targetLevel: target, answers };
  const read = brackets.assess(input);
  const toGo = 100 - size;
  const line = brackets.line(read, {
    deck,
    cards,
    progress: toGo > 0 ? `add ${toGo} more cards` : null,
    targetLevel: target,
  });
  return { read, line, words: autofillAfter({ brackets, read, input, target, line, upgradeDoor }) };
}

describe("autofillTargetNote — under the choice, only when Add would move the deck's target", () => {
  it("the same level, or Not set on a deck with none: nothing", () => {
    expect(autofillTargetNote(brackets, null, null, true)).toBeNull();
    expect(autofillTargetNote(brackets, 3, 3, true)).toBeNull();
  });

  it("a target where there was none: set, in the level's own words, and where a target shows", () => {
    expect(autofillTargetNote(brackets, null, 2, true)).toBe(
      "Adding these cards sets this deck's target to Bracket 2 (Core). A target shows on your share page, in link previews and where the deck is listed.",
    );
    // A private deck's preview is the generic image: the note leaves link previews out.
    expect(autofillTargetNote(brackets, null, 2, false)).toBe(
      "Adding these cards sets this deck's target to Bracket 2 (Core). A target shows on your share page and where the deck is listed.",
    );
  });

  it("another level: changed, 'to' between the two; Not set on a deck with a target: cleared", () => {
    expect(autofillTargetNote(brackets, 2, 3, true)).toBe(
      "Adding these cards changes this deck's target from Bracket 2 to Bracket 3. A target shows on your share page, in link previews and where the deck is listed.",
    );
    expect(autofillTargetNote(brackets, 4, null, true)).toBe(
      "Adding these cards clears this deck's target.",
    );
  });
});

describe("autofillTargetToast — the toast's second line when Add moved the target", () => {
  it("TARGET-CHANGES' titles, then what the Undo leaves", () => {
    expect(autofillTargetToast(brackets, null, 3)).toBe(
      "Target set: Bracket 3 (Upgraded). Undo takes the cards back, not the target.",
    );
    expect(autofillTargetToast(brackets, 2, 4)).toBe(
      "Target changed from Bracket 2 to Bracket 4. Undo takes the cards back, not the target.",
    );
    expect(autofillTargetToast(brackets, 2, null)).toBe(
      "Target cleared. Undo takes the cards back, not the target.",
    );
  });

  it("a target that didn't move says nothing", () => {
    expect(autofillTargetToast(brackets, null, null)).toBeNull();
    expect(autofillTargetToast(brackets, 3, 3)).toBeNull();
  });
});

describe("autofillAfter — step 0's rows", () => {
  it("no target: what the cards show, and nothing about a target", () => {
    expect(after({ target: null, changers: 6 }).words).toEqual({
      kind: "open",
      head: "With these added, the cards show at least Bracket 4 (Optimized).",
      notes: [],
      status: "With these added, the cards show at least Bracket 4 (Optimized).",
    });
    expect(after({ target: null }).words).toMatchObject({
      kind: "open",
      head: "With these added, nothing in the list raises the bracket.",
    });
  });

  it("targets 1 and 2, a list nothing flags: nothing goes past the target, which is named and never said to be shown", () => {
    for (const [target, level] of [
      [1, "Bracket 1 (Exhibition)"],
      [2, "Bracket 2 (Core)"],
    ] as const) {
      const { words, line } = after({ target });
      expect(words).toEqual({
        kind: "within",
        head: `With these added, nothing in the list goes past ${level}.`,
        notes: [],
        status: `With these added, nothing in the list goes past ${level}.`,
      });
      // The deck pane's own line for the same list.
      expect(line).toBe(`Your target: Bracket ${target} · nothing here goes past Core`);
    }
  });

  it("target 2 with the one extra-turn card it allows: the cards show 2, and that is the target", () => {
    const { words, line } = after({ target: 2, extra: [turn] });
    expect(words).toMatchObject({
      kind: "reached",
      head: "With these added, the cards show at least Bracket 2 (Core). That's your target.",
      notes: [],
    });
    expect(line).toBe("Your target: Bracket 2 · the cards say at least 2");
  });

  it("target 3 with Game Changers: reached", () => {
    for (const changers of [1, 2, 3]) {
      const { words, line } = after({ target: 3, changers });
      expect(words).toMatchObject({
        kind: "reached",
        head: "With these added, the cards show at least Bracket 3 (Upgraded). That's your target.",
      });
      expect(line).toBe("Your target: Bracket 3 · the cards say at least 3");
    }
  });

  it("target 4: four Game Changers reach it; three stop at 3, a ceiling Autofill doesn't build up to, with the door named", () => {
    expect(after({ target: 4, changers: 4 }).words).toMatchObject({
      kind: "reached",
      head: "With these added, the cards show at least Bracket 4 (Optimized). That's your target.",
    });
    const short = after({ target: 4, changers: 3 });
    expect(short.words).toEqual({
      kind: "below",
      head: "With these added, the cards show at least Bracket 3 (Upgraded).",
      notes: [
        "Autofill keeps a shell at or under its target and doesn't build up to it.",
        "Once these are in, Why? offers Upgrade toward Bracket 4.",
      ],
      status: "With these added, the cards show at least Bracket 3 (Upgraded).",
    });
    expect(short.line).toBe("Your target: Bracket 4 · the cards say at least 3");
    // Without the editor's door (a game that can't swap Suggestions in), the ceiling alone.
    expect(after({ target: 4, changers: 3, upgradeDoor: false }).words).toMatchObject({
      kind: "below",
      notes: ["Autofill keeps a shell at or under its target and doesn't build up to it."],
    });
  });

  it("target 3 on a list nothing flags: below, in the read's words", () => {
    expect(after({ target: 3 }).words).toMatchObject({
      kind: "below",
      head: "With these added, nothing in the list raises the bracket.",
      notes: [
        "Autofill keeps a shell at or under its target and doesn't build up to it.",
        "Once these are in, Why? offers Upgrade toward Bracket 3.",
      ],
    });
  });

  it("target 5: never claimed from cards. At 4 the rest is How it plays; short of 4, the ceiling", () => {
    const top = after({ target: 5, changers: 9 });
    expect(top.words).toEqual({
      kind: "below",
      head: "With these added, the cards show at least Bracket 4 (Optimized).",
      notes: [
        "Cards can only show a floor. Once these are in, Why? has How it plays, where you can say the deck plays at Bracket 5 (cEDH).",
      ],
      status: "With these added, the cards show at least Bracket 4 (Optimized).",
    });
    expect(top.line).toBe("Your target: Bracket 5 · the cards say at least 4");
    expect(after({ target: 5, changers: 3 }).words).toMatchObject({
      kind: "below",
      head: "With these added, the cards show at least Bracket 3 (Upgraded).",
      notes: [
        "Autofill keeps a shell at or under its target and doesn't build up to it.",
        "Once these are in, Why? offers Upgrade toward Bracket 5.",
      ],
    });
    for (const changers of [0, 1, 4, 12]) {
      const { words } = after({ target: 5, changers });
      expect(words.kind).toBe("below");
      if (words.kind === "below") expect(words.head).not.toContain("Bracket 5");
    }
  });
});

describe("autofillAfter — what the corpus could not hold", () => {
  it("a commander that is itself a Game Changer, under a target of 2: named, in the read's own sentence", () => {
    const urza = changer("Urza, Lord High Artificer");
    const { words } = after({ target: 2, commander: urza });
    expect(words.kind).toBe("above");
    if (words.kind !== "above") return;
    expect(words.lead).toBe("With these added, these put the deck above Bracket 2:");
    expect(words.above.map((f) => f.id)).toEqual(["game-changers"]);
    expect(words.above[0].sentence).toBe(
      "1 Game Changer: Urza, Lord High Artificer. Brackets 1 and 2 allow none.",
    );
    expect(words.status).toBe("With these added, 1 thing puts the deck above Bracket 2.");
  });

  it("two findings above the choice: both, and the count agrees", () => {
    const { words } = after({ target: 1, changers: 1, extra: [turn] });
    expect(words.kind).toBe("above");
    if (words.kind !== "above") return;
    expect(words.above.map((f) => f.id)).toEqual(["game-changers", "extra-turns"]);
    expect(words.status).toBe("With these added, 2 things put the deck above Bracket 1.");
  });

  it("a short list (picks unchecked): the deck's own line, quoted, and no claim", () => {
    const { words, line } = after({ target: 3, changers: 3, size: 88 });
    expect(line).toBe("Bracket: add 12 more cards · 3 Game Changers so far");
    expect(words).toEqual({
      kind: "line",
      lead: "With these added, the deck's bracket line says:",
      line,
      status: `With these added, the deck's bracket line says: ${line}`,
    });
    // Short and above the choice: what is above still leads.
    expect(after({ target: 2, changers: 1, size: 88 }).words.kind).toBe("above");
  });

  it("a kept card that isn't legal: the line that says the read needs a legal list", () => {
    const banned = card({ name: "Banned Card", legality: [{ status: "banned" }] });
    const { words } = after({ target: 3, changers: 3, extra: [banned] });
    expect(words).toMatchObject({
      kind: "line",
      line: "Bracket read needs a legal list · 1 banned card",
    });
  });

  it("a feed that couldn't be checked: the line says so, and the target is never claimed", () => {
    const stale = after({ target: 3, changers: 3, freshness: STALE });
    expect(stale.read.status).toBe("unavailable");
    expect(stale.words).toMatchObject({
      kind: "line",
      line: "Your target: Bracket 3 · the cards say at least 3. Couldn't check Game Changers, mass land denial, extra turns and combos",
    });
    expect(after({ target: null, freshness: STALE }).words).toMatchObject({
      kind: "line",
      line: "Bracket read incomplete · Couldn't check Game Changers, mass land denial, extra turns and combos",
    });
  });

  it("a call that is the player's: the deck's own line says it, and no verdict is given at any target or at none", () => {
    // Three Game Changers and a card the read asks about: at least 3, a call to 4.
    for (const [target, line] of [
      [null, "Bracket 3 or 4 · one card is your call"],
      [3, "Your target: Bracket 3 · the cards say 3 or 4, one card is your call"],
      [4, "Your target: Bracket 4 · the cards say 3 or 4, one card is your call"],
      [5, "Your target: Bracket 5 · the cards say 3 or 4, one card is your call"],
    ] as const) {
      const got = after({ target, changers: 3, extra: [edge] });
      expect(got.read.status).toBe("review");
      expect(got.words).toEqual({
        kind: "line",
        lead: "With these added, the deck's bracket line says:",
        line,
        status: `With these added, the deck's bracket line says: ${line}`,
      });
    }
    // Nothing else flagged, under a target of 2: never "nothing goes past" while a call could.
    const core = after({ target: 2, extra: [edge] });
    expect(core.words).toMatchObject({
      kind: "line",
      line: "Your target: Bracket 2 · the cards say 1 to 2 or 4, one card is your call",
    });
    // Answered, the call is no longer open: no settles it, yes makes it firm.
    const call = `land-denial:${edge.externalKey}`;
    expect(
      after({
        target: 3,
        changers: 3,
        extra: [edge],
        answers: { rulesetVersion: 1, calls: { [call]: "no" } },
      }).words,
    ).toMatchObject({
      kind: "reached",
      head: "With these added, the cards and your answers say Bracket 3 (Upgraded). That's your target.",
    });
    expect(
      after({
        target: 4,
        changers: 3,
        extra: [edge],
        answers: { rulesetVersion: 1, calls: { [call]: "yes" } },
      }).words,
    ).toMatchObject({
      kind: "reached",
      head: "With these added, the cards and your answers say Bracket 4 (Optimized). That's your target.",
    });
  });

  it("answers under How it plays lead the head, and their level is what reaches a target", () => {
    const answers: BracketAnswers = { rulesetVersion: 1, play: { fast: "yes" } };
    expect(after({ target: 4, changers: 3, answers }).words).toMatchObject({
      kind: "reached",
      head: "With these added, the cards and your answers say Bracket 4 (Optimized). That's your target.",
    });
    expect(after({ target: null, answers }).words).toMatchObject({
      kind: "open",
      head: "With these added, the cards and your answers say Bracket 4 (Optimized).",
    });
  });

  it("answers that say a level past the target: what they say, and never That's your target.", () => {
    // The owner said the deck is tuned for cEDH; the sheet's pick is 3.
    const cedh: BracketAnswers = { rulesetVersion: 1, play: { cedh: "yes" } };
    const over = after({ target: 3, changers: 3, answers: cedh });
    expect(over.read.conflicts).toEqual([]);
    expect(over.words).toEqual({
      kind: "over",
      head: "With these added, the cards and your answers say Bracket 5 (cEDH).",
      notes: [],
      status: "With these added, the cards and your answers say Bracket 5 (cEDH).",
    });
    expect(over.line).toBe("Your target: Bracket 3 · the cards and your answers say 5");
    // On a list nothing flags, under a target of 2, the same: the answers lead.
    expect(after({ target: 2, answers: cedh }).words).toMatchObject({
      kind: "over",
      head: "With these added, the cards and your answers say Bracket 5 (cEDH).",
    });
    // At the level the answers say, it is the target: Bracket 5 from the answers, never from cards.
    expect(after({ target: 5, changers: 4, answers: cedh }).words).toMatchObject({
      kind: "reached",
      head: "With these added, the cards and your answers say Bracket 5 (cEDH). That's your target.",
    });
  });
});

describe("autofillAfter — truth: the verdict agrees with the read, on every list and every choice", () => {
  it("with answers that raise the read (How it plays): never That's your target. unless the level they say is the target", () => {
    const plays: BracketAnswers["play"][] = [
      { theme: "no" },
      { quality: "yes" },
      { fast: "yes" },
      { cedh: "yes" },
    ];
    for (const play of plays) {
      for (const changers of [0, 2, 4]) {
        for (const target of [1, 2, 3, 4, 5]) {
          const { read, words } = after({
            target,
            changers,
            answers: { rulesetVersion: 1, play },
          });
          const at = `${JSON.stringify(play)}, ${changers} changers, target ${target}`;
          if (words.kind === "above" || words.kind === "line") continue;
          const says = read.suggested ?? read.minimum;
          expect(words.kind === "reached", at).toBe(says === target);
          expect(words.kind === "over", at).toBe(says > target);
          expect(words.head.includes("That's your target."), at).toBe(says === target);
        }
      }
    }
  });

  it("0 to 6 Game Changers, with and without an extra-turn card or a card that is a call, at no target and each level", () => {
    for (const changers of [0, 1, 2, 3, 4, 5, 6]) {
      for (const extra of [[], [turn], [edge], [turn, edge]]) {
        for (const target of [null, 1, 2, 3, 4, 5]) {
          const { read, words } = after({ target, changers, extra });
          const floor = read.suggested ?? read.minimum;
          const at = `${changers} changers, ${extra.length} extra, target ${target}`;
          // Above exactly when the read names a conflict.
          expect(words.kind === "above", at).toBe(read.conflicts.length > 0);
          // The deck's own line exactly when something is left open (here, a call).
          expect(words.kind === "line", at).toBe(
            read.conflicts.length === 0 && read.status !== "read",
          );
          if (words.kind === "above" || words.kind === "line") continue;
          expect(read.status, at).toBe("read");
          expect(words.kind === "open", at).toBe(target === null);
          if (target === null) continue;
          // "That's your target." only with the floor at it.
          expect(words.head.includes("That's your target."), at).toBe(words.kind === "reached");
          if (words.kind === "reached") expect(floor, at).toBe(target);
          // Below exactly when the Why sheet would show Below your target.
          expect(words.kind === "below", at).toBe(belowTargetBand(brackets, read, target));
          // The level it names is the read's floor, never the target's.
          if (floor > 1 && words.kind !== "within") {
            expect(words.head, at).toContain(`Bracket ${floor} (`);
          }
        }
      }
    }
  });
});
