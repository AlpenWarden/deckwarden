/**
 * A deck total in Suggestions (SUGGEST-TOTAL): the owner's "Fits what's left"
 * as a price limit, which of the two limits binds, the fetch key, and every
 * line the panel can say about it.
 */
import { describe, expect, it } from "vitest";

import {
  fitsLimit,
  limitKey,
  SUGGEST_TOTAL_COPY,
  suggestionLimit,
  suggestTotalLine,
  usdLeft,
} from "./suggest-total";

const est = (usd: number, unpriced = 0) => ({ usd, unpriced });

describe("suggestionLimit", () => {
  it("no total: the tier alone, or no limit at All", () => {
    expect(
      suggestionLimit({ tierUsd: null, totalUsd: null, estimate: est(62), owned: false }),
    ).toEqual({ priceUsd: null, binding: null, leftUsd: null, full: false });
    expect(
      suggestionLimit({ tierUsd: 5, totalUsd: null, estimate: est(62), owned: false }),
    ).toEqual({
      priceUsd: 5,
      binding: "tier",
      leftUsd: null,
      full: false,
    });
  });

  it("a total narrows to what's left, the total less the estimate, to the cent", () => {
    expect(
      suggestionLimit({ tierUsd: null, totalUsd: 100, estimate: est(62.38), owned: false }),
    ).toEqual({ priceUsd: 37.62, binding: "total", leftUsd: 37.62, full: false });
    // A sum of prices a hair off its cents reads as the cents it shows.
    expect(
      suggestionLimit({ tierUsd: null, totalUsd: 1, estimate: est(0.1 + 0.2), owned: false })
        .priceUsd,
    ).toBe(0.7);
    // …and one just under them: $0.29 is 28.999… cents in floating point.
    expect(
      suggestionLimit({ tierUsd: null, totalUsd: 1, estimate: est(0.29), owned: false }).priceUsd,
    ).toBe(0.71);
  });

  it("the tighter limit binds: the tier under what's left, what's left under the tier; a tie reads as the tier", () => {
    expect(suggestionLimit({ tierUsd: 5, totalUsd: 100, estimate: est(62), owned: false })).toEqual(
      {
        priceUsd: 5,
        binding: "tier",
        leftUsd: 38,
        full: false,
      },
    );
    expect(
      suggestionLimit({ tierUsd: 5, totalUsd: 100, estimate: est(96.5), owned: false }),
    ).toEqual({ priceUsd: 3.5, binding: "total", leftUsd: 3.5, full: false });
    expect(
      suggestionLimit({ tierUsd: 5, totalUsd: 100, estimate: est(95), owned: false }).binding,
    ).toBe("tier");
  });

  it("nothing left, at the total or over it: full, nothing to ask", () => {
    expect(
      suggestionLimit({ tierUsd: null, totalUsd: 100, estimate: est(100), owned: false }),
    ).toEqual({ priceUsd: null, binding: null, leftUsd: 0, full: true });
    expect(
      suggestionLimit({ tierUsd: 1, totalUsd: 100, estimate: est(104.2), owned: false }),
    ).toEqual({ priceUsd: null, binding: null, leftUsd: -4.2, full: true });
    // A cent left still fits a card at a cent.
    expect(
      suggestionLimit({ tierUsd: null, totalUsd: 100, estimate: est(99.99), owned: false }),
    ).toMatchObject({ priceUsd: 0.01, full: false });
  });

  it("cards you own, or an estimate not known yet: the total narrows nothing", () => {
    expect(suggestionLimit({ tierUsd: 1, totalUsd: 100, estimate: est(104), owned: true })).toEqual(
      {
        priceUsd: 1,
        binding: "tier",
        leftUsd: null,
        full: false,
      },
    );
    expect(suggestionLimit({ tierUsd: null, totalUsd: 100, estimate: null, owned: false })).toEqual(
      {
        priceUsd: null,
        binding: null,
        leftUsd: null,
        full: false,
      },
    );
  });
});

describe("limitKey", () => {
  it("one string per distinct ask: all, full, or the limit in cents, whichever limit set it", () => {
    const at = (tierUsd: number | null, totalUsd: number | null, usd: number) =>
      limitKey(suggestionLimit({ tierUsd, totalUsd, estimate: est(usd), owned: false }));
    expect(at(null, null, 62)).toBe("all");
    expect(at(null, 100, 100)).toBe("full");
    expect(at(null, 100, 120)).toBe("full");
    expect(at(5, null, 62)).toBe("500");
    // What's left under both tiers asks the same thing: one key.
    expect(at(null, 100, 99.2)).toBe("80");
    expect(at(5, 100, 99.2)).toBe("80");
    expect(at(1, 100, 99.2)).toBe("80");
  });
});

describe("usdLeft", () => {
  it("whole dollars when there are no cents, the cents when there are", () => {
    expect(usdLeft(38)).toBe("$38");
    expect(usdLeft(37.62)).toBe("$37.62");
    expect(usdLeft(0.05)).toBe("$0.05");
    expect(usdLeft(1204.5)).toBe("$1,204.50");
    expect(usdLeft(2500)).toBe("$2,500");
  });
});

describe("suggestTotalLine", () => {
  /** The line for a deck at est. `usd` (default $62) against `totalUsd` (default $100, saved). */
  const line = ({
    usd = 62,
    ...over
  }: Partial<Parameters<typeof suggestTotalLine>[0]> & { usd?: number }) => {
    const totalUsd = over.totalUsd === undefined ? 100 : over.totalUsd;
    return suggestTotalLine({
      totalUsd,
      savedUsd: 100,
      limit: suggestionLimit({ tierUsd: null, totalUsd, estimate: est(usd), owned: false }),
      toAdd: 38,
      owned: false,
      phrase: "est. $62 of your $100",
      ...over,
    });
  };

  it("the saved total: what's left and for how many cards (the goals line above has the estimate)", () => {
    expect(line({})).toBe("$38 left for 38 more cards");
    expect(line({ toAdd: 1 })).toBe("$38 left for 1 more card");
    expect(line({ toAdd: 0 })).toBe("$38 left");
  });

  it("a total of the panel's own leads with its own phrase", () => {
    expect(line({ savedUsd: null })).toBe("est. $62 of your $100 · $38 left for 38 more cards");
    expect(line({ savedUsd: 150 })).toBe("est. $62 of your $100 · $38 left for 38 more cards");
  });

  it("nothing left: the list's place says it, so the line keeps only an unsaved total's phrase", () => {
    expect(line({ usd: 104, phrase: "est. $104 of your $100" })).toBeNull();
    expect(line({ usd: 104, phrase: "est. $104 of your $100", savedUsd: null })).toBe(
      "est. $104 of your $100",
    );
  });

  it("no total, or one that narrows nothing: no line, or the owned sentence", () => {
    expect(line({ totalUsd: null })).toBeNull();
    expect(line({ owned: true })).toBe(SUGGEST_TOTAL_COPY.owned);
    expect(
      suggestTotalLine({
        totalUsd: 100,
        savedUsd: 100,
        limit: suggestionLimit({ tierUsd: null, totalUsd: 100, estimate: null, owned: false }),
        toAdd: 38,
        owned: false,
        phrase: "$100 total",
      }),
    ).toBeNull();
  });
});

describe("fitsLimit", () => {
  it("a shown row against the limit now, to the cent; no price never fits a limit; no limit fits all", () => {
    expect(fitsLimit("9.00", null)).toBe(true);
    expect(fitsLimit(null, null)).toBe(true);
    expect(fitsLimit(null, 5)).toBe(false);
    expect(fitsLimit("37.62", 37.62)).toBe(true);
    expect(fitsLimit("37.63", 37.62)).toBe(false);
    // $0.29 is 28.999… cents in floating point, and still fits $0.29.
    expect(fitsLimit(0.29, 0.29)).toBe(true);
    expect(fitsLimit("not a price", 5)).toBe(false);
  });
});

describe("SUGGEST_TOTAL_COPY", () => {
  it("says what to do when nothing fits, and when nothing came back", () => {
    // Not set drops the total; a per-card tier still holds, so it promises no more.
    expect(SUGGEST_TOTAL_COPY.full("$100")).toBe(
      "Nothing more fits under your $100 total. Raise it, or choose Not set to drop it.",
    );
    expect(SUGGEST_TOTAL_COPY.noneLeft("$3.50", "$100")).toBe(
      "No suggestions fit the $3.50 left of your $100 total.",
    );
    expect(SUGGEST_TOTAL_COPY.owned).toBe(
      "Cards you own cost nothing to add, so the total doesn't narrow this list.",
    );
  });
});
