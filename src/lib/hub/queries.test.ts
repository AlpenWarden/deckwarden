/**
 * The commander index's color condition (COLOR-INCLUDES), rendered without
 * a database (the search translator's test pattern): exactly is the
 * condition the index sent before the mode, and the default; including is
 * the card search's `including` with the mask bound and typed; no color is
 * no condition; and Colorless never runs the including arm, which would
 * match every row.
 */
import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { leaderColorCondition } from "./queries";

const dialect = new PgDialect();
const render = (fragment: SQL | null) => (fragment ? dialect.sqlToQuery(fragment) : null);

describe("leaderColorCondition", () => {
  it("no color picked: no condition, in either reading", () => {
    expect(leaderColorCondition(null)).toBeNull();
    expect(leaderColorCondition(null, "exactly")).toBeNull();
    expect(leaderColorCondition(null, "including")).toBeNull();
  });

  it("exactly is the default and the identity itself, the condition from before the mode", () => {
    for (let mask = 0; mask <= 31; mask++) {
      for (const q of [
        render(leaderColorCondition(mask)),
        render(leaderColorCondition(mask, "exactly")),
      ]) {
        expect(q?.sql).toBe('"card_identities"."ci_mask" = $1');
        expect(q?.params).toEqual([mask]);
      }
    }
  });

  it("including holds all the mask's colors: the mask bound twice and typed for the bitwise &", () => {
    for (let mask = 1; mask <= 31; mask++) {
      const q = render(leaderColorCondition(mask, "including"));
      expect(q?.sql).toBe('("card_identities"."ci_mask" & $1::int) = $2::int');
      expect(q?.params).toEqual([mask, mask]);
    }
  });

  it("Colorless is always exact: a mask of 0 never runs the including arm", () => {
    const q = render(leaderColorCondition(0, "including"));
    expect(q?.sql).toBe('"card_identities"."ci_mask" = $1');
    expect(q?.params).toEqual([0]);
  });
});
