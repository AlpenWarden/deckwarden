// @vitest-environment node
/**
 * /api/decks/[id] and goals (Y4b, WAVE4 D5): the goals PATCH — its own body
 * `{goals}`, checked against the deck's adapter, never moving updated_at
 * unless another key rides along — and what the deck GET hands a visitor.
 * Through the REAL drizzle builders over a fake postgres.js client (the
 * X2/X3/X5 route-test pattern), so the statements asserted are the route's
 * own. The session and the limiter are mocked at their module seams.
 *
 * Since the 2026-10-30 security audit: a private deck is the unknown id's
 * 404 to anyone but its owner (the deck-oracle record), and a PATCH that
 * moves a deck into or out of `public` — or the DELETE of a public deck —
 * revalidates the ISR listings the deck sat on (the hub record): `next/cache`
 * is mocked, lib/hub/paths.ts runs for real over the fake client.
 */
import { getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";
import { GAME_ID } from "@/db/seed-data";
import type { DeckRow } from "@/lib/decks/serialize";

interface Statement {
  sql: string;
  params: unknown[];
}
let statements: Statement[] = [];
let answers: unknown[][][] = [];
/** PRECON-OWNED: rows answered by the statement's text, ahead of the positional queue. */
let routed: { match: RegExp; rows: unknown[][] }[] = [];

const fakeClient = {
  options: { parsers: {}, serializers: {} },
  unsafe(sql: string, params: unknown[]) {
    statements.push({ sql, params });
    const rows = routed.find((r) => r.match.test(sql))?.rows ?? answers.shift() ?? [];
    return { values: async () => rows, then: undefined };
  },
  begin: async (fn: (client: unknown) => Promise<unknown>) => fn(fakeClient),
};
const fakeDb = drizzle(fakeClient as never, { schema });

vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: () => fakeDb,
}));

const session = { userId: null as string | null };
vi.mock("@/lib/auth", () => ({
  getSessionUserId: async () => session.userId,
}));

const limiter = { calls: [] as string[][], answer: null as NextResponse | null };
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  enforceRateLimit: async (limits: { key: string }[]) => {
    limiter.calls.push(limits.map((l) => l.key));
    return limiter.answer;
  },
}));

const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
}));

const { DELETE, GET, PATCH } = await import("./route");

const OWNER = "0b5a4f8e-1111-4222-8333-944445555666";
const DECK = "33333333-3333-4333-8333-333333333333";
const UPDATED = "2026-10-01T12:00:00.000Z";

/** A decks row in the schema's select order — the fake client answers positionally. */
const COLUMNS = Object.keys(getTableColumns(schema.decks)) as (keyof DeckRow)[];
function deckRow(over: Partial<Record<keyof DeckRow, unknown>> = {}): unknown[] {
  const deck: Record<string, unknown> = {
    id: DECK,
    publicId: "abcdefgh2345",
    gameId: GAME_ID.mtg,
    formatId: 1,
    userId: OWNER,
    claimToken: null,
    createdIp: null,
    name: "Atraxa Superfriends",
    description: null,
    notes: null,
    visibility: "public",
    kind: "user",
    leaderIds: [],
    ciMask: 0,
    folderId: null,
    forkedFromDeckId: null,
    currentVersion: 3,
    likesCount: 0,
    goals: null,
    hiddenTokens: null,
    preconDeckId: null,
    ownsPrecon: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: UPDATED,
    ...over,
  };
  return COLUMNS.map((c) => deck[c]);
}

function patch(body: unknown): NextRequest {
  return new NextRequest(`http://localhost:3000/api/decks/${DECK}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
const ctx = { params: Promise.resolve({ id: DECK }) };
const updates = () => statements.filter((s) => s.sql.startsWith("update"));

beforeEach(() => {
  statements = [];
  answers = [];
  routed = [];
  session.userId = OWNER;
  limiter.calls = [];
  limiter.answer = null;
  revalidated.length = 0;
});

describe("PATCH {goals} (Y4b)", () => {
  const goals = { v: 1, targetLevel: 2, answers: { rulesetVersion: 1, play: { fast: "no" } } };

  it("a goals-only body sets goals and nothing else — updated_at stays where it was", async () => {
    answers = [[deckRow()], [deckRow({ goals })]];
    const res = await PATCH(patch({ goals }), ctx);
    expect(res.status).toBe(200);
    const [write] = updates();
    expect(write.sql).toMatch(/^update "decks" set "goals" = \$1 where "decks"\."id" = \$2/);
    expect(write.sql).not.toContain('"updated_at" =');
    expect(JSON.parse(String(write.params[0]))).toEqual(goals);
    const json = await res.json();
    expect(json.deck.goals).toEqual(goals);
    expect(json.deck.updatedAt).toBe(UPDATED);
  });

  it("the same buckets as the meta PATCH: the IP's before anything else, the deck's only after the proof (S4, M1)", async () => {
    limiter.answer = NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const res = await PATCH(patch({ goals }), ctx);
    expect(res.status).toBe(429);
    expect(limiter.calls).toEqual([["deck-meta:ip:unknown"]]);
    expect(statements).toEqual([]);

    limiter.calls = [];
    limiter.answer = null;
    answers = [[deckRow()], [deckRow({ goals })]];
    await PATCH(patch({ goals }), ctx);
    expect(limiter.calls).toEqual([["deck-meta:ip:unknown"], [`deck-meta:deck:${DECK}`]]);
  });

  it("a meta key alongside goals moves updated_at, as every meta PATCH always has", async () => {
    answers = [[deckRow()], [deckRow()]];
    await PATCH(patch({ name: "Renamed", goals }), ctx);
    const [write] = updates();
    expect(write.sql).toMatch(
      /^update "decks" set "name" = \$1, "goals" = \$2, "updated_at" = \$3/,
    );
  });

  it("a meta-only body is unchanged: updated_at moves, goals are untouched", async () => {
    answers = [[deckRow()], [deckRow()]];
    await PATCH(patch({ name: "Renamed" }), ctx);
    const [write] = updates();
    expect(write.sql).toMatch(/^update "decks" set "name" = \$1, "updated_at" = \$2 where/);
    expect(write.sql.split(" where ")[0]).not.toContain('"goals"');
  });

  it("null clears; goals that say nothing are stored as null", async () => {
    answers = [[deckRow({ goals })], [deckRow()]];
    await PATCH(patch({ goals: null }), ctx);
    expect(updates()[0].params[0]).toBeNull();

    statements = [];
    answers = [[deckRow({ goals })], [deckRow()]];
    await PATCH(patch({ goals: { v: 1, answers: { rulesetVersion: 1, play: {} } } }), ctx);
    expect(updates()[0].params[0]).toBeNull();
  });

  it("Magic's range is 1–5; anything else answers 400 and writes nothing", async () => {
    for (const bad of [{ v: 1, targetLevel: 6 }, { v: 1, targetLevel: 0 }, { v: 2 }]) {
      answers = [[deckRow()]];
      const res = await PATCH(patch({ goals: bad }), ctx);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect(updates()).toEqual([]);
  });

  it("One Piece declares no brackets: a target answers 400", async () => {
    answers = [[deckRow({ gameId: GAME_ID.optcg, formatId: 3 })]];
    const res = await PATCH(patch({ goals: { v: 1, targetLevel: 2 } }), ctx);
    expect(res.status).toBe(400);
    expect(updates()).toEqual([]);
  });

  it("someone else's deck is 403 before the body is checked", async () => {
    session.userId = "99999999-9999-4999-8999-999999999999";
    answers = [[deckRow()]];
    const res = await PATCH(patch({ goals }), ctx);
    expect(res.status).toBe(403);
    expect(updates()).toEqual([]);
  });

  it("a guest deck takes goals with its edit key, the same way", async () => {
    session.userId = null;
    const token = "5f2c8a7e-0000-4000-8000-00000000abcd";
    answers = [[deckRow({ userId: null, claimToken: token })], [deckRow({ userId: null, goals })]];
    const req = patch({ goals });
    req.headers.set("x-deck-token", token);
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    expect(updates()[0].sql).not.toContain('"updated_at" =');
  });
});

describe("PATCH {hiddenTokens} (TOKEN-FILL)", () => {
  const treasure = "aaaaaaaa-0000-4000-8000-000000000001";
  const soldier = "aaaaaaaa-0000-4000-8000-000000000002";

  it("a hidden-only body sets hidden_tokens and nothing else — updated_at stays where it was", async () => {
    answers = [[deckRow()], [deckRow({ hiddenTokens: [treasure, soldier] })]];
    const res = await PATCH(patch({ hiddenTokens: [soldier, treasure, soldier] }), ctx);
    expect(res.status).toBe(200);
    const [write] = updates();
    expect(write.sql).toMatch(
      /^update "decks" set "hidden_tokens" = \$1 where "decks"\."id" = \$2/,
    );
    expect(write.sql).not.toContain('"updated_at" =');
    // Sorted and de-duplicated before the write (drizzle binds a text[] as its array literal).
    expect(write.params[0]).toBe(`{"${treasure}","${soldier}"}`);
    const json = await res.json();
    expect(json.deck.hiddenTokens).toEqual([treasure, soldier]);
    expect(json.deck.updatedAt).toBe(UPDATED);
  });

  it("null clears, and so does an empty array (the column's 0-byte state)", async () => {
    answers = [[deckRow({ hiddenTokens: [treasure] })], [deckRow()]];
    await PATCH(patch({ hiddenTokens: [] }), ctx);
    expect(updates()[0].params[0]).toBeNull();
    statements = [];
    answers = [[deckRow({ hiddenTokens: [treasure] })], [deckRow()]];
    await PATCH(patch({ hiddenTokens: null }), ctx);
    expect(updates()[0].params[0]).toBeNull();
  });

  it("a meta key alongside moves updated_at, as every meta PATCH always has", async () => {
    answers = [[deckRow()], [deckRow({ name: "Brago", hiddenTokens: [treasure] })]];
    await PATCH(patch({ name: "Brago", hiddenTokens: [treasure] }), ctx);
    const [write] = updates();
    expect(write.sql).toContain('"hidden_tokens" =');
    expect(write.sql).toContain('"updated_at" =');
  });

  it("the bounds: more than 100 keys, or a key past 64 chars, answers 400 and writes nothing", async () => {
    answers = [[deckRow()]];
    expect((await PATCH(patch({ hiddenTokens: Array(101).fill(treasure) }), ctx)).status).toBe(400);
    expect(updates()).toHaveLength(0);
    answers = [[deckRow()]];
    expect((await PATCH(patch({ hiddenTokens: ["x".repeat(65)] }), ctx)).status).toBe(400);
    expect(updates()).toHaveLength(0);
  });

  it("someone else's deck is 403 before the body is checked", async () => {
    session.userId = "0b5a4f8e-9999-4999-8999-999999999999";
    answers = [[deckRow()]];
    expect((await PATCH(patch({ hiddenTokens: [treasure] }), ctx)).status).toBe(403);
    expect(updates()).toHaveLength(0);
  });
});

describe("GET — the hidden token keys (TOKEN-FILL)", () => {
  const get = () => new NextRequest(`http://localhost:3000/api/decks/${DECK}`);
  const hiddenTokens = ["aaaaaaaa-0000-4000-8000-000000000001"];

  it("the owner's wire carries them; a visitor's says null", async () => {
    answers = [[deckRow({ hiddenTokens })]];
    expect((await (await GET(get(), ctx)).json()).deck.hiddenTokens).toEqual(hiddenTokens);
    session.userId = null;
    answers = [[deckRow({ hiddenTokens })]];
    expect((await (await GET(get(), ctx)).json()).deck.hiddenTokens).toBeNull();
  });
});

describe("GET — what a visitor sees of the goals", () => {
  const goals = {
    v: 1,
    targetLevel: 2,
    exceptions: "One thematic Game Changer — ask me",
    budget: { perCardUsd: 5 },
    answers: { rulesetVersion: 1, calls: { "combo:618-1537": "yes" } },
  };
  const get = () => new NextRequest(`http://localhost:3000/api/decks/${DECK}`);

  it("a visitor: the target and the exceptions, never the budget or the answers", async () => {
    session.userId = null;
    answers = [[deckRow({ goals })]];
    const res = await GET(get(), ctx);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deck.isOwner).toBe(false);
    expect(json.deck.goals).toEqual({ v: 1, targetLevel: 2, exceptions: goals.exceptions });
  });

  it("the owner: everything", async () => {
    answers = [[deckRow({ goals })]];
    const json = await (await GET(get(), ctx)).json();
    expect(json.deck.isOwner).toBe(true);
    expect(json.deck.goals).toEqual(goals);
  });
});

describe("PATCH {ownsPrecon} (PRECON-OWNED)", () => {
  const PRECON = "55555555-5555-4555-8555-555555555555";
  const started = { preconDeckId: PRECON };

  it("an answer-only body sets owns_precon and nothing else — updated_at stays where it was", async () => {
    answers = [[deckRow(started)], [deckRow({ ...started, ownsPrecon: true })]];
    const res = await PATCH(patch({ ownsPrecon: true }), ctx);
    expect(res.status).toBe(200);
    const [write] = updates();
    expect(write.sql).toMatch(/^update "decks" set "owns_precon" = \$1 where "decks"\."id" = \$2/);
    expect(write.sql).not.toContain('"updated_at" =');
    expect(write.params[0]).toBe(true);
    const json = await res.json();
    expect(json.deck.updatedAt).toBe(UPDATED);
    // The answer's wire is deckMetaJson's: it never names the precon.
    expect(json.deck).not.toHaveProperty("ownsPrecon");
    expect(json.deck).not.toHaveProperty("precon");
  });

  it("No, and null (not asked), save the same way", async () => {
    for (const ownsPrecon of [false, null]) {
      statements = [];
      answers = [[deckRow({ ...started, ownsPrecon: true })], [deckRow(started)]];
      expect((await PATCH(patch({ ownsPrecon }), ctx)).status).toBe(200);
      expect(updates()[0].params[0]).toBe(ownsPrecon);
      expect(updates()[0].sql).not.toContain('"updated_at" =');
    }
  });

  it("a deck that didn't start from a precon: 400, nothing written — alone or beside a name", async () => {
    for (const body of [
      { ownsPrecon: true },
      { ownsPrecon: null },
      { name: "X", ownsPrecon: true },
    ]) {
      answers = [[deckRow()]];
      const res = await PATCH(patch(body), ctx);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(await res.json()).toEqual({ error: "This deck didn't start from a precon" });
    }
    expect(updates()).toEqual([]);
  });

  it("true, false or null only: anything else is a 400", async () => {
    for (const bad of ["yes", 1, {}]) {
      answers = [[deckRow(started)]];
      expect((await PATCH(patch({ ownsPrecon: bad }), ctx)).status, String(bad)).toBe(400);
    }
    expect(updates()).toEqual([]);
  });

  it("a meta key alongside moves updated_at, as every meta PATCH always has", async () => {
    answers = [[deckRow(started)], [deckRow(started)]];
    await PATCH(patch({ name: "Renamed", ownsPrecon: false }), ctx);
    const [write] = updates();
    expect(write.sql).toContain('"owns_precon" =');
    expect(write.sql).toContain('"updated_at" =');
  });

  it("owner only: someone else's deck is 403 before the body is checked", async () => {
    session.userId = "99999999-9999-4999-8999-999999999999";
    answers = [[deckRow(started)]];
    expect((await PATCH(patch({ ownsPrecon: true }), ctx)).status).toBe(403);
    expect(updates()).toEqual([]);
  });

  it("a guest deck answers with its edit key, the same way", async () => {
    session.userId = null;
    const token = "5f2c8a7e-0000-4000-8000-00000000abcd";
    answers = [
      [deckRow({ ...started, userId: null, claimToken: token })],
      [deckRow({ ...started, userId: null, ownsPrecon: true })],
    ];
    const req = patch({ ownsPrecon: true });
    req.headers.set("x-deck-token", token);
    expect((await PATCH(req, ctx)).status).toBe(200);
    expect(updates()[0].sql).not.toContain('"updated_at" =');
  });
});

describe("GET — the precon a deck started from (PRECON-OWNED)", () => {
  const PRECON = "55555555-5555-4555-8555-555555555555";
  const CMDR = "aaaaaaaa-1111-4111-8111-000000000001";
  const FOREST = "aaaaaaaa-1111-4111-8111-000000000002";
  /** loadDeckPrecon's rows: the product's slug and name beside each counted deck_cards row. */
  const preconRows = [
    ["breed_lethality_c16", "Breed Lethality", FOREST, "main", 12],
    ["breed_lethality_c16", "Breed Lethality", CMDR, "commander", 1],
  ];
  const get = () => new NextRequest(`http://localhost:3000/api/decks/${DECK}`);
  const preconReads = () => statements.filter((s) => s.sql.includes('from "precon_products"'));

  it("the owner: deck.precon — the slug, the name, the answer, the precon's copies; one read", async () => {
    routed = [{ match: /from "precon_products"/, rows: preconRows }];
    answers = [[deckRow({ preconDeckId: PRECON, ownsPrecon: true })]];
    const res = await GET(get(), ctx);
    const text = await res.text();
    expect(JSON.parse(text).deck.precon).toEqual({
      slug: "breed_lethality_c16",
      name: "Breed Lethality",
      owns: true,
      cards: [
        { cardId: CMDR, qty: 1 },
        { cardId: FOREST, qty: 12 },
      ],
    });
    // One read, keyed by the precon's deck id, over the counted zones alone.
    expect(preconReads()).toHaveLength(1);
    expect(preconReads()[0].params).toEqual(expect.arrayContaining([PRECON, "commander", "main"]));
    expect(preconReads()[0].params).not.toContain("tokens");
    // The wire names the precon by its slug; its row id stays on the server.
    expect(text).not.toContain(PRECON);
  });

  it("an unanswered question reads null; a deck that started from nothing reads null, with no read", async () => {
    routed = [{ match: /from "precon_products"/, rows: preconRows }];
    answers = [[deckRow({ preconDeckId: PRECON })]];
    expect((await (await GET(get(), ctx)).json()).deck.precon.owns).toBeNull();

    statements = [];
    answers = [[deckRow()]];
    expect((await (await GET(get(), ctx)).json()).deck.precon).toBeNull();
    expect(preconReads()).toEqual([]);
  });

  it("a visitor: no precon key, no lineage, no answer, none of its cards — and no read", async () => {
    session.userId = null;
    routed = [{ match: /from "precon_products"/, rows: preconRows }];
    answers = [[deckRow({ preconDeckId: PRECON, ownsPrecon: true })]];
    const res = await GET(get(), ctx);
    expect(res.status).toBe(200);
    const text = await res.text();
    const json = JSON.parse(text);
    expect(json.deck.isOwner).toBe(false);
    expect(json.deck).not.toHaveProperty("precon");
    expect(text).not.toContain(PRECON);
    expect(text).not.toContain(FOREST);
    expect(text).not.toMatch(/ownsPrecon|preconDeckId|breed_lethality|"owns"/);
    expect(preconReads()).toEqual([]);
  });
});

describe("a private deck is the unknown id's 404 to anyone but its owner (the audit's deck-oracle record)", () => {
  const STRANGER = "99999999-9999-4999-8999-999999999999";
  const TOKEN = "5f2c8a7e-0000-4000-8000-00000000abcd";
  const get = (token?: string) =>
    new NextRequest(`http://localhost:3000/api/decks/${DECK}`, {
      headers: token ? { "x-deck-token": token } : {},
    });
  /** What a caller can compare: the status, the body and the cache header. */
  async function shape(res: Response) {
    return { status: res.status, body: await res.json(), cache: res.headers.get("cache-control") };
  }

  it("GET: signed out, a stranger and a wrong token get exactly the unknown uuid's answer", async () => {
    session.userId = null;
    answers = [[]];
    const unknown = await shape(await GET(get(), ctx));
    expect(unknown).toEqual({
      status: 404,
      body: { error: "Deck not found" },
      cache: "no-store",
    });

    answers = [[deckRow({ visibility: "private" })]];
    expect(await shape(await GET(get(), ctx))).toEqual(unknown);
    session.userId = STRANGER;
    answers = [[deckRow({ visibility: "private" })]];
    expect(await shape(await GET(get(), ctx))).toEqual(unknown);
    session.userId = null;
    answers = [[deckRow({ visibility: "private", userId: null, claimToken: TOKEN })]];
    expect(await shape(await GET(get("not-the-token"), ctx))).toEqual(unknown);
    // Four reads, four identical answers: the old 403 and its body are gone from the wire.
    expect(statements.map((s) => s.sql.split(" ")[0])).toEqual(Array(4).fill("select"));
  });

  it("GET: the owner's session or token still reads it", async () => {
    answers = [[deckRow({ visibility: "private" })]];
    expect((await GET(get(), ctx)).status).toBe(200);
    session.userId = null;
    answers = [[deckRow({ visibility: "private", userId: null, claimToken: TOKEN })]];
    expect((await GET(get(TOKEN), ctx)).status).toBe(200);
  });

  it("PATCH: a stranger on a private deck gets the 404 before the body; on a public deck the 403 stays", async () => {
    session.userId = STRANGER;
    answers = [[deckRow({ visibility: "private" })]];
    const refused = await PATCH(patch({ name: "x" }), ctx);
    expect(await shape(refused)).toEqual({
      status: 404,
      body: { error: "Deck not found" },
      cache: "no-store",
    });
    expect(updates()).toEqual([]);
    answers = [[deckRow()]];
    expect((await PATCH(patch({ name: "x" }), ctx)).status).toBe(403);
  });
});

describe("the ISR listings follow a visibility move and a delete (the audit's hub record)", () => {
  const LEADER = "aaaaaaaa-1111-4111-8111-000000000001";
  const SLUG = "atraxa-praetors-voice";
  const slugReads = () => statements.filter((s) => s.sql.includes('from "card_identities"'));
  const del = () =>
    new NextRequest(`http://localhost:3000/api/decks/${DECK}`, { method: "DELETE" });

  it("public → private: the commander's hub and the sitemap are revalidated, after the write", async () => {
    answers = [
      [deckRow({ leaderIds: [LEADER] })],
      [deckRow({ leaderIds: [LEADER], visibility: "private" })],
      [[SLUG]],
    ];
    const res = await PATCH(patch({ visibility: "private" }), ctx);
    expect(res.status).toBe(200);
    expect(revalidated.sort()).toEqual([`/c/${SLUG}`, "/sitemap.xml"]);
    expect(slugReads()).toHaveLength(1);
    expect(slugReads()[0].params).toEqual([LEADER]);
    // The write came first; the listings read the row it returned.
    expect(statements.map((s) => s.sql.split(" ")[0])).toEqual(["select", "update", "select"]);
  });

  it("unlisted → public: the same", async () => {
    answers = [
      [deckRow({ leaderIds: [LEADER], visibility: "unlisted" })],
      [deckRow({ leaderIds: [LEADER], visibility: "public" })],
      [[SLUG]],
    ];
    await PATCH(patch({ visibility: "public" }), ctx);
    expect(revalidated.sort()).toEqual([`/c/${SLUG}`, "/sitemap.xml"]);
  });

  it("a name-only PATCH, unlisted → private, or public → public: nothing to refresh", async () => {
    answers = [[deckRow({ leaderIds: [LEADER] })], [deckRow({ leaderIds: [LEADER] })]];
    await PATCH(patch({ name: "Renamed" }), ctx);
    answers = [
      [deckRow({ leaderIds: [LEADER], visibility: "unlisted" })],
      [deckRow({ leaderIds: [LEADER], visibility: "private" })],
    ];
    await PATCH(patch({ visibility: "private" }), ctx);
    answers = [[deckRow({ leaderIds: [LEADER] })], [deckRow({ leaderIds: [LEADER] })]];
    await PATCH(patch({ visibility: "public" }), ctx);
    expect(revalidated).toEqual([]);
    expect(slugReads()).toEqual([]);
  });

  it("a One Piece deck refreshes the sitemap alone: its /l/ hubs carry no shelf", async () => {
    answers = [
      [deckRow({ gameId: GAME_ID.optcg, formatId: 3, leaderIds: [LEADER] })],
      [deckRow({ gameId: GAME_ID.optcg, formatId: 3, leaderIds: [LEADER], visibility: "private" })],
    ];
    await PATCH(patch({ visibility: "private" }), ctx);
    expect(revalidated).toEqual(["/sitemap.xml"]);
    expect(slugReads()).toEqual([]);
  });

  it("DELETE of a public deck refreshes its listings; of an unlisted deck, nothing", async () => {
    // the gate's row · the forks' detach · the delete · the slug read
    answers = [[deckRow({ leaderIds: [LEADER] })], [], [[DECK]], [[SLUG]]];
    expect((await DELETE(del(), ctx)).status).toBe(204);
    expect(revalidated.sort()).toEqual([`/c/${SLUG}`, "/sitemap.xml"]);

    revalidated.length = 0;
    statements = [];
    answers = [[deckRow({ leaderIds: [LEADER], visibility: "unlisted" })], [], [[DECK]]];
    expect((await DELETE(del(), ctx)).status).toBe(204);
    expect(revalidated).toEqual([]);
    expect(slugReads()).toEqual([]);
  });
});

describe("PATCH {baseline} (FIRST-LIST)", () => {
  const A = "aaaaaaaa-1111-4111-8111-00000000000a";
  const B = "aaaaaaaa-1111-4111-8111-00000000000b";
  const baselineWrites = () =>
    statements.filter((s) => /^(insert into|delete from) "deck_baselines"/.test(s.sql));

  it("a baseline-only body upserts deck_baselines and leaves the decks row alone — updated_at stays", async () => {
    answers = [[deckRow()]];
    const res = await PATCH(
      patch({
        baseline: {
          source: "owner",
          setAt: "2026-11-26T10:00:00.000Z",
          // A repeated id folds into one row, and the rows sort by id.
          cards: [
            { cardId: B, qty: 1 },
            { cardId: A, qty: 2 },
            { cardId: B, qty: 3 },
          ],
        },
      }),
      ctx,
    );
    expect(res.status).toBe(200);
    expect(updates()).toEqual([]);
    const [write] = baselineWrites();
    expect(write.sql).toMatch(
      /^insert into "deck_baselines" .* on conflict \("deck_id"\) do update/,
    );
    expect(write.params).toEqual(
      expect.arrayContaining([
        DECK,
        "owner",
        JSON.stringify([
          { cardId: A, qty: 2 },
          { cardId: B, qty: 4 },
        ]),
      ]),
    );
    expect((await res.json()).deck.updatedAt).toBe(UPDATED);
  });

  it("a set time in the future is stored as now", async () => {
    answers = [[deckRow()]];
    const before = Date.now();
    await PATCH(
      patch({ baseline: { source: "complete", setAt: "2099-01-01T00:00:00.000Z", cards: [] } }),
      ctx,
    );
    const stored = baselineWrites()[0].params.find(
      (p) => typeof p === "string" && /^\d{4}-\d\d-\d\dT/.test(p),
    ) as string;
    expect(new Date(stored).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(stored).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("null deletes it", async () => {
    answers = [[deckRow()]];
    expect((await PATCH(patch({ baseline: null }), ctx)).status).toBe(200);
    const [write] = baselineWrites();
    expect(write.sql).toMatch(
      /^delete from "deck_baselines" where "deck_baselines"\."deck_id" = \$1/,
    );
    expect(write.params).toEqual([DECK]);
  });

  it("a deck with a precon lineage: 400, nothing written — its precon is its baseline", async () => {
    answers = [[deckRow({ preconDeckId: "55555555-5555-4555-8555-555555555555" })]];
    const res = await PATCH(
      patch({ baseline: { source: "owner", setAt: "2026-11-26T10:00:00.000Z", cards: [] } }),
      ctx,
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "This deck counts its changes from its precon" });
    expect(baselineWrites()).toEqual([]);
    expect(updates()).toEqual([]);
  });

  it("a malformed baseline is a 400, nothing written", async () => {
    const at = "2026-11-26T10:00:00.000Z";
    for (const bad of [
      { source: "someone", setAt: at, cards: [] },
      { source: "owner", setAt: "yesterday", cards: [] },
      { source: "owner", setAt: at, cards: [{ cardId: "Sol Ring", qty: 1 }] },
      { source: "owner", setAt: at, cards: [{ cardId: A, qty: 0 }] },
      {
        source: "owner",
        setAt: at,
        cards: Array.from({ length: 501 }, () => ({ cardId: A, qty: 1 })),
      },
      { source: "owner", cards: [] },
    ]) {
      answers = [[deckRow()]];
      expect(
        (await PATCH(patch({ baseline: bad }), ctx)).status,
        JSON.stringify(bad).slice(0, 60),
      ).toBe(400);
    }
    expect(baselineWrites()).toEqual([]);
  });

  it("owner only: someone else's deck is 403 before the body is checked", async () => {
    session.userId = "99999999-9999-4999-8999-999999999999";
    answers = [[deckRow()]];
    const res = await PATCH(
      patch({ baseline: { source: "owner", setAt: "2026-11-26T10:00:00.000Z", cards: [] } }),
      ctx,
    );
    expect(res.status).toBe(403);
    expect(baselineWrites()).toEqual([]);
  });
});

describe("GET — the baseline (FIRST-LIST)", () => {
  const A = "aaaaaaaa-1111-4111-8111-00000000000a";
  const B = "aaaaaaaa-1111-4111-8111-00000000000b";
  const get = () => new NextRequest(`http://localhost:3000/api/decks/${DECK}`);
  const baselineReads = () => statements.filter((s) => s.sql.includes('from "deck_baselines"'));
  /** wireSelect's row: id … attrs, then the default printing's id, override and back. */
  const wireRow = (id: string, name: string) => [
    id,
    name,
    name.toLowerCase(),
    `key-${name}`,
    "Sorcery",
    1,
    0,
    0,
    "0.25",
    1,
    false,
    false,
    {},
    null,
    null,
    false,
  ];

  it("the owner: deck.baseline as stored, and the cut cards' wires in baselineCards", async () => {
    routed = [
      {
        match: /from "deck_baselines"/,
        rows: [
          [
            "complete",
            "2026-11-20T12:00:00.000Z",
            [
              { cardId: A, qty: 1 },
              { cardId: B, qty: 2 },
            ],
          ],
        ],
      },
      {
        match: /from "card_identities" left join/,
        rows: [wireRow(A, "Divination"), wireRow(B, "Opt")],
      },
    ];
    answers = [[deckRow()]];
    const json = await (await GET(get(), ctx)).json();
    expect(json.deck.baseline).toEqual({
      source: "complete",
      setAt: "2026-11-20T12:00:00.000Z",
      cards: [
        { cardId: A, qty: 1 },
        { cardId: B, qty: 2 },
      ],
    });
    // The list holds neither card (the fake deck_cards read is empty), so both are cut.
    expect(json.baselineCards.map((c: { id: string; name: string }) => [c.id, c.name])).toEqual([
      [A, "Divination"],
      [B, "Opt"],
    ]);
    expect(baselineReads()).toHaveLength(1);
    expect(baselineReads()[0].params).toEqual([DECK, 1]);
  });

  it("none stored: baseline null, no cut cards, no wire read", async () => {
    answers = [[deckRow()]];
    const json = await (await GET(get(), ctx)).json();
    expect(json.deck.baseline).toBeNull();
    expect(json.baselineCards).toEqual([]);
    expect(statements.filter((s) => s.sql.includes('from "card_identities" left join'))).toEqual(
      [],
    );
  });

  it("a deck with a precon lineage reads none", async () => {
    answers = [[deckRow({ preconDeckId: "55555555-5555-4555-8555-555555555555" })]];
    const json = await (await GET(get(), ctx)).json();
    expect(json.deck.baseline).toBeNull();
    expect(baselineReads()).toEqual([]);
  });

  it("a visitor: no baseline key, no cut cards, and no read", async () => {
    session.userId = null;
    routed = [
      {
        match: /from "deck_baselines"/,
        rows: [["complete", "2026-11-20T12:00:00.000Z", [{ cardId: A, qty: 1 }]]],
      },
    ];
    answers = [[deckRow()]];
    const res = await GET(get(), ctx);
    const text = await res.text();
    const json = JSON.parse(text);
    expect(json.deck.isOwner).toBe(false);
    expect(json.deck).not.toHaveProperty("baseline");
    expect(json).not.toHaveProperty("baselineCards");
    expect(text).not.toContain(A);
    expect(baselineReads()).toEqual([]);
  });
});
