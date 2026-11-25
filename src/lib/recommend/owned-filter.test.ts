// @vitest-environment node
/**
 * The owned hook in the statements that carry it (OWNED-FILTER, 2026-11-24,
 * LATER row 69), through the REAL drizzle builders over a fake postgres.js
 * client, so the rendered SQL and its parameters are what the engine really
 * sends. What this pins:
 *
 * - no statement carries a list of card ids for the hook: the player's id is
 *   bound once (the id list was about 20,000 parameters and 0.9 MB a
 *   statement at the cap);
 * - the hook is the one probe in every statement, never a set built inside
 *   the condition (the two forms that did were measured in seconds);
 * - the popularity pool, and only it, spells its color check as a list of
 *   identities while the hook is on, which is what lets Postgres choose a
 *   plan that does not probe once per scanned row;
 * - with the hook off, every statement is the text it was: it never names
 *   the collection, and the pool keeps the bit test.
 *
 * That the rows are the ones the id list picked is proved against the
 * database, statement by statement (REDESIGN.md, OWNED-FILTER), and
 * `pnpm smoke:collection` reads the route's answer.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

interface Statement {
  sql: string;
  params: unknown[];
}
let statements: Statement[] = [];

const fakeClient = {
  options: { parsers: {}, serializers: {} },
  unsafe(sql: string, params: unknown[]) {
    statements.push({ sql, params });
    return { values: async () => [], then: undefined };
  },
};
const fakeDb = drizzle(fakeClient as never, { schema });

vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: () => fakeDb,
}));

const { loadCandidatePool, loadCandidateRows, loadThemeCandidates, loadTournamentCandidates } =
  await import("./queries");
type CandidateFilter = import("./queries").CandidateFilter;

const PLAYER = "00000000-0000-4000-8000-0000000000aa";
const LEADER = "00000000-0000-4000-8000-0000000000bb";
const COMBO_PIECE = "00000000-0000-4000-8000-0000000000cc";

/** A two-color deck: four identities fit it (0, 1, 2, 3). */
const BASE: CandidateFilter = {
  gameId: 1,
  formatId: 1,
  deckCiMask: 3,
  excludeCardIds: [LEADER],
};
const OWNED: CandidateFilter = { ...BASE, ownedBy: PLAYER };

/** The probe for the row at hand. */
const PROBE =
  /EXISTS \(\s*SELECT 1 FROM "collections" oc\s+JOIN "card_printings" op ON op\.id = oc\.printing_id/;
/** The color check's two spellings (`colorFitCondition`). */
const BIT_TEST = /\("card_identities"\."ci_mask" & ~\$\d+::int\) = 0/;
const COUNTED = /"card_identities"\."ci_mask" in \(\$\d+, \$\d+, \$\d+, \$\d+\)/;

/** The four statements a request can send with the hook, each through its real loader. */
const LOADERS: {
  name: string;
  /** Whether the statement scans the pool in popularity order (the color check is counted). */
  pool: boolean;
  run: (filter: CandidateFilter) => Promise<unknown>;
}[] = [
  { name: "the popularity pool", pool: true, run: (f) => loadCandidatePool(f, 600) },
  {
    name: "a theme pool",
    pool: false,
    run: (f) => loadThemeCandidates({ ...f, themePath: "type_line" }, "Vampire", 60),
  },
  {
    name: "the tournament candidates",
    pool: false,
    run: (f) => loadTournamentCandidates(f, [LEADER], 200),
  },
  { name: "the combo recheck", pool: false, run: (f) => loadCandidateRows(f, [COMBO_PIECE]) },
];

beforeEach(() => {
  statements = [];
});

describe("the owned hook, statement by statement (OWNED-FILTER)", () => {
  for (const { name, pool, run } of LOADERS) {
    it(`${name}: one statement, the probe once, the player's id its only new value`, async () => {
      await run(OWNED);
      expect(statements).toHaveLength(1);
      const [{ sql, params }] = statements;
      expect(sql.match(new RegExp(PROBE.source, "g"))).toHaveLength(1);
      expect(params.filter((p) => p === PLAYER)).toHaveLength(1);
      // A few dozen values at most, never a list of the player's cards.
      expect(params.length).toBeLessThan(40);
      // No set is built inside the condition (the measured dead ends).
      expect(sql).not.toContain("MATERIALIZED");
      expect(sql).not.toMatch(/"card_identities"\."id" IN \(\s*(SELECT|WITH)/i);
    });

    it(`${name}: ${pool ? "counts its color check while the hook is on" : "keeps the bit test with the hook on"}`, async () => {
      await run(OWNED);
      const [{ sql, params }] = statements;
      if (pool) {
        expect(sql).toMatch(COUNTED);
        expect(sql).not.toMatch(BIT_TEST);
        // The identities inside a two-color deck's, as values.
        expect(params.slice(0, 8)).toEqual(expect.arrayContaining([0, 1, 2, 3]));
      } else {
        expect(sql).toMatch(BIT_TEST);
        expect(sql).not.toMatch(COUNTED);
      }
    });

    it(`${name}: with the hook off, the statement never names the collection and keeps the bit test`, async () => {
      await run(BASE);
      expect(statements).toHaveLength(1);
      const [{ sql }] = statements;
      expect(sql).not.toContain('"collections"');
      expect(sql).toMatch(BIT_TEST);
      expect(sql).not.toMatch(COUNTED);
    });
  }

  it("the combo recheck asks nothing without ids, hook or no hook", async () => {
    await loadCandidateRows(OWNED, []);
    expect(statements).toHaveLength(0);
  });
});
