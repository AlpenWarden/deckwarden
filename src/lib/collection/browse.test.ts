// @vitest-environment node
/**
 * The collection page's card list (COLLECTION-PAGE): one statement a page,
 * as the REAL drizzle builders render it over a fake postgres.js client.
 *
 * - One row per card: the player's rows are folded by card with their
 *   copies added up before anything is sorted.
 * - Keyed by the player's id, bound once, with no list of cards.
 * - Sixty a page, in one of two orders that both end on the card's id, so
 *   two pages never share a row; the total is a window count on the same
 *   statement.
 * - The name filter is the site's matcher in its "list" reading, added to
 *   the conditions; the order stays the reader's.
 *
 * That the statement returns the right rows is the smoke's
 * (`pnpm smoke:collection`), against the database.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

interface Statement {
  sql: string;
  params: unknown[];
}
let statements: Statement[] = [];
let answer: unknown[][] = [];

const fakeClient = {
  options: { parsers: {}, serializers: {} },
  unsafe(sql: string, params: unknown[]) {
    statements.push({ sql, params });
    return { values: async () => answer, then: undefined };
  },
};
const fakeDb = drizzle(fakeClient as never, { schema });

vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: () => fakeDb,
}));

const { loadOwnedCards } = await import("./browse");

const PLAYER = "00000000-0000-4000-8000-0000000000aa";
const base = { userId: PLAYER, gameId: 1, page: 1, sort: "name" as const };

/** The one statement the call sent. */
function sent(): Statement {
  expect(statements).toHaveLength(1);
  return statements[0];
}

const ORDER_BY_NAME =
  /order by "card_identities"\."name_norm" ASC, "card_identities"\."id" ASC limit/;
const ORDER_BY_RANK =
  /order by "card_identities"\."popularity" ASC NULLS LAST, "card_identities"\."name_norm" ASC, "card_identities"\."id" ASC limit/;

beforeEach(() => {
  statements = [];
  answer = [];
});

describe("loadOwnedCards — the statement", () => {
  it("folds the player's rows to cards with their copies added up, for one game, sixty to a page", async () => {
    await loadOwnedCards(base);
    const { sql, params } = sent();
    // The player, the game and the page's size: three values (page 1 has no offset).
    expect(params).toEqual([PLAYER, 1, 60]);
    expect(sql).not.toMatch(/in \(\$\d+, \$\d+|= any\(/i);
    // One row per card: every printing and finish of it, summed.
    expect(sql).toMatch(
      /\(select "card_printings"\."card_identity_id", sum\("collections"\."quantity"\)::int as "copies" from "collections" inner join "card_printings" on "card_printings"\."id" = "collections"\."printing_id" where "collections"\."user_id" = \$1 group by "card_printings"\."card_identity_id"\) "owned"/,
    );
    expect(sql).toMatch(
      /inner join "card_identities" on "card_identities"\."id" = "owned"\."card_identity_id"/,
    );
    expect(sql).toMatch(/where "card_identities"\."game_id" = \$2 order by/);
    // The total rides the same statement.
    expect(sql).toMatch(/\(count\(\*\) OVER \(\)\)::int/);
    expect(sql).toMatch(/limit \$3$/);
  });

  it("by name: A to Z, the id last so pages never overlap", async () => {
    await loadOwnedCards(base);
    expect(sent().sql).toMatch(ORDER_BY_NAME);
  });

  it("by rank: most played first, unranked cards last, then the name and the id", async () => {
    await loadOwnedCards({ ...base, sort: "rank" });
    const { sql } = sent();
    expect(sql).toMatch(ORDER_BY_RANK);
    expect(sql).not.toMatch(ORDER_BY_NAME);
  });

  it("a page is an offset of sixty rows a page: the last page is the same statement, cut further down", async () => {
    await loadOwnedCards({ ...base, page: 2 });
    expect(sent().params).toEqual([PLAYER, 1, 60, 60]);
    expect(sent().sql).toMatch(/limit \$3 offset \$4$/);
    statements = [];
    await loadOwnedCards({ ...base, page: 334 });
    expect(sent().params).toEqual([PLAYER, 1, 60, 333 * 60]);
  });

  it("a name narrows the list with the site's matcher: every word somewhere in the name, near misses from four characters", async () => {
    await loadOwnedCards({ ...base, q: "Lightning  BOLT" });
    const { sql, params } = sent();
    expect(params).toEqual([PLAYER, 1, "%lightning%", "%bolt%", "lightning bolt", 60]);
    expect(sql).toMatch(
      /"card_identities"\."game_id" = \$2 and \(\("card_identities"\."name_norm" LIKE \$3 AND "card_identities"\."name_norm" LIKE \$4\) OR "card_identities"\."name_norm" % \$5\)/,
    );
    // The order is still the reader's, never the matcher's ranking.
    expect(sql).toMatch(ORDER_BY_NAME);
    expect(sql).not.toMatch(/similarity\(/);
  });

  it("a short name matches by containment alone; with by-rank it keeps that order", async () => {
    await loadOwnedCards({ ...base, sort: "rank", q: "ur" });
    const { sql, params } = sent();
    expect(params).toEqual([PLAYER, 1, "%ur%", 60]);
    expect(sql).not.toMatch(/ % \$/);
    expect(sql).toMatch(ORDER_BY_RANK);
  });

  it("a typed wildcard is a character, not a pattern", async () => {
    await loadOwnedCards({ ...base, q: "100%" });
    expect(sent().params).toContain("%100\\%%");
  });

  it("a name with nothing left after normalization is no filter", async () => {
    for (const q of ["", "   ", undefined]) {
      statements = [];
      await loadOwnedCards({ ...base, ...(q === undefined ? {} : { q }) });
      expect(sent().params).toEqual([PLAYER, 1, 60]);
    }
  });
});

describe("loadOwnedCards — the answer", () => {
  it("the page's rows as they came, and the total every row carries", async () => {
    answer = [
      ["id-1", "Arcane Signet", "Artifact", 0, 2, 3, 13_239],
      ["id-2", "Zur the Enchanter", "Creature", 7, null, 1, 13_239],
    ];
    expect(await loadOwnedCards(base)).toEqual({
      rows: [
        {
          id: "id-1",
          name: "Arcane Signet",
          primaryType: "Artifact",
          ciMask: 0,
          popularity: 2,
          copies: 3,
        },
        {
          id: "id-2",
          name: "Zur the Enchanter",
          primaryType: "Creature",
          ciMask: 7,
          popularity: null,
          copies: 1,
        },
      ],
      total: 13_239,
    });
  });

  it("no rows: an empty page and no total (a page past the end, or nothing matches)", async () => {
    expect(await loadOwnedCards({ ...base, page: 9 })).toEqual({ rows: [], total: null });
  });
});
