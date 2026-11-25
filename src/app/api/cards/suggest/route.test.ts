// @vitest-environment node
/**
 * GET /api/cards/suggest (X2, WAVE3.md D2): the statements it sends and the
 * rows it answers, through the REAL drizzle builders over a fake postgres.js
 * client — so the rendered SQL, the statement count (one; two only for the
 * trigram pass; none below two characters) and the row mapping are what the
 * route really does. The ranking's semantics are name-match.test.ts's; the
 * live acceptance table ran against the database (WAVE3.md X2 ship note).
 *
 * COMMANDER-DOOR: every statement selects one more column, last: the card's
 * ruling in the format a new deck opens in. No test here executes SQL, so
 * the column is pinned by its text and by the value bound for the format;
 * what it answers on real data was checked against the rule on the dev
 * database (REDESIGN.md, "A build button where a commander is found"). The
 * older cases feed rows of ten values and so read the column as absent.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { FORMAT_ID } from "@/db/seed-data";
import { TOKEN_DOC } from "@/lib/cards/tokens";
import { buildBlockedSql } from "@/lib/search/suggest";

interface Statement {
  sql: string;
  params: unknown[];
}
let statements: Statement[] = [];
let answers: unknown[][][] = [];

const fakeClient = {
  options: { parsers: {}, serializers: {} },
  unsafe(sql: string, params: unknown[]) {
    statements.push({ sql, params });
    const rows = answers.shift() ?? [];
    return { values: async () => rows, then: undefined };
  },
};
const fakeDb = drizzle(fakeClient as never, { schema });

vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: () => fakeDb,
}));

// The limiter at its seam (S4, M6; LATER row 118 fired): keys and order
// pinned here, the counting in src/lib/rate-limit-enforce.test.ts.
const limiter = { calls: [] as string[][], answer: null as NextResponse | null };
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  enforceRateLimit: async (limits: { key: string }[]) => {
    limiter.calls.push(limits.map((l) => l.key));
    return limiter.answer;
  },
}));

const { GET } = await import("./route");

/** A row in the select's column order (suggest.ts slimSelect). */
function row(r: {
  id: string;
  name: string;
  slug?: string | null;
  isLeader?: boolean;
  typeLine?: string | null;
  colorsMask?: number;
  ciMask?: number;
  externalKey?: string;
  printingId?: string | null;
  imageOverride?: unknown;
}): unknown[] {
  return [
    r.id,
    r.name,
    r.slug ?? null,
    r.isLeader ?? false,
    r.typeLine ?? null,
    r.colorsMask ?? 0,
    r.ciMask ?? 0,
    r.externalKey ?? "x",
    r.printingId ?? null,
    r.imageOverride ?? null,
  ];
}

const SOL_PRINTING = "5bef0790-aa1b-4144-8391-338e59e86115";

async function get(query: string, headers: Record<string, string> = {}) {
  const res = await GET(
    new NextRequest(`http://localhost/api/cards/suggest?${query}`, { headers }),
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  statements = [];
  answers = [];
  limiter.calls = [];
  limiter.answer = null;
});

describe("GET /api/cards/suggest — the limiter (S4, M6)", () => {
  it("consumes the caller's IP buckets first; a 429 parses nothing and runs nothing", async () => {
    limiter.answer = NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const { res } = await get("game=mtg&q=sol", { "x-forwarded-for": "203.0.113.9" });
    expect(res.status).toBe(429);
    expect(limiter.calls).toEqual([
      ["card-suggest:ip:203.0.113.9", "card-suggest:ip-hour:203.0.113.9"],
    ]);
    expect(statements).toEqual([]);
  });

  it("the empty answer (under two characters) still passes the bucket — it is a request like any other", async () => {
    const { res } = await get("game=mtg&q=s", { "x-forwarded-for": "203.0.113.9" });
    expect(res.status).toBe(200);
    expect(limiter.calls).toHaveLength(1);
    expect(statements).toEqual([]);
  });
});

describe("GET /api/cards/suggest", () => {
  it("one normalized character: an empty 200, the cache header, and no statement", async () => {
    const { res, body } = await get("game=mtg&scope=cards&q=A");
    expect(res.status).toBe(200);
    expect(body).toEqual({ q: "a", results: [] });
    expect(res.headers.get("cache-control")).toBe(
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
    expect(statements).toHaveLength(0);
  });

  it("a name: ONE statement — classes 1–3, ranked, limited to 8 in SQL — and the slim rows", async () => {
    answers = [
      [
        row({
          id: "id-sol",
          name: "Sol Ring",
          typeLine: "Artifact",
          externalKey: "6ad8011d",
          printingId: SOL_PRINTING,
        }),
        row({ id: "id-solemn", name: "Solemn Simulacrum", typeLine: "Artifact Creature — Golem" }),
      ],
    ];
    const { res, body } = await get("game=mtg&scope=cards&q=Sol");
    expect(res.headers.get("cache-control")).toContain("s-maxage=3600");
    expect(statements).toHaveLength(1);
    const [s] = statements;
    expect(s.sql).toContain('"card_identities"."name_norm" LIKE');
    expect(s.sql).toMatch(/order by CASE WHEN "card_identities"\."name_norm" = \$\d+ THEN 1/);
    expect(s.sql).toContain('"card_identities"."popularity" ASC NULLS LAST');
    expect(s.sql).toMatch(/limit \$\d+$/);
    expect(s.params.at(-1)).toBe(8);
    expect(s.params).toContain("sol%");
    expect(s.params).toContain("%-sol%");
    expect(s.sql).not.toContain('is_leader_candidate" = ');
    expect(body.q).toBe("sol");
    expect(body.results).toEqual([
      {
        id: "id-sol",
        name: "Sol Ring",
        slug: null,
        isLeader: false,
        typeLine: "Artifact",
        colorsMask: 0,
        ciMask: 0,
        externalKey: "6ad8011d",
        image: `https://cards.scryfall.io/small/front/5/b/${SOL_PRINTING}.jpg`,
      },
      expect.objectContaining({ name: "Solemn Simulacrum", image: null }),
    ]);
  });

  it("never suggests a token (DECK-TOKENS): both statements carry the guard, every scope", async () => {
    answers = [[], []];
    await get("game=mtg&scope=cards&q=treasure");
    await get("game=mtg&scope=leaders&q=marit");
    expect(statements.length).toBeGreaterThanOrEqual(3);
    for (const s of statements) {
      expect(s.sql).toContain('NOT ("card_identities"."attrs" @> $');
      expect(s.params).toContain(TOKEN_DOC);
    }
  });

  it("scope=leaders is the hub scope: leader candidates with a slug", async () => {
    answers = [
      [row({ id: "k", name: "Krenko, Mob Boss", slug: "krenko-mob-boss", isLeader: true })],
    ];
    const { body } = await get("game=mtg&scope=leaders&q=kr");
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain('"card_identities"."is_leader_candidate" = $');
    expect(statements[0].sql).toContain('"card_identities"."slug" IS NOT NULL');
    expect(body.results[0]).toMatchObject({ slug: "krenko-mob-boss", isLeader: true });
  });

  it("the trigram pass is a SECOND statement, only under 8 rows and from four characters", async () => {
    answers = [[], [row({ id: "saga", name: "Urza's Saga" }), row({ id: "urza", name: "Urza's" })]];
    const { body } = await get("game=mtg&scope=cards&q=urzas+saga");
    expect(statements).toHaveLength(2);
    expect(statements[1].sql).toContain('"card_identities"."name_norm" % $');
    expect(statements[1].params).toContain("urzas saga");
    expect(statements[1].params.at(-1)).toBe(8);
    expect(body.results.map((r: { name: string }) => r.name)).toEqual(["Urza's Saga", "Urza's"]);
  });

  it("the trigram pass skips the rows already found and fills only the remaining places", async () => {
    answers = [[row({ id: "a1", name: "Atog" })], []];
    await get("game=mtg&scope=cards&q=atogs");
    expect(statements).toHaveLength(2);
    expect(statements[1].sql).toContain('"card_identities"."id" not in ($');
    expect(statements[1].params).toContain("a1");
    expect(statements[1].params.at(-1)).toBe(7);
  });

  it("no trigram pass below four characters, nor when the first statement filled the list", async () => {
    answers = [[row({ id: "a", name: "Atarka, World Render" })]];
    await get("game=mtg&scope=cards&q=at");
    expect(statements).toHaveLength(1);

    statements = [];
    answers = [Array.from({ length: 8 }, (_, i) => row({ id: `r${i}`, name: `Ring ${i}` }))];
    await get("game=mtg&scope=cards&q=ring");
    expect(statements).toHaveLength(1);
  });

  it("a One Piece card number takes the id pass: one statement in card-number order, no name ranking", async () => {
    answers = [
      [
        row({
          id: "h",
          name: "Hyogoro",
          externalKey: "OP01-020",
          typeLine: "Character — Land of Wano",
          printingId: "00000000-0000-4000-8000-000000000001",
          imageOverride: { front: "https://img.deckwarden.gg/optcg/images/OP01-020.png" },
        }),
      ],
    ];
    const { body } = await get("game=optcg&scope=cards&q=op01-02");
    expect(statements).toHaveLength(1);
    expect(statements[0].sql).toContain('"card_identities"."external_key" LIKE $');
    expect(statements[0].params).toContain("OP01-02%");
    expect(statements[0].sql).toContain('order by "card_identities"."external_key" ASC');
    expect(statements[0].sql).not.toContain("CASE");
    // One Piece thumbnails follow thumbnailUrl(): the mirror's small WebP (P4.9).
    expect(body.results[0]).toMatchObject({
      externalKey: "OP01-020",
      image: "https://img.deckwarden.gg/optcg/small/OP01-020.webp",
    });
  });

  it("Magic never takes the id pass", async () => {
    answers = [[]];
    await get("game=mtg&scope=cards&q=op01-02");
    expect(statements[0].sql).not.toContain('external_key" LIKE');
    expect(statements[0].sql).toContain("CASE");
  });

  it("a bad game or scope is a 400 and sends nothing", async () => {
    for (const query of ["game=azuki&q=sol", "scope=all&q=sol", `q=${"a".repeat(201)}`]) {
      const { res } = await get(query);
      expect(res.status).toBe(400);
    }
    expect(statements).toHaveLength(0);
  });
});

describe("GET /api/cards/suggest — the ruling column (COMMANDER-DOOR)", () => {
  /** A row with the column's value after the ten the older cases feed. */
  const ruled = (r: Parameters<typeof row>[0], blocked: boolean): unknown[] => [...row(r), blocked];

  /** The value bound where the column names its format. */
  function boundFormat(s: Statement): unknown {
    const place = s.sql.match(/l\.format_id = \$(\d+)/);
    expect(place).not.toBeNull();
    return s.params[Number(place![1]) - 1];
  }

  /** The column's own text: from its EXISTS to the select list's end. */
  function column(s: Statement): string {
    const start = s.sql.indexOf("EXISTS (");
    expect(start).toBeGreaterThan(-1);
    return s.sql.slice(start, s.sql.indexOf(' from "card_identities"'));
  }

  const NINE = [
    "id",
    "name",
    "slug",
    "isLeader",
    "typeLine",
    "colorsMask",
    "ciMask",
    "externalKey",
    "image",
  ];

  it("all three statements select it last: current, unconditional, any status but legal, in the game's own format", async () => {
    answers = [[], []]; // a name pass that finds nothing, then the near misses
    await get("game=mtg&scope=cards&q=urzas+saga");
    await get("game=optcg&scope=cards&q=op01-02"); // the card-number pass
    await get("game=optcg&scope=cards&q=luffy"); // finds nothing here, so its near misses run too
    expect(statements).toHaveLength(5);
    const [name, nearMisses, idPass, opName, opNearMisses] = statements;

    for (const s of statements) {
      // Last in the select list, straight after the printing's two columns.
      expect(s.sql).toMatch(/"card_printings"\."image_override", EXISTS \(/);
      const text = column(s).replace(/\s+/g, " ");
      expect(text).toBe(
        'EXISTS ( SELECT 1 FROM "legalities" l WHERE l.card_identity_id = "card_identities"."id" ' +
          `AND l.format_id = ${s.sql.match(/l\.format_id = (\$\d+)/)![1]} ` +
          "AND l.effective_to IS NULL AND l.condition IS NULL AND l.status <> 'legal')",
      );
      // A column, never a condition: the WHERE names no ruling.
      expect(s.sql.slice(s.sql.indexOf(" where ")).includes("legalities")).toBe(false);
    }
    // The game ids are the same two numbers as the format ids, so read the bound place itself.
    expect(boundFormat(name)).toBe(FORMAT_ID.commander);
    expect(boundFormat(nearMisses)).toBe(FORMAT_ID.commander);
    expect(boundFormat(idPass)).toBe(FORMAT_ID.optcgStandard);
    expect(boundFormat(opName)).toBe(FORMAT_ID.optcgStandard);
    expect(boundFormat(opNearMisses)).toBe(FORMAT_ID.optcgStandard);
    expect(FORMAT_ID.commander).not.toBe(FORMAT_ID.optcgStandard);
    // The two older pins on the statements' text still hold with the column in.
    expect(name.sql).not.toContain('is_leader_candidate" = ');
    expect(idPass.sql).not.toContain("CASE");
  });

  it("the exported column names the card's own id in a statement with no join too", () => {
    // In a select list with no join drizzle writes that list's columns bare; a bare "id"
    // inside the subquery would be the ruling's. Met on the dev database, pinned here.
    for (const [game, formatId] of [
      ["mtg", FORMAT_ID.commander],
      ["optcg", FORMAT_ID.optcgStandard],
    ] as const) {
      const alone = fakeDb
        .select({ id: schema.cardIdentities.id, blocked: buildBlockedSql(game) })
        .from(schema.cardIdentities)
        .toSQL();
      expect(alone.sql.startsWith('select "id", EXISTS (')).toBe(true);
      expect(alone.sql).toContain('l.card_identity_id = "card_identities"."id"');
      expect(alone.params).toEqual([formatId]);
    }
  });

  it("a row keeps exactly its nine keys unless it is a leader candidate that fails the rule", async () => {
    answers = [
      [
        // A legal commander: the column is false.
        ruled({ id: "atraxa", name: "Atraxa, Praetors' Voice", isLeader: true, slug: "a" }, false),
        // A card with a ruling that is no leader candidate: the column is true, and says nothing.
        ruled({ id: "lotus", name: "Black Lotus", typeLine: "Artifact" }, true),
        ruled({ id: "sol", name: "Sol Ring", typeLine: "Artifact" }, false),
        // A banned commander.
        ruled({ id: "golos", name: "Golos, Tireless Pilgrim", isLeader: true, slug: "g" }, true),
      ],
    ];
    const { body } = await get("game=mtg&scope=cards&q=ol");
    const [atraxa, lotus, sol, golos] = body.results as Record<string, unknown>[];
    for (const plain of [atraxa, lotus, sol]) {
      expect(Object.keys(plain)).toEqual(NINE);
      expect("buildBlocked" in plain).toBe(false);
    }
    expect(Object.keys(golos)).toEqual([...NINE, "buildBlocked"]);
    expect(golos.buildBlocked).toBe(true);
    expect(golos).toMatchObject({ name: "Golos, Tireless Pilgrim", isLeader: true });
  });

  it("only a real true blocks: a driver that sent the column as text would block nothing, not everything", async () => {
    // postgres.js parses the column to a boolean (read on the dev database). Were it ever
    // to arrive unparsed, "f" is a truthy string: the row must not read as blocked.
    answers = [[[...row({ id: "atraxa", name: "Atraxa, Praetors' Voice", isLeader: true }), "f"]]];
    const { body } = await get("game=mtg&scope=cards&q=atraxa");
    expect(Object.keys(body.results[0])).toEqual(NINE);
  });

  it("the hub scope's rows carry the member the same way (those boxes ignore it)", async () => {
    answers = [
      [
        ruled({ id: "golos", name: "Golos, Tireless Pilgrim", isLeader: true, slug: "g" }, true),
        ruled({ id: "gonti", name: "Gonti, Lord of Luxury", isLeader: true, slug: "o" }, false),
      ],
    ];
    const { body } = await get("game=mtg&scope=leaders&q=go");
    expect(boundFormat(statements[0])).toBe(FORMAT_ID.commander);
    expect(body.results.map((r: Record<string, unknown>) => Object.keys(r).length)).toEqual([
      10, 9,
    ]);
  });

  it("a One Piece leader banned outright carries it; one with no ruling does not", async () => {
    answers = [
      [
        ruled({ id: "nami", name: "Nami", isLeader: true, externalKey: "OP03-040" }, true),
        ruled(
          { id: "luffy", name: "Monkey.D.Luffy", isLeader: true, externalKey: "OP11-040" },
          false,
        ),
      ],
    ];
    const { body } = await get("game=optcg&scope=cards&q=op");
    expect(body.results[0]).toMatchObject({ externalKey: "OP03-040", buildBlocked: true });
    expect(Object.keys(body.results[1])).toEqual(NINE);
  });
});
