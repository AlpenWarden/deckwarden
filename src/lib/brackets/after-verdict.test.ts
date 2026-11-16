/**
 * The verdict under a list a sheet is about to apply (BRACKET-UP's
 * after-line, shared with AUTOFILL-TARGET's): what is above the target,
 * whether the floor reaches it, what the first sentence is about, and what
 * proves the floor. Over hand-built reads, and over the real adapter's read
 * of a list with Game Changers.
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
import { getAdapter } from "@/lib/games/registry";
import type { BracketFactor, BracketFreshness, BracketRead } from "@/lib/games/types";

import { afterVerdict } from "./after-verdict";

const brackets = getAdapter("mtg").brackets!;

function read(over: Partial<BracketRead> = {}): BracketRead {
  return {
    status: "read",
    minimum: 1,
    suggested: null,
    factors: [],
    assumptions: [],
    review: [],
    blockedBy: [],
    conflicts: [],
    ruleset: { version: 1, asOf: "2025-11-05" },
    answersStale: false,
    ...over,
  };
}

const factor = (id: string, atLeast: number | null): BracketFactor => ({
  id,
  sentence: `${id} at ${atLeast}`,
  cards: [],
  source: "test",
  atLeast,
  change: null,
});

describe("afterVerdict — a read against a target", () => {
  it("nothing flagged: the head says nothing is raised; a target of 1 is reached, 2 and up are not", () => {
    const r = read();
    expect(afterVerdict(brackets, r, 1)).toEqual({
      above: [],
      reached: true,
      head: { kind: "nothing" },
      proving: [],
    });
    for (const target of [2, 3, 4, 5]) {
      expect(afterVerdict(brackets, r, target).reached).toBe(false);
    }
  });

  it("a floor: the head names it, the findings at it prove it, and it reaches every target at or under it", () => {
    const gc = factor("game-changers", 3);
    const turns = factor("extra-turns", 2);
    const r = read({ minimum: 3, factors: [gc, turns, factor("unchecked:combos", null)] });
    const v = afterVerdict(brackets, r, 3);
    expect(v.head).toEqual({ kind: "floor", level: 3 });
    expect(v.proving).toEqual([gc]);
    expect(v.reached).toBe(true);
    expect(afterVerdict(brackets, r, 2).reached).toBe(true);
    expect(afterVerdict(brackets, r, 4).reached).toBe(false);
    expect(afterVerdict(brackets, r, 5).reached).toBe(false);
  });

  it("findings above the target lead, in the read's order, and nothing is reached", () => {
    const land = factor("land-denial", 4);
    const gc = factor("game-changers", 3);
    const r = read({
      minimum: 4,
      factors: [land, gc],
      conflicts: ["game-changers", "land-denial"],
    });
    const v = afterVerdict(brackets, r, 2);
    expect(v.above).toEqual([land, gc]);
    expect(v.head).toEqual({ kind: "above", count: 2 });
    expect(v.reached).toBe(false);
    // What proves the floor is still the read's own.
    expect(v.proving).toEqual([land]);
  });

  it("answers: the head says the level they point to, and that level is what reaches a target", () => {
    const r = read({ minimum: 3, suggested: 4, factors: [factor("game-changers", 3)] });
    expect(afterVerdict(brackets, r, 4)).toMatchObject({
      head: { kind: "answers", level: 4 },
      reached: true,
    });
    expect(afterVerdict(brackets, r, 5).reached).toBe(false);
    // Answers on a list nothing flags still lead the head.
    expect(afterVerdict(brackets, read({ suggested: 2 }), 2)).toMatchObject({
      head: { kind: "answers", level: 2 },
      reached: true,
      proving: [],
    });
  });

  it("no target: nothing is above one and nothing is reached, whatever the cards show", () => {
    const r = read({ minimum: 4, factors: [factor("game-changers", 4)] });
    expect(afterVerdict(brackets, r, null)).toEqual({
      above: [],
      reached: false,
      head: { kind: "floor", level: 4 },
      proving: [factor("game-changers", 4)],
    });
    expect(afterVerdict(brackets, read(), null).reached).toBe(false);
  });

  it("the lowest level is the adapter's, never a number written here", () => {
    const from2 = { levels: [{ level: 2, name: "Two" }] };
    expect(afterVerdict(from2, read({ minimum: 2, factors: [factor("x", 2)] }), 2)).toEqual({
      above: [],
      reached: true,
      head: { kind: "nothing" },
      proving: [],
    });
  });
});

describe("afterVerdict — over the real read", () => {
  const FRESH: BracketFreshness = {
    readAt: "2026-11-16T00:00:00.000Z",
    feeds: Object.fromEntries(
      ["gameChangers", "landDenial", "extraTurns", "combos"].map((feed) => [
        feed,
        { state: "ok" as const, asOf: "2026-11-15T00:00:00.000Z" },
      ]),
    ),
  };
  const changer = (name: string) =>
    card({ name, attrs: { type_line: "Sorcery", oracle_text: "", game_changer: true } });
  const assess = (changers: number, target: number | null) => {
    const held = Array.from({ length: changers }, (_, i) => changer(`Changer ${i + 1}`));
    const main = [...held, ...fillers(99 - changers)];
    return brackets.assess({
      deck: commanderDeck(
        [atraxa],
        main.map((c) => entry(c)),
      ),
      cards: cardMap([atraxa, ...main]),
      combos: [],
      freshness: FRESH,
      targetLevel: target,
      answers: null,
    });
  };

  it("three Game Changers reach a target of 3 and stop short of 4", () => {
    const at3 = afterVerdict(brackets, assess(3, 3), 3);
    expect(at3.reached).toBe(true);
    expect(at3.head).toEqual({ kind: "floor", level: 3 });
    expect(at3.proving.map((f) => f.id)).toEqual(["game-changers"]);
    expect(afterVerdict(brackets, assess(3, 4), 4).reached).toBe(false);
  });

  it("one Game Changer is above a target of 2, and named", () => {
    const v = afterVerdict(brackets, assess(1, 2), 2);
    expect(v.above.map((f) => f.id)).toEqual(["game-changers"]);
    expect(v.head).toEqual({ kind: "above", count: 1 });
    expect(v.reached).toBe(false);
  });

  it("a list nothing flags is not said to reach a target of 2 by this rule (the callers' bands decide that)", () => {
    const v = afterVerdict(brackets, assess(0, 2), 2);
    expect(v.head).toEqual({ kind: "nothing" });
    expect(v.reached).toBe(false);
  });
});
