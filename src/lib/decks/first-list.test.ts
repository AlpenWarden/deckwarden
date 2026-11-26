import { describe, expect, it } from "vitest";

import {
  baselineDate,
  baselineOf,
  baselinePatchBody,
  baselineSchema,
  listComplete,
  normalizeBaseline,
} from "@/lib/decks/first-list";
import { FIRST_LIST_COPY } from "@/lib/decks/first-list-copy";
import type { FormatDef } from "@/lib/games/types";

const commander: Pick<FormatDef, "zones" | "deckSize"> = {
  deckSize: { min: 100, max: 100 },
  zones: [
    { id: "commander", countsTowardSize: true },
    { id: "main", countsTowardSize: true },
    { id: "tokens", countsTowardSize: false },
    { id: "maybeboard", countsTowardSize: false },
  ] as FormatDef["zones"],
};
const open: Pick<FormatDef, "zones" | "deckSize"> = {
  deckSize: { min: 60, max: null },
  zones: [{ id: "main", countsTowardSize: true }] as FormatDef["zones"],
};
const A = "aaaaaaaa-1111-4111-8111-00000000000a";
const B = "aaaaaaaa-1111-4111-8111-00000000000b";

describe("listComplete", () => {
  it("Commander is full at exactly 100 over the counted zones", () => {
    const list = (wastes: number) => [
      { zone: "commander", qty: 1 },
      { zone: "main", qty: wastes },
    ];
    expect(listComplete(list(99), commander)).toBe(true);
    expect(listComplete(list(98), commander)).toBe(false);
    expect(listComplete(list(100), commander)).toBe(false);
  });

  it("Tokens and Maybe count toward no size", () => {
    expect(
      listComplete(
        [
          { zone: "main", qty: 98 },
          { zone: "tokens", qty: 1 },
          { zone: "maybeboard", qty: 1 },
        ],
        commander,
      ),
    ).toBe(false);
  });

  it("a format with no maximum is full from its minimum; an empty list never is", () => {
    expect(listComplete([{ zone: "main", qty: 60 }], open)).toBe(true);
    expect(listComplete([{ zone: "main", qty: 75 }], open)).toBe(true);
    expect(listComplete([{ zone: "main", qty: 59 }], open)).toBe(false);
    expect(listComplete([], { ...open, deckSize: { min: 0, max: null } })).toBe(false);
  });
});

describe("baselineOf", () => {
  it("folds the counted zones per identity, sorted by id, as the precon list is", () => {
    expect(
      baselineOf(
        [
          { cardId: B, zone: "main", qty: 2 },
          { cardId: A, zone: "commander", qty: 1 },
          { cardId: B, zone: "commander", qty: 1 },
          { cardId: A, zone: "maybeboard", qty: 4 },
        ],
        commander,
        "complete",
        "2026-11-26T10:00:00.000Z",
      ),
    ).toEqual({
      source: "complete",
      setAt: "2026-11-26T10:00:00.000Z",
      cards: [
        { cardId: A, qty: 1 },
        { cardId: B, qty: 3 },
      ],
    });
  });
});

describe("the PATCH body", () => {
  it("is canonical: the editor compares bodies as strings", () => {
    expect(baselinePatchBody(null)).toBe('{"baseline":null}');
    const b = { source: "owner" as const, setAt: "2026-11-26T10:00:00.000Z", cards: [] };
    expect(baselinePatchBody(b)).toBe(baselinePatchBody({ ...b }));
  });

  it("normalizes: repeated ids fold, rows sort, a future time is now, a past one stays", () => {
    const now = new Date("2026-11-26T12:00:00.000Z");
    const parsed = baselineSchema.parse({
      source: "owner",
      setAt: "2026-11-27T00:00:00.000Z",
      cards: [
        { cardId: B, qty: 1 },
        { cardId: A, qty: 2 },
        { cardId: B, qty: 1 },
      ],
    });
    expect(normalizeBaseline(parsed, now)).toEqual({
      source: "owner",
      setAt: now,
      cards: [
        { cardId: A, qty: 2 },
        { cardId: B, qty: 2 },
      ],
    });
    const past = baselineSchema.parse({
      source: "complete",
      setAt: "2026-11-20T00:00:00Z",
      cards: [],
    });
    expect(normalizeBaseline(past, now)!.setAt.toISOString()).toBe("2026-11-20T00:00:00.000Z");
    expect(normalizeBaseline(null, now)).toBeNull();
  });

  it("refuses what no editor sends", () => {
    const at = "2026-11-26T10:00:00.000Z";
    for (const bad of [
      { source: "anyone", setAt: at, cards: [] },
      { source: "owner", setAt: "Nov 26", cards: [] },
      { source: "owner", setAt: at, cards: [{ cardId: "x", qty: 1 }] },
      { source: "owner", setAt: at, cards: [{ cardId: A, qty: 1.5 }] },
      { source: "owner", setAt: at, cards: [{ cardId: A, qty: 1000 }] },
    ]) {
      expect(baselineSchema.safeParse(bad).success, JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("baselineDate and the words", () => {
  const now = new Date("2026-11-26T12:00:00.000Z");
  it("the day alone this year, with the year otherwise, in the given time zone", () => {
    expect(baselineDate("2026-11-20T12:00:00.000Z", now, "UTC")).toBe("Nov 20");
    expect(baselineDate("2025-12-31T12:00:00.000Z", now, "UTC")).toBe("Dec 31, 2025");
    // Late on the 20th in UTC is the 21st in Tokyo.
    expect(baselineDate("2026-11-20T23:00:00.000Z", now, "Asia/Tokyo")).toBe("Nov 21");
  });

  it("two voices: the first full list, or the owner's list of a day", () => {
    expect(FIRST_LIST_COPY.changed("complete", "", 3, 2)).toBe(
      "Changed from your first full list: 3 out, 2 in.",
    );
    expect(FIRST_LIST_COPY.changed("owner", "Nov 20", 3, 2)).toBe(
      "Changed since your list of Nov 20: 3 out, 2 in.",
    );
    expect(FIRST_LIST_COPY.noChanges("complete", "")).toBe(
      "No changes from your first full list yet.",
    );
    expect(FIRST_LIST_COPY.noChanges("owner", "Nov 20")).toBe(
      "No changes since your list of Nov 20.",
    );
    expect(FIRST_LIST_COPY.rowMark("complete", "", 1, 1)).toBe("Not in your first full list");
    expect(FIRST_LIST_COPY.rowMark("owner", "Nov 20", 2, 14)).toBe("2 not in your list of Nov 20");
  });
});
