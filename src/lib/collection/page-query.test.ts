// @vitest-environment node
/**
 * The collection page's address (COLLECTION-PAGE): what the page reads off
 * a query, the links it builds, and that the two agree. A crafted or broken
 * query reads as a default, never as an error, and the build link is the
 * new-deck link with its two one-time flags.
 */
import { describe, expect, it } from "vitest";

import {
  buildFromCollectionHref,
  COLLECTION_NAME_MAX,
  COLLECTION_PAGE_MAX,
  COLLECTION_PAGE_SIZE,
  collectionHref,
  pageCount,
  pageSlice,
  parseCollectionQuery,
  type CollectionQuery,
} from "./page-query";

const parse = (sp: Record<string, string | string[] | undefined>, rankSort = true) =>
  parseCollectionQuery(sp, { rankSort });

describe("parseCollectionQuery", () => {
  it("the plain address is the leaders, page 1", () => {
    expect(parse({})).toEqual({ view: "leaders", page: 1, sort: "name", q: "" });
  });

  it("view=cards is the card list; anything else is the leaders", () => {
    expect(parse({ view: "cards" }).view).toBe("cards");
    for (const view of ["leaders", "commanders", "CARDS", "", ["cards", "cards"]]) {
      expect(parse({ view }).view, String(view)).toBe("leaders");
    }
  });

  it("a page is a whole number from 1 to the cap; anything else is page 1", () => {
    expect(parse({ page: "2" }).page).toBe(2);
    expect(parse({ view: "cards", page: String(COLLECTION_PAGE_MAX) }).page).toBe(
      COLLECTION_PAGE_MAX,
    );
    for (const page of ["0", "-1", "1.5", "2e2", " 3", "abc", "", "99999", ["2", "3"]]) {
      expect(parse({ page }).page, String(page)).toBe(1);
    }
    expect(parse({ page: String(COLLECTION_PAGE_MAX + 1) }).page).toBe(1);
  });

  it("the card list takes a name and an order; the leaders view drops both", () => {
    expect(parse({ view: "cards", q: "  lightning bolt ", sort: "rank", page: "3" })).toEqual({
      view: "cards",
      page: 3,
      sort: "rank",
      q: "lightning bolt",
    });
    expect(parse({ q: "bolt", sort: "rank", page: "3" })).toEqual({
      view: "leaders",
      page: 3,
      sort: "name",
      q: "",
    });
  });

  it("an unknown order is by name, and so is by rank for a game that has no rank", () => {
    expect(parse({ view: "cards", sort: "price" }).sort).toBe("name");
    expect(parse({ view: "cards", sort: ["rank", "rank"] }).sort).toBe("name");
    expect(parse({ view: "cards", sort: "rank" }, false).sort).toBe("name");
  });

  it("a repeated name is ignored and a long one is cut", () => {
    expect(parse({ view: "cards", q: ["a", "b"] }).q).toBe("");
    expect(parse({ view: "cards", q: "x".repeat(500) }).q).toHaveLength(COLLECTION_NAME_MAX);
  });
});

describe("collectionHref", () => {
  it("leaves every default out", () => {
    expect(collectionHref()).toBe("/collection");
    expect(collectionHref({ page: 1, sort: "name", q: "", view: "leaders" })).toBe("/collection");
    expect(collectionHref({ page: 2 })).toBe("/collection?page=2");
    expect(collectionHref({ view: "cards" })).toBe("/collection?view=cards");
    expect(collectionHref({ view: "cards", q: "bolt", sort: "rank", page: 3 })).toBe(
      "/collection?view=cards&q=bolt&sort=rank&page=3",
    );
  });

  it("never carries a name or an order into the leaders view", () => {
    expect(collectionHref({ view: "leaders", q: "bolt", sort: "rank", page: 2 })).toBe(
      "/collection?page=2",
    );
  });

  it("encodes what was typed", () => {
    expect(collectionHref({ view: "cards", q: "fire & ice?" })).toBe(
      "/collection?view=cards&q=fire+%26+ice%3F",
    );
  });

  it("every state it writes, the page reads back the same", () => {
    const states: CollectionQuery[] = [
      { view: "leaders", page: 1, sort: "name", q: "" },
      { view: "leaders", page: 7, sort: "name", q: "" },
      { view: "cards", page: 1, sort: "name", q: "" },
      { view: "cards", page: 334, sort: "rank", q: "" },
      { view: "cards", page: 2, sort: "name", q: "urza's saga" },
      { view: "cards", page: 1, sort: "rank", q: "fire & ice?" },
    ];
    for (const state of states) {
      const url = new URL(collectionHref(state), "https://deckwarden.invalid");
      expect(url.pathname).toBe("/collection");
      expect(parse(Object.fromEntries(url.searchParams))).toEqual(state);
    }
  });
});

describe("pages", () => {
  it("sixty to a page", () => {
    expect(COLLECTION_PAGE_SIZE).toBe(60);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(1)).toBe(1);
    expect(pageCount(60)).toBe(1);
    expect(pageCount(61)).toBe(2);
    expect(pageCount(20_000)).toBe(334);
    // The cap on the address holds any collection the import keeps.
    expect(COLLECTION_PAGE_MAX).toBeGreaterThanOrEqual(pageCount(20_000));
  });

  it("a page of a list already in order: its sixty, the tail, and nothing past the end", () => {
    const rows = Array.from({ length: 130 }, (_, i) => i);
    expect(pageSlice(rows, 1)).toEqual(rows.slice(0, 60));
    expect(pageSlice(rows, 2)).toEqual(rows.slice(60, 120));
    expect(pageSlice(rows, 3)).toEqual(rows.slice(120));
    expect(pageSlice(rows, 4)).toEqual([]);
  });
});

describe("buildFromCollectionHref", () => {
  it("is the new-deck link with the leader, the sheet open and the owned box ticked", () => {
    const href = buildFromCollectionHref("mtg", "e56f9b46-4bd3-4f4b-8d57-3a4b7d0c7a11");
    expect(href).toBe(
      "/decks/new?game=mtg&leader=e56f9b46-4bd3-4f4b-8d57-3a4b7d0c7a11&autofill=1&owned=1",
    );
  });

  it("names no player and no card but the leader, and encodes the key", () => {
    const url = new URL(buildFromCollectionHref("optcg", "OP01 001&x=1"), "https://x.invalid");
    expect([...url.searchParams.keys()]).toEqual(["game", "leader", "autofill", "owned"]);
    expect(url.searchParams.get("leader")).toBe("OP01 001&x=1");
  });
});
