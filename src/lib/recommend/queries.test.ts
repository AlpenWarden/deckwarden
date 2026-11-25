import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { TOKEN_DOC } from "@/lib/cards/tokens";

import {
  attrTextColumn,
  candidateConditions,
  candidatePoolOrder,
  colorFitCondition,
  flagsColumn,
  identitiesWithin,
  ownedCondition,
  roleKeys,
  rolesColumn,
  sharedRolesCount,
  themeWordCondition,
  type CandidateFilter,
} from "./queries";

/**
 * The deterministic filter is SQL built by one function; these tests pin its
 * CONTRACT shape without a database: which inputs add conditions and which
 * are inert. Behavior against real rows is smoke:recommend's job.
 */
const BASE: CandidateFilter = {
  gameId: 1,
  formatId: 1,
  deckCiMask: 3,
  excludeCardIds: [],
};
/** A player's id, as the owned hook takes it. */
const PLAYER = "00000000-0000-4000-8000-0000000000aa";
/** Conditions as the statement would carry them: text and parameters. */
const rendered = (conditions: SQL[]) =>
  conditions.map((c) => {
    const q = new PgDialect().sqlToQuery(c);
    return { sql: q.sql, params: q.params };
  });

describe("candidateConditions", () => {
  it("never offers a token (DECK-TOKENS): the containment guard is a base condition", () => {
    const q = new PgDialect().sqlToQuery(candidateConditions(BASE)[3]);
    expect(q.sql).toContain("NOT (");
    expect(q.sql).toContain("@>");
    expect(q.params).toEqual([TOKEN_DOC]);
  });

  it("owned-cards hook is off when undefined (the contract P3.7's ?owned=1 relies on), in a pool scan too", () => {
    const off = candidateConditions(BASE);
    const alsoOff = candidateConditions({ ...BASE, ownedBy: undefined });
    expect(alsoOff).toHaveLength(off.length);
    // `poolScan` only matters with the hook on: off, the statement's text is the same.
    expect(rendered(candidateConditions(BASE, { poolScan: true }))).toEqual(rendered(off));
  });

  it("owned-cards hook restricts when given a player: one more condition, and the others untouched", () => {
    const off = candidateConditions(BASE);
    const restricted = candidateConditions({ ...BASE, ownedBy: PLAYER });
    expect(restricted).toHaveLength(off.length + 1);
    expect(rendered(restricted.slice(0, -1))).toEqual(rendered(off));
  });

  it("the owned hook binds the player's id and nothing else: no list of card ids travels (OWNED-FILTER, LATER row 69)", () => {
    const q = new PgDialect().sqlToQuery(ownedCondition(PLAYER));
    expect(q.params).toEqual([PLAYER]);
    // Owned = any printing of the card: the collection's rows, through their printings.
    expect(q.sql).toContain('FROM "collections" oc');
    expect(q.sql).toContain('JOIN "card_printings" op ON op.id = oc.printing_id');
    expect(q.sql).toContain("oc.user_id = $1");
  });

  it("the owned hook is one shape, a probe for the row at hand: every step an index lookup, no set built inside the condition", () => {
    const { sql } = new PgDialect().sqlToQuery(ownedCondition(PLAYER));
    expect(sql).toMatch(/^EXISTS \(/);
    expect(sql).toContain('op.card_identity_id = "card_identities"."id"');
    // The measured dead ends: a fenced set (rescanned per row) and an IN the planner can only hash.
    expect(sql).not.toContain("MATERIALIZED");
    expect(sql).not.toMatch(/\bIN \(/);
  });
});

describe("the color check, two spellings of one test (OWNED-FILTER)", () => {
  const popcount = (mask: number) => mask.toString(2).replace(/0/g, "").length;

  it("identitiesWithin lists exactly the identities the bit test passes, ascending, for every deck", () => {
    for (let deck = 0; deck < 32; deck++) {
      const within = identitiesWithin(deck);
      expect(within).toHaveLength(2 ** popcount(deck));
      expect(within).toEqual([...within].sort((a, b) => a - b));
      for (let card = 0; card < 32; card++) {
        expect(within.includes(card)).toBe((card & ~deck) === 0);
      }
    }
    // A colorless deck fits colorless cards alone; a six-color mask has 64 identities.
    expect(identitiesWithin(0)).toEqual([0]);
    expect(identitiesWithin(63)).toHaveLength(64);
  });

  it("the bit test by default; counted, the list of those identities as values Postgres can count", () => {
    const bits = new PgDialect().sqlToQuery(colorFitCondition(3));
    expect(bits.sql).toBe('("card_identities"."ci_mask" & ~$1::int) = 0');
    expect(bits.params).toEqual([3]);
    const counted = new PgDialect().sqlToQuery(colorFitCondition(3, true));
    expect(counted.sql).toBe('"card_identities"."ci_mask" in ($1, $2, $3, $4)');
    expect(counted.params).toEqual([0, 1, 2, 3]);
  });

  it("past six colors the list would run to hundreds of values: the bit test stays", () => {
    expect(new PgDialect().sqlToQuery(colorFitCondition(63, true)).params).toHaveLength(64);
    const wide = new PgDialect().sqlToQuery(colorFitCondition(127, true));
    expect(wide.sql).toBe('("card_identities"."ci_mask" & ~$1::int) = 0');
    expect(wide.params).toEqual([127]);
  });

  it("only the popularity pool counts, and only with the owned hook on: every other statement keeps the bit test", () => {
    const colors = (conditions: SQL[]) => new PgDialect().sqlToQuery(conditions[4]).sql;
    const BIT_TEST = '("card_identities"."ci_mask" & ~$1::int) = 0';
    const owned = { ...BASE, ownedBy: PLAYER };
    expect(colors(candidateConditions(owned, { poolScan: true }))).toBe(
      '"card_identities"."ci_mask" in ($1, $2, $3, $4)',
    );
    expect(colors(candidateConditions(owned))).toBe(BIT_TEST);
    expect(colors(candidateConditions(BASE, { poolScan: true }))).toBe(BIT_TEST);
    expect(colors(candidateConditions(BASE))).toBe(BIT_TEST);
  });
});

describe("candidateConditions — the other inputs", () => {
  it("budget and deck-exclusion each add conditions; adapter exclude rules apply per rule", () => {
    const off = candidateConditions(BASE);
    // Budget adds two: price known AND price under budget (unknown price is
    // never silently "within budget").
    expect(candidateConditions({ ...BASE, maxPriceUsd: 25 })).toHaveLength(off.length + 2);
    expect(
      candidateConditions({ ...BASE, excludeCardIds: ["00000000-0000-0000-0000-000000000002"] }),
    ).toHaveLength(off.length + 1);
    expect(
      candidateConditions({
        ...BASE,
        exclude: [{ jsonbPath: ["type_line"], likePattern: "%Basic%" }],
      }),
    ).toHaveLength(off.length + 1);
  });

  it("scope goes through the whitelist like exclude — one condition per op, never string SQL", () => {
    const off = candidateConditions(BASE);
    expect(
      candidateConditions({
        ...BASE,
        scope: { column: "primary_type", op: "eq", value: "Land" },
      }),
    ).toHaveLength(off.length + 1);
    expect(
      candidateConditions({
        ...BASE,
        scope: { column: "primary_type", op: "ne", value: "Land" },
      }),
    ).toHaveLength(off.length + 1);
  });

  it("rejects a non-whitelisted scope column instead of interpolating it", () => {
    expect(() =>
      candidateConditions({
        ...BASE,
        scope: {
          column: "name; DROP TABLE" as unknown as "primary_type",
          op: "eq",
          value: "x",
        },
      }),
    ).toThrow(/Invalid scope column/);
  });

  // Y7a: Swap Lab's cost window joins the whitelist — a bound range, never string SQL.
  it("a cost_value range adds exactly one bound condition; a list of scopes ANDs one each", () => {
    const off = candidateConditions(BASE);
    const window = candidateConditions({
      ...BASE,
      scope: { column: "cost_value", op: "between", min: 0, max: 2 },
    });
    expect(window).toHaveLength(off.length + 1);
    const q = new PgDialect().sqlToQuery(window[window.length - 1]);
    expect(q.sql).toBe(`"card_identities"."cost_value" BETWEEN $1 AND $2`);
    expect(q.params).toEqual([0, 2]);
    expect(
      candidateConditions({
        ...BASE,
        scope: [
          { column: "primary_type", op: "ne", value: "Land" },
          { column: "cost_value", op: "between", min: 1, max: 3 },
        ],
      }),
    ).toHaveLength(off.length + 2);
    expect(candidateConditions({ ...BASE, scope: [] })).toHaveLength(off.length);
  });

  it("rejects a cost range of the wrong shape, and string ops on cost_value", () => {
    const bad = [
      { column: "cost_value", op: "between", min: 3, max: 1 },
      { column: "cost_value", op: "between", min: 0.5, max: 2 },
      { column: "cost_value", op: "between", min: 0 },
      { column: "cost_value", op: "eq", value: "2" },
      { column: "primary_type", op: "between", min: 0, max: 1 },
    ];
    for (const scope of bad) {
      expect(() =>
        candidateConditions({ ...BASE, scope: scope as unknown as CandidateFilter["scope"] }),
      ).toThrow(/Invalid scope/);
    }
  });

  it("shared roles add one condition — an OR of bound containment documents (the GIN's @>)", () => {
    const off = candidateConditions(BASE);
    const shared = candidateConditions({
      ...BASE,
      roles: { path: "roles", any: ["mana-rock", "ramp"] },
    });
    expect(shared).toHaveLength(off.length + 1);
    const q = new PgDialect().sqlToQuery(shared[shared.length - 1]);
    expect(q.sql).toBe(
      `("card_identities"."attrs" @> $1::jsonb OR "card_identities"."attrs" @> $2::jsonb)`,
    );
    expect(q.params).toEqual(['{"roles":["mana-rock"]}', '{"roles":["ramp"]}']);
    // No role, no candidate — never "every card".
    const none = candidateConditions({ ...BASE, roles: { path: "roles", any: [] } });
    expect(new PgDialect().sqlToQuery(none[none.length - 1]).sql).toBe("false");
  });

  it("rejects a malformed roles path or role key instead of binding it", () => {
    expect(() =>
      candidateConditions({ ...BASE, roles: { path: "roles'; --", any: ["ramp"] } }),
    ).toThrow(/Invalid roles path/);
    expect(() =>
      candidateConditions({ ...BASE, roles: { path: "roles", any: ['ramp"]}'] } }),
    ).toThrow(/Invalid role/);
  });

  it("rejects a malformed jsonb exclude key instead of interpolating it", () => {
    expect(() =>
      candidateConditions({
        ...BASE,
        exclude: [{ jsonbPath: ["bad' key"] as unknown as [string], likePattern: "%x%" }],
      }),
    ).toThrow(/Invalid exclude path/);
  });
});

/**
 * Y6a — the adapter's bracket flags as one jsonb column: built from its
 * declared paths only, each through exclude's key check before it reaches
 * the SQL, absent keys dropped (jsonb_strip_nulls), `{}` for a game that
 * declares none.
 */
describe("flagsColumn", () => {
  const dialect = new PgDialect();
  const render = (paths: Parameters<typeof flagsColumn>[0]) =>
    dialect.sqlToQuery(flagsColumn(paths));

  it("one jsonb object over the declared paths, nulls stripped, no parameters", () => {
    const q = render([["game_changer"], ["mld"], ["extra_turn"]]);
    expect(q.sql).toBe(
      `jsonb_strip_nulls(jsonb_build_object('game_changer', "card_identities"."attrs"->'game_changer', 'mld', "card_identities"."attrs"->'mld', 'extra_turn', "card_identities"."attrs"->'extra_turn'))`,
    );
    expect(q.params).toEqual([]);
  });

  it("a game that declares none reads {}", () => {
    expect(render(undefined).sql).toBe(`'{}'::jsonb`);
    expect(render([]).sql).toBe(`'{}'::jsonb`);
  });

  it("a declared path outside the key alphabet throws — never SQL", () => {
    expect(() => render([["mld'; drop table decks; --"]])).toThrow("Invalid flag path");
  });
});

/** Y7a — the roles column and the pool's closest-first order, rendered without a database. */
describe("Swap Lab's role columns", () => {
  const dialect = new PgDialect();

  it("a card's roles come off the declared path; anything but an array of strings is none", () => {
    expect(dialect.sqlToQuery(rolesColumn("roles")).sql).toBe(`"card_identities"."attrs"->'roles'`);
    expect(() => rolesColumn("roles'")).toThrow("Invalid roles path");
    expect(roleKeys(["ramp", 3, "mana-rock"])).toEqual(["ramp", "mana-rock"]);
    expect(roleKeys(null)).toEqual([]);
    expect(roleKeys("ramp")).toEqual([]);
  });

  it("the pool orders by the most shared roles first, then popularity — and only with roles", () => {
    const render = (filter: CandidateFilter) =>
      candidatePoolOrder(filter).map((o) => dialect.sqlToQuery(o).sql);
    expect(render(BASE)).toEqual([
      `"card_identities"."popularity" asc`,
      `"card_identities"."id" asc`,
    ]);
    const withRoles = render({ ...BASE, roles: { path: "roles", any: ["burn"] } });
    expect(withRoles).toEqual([
      `(("card_identities"."attrs" @> $1::jsonb)::int) desc`,
      `"card_identities"."popularity" asc`,
      `"card_identities"."id" asc`,
    ]);
  });

  it("the shared-role count sums one containment per role, 0 for none", () => {
    const q = dialect.sqlToQuery(sharedRolesCount({ path: "roles", any: ["mana-rock", "ramp"] }));
    expect(q.sql).toBe(
      `(("card_identities"."attrs" @> $1::jsonb)::int + ("card_identities"."attrs" @> $2::jsonb)::int)`,
    );
    expect(q.params).toEqual(['{"roles":["mana-rock"]}', '{"roles":["ramp"]}']);
    expect(dialect.sqlToQuery(sharedRolesCount({ path: "roles", any: [] })).sql).toBe("0");
  });
});

describe("the list's themes (COMMANDER-FIT)", () => {
  const dialect = new PgDialect();

  it("a card's text comes off the declared path, with no parameter", () => {
    const q = dialect.sqlToQuery(attrTextColumn("type_line"));
    expect(q.sql).toBe(`"card_identities"."attrs"->>'type_line'`);
    expect(q.params).toEqual([]);
    expect(() => attrTextColumn("type_line'; --")).toThrow(/Invalid attrs path/);
  });

  it("a theme word is two bound halves: the full-text match, then the whole word at the path", () => {
    const q = dialect.sqlToQuery(themeWordCondition("type_line", "Sliver"));
    expect(q.sql).toBe(
      `("card_identities"."search_text" @@ plainto_tsquery('english', $1) AND "card_identities"."attrs"->>'type_line' ~ $2)`,
    );
    // \m … \M: Postgres' word boundaries — "Rat" is not "Pirate".
    expect(q.params).toEqual(["Sliver", "\\mSliver\\M"]);
    expect(dialect.sqlToQuery(themeWordCondition("type_line", "Time Lord")).params).toEqual([
      "Time Lord",
      "\\mTime Lord\\M",
    ]);
  });

  it("rejects a word that could be a pattern, and a path the search document doesn't cover", () => {
    for (const word of [
      "",
      "Sliver|Elf",
      "Sliver.*",
      "(Sliver)",
      "Sliver\\M",
      "Sliver%",
      " Elf",
      "Elf ",
    ]) {
      expect(() => themeWordCondition("type_line", word)).toThrow(/Invalid theme word/);
    }
    for (const word of ["Sliver", "Time Lord", "Urza's", "Power-Plant"]) {
      expect(() => themeWordCondition("type_line", word)).not.toThrow();
    }
    expect(() => themeWordCondition("flavor_text", "Sliver")).toThrow(/No search index covers/);
  });

  it("the themes path is a projection, never a condition: it narrows nothing", () => {
    expect(candidateConditions({ ...BASE, themePath: "type_line" })).toHaveLength(
      candidateConditions(BASE).length,
    );
  });
});
