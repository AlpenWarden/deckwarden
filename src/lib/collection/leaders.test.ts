// @vitest-environment node
/**
 * The collection page's leader view (COLLECTION-PAGE): the arithmetic, and
 * the two statements as the REAL drizzle builders render them over a fake
 * postgres.js client.
 *
 * - The count beside a leader is every other card the player owns inside its
 *   colors (the owner's decision 12), worked out from at most 32 rows. The
 *   order is that count, then play, then the name.
 * - A leader the format does not allow is set apart and never ranked.
 * - Both statements are keyed by the player's id, bound once, and carry no
 *   list of cards (OWNED-FILTER's rule: nothing of a collection travels).
 *
 * That the statements return the right rows is the smoke's
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

const { cardsWithin, loadOwnedColorCounts, loadOwnedLeaders, rankOwnedLeaders } =
  await import("./leaders");
type OwnedLeader = import("./leaders").OwnedLeader;

const PLAYER = "00000000-0000-4000-8000-0000000000aa";
const W = 1;
const U = 2;
const B = 4;
const R = 8;
const G = 16;
const WUBRG = W | U | B | R | G;

let seq = 0;
function leader(over: Partial<OwnedLeader> & { name: string }): OwnedLeader {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    externalKey: `key-${seq}`,
    ciMask: 0,
    popularity: null,
    status: "legal",
    ...over,
  };
}

beforeEach(() => {
  statements = [];
  answer = [];
});

describe("cardsWithin — the fit test, (card & ~leader) = 0", () => {
  const counts = new Map([
    [0, 5], // colorless
    [W, 10],
    [U, 20],
    [W | U, 3],
    [B, 7],
    [WUBRG, 2],
  ]);

  it("a color identity holds itself, its parts and colorless, and nothing with a color outside it", () => {
    expect(cardsWithin(counts, 0)).toBe(5);
    expect(cardsWithin(counts, W)).toBe(15);
    expect(cardsWithin(counts, U)).toBe(25);
    expect(cardsWithin(counts, W | U)).toBe(38);
    expect(cardsWithin(counts, W | U | B)).toBe(45);
    expect(cardsWithin(counts, G)).toBe(5);
  });

  it("all five colors hold every card", () => {
    expect(cardsWithin(counts, WUBRG)).toBe(47);
  });

  it("an empty collection counts nothing", () => {
    expect(cardsWithin(new Map(), WUBRG)).toBe(0);
  });
});

describe("rankOwnedLeaders", () => {
  it("counts every OTHER owned card inside the leader's colors: the leader is one of them and is left out", () => {
    // Fifty cards in all: the three leaders are among them (one W|U, one U, one five-color).
    const counts = new Map([
      [0, 6],
      [W, 9],
      [U, 12],
      [W | U, 4],
      [R, 18],
      [WUBRG, 1],
    ]);
    const five = leader({ name: "Five", ciMask: WUBRG });
    const azorius = leader({ name: "Azorius", ciMask: W | U });
    const blue = leader({ name: "Blue", ciMask: U });
    const { legal, notLegal } = rankOwnedLeaders([blue, azorius, five], counts);
    expect(legal.map((l) => [l.name, l.fits])).toEqual([
      // The five-color leader's count is every other owned card.
      ["Five", 49],
      ["Azorius", 6 + 9 + 12 + 4 - 1],
      ["Blue", 6 + 12 - 1],
    ]);
    expect(notLegal).toEqual([]);
  });

  it("orders by the count, then by play (unranked last), then by the name", () => {
    const counts = new Map([
      [0, 10],
      [W, 5],
      [U, 5],
    ]);
    const leaders = [
      leader({ name: "Zed", ciMask: W, popularity: 900 }),
      leader({ name: "Amy", ciMask: U, popularity: null }),
      leader({ name: "Bob", ciMask: U, popularity: 12 }),
      leader({ name: "Cyd", ciMask: W, popularity: 900 }),
      leader({ name: "Dot", ciMask: 0, popularity: 1 }),
      leader({ name: "Eve", ciMask: W | U, popularity: 50_000 }),
      leader({ name: "Abe", ciMask: W, popularity: null }),
    ];
    const { legal } = rankOwnedLeaders(leaders, counts);
    expect(legal.map((l) => `${l.name} ${l.fits}`)).toEqual([
      "Eve 19", // most cards fit, whatever its rank
      "Bob 14", // then the more played of the equal counts
      "Cyd 14", // equal rank: by name
      "Zed 14",
      "Abe 14", // unranked last, by name
      "Amy 14",
      "Dot 9",
    ]);
  });

  it("a partner is one leader counted on its own colors", () => {
    const counts = new Map([
      [0, 3],
      [G, 8],
      [B, 6],
      [B | G, 2],
    ]);
    const partner = leader({ name: "A Partner", ciMask: G });
    expect(rankOwnedLeaders([partner], counts).legal[0].fits).toBe(3 + 8 - 1);
  });

  it("a leader the format does not allow is set apart by name, with no count", () => {
    const counts = new Map([[0, 40]]);
    const banned = leader({ name: "Zz Banned", status: "banned" });
    const fine = leader({ name: "Fine" });
    const notLegal = leader({ name: "Aa Silver", status: "not_legal" });
    const restricted = leader({ name: "Mm Restricted", status: "restricted" });
    const out = rankOwnedLeaders([banned, fine, notLegal, restricted], counts);
    expect(out.legal.map((l) => l.name)).toEqual(["Fine"]);
    expect(out.notLegal.map((l) => `${l.name}: ${l.status}`)).toEqual([
      "Aa Silver: not_legal",
      "Mm Restricted: restricted",
      "Zz Banned: banned",
    ]);
    expect(out.notLegal.every((l) => !("fits" in l))).toBe(true);
  });

  it("never counts below zero, and changes neither input", () => {
    const lone = leader({ name: "Lone", ciMask: R });
    const leaders = [lone];
    const counts = new Map<number, number>();
    expect(rankOwnedLeaders(leaders, counts).legal[0].fits).toBe(0);
    expect(leaders).toEqual([lone]);
    expect("fits" in lone).toBe(false);
  });
});

describe("the two statements", () => {
  /** No list of ids: the statement binds a handful of values, whatever the collection holds. */
  const ID_LIST = /in \(\$\d+, \$\d+|= any\(/i;

  it("the color counts: the player's cards, each once, counted by color identity for one game", async () => {
    answer = [
      [0, 6],
      [W | U, 4],
      [WUBRG, 1],
    ];
    const counts = await loadOwnedColorCounts(PLAYER, 1);
    expect(counts).toEqual(
      new Map([
        [0, 6],
        [W | U, 4],
        [WUBRG, 1],
      ]),
    );

    expect(statements).toHaveLength(1);
    const { sql, params } = statements[0];
    // Keyed by the player and the game, and by nothing else.
    expect(params).toEqual([PLAYER, 1]);
    expect(sql).not.toMatch(ID_LIST);
    // The cards first, each once however many printings and finishes the collection holds…
    expect(sql).toMatch(
      /select distinct "card_printings"\."card_identity_id" from "collections" inner join "card_printings" on "card_printings"\."id" = "collections"\."printing_id" where "collections"\."user_id" = \$1/,
    );
    // …then their identities, counted by color identity.
    expect(sql).toMatch(/count\(\*\)::int/);
    expect(sql).toMatch(/"card_identities"\."game_id" = \$2/);
    expect(sql).toMatch(/group by "card_identities"\."ci_mask"$/);
  });

  it("the color counts of a player with no cards: an empty map", async () => {
    expect((await loadOwnedColorCounts(PLAYER, 1)).size).toBe(0);
  });

  it("the leaders: candidates of the game that are not removed, owned by the probe, with the format's current unconditional ruling", async () => {
    answer = [
      ["id-1", "Atraxa, Praetors' Voice", "key-1", 23, 3, "legal"],
      ["id-2", "Golos, Tireless Pilgrim", "key-2", 0, 40, "banned"],
    ];
    const leaders = await loadOwnedLeaders(PLAYER, 1, 7);
    expect(leaders).toEqual([
      {
        id: "id-1",
        name: "Atraxa, Praetors' Voice",
        externalKey: "key-1",
        ciMask: 23,
        popularity: 3,
        status: "legal",
      },
      {
        id: "id-2",
        name: "Golos, Tireless Pilgrim",
        externalKey: "key-2",
        ciMask: 0,
        popularity: 40,
        status: "banned",
      },
    ]);

    expect(statements).toHaveLength(1);
    const { sql, params } = statements[0];
    // The format, the game, the two flags and the player: five values, one of them the player's id.
    expect(params).toEqual([7, 1, true, false, PLAYER]);
    expect(params.filter((p) => p === PLAYER)).toHaveLength(1);
    expect(sql).not.toMatch(ID_LIST);
    // The hub's rule for a whole list: the current unconditional row, and none means legal.
    expect(sql).toMatch(/coalesce\("legalities"\."status", 'legal'\)/);
    expect(sql).toMatch(
      /left join "legalities" on \("legalities"\."card_identity_id" = "card_identities"\."id" and "legalities"\."format_id" = \$1 and "legalities"\."effective_to" is null and "legalities"\."condition" is null\)/,
    );
    expect(sql).toMatch(/"card_identities"\."game_id" = \$2/);
    expect(sql).toMatch(/"card_identities"\."is_leader_candidate" = \$3/);
    expect(sql).toMatch(/"card_identities"\."is_removed" = \$4/);
    // The engine's own probe, for the row at hand.
    expect(sql).toMatch(
      /EXISTS \(\s*SELECT 1 FROM "collections" oc\s+JOIN "card_printings" op ON op\.id = oc\.printing_id\s+WHERE oc\.user_id = \$5 AND op\.card_identity_id = "card_identities"\."id"\)/,
    );
  });

  it("neither statement is ordered or cut: the page orders the leaders itself", async () => {
    await loadOwnedColorCounts(PLAYER, 1);
    await loadOwnedLeaders(PLAYER, 1, 7);
    for (const { sql } of statements) expect(sql).not.toMatch(/order by|limit|offset/i);
  });
});
