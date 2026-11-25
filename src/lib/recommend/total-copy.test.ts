/**
 * AUTOFILL-TOTAL: the Autofill sheet's words about a deck total, exact, and
 * U9's marks over every line they can say. The toast's target-only line is
 * AUTOFILL-TARGET's own sentence, so an Add that moves the target alone
 * reads as it always has.
 */
import { describe, expect, it } from "vitest";

import { autofillTargetTitle, autofillTargetToast } from "@/lib/brackets/autofill-target";
import { getAdapter } from "@/lib/games/registry";
import {
  autofillSavedToast,
  autofillTotalNote,
  autofillTotalTitle,
  deckTotalLine,
  TOTAL_COPY,
} from "./total-copy";

const brackets = getAdapter("mtg").brackets!;

describe("autofillTotalNote — under the control, what Add will do to the deck's total", () => {
  it("nothing when Add would leave the total as it is", () => {
    expect(autofillTotalNote(null, null)).toBeNull();
    expect(autofillTotalNote(100, 100)).toBeNull();
  });

  it("set, changed and removed, each in one line; a total that will be saved says who sees it", () => {
    expect(autofillTotalNote(null, 100)).toBe(
      "Adding these cards saves $100 as this deck's total. Only you see a deck's total.",
    );
    expect(autofillTotalNote(150, 100)).toBe(
      "Adding these cards changes this deck's total from $150 to $100. Only you see a deck's total.",
    );
    expect(autofillTotalNote(1500, 12000)).toBe(
      "Adding these cards changes this deck's total from $1,500 to $12,000. Only you see a deck's total.",
    );
    expect(autofillTotalNote(150, null)).toBe("Adding these cards removes this deck's total.");
  });
});

describe("the toast after Add: what was saved besides the cards, and what Undo leaves", () => {
  it("the total's title", () => {
    expect(autofillTotalTitle(null, null)).toBeNull();
    expect(autofillTotalTitle(100, 100)).toBeNull();
    expect(autofillTotalTitle(null, 100)).toBe("Deck total set: $100");
    expect(autofillTotalTitle(150, 100)).toBe("Deck total changed from $150 to $100");
    expect(autofillTotalTitle(150, null)).toBe("Deck total removed");
  });

  it("the total alone, the target alone (AUTOFILL-TARGET's sentence, word for word), both, and neither", () => {
    expect(autofillSavedToast(null, autofillTotalTitle(null, 100))).toBe(
      "Deck total set: $100. Undo takes the cards back, not the total.",
    );
    expect(autofillSavedToast(null, autofillTotalTitle(150, null))).toBe(
      "Deck total removed. Undo takes the cards back, not the total.",
    );
    const target = autofillTargetTitle(brackets, null, 3);
    expect(target).toBe("Target set: Bracket 3 (Upgraded)");
    expect(autofillSavedToast(target, null)).toBe(
      "Target set: Bracket 3 (Upgraded). Undo takes the cards back, not the target.",
    );
    // The same line the editor showed before the total existed, for every move of the target.
    for (const [from, to] of [
      [null, 2],
      [2, 3],
      [4, null],
    ] as const) {
      expect(autofillSavedToast(autofillTargetTitle(brackets, from, to), null)).toBe(
        autofillTargetToast(brackets, from, to),
      );
    }
    expect(autofillSavedToast(target, autofillTotalTitle(null, 100))).toBe(
      "Target set: Bracket 3 (Upgraded). Deck total set: $100. Undo takes the cards back, not the target or the total.",
    );
    expect(autofillSavedToast(null, null)).toBeNull();
    expect(autofillTargetTitle(brackets, 3, 3)).toBeNull();
  });
});

describe("deckTotalLine — the footer's figure for the whole deck", () => {
  it("the Fit sheet's phrase under the control's own label", () => {
    expect(deckTotalLine(100, { usd: 97.4, unpriced: 0 })).toBe(
      "Deck total: est. $97 of your $100",
    );
    expect(deckTotalLine(100, { usd: 131.2, unpriced: 3 })).toBe(
      "Deck total: est. $131 of your $100 (+3 unpriced)",
    );
    // Whole dollars would read as the total itself: the cents show which side it is on.
    expect(deckTotalLine(100, { usd: 100.4, unpriced: 0 })).toBe(
      "Deck total: est. $100.40 of your $100",
    );
    expect(deckTotalLine(100, { usd: 100, unpriced: 0 })).toBe(
      "Deck total: est. $100 of your $100",
    );
    expect(deckTotalLine(100, { usd: 99.6, unpriced: 0 })).toBe(
      "Deck total: est. $99.60 of your $100",
    );
  });
});

describe("U9's marks over every line", () => {
  const every = [
    ...Object.values(TOTAL_COPY).map((v) => (typeof v === "function" ? v("$150", "$100") : v)),
    autofillTotalNote(null, 100)!,
    autofillTotalNote(150, 100)!,
    autofillTotalNote(150, null)!,
    autofillSavedToast("Target set: Bracket 3 (Upgraded)", "Deck total set: $100")!,
    autofillSavedToast(null, "Deck total removed")!,
    deckTotalLine(100, { usd: 131.2, unpriced: 3 }),
  ];

  it("reads every string", () => {
    expect(every.length).toBeGreaterThan(15);
    expect(every.every((s) => typeof s === "string" && s.length > 0)).toBe(true);
  });

  it("no dash aside, no middle dot, no notation, and it names no bracket term of its own", () => {
    expect(every.filter((s) => /[—–·]/.test(s))).toEqual([]);
    expect(every.filter((s) => /\d\+|≤|≥/.test(s))).toEqual([]);
    const own = every.filter((s) => !s.startsWith("Target set"));
    expect(own.filter((s) => /Game Changer|Bracket/.test(s))).toEqual([]);
  });
});
