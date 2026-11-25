/**
 * Curl-level tests for the P3.7 surface: /api/collection (401 contract,
 * zod 400s, merge SETS quantities, replace wipes first, in-file duplicates
 * fold, finish fallback, the honest unresolved list, the per-user cap),
 * the owned set on GET /api/decks/[id] and POST /api/collection/owned, the
 * share page's "You own N/M" line (signed-in viewer only), and the
 * recommendations route's opt-in `?owned=1` in all three states (applied /
 * no-collection / signed-out), and once more for a collection at the cap
 * (OWNED-FILTER: the filter is a subquery keyed by the player, so the cap
 * costs no list of ids), and Autofill's `ownedOnly` (AUTOFILL-OWNED): a
 * player whose collection is a commander and thirty cards gets exactly
 * those cards and the basic lands, with the open slots counted, and a
 * signed-out caller or a player with no collection gets no list. Runs
 * against a live server + real DB — deliberately outside `pnpm check`.
 *
 *   pnpm smoke:collection                                  # http://localhost:3000
 *   SMOKE_ALLOW_REMOTE=1 BASE_URL=https://deckwarden.gg pnpm smoke:collection   # a deploy, on purpose
 *
 * Sessions come from scripts/smoke/session.ts (throwaway users + session
 * rows in the database .env.local names). Fixtures are REAL printing
 * ids read from the DB (never the owner's account, which has no collection
 * yet); one deck is created (the per-IP deck-create limiter is 10/hour —
 * run this smoke before the deck-heavy ones). Everything is deleted in
 * `finally`, and the user delete doubles as the cascade proof.
 *
 * Autofill budget: three POSTs to /api/decks/autofill (the owned list and
 * its two refusals; a refusal spends the per-address bucket too). That
 * bucket is 20 a minute and `pnpm smoke:autofill` spends 18, so run the two
 * a minute apart. A 429 is a failed check here, never a retry.
 */
import { BASE } from "./smoke/guard"; // first import: a non-local BASE_URL exits 1 here
import { mintSession } from "./smoke/session";
import { guardDatabaseUrl } from "./smoke/db";

import { randomBytes, randomUUID } from "node:crypto";

import { loadEnv } from "../src/lib/load-env";

loadEnv();
guardDatabaseUrl(); // right after the env load: a production DATABASE_URL exits 1 here

import postgres from "postgres";

import { COLLECTION_LIMITS } from "../src/lib/collection/types";
import { FORMAT_ID, GAME_ID } from "../src/db/seed-data";

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) throw new Error("DATABASE_URL is not set.");

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    console.log(`  ok    ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
  }
}

async function api(
  method: string,
  path: string,
  opts: { cookie?: string; body?: unknown; rawBody?: string } = {},
): Promise<{ status: number; json: unknown; text: string; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(opts.body !== undefined || opts.rawBody !== undefined
        ? { "content-type": "application/json" }
        : {}),
      ...(opts.cookie ? { cookie: opts.cookie } : {}),
    },
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* pages / 204s */
  }
  return { status: res.status, json, text, headers: res.headers };
}

const j = <T = Record<string, unknown>>(v: unknown): T => (v ?? {}) as T;

interface Printing {
  printingId: string;
  identityId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  finishes: string[];
}

interface Report {
  mode: string;
  received: number;
  resolved: number;
  resolvedBy: { scryfallId: number; setNumber: number; name: number };
  unresolvedTotal: number;
  unresolved: { index: number; name: string; reason: string }[];
  finishAdjusted: number;
  merged: number;
  inserted: number;
  updated: number;
  deleted: number;
  capped: { limit: number; dropped: number } | null;
  summary: { rows: number; printings: number; identities: number; updatedAt: string | null };
}

interface Rec {
  cardId: string;
  name: string;
  evidence: unknown[];
}

async function main() {
  console.log(`collection smoke against ${BASE}`);
  const sql = postgres(DB_URL as string, { max: 1, prepare: false });
  const run = randomBytes(4).toString("hex");
  const cleanup = { userIds: [] as string[], deckIds: [] as string[] };

  try {
    // ---- fixtures: real default printings by name -------------------------
    const pick = async (name: string): Promise<Printing> => {
      const [row] = await sql`
        select p.id as printing_id, ci.id as identity_id, ci.name, s.code as set_code,
               p.collector_number, p.finishes
        from card_printings p
        join card_identities ci on ci.id = p.card_identity_id
        join sets s on s.id = p.set_id
        where ci.name = ${name} and p.is_default and ci.is_removed = false
        limit 1`;
      if (!row) throw new Error(`fixture card not found: ${name}`);
      return {
        printingId: row.printing_id as string,
        identityId: row.identity_id as string,
        name: row.name as string,
        setCode: row.set_code as string,
        collectorNumber: row.collector_number as string,
        finishes: row.finishes as string[],
      };
    };
    const [
      talrand,
      counterspell,
      remora,
      solRing,
      signet,
      rhystic,
      rift,
      brainstorm,
      ponder,
      greaves,
    ] = await Promise.all(
      [
        "Talrand, Sky Summoner",
        "Counterspell",
        "Mystic Remora",
        "Sol Ring",
        "Arcane Signet",
        "Rhystic Study",
        "Cyclonic Rift",
        "Brainstorm",
        "Ponder",
        "Lightning Greaves",
      ].map(pick),
    );
    // Sol Ring twice: a printing that comes in BOTH finishes (its foil row must
    // stay foil) and a DIFFERENT nonfoil-only printing (requesting foil there
    // must fall back, disclosed). The default printing happens to be
    // nonfoil-only, which is why this isn't simply pick("Sol Ring").
    const [foilable] = await sql`
      select p.id as printing_id from card_printings p
      join card_identities ci on ci.id = p.card_identity_id
      where ci.name = 'Sol Ring' and p.finishes @> '{nonfoil,foil}'::text[] and p.is_removed = false
      order by p.released_at desc nulls last limit 1`;
    if (!foilable) throw new Error("no two-finish Sol Ring printing found");
    solRing.printingId = foilable.printing_id as string;
    const [nonfoilOnly] = await sql`
      select p.id as printing_id from card_printings p
      join card_identities ci on ci.id = p.card_identity_id
      where ci.name = 'Sol Ring' and p.finishes = '{nonfoil}'::text[] and p.is_removed = false
        and p.id <> ${solRing.printingId}
      limit 1`;
    if (!nonfoilOnly) throw new Error("no nonfoil-only Sol Ring printing found");
    const nonfoilOnlyId = nonfoilOnly.printing_id as string;

    // ---- mint two users: A imports, B never does ---------------------------
    const mkUser = (tag: string) =>
      mintSession(sql, { label: "P37", tag, run, userIds: cleanup.userIds });
    const alice = await mkUser("a");
    const bob = await mkUser("b");

    // ---- signed-out contract ----------------------------------------------
    check(
      "GET /api/collection signed out → 401",
      (await api("GET", "/api/collection")).status === 401,
    );
    check(
      "POST /api/collection signed out → 401",
      (await api("POST", "/api/collection", { body: { rows: [] } })).status === 401,
    );
    check(
      "DELETE /api/collection signed out → 401",
      (await api("DELETE", "/api/collection")).status === 401,
    );
    check(
      "POST /api/collection/owned signed out → 401",
      (await api("POST", "/api/collection/owned", { body: { ids: [solRing.identityId] } }))
        .status === 401,
    );

    // ---- empty summary + zod 400s -----------------------------------------
    const empty = await api("GET", "/api/collection", { cookie: alice.cookie });
    check(
      "GET summary for a fresh account → zeros, no-store",
      empty.status === 200 &&
        j<{ summary: Report["summary"] }>(empty.json).summary?.rows === 0 &&
        empty.headers.get("cache-control") === "no-store",
      empty.json,
    );
    check(
      "POST non-JSON → 400",
      (await api("POST", "/api/collection", { cookie: alice.cookie, rawBody: "not json" }))
        .status === 400,
    );
    check(
      "POST {rows: []} → 400 (min 1)",
      (await api("POST", "/api/collection", { cookie: alice.cookie, body: { rows: [] } }))
        .status === 400,
    );
    check(
      "POST bad finish → 400",
      (
        await api("POST", "/api/collection", {
          cookie: alice.cookie,
          body: { rows: [{ name: "Sol Ring", finish: "glossy", quantity: 1 }] },
        })
      ).status === 400,
    );
    check(
      "POST quantity 0 → 400",
      (
        await api("POST", "/api/collection", {
          cookie: alice.cookie,
          body: { rows: [{ name: "Sol Ring", finish: "nonfoil", quantity: 0 }] },
        })
      ).status === 400,
    );
    check(
      "POST bad mode → 400",
      (
        await api("POST", "/api/collection", {
          cookie: alice.cookie,
          body: { rows: [{ name: "Sol Ring", finish: "nonfoil", quantity: 1 }], mode: "append" },
        })
      ).status === 400,
    );
    {
      const tooMany = Array.from({ length: COLLECTION_LIMITS.rowsPerImport + 1 }, () => ({
        name: "Sol Ring",
        finish: "nonfoil",
        quantity: 1,
      }));
      const res = await api("POST", "/api/collection", {
        cookie: alice.cookie,
        body: { rows: tooMany },
      });
      check(
        `POST ${COLLECTION_LIMITS.rowsPerImport + 1} rows → 400 (body cap)`,
        res.status === 400,
        res.status,
      );
    }

    // ---- first import (merge): every resolution path + the reject path ----
    const bogusId = randomUUID();
    const firstRows = [
      // ManaBox-style: Scryfall id (+ set/number/name it could fall back to)
      {
        scryfallId: solRing.printingId,
        name: solRing.name,
        setCode: solRing.setCode,
        collectorNumber: solRing.collectorNumber,
        finish: "nonfoil",
        quantity: 2,
      },
      { scryfallId: solRing.printingId, name: solRing.name, finish: "nonfoil", quantity: 1 }, // duplicate → folded (sum 3)
      { scryfallId: solRing.printingId, name: solRing.name, finish: "foil", quantity: 1 }, // same printing, other finish → own row
      { scryfallId: nonfoilOnlyId, name: "Sol Ring", finish: "foil", quantity: 1 }, // nonfoil-only printing → finish adjusted
      // Moxfield-style: set + collector number, uppercase set code on purpose
      {
        name: signet.name,
        setCode: signet.setCode.toUpperCase(),
        collectorNumber: signet.collectorNumber,
        finish: "nonfoil",
        quantity: 1,
      },
      {
        name: counterspell.name,
        setCode: counterspell.setCode,
        collectorNumber: counterspell.collectorNumber,
        finish: "nonfoil",
        quantity: 4,
      },
      {
        name: rift.name,
        setCode: rift.setCode,
        collectorNumber: rift.collectorNumber,
        finish: "foil",
        quantity: 1,
      },
      // name only → default printing
      { name: "rhystic study", finish: "nonfoil", quantity: 1 },
      { name: "Brainstorm", finish: "nonfoil", quantity: 1 },
      { name: "Ponder", finish: "nonfoil", quantity: 1 },
      { name: "Lightning Greaves", finish: "nonfoil", quantity: 1 },
      // deliberately unresolvable, one per reason
      {
        scryfallId: bogusId,
        name: "Not A Real Card",
        setCode: "zzz",
        collectorNumber: "999",
        finish: "nonfoil",
        quantity: 1,
      },
      {
        name: "Zzz Not A Card",
        setCode: "zzz",
        collectorNumber: "999",
        finish: "nonfoil",
        quantity: 1,
      },
      { name: "Definitely Not A Card Name 12345", finish: "nonfoil", quantity: 1 },
    ];
    const first = await api("POST", "/api/collection", {
      cookie: alice.cookie,
      body: { rows: firstRows },
    });
    const r1 = j<Report>(first.json);
    check("first import → 200", first.status === 200, first.json);
    check("received = rows sent", r1.received === firstRows.length);
    check(
      "resolvedBy counts: 4 by Scryfall id, 3 by set+number, 4 by name",
      r1.resolvedBy?.scryfallId === 4 &&
        r1.resolvedBy?.setNumber === 3 &&
        r1.resolvedBy?.name === 4,
      r1.resolvedBy,
    );
    check(
      "3 unresolved with honest reasons, in input order",
      r1.unresolvedTotal === 3 &&
        r1.unresolved.map((u) => u.reason).join(",") ===
          "unknown-scryfall-id,unknown-set-number,unknown-name" &&
        r1.unresolved[0]?.index === 11,
      r1.unresolved,
    );
    check("duplicate Sol Ring line folded (merged 1)", r1.merged === 1, r1.merged);
    check(
      "foil on a nonfoil-only printing → finishAdjusted 1",
      r1.finishAdjusted === 1,
      r1.finishAdjusted,
    );
    check(
      "inserted 10 rows (11 resolved − 1 folded), 0 updated, not capped",
      r1.inserted === 10 && r1.updated === 0 && r1.capped === null,
      { inserted: r1.inserted, updated: r1.updated, capped: r1.capped },
    );
    check(
      "summary: 10 rows, 9 printings, 8 identities",
      r1.summary?.rows === 10 && r1.summary?.printings === 9 && r1.summary?.identities === 8,
      r1.summary,
    );
    const [solRow] = await sql`
      select quantity from collections where user_id = ${alice.id} and printing_id = ${solRing.printingId} and finish = 'nonfoil'`;
    check("folded quantity stored (2 + 1 = 3)", Number(solRow?.quantity) === 3, solRow);
    const [adjRow] = await sql`
      select finish from collections where user_id = ${alice.id} and printing_id = ${nonfoilOnlyId}`;
    check("adjusted row stored as nonfoil", adjRow?.finish === "nonfoil", adjRow);
    const [signetRow] = await sql`
      select 1 from collections where user_id = ${alice.id} and printing_id = ${signet.printingId}`;
    check("uppercase set code resolved to the right printing", signetRow !== undefined);

    // ---- re-import the same file: SET semantics, nothing doubles ----------
    const again = await api("POST", "/api/collection", {
      cookie: alice.cookie,
      body: { rows: firstRows },
    });
    const r2 = j<Report>(again.json);
    check("re-import → 0 inserted, 10 updated", r2.inserted === 0 && r2.updated === 10, {
      inserted: r2.inserted,
      updated: r2.updated,
    });
    const [solAgain] = await sql`
      select quantity from collections where user_id = ${alice.id} and printing_id = ${solRing.printingId} and finish = 'nonfoil'`;
    check(
      "quantity unchanged after re-import (3, not 6)",
      Number(solAgain?.quantity) === 3,
      solAgain,
    );

    // ---- merge with a new quantity SETS it -------------------------------
    const setQty = await api("POST", "/api/collection", {
      cookie: alice.cookie,
      body: {
        rows: [
          { scryfallId: solRing.printingId, name: "Sol Ring", finish: "nonfoil", quantity: 1 },
        ],
      },
    });
    const [solSet] = await sql`
      select quantity from collections where user_id = ${alice.id} and printing_id = ${solRing.printingId} and finish = 'nonfoil'`;
    check(
      "merge sets quantity to the file's value (1)",
      setQty.status === 200 && Number(solSet?.quantity) === 1,
      solSet,
    );
    check(
      "other rows untouched by a partial merge",
      j<Report>(setQty.json).summary?.rows === 10,
      j<Report>(setQty.json).summary,
    );

    // ---- the read surfaces -----------------------------------------------
    const owned = await api("POST", "/api/collection/owned", {
      cookie: alice.cookie,
      body: { ids: [solRing.identityId, remora.identityId, counterspell.identityId] },
    });
    const ownedIds = j<{ owned: string[] }>(owned.json).owned ?? [];
    check(
      "POST /api/collection/owned → the owned subset only",
      owned.status === 200 &&
        ownedIds.length === 2 &&
        ownedIds.includes(solRing.identityId) &&
        ownedIds.includes(counterspell.identityId),
      owned.json,
    );
    check(
      "POST /api/collection/owned with a bad id → 400",
      (
        await api("POST", "/api/collection/owned", {
          cookie: alice.cookie,
          body: { ids: ["nope"] },
        })
      ).status === 400,
    );

    // A deck: Talrand (not owned) + Counterspell (owned) + Mystic Remora (not owned).
    const created = await api("POST", "/api/decks", {
      cookie: alice.cookie,
      body: { game: "mtg", format: "commander", name: `Collection Smoke ${run}` },
    });
    const deck = j<{ id: string; publicId: string }>(j(created.json).deck);
    if (created.status !== 201 || !deck.id)
      throw new Error(
        `deck create failed (${created.status}) — the per-IP limiter? ${created.text}`,
      );
    cleanup.deckIds.push(deck.id);
    const put = await api("PUT", `/api/decks/${deck.id}/cards`, {
      cookie: alice.cookie,
      body: {
        cards: [
          { cardId: talrand.identityId, zone: "commander", qty: 1, tags: [] },
          { cardId: counterspell.identityId, zone: "main", qty: 1, tags: [] },
          { cardId: remora.identityId, zone: "main", qty: 1, tags: [] },
        ],
      },
    });
    check("PUT deck cards → 200", put.status === 200, put.json);

    const getA = await api("GET", `/api/decks/${deck.id}`, { cookie: alice.cookie });
    const bodyA = j<{ owned: string[]; hasCollection: boolean }>(getA.json);
    check(
      "GET deck as the owner → owned = [Counterspell], hasCollection true",
      getA.status === 200 &&
        bodyA.hasCollection === true &&
        bodyA.owned?.length === 1 &&
        bodyA.owned[0] === counterspell.identityId,
      { owned: bodyA.owned, hasCollection: bodyA.hasCollection },
    );
    const getB = await api("GET", `/api/decks/${deck.id}`, { cookie: bob.cookie });
    const bodyB = j<{ owned: string[]; hasCollection: boolean }>(getB.json);
    check(
      "GET deck as a signed-in user with no collection → owned [], hasCollection false",
      getB.status === 200 && bodyB.owned?.length === 0 && bodyB.hasCollection === false,
      bodyB,
    );
    const getGuest = await api("GET", `/api/decks/${deck.id}`);
    const bodyG = j<{ owned: string[]; hasCollection: boolean }>(getGuest.json);
    check(
      "GET deck signed out (guest path) → owned [], hasCollection false",
      getGuest.status === 200 && bodyG.owned?.length === 0 && bodyG.hasCollection === false,
      bodyG,
    );

    // Share page line: signed-in viewer with a collection only.
    const shareA = await api("GET", `/d/${deck.publicId}`, { cookie: alice.cookie });
    check(
      "share page for the collection holder renders “You own 1/3”",
      shareA.status === 200 && shareA.text.includes("You own 1/3"),
      shareA.status,
    );
    check(
      "…and the missing-cost estimate",
      /missing ≈ \$\d|missing 2 \(no price data\)/.test(shareA.text),
    );
    const shareGuest = await api("GET", `/d/${deck.publicId}`);
    check(
      "share page signed out renders NO ownership line",
      shareGuest.status === 200 && !shareGuest.text.includes("You own"),
    );
    const shareB = await api("GET", `/d/${deck.publicId}`, { cookie: bob.cookie });
    check(
      "share page for a signed-in viewer without a collection renders NO ownership line",
      shareB.status === 200 && !shareB.text.includes("You own"),
    );

    // Recommendations: the opt-in hook in its three states.
    const aliceOwned = new Set(
      (
        await sql`
          select distinct p.card_identity_id as id from collections c
          join card_printings p on p.id = c.printing_id where c.user_id = ${alice.id}`
      ).map((r) => r.id as string),
    );
    const recA = await api("GET", `/api/decks/${deck.id}/recommendations?owned=1`, {
      cookie: alice.cookie,
    });
    const recABody = j<{
      owned: { requested: boolean; applied: boolean; reason?: string };
      recommendations: Rec[];
    }>(recA.json);
    check(
      "?owned=1 with a collection → applied, every suggestion is an owned card, evidence intact",
      recA.status === 200 &&
        recABody.owned?.applied === true &&
        recABody.recommendations.length > 0 &&
        recABody.recommendations.every((r) => aliceOwned.has(r.cardId) && r.evidence.length > 0),
      {
        owned: recABody.owned,
        names: recABody.recommendations?.map((r) => r.name),
      },
    );
    check(
      "…and never a card already in the deck",
      recABody.recommendations?.every((r) => r.cardId !== counterspell.identityId) === true,
    );
    const recB = await api("GET", `/api/decks/${deck.id}/recommendations?owned=1`, {
      cookie: bob.cookie,
    });
    const recBBody = j<{ owned: { applied: boolean; reason?: string }; recommendations: Rec[] }>(
      recB.json,
    );
    check(
      "?owned=1 without a collection → not applied, reason no-collection, pool NOT emptied",
      recB.status === 200 &&
        recBBody.owned?.applied === false &&
        recBBody.owned?.reason === "no-collection" &&
        recBBody.recommendations.length > 0,
      recBBody.owned,
    );
    const recG = await api("GET", `/api/decks/${deck.id}/recommendations?owned=1`);
    const recGBody = j<{ owned: { applied: boolean; reason?: string }; recommendations: Rec[] }>(
      recG.json,
    );
    check(
      "?owned=1 signed out → not applied, reason signed-out, pool NOT emptied",
      recG.status === 200 &&
        recGBody.owned?.applied === false &&
        recGBody.owned?.reason === "signed-out" &&
        recGBody.recommendations.length > 0,
      recGBody.owned,
    );
    const recPlain = await api("GET", `/api/decks/${deck.id}/recommendations`, {
      cookie: alice.cookie,
    });
    check(
      "no owned param → hook off even with a collection (requested false)",
      j<{ owned: { requested: boolean } }>(recPlain.json).owned?.requested === false,
    );

    // ---- Autofill from the collection (AUTOFILL-OWNED) --------------------
    // A fresh player whose rows are inserted directly (the import allows 10
    // an hour per user). The collection is the plan's edge case: the
    // commander, and the thirty most played cards in its colour that are not
    // lands and not Game Changers, picked by the engine's own conditions
    // (legal, in colour, ranked, no basics). No land at all. Asked at a
    // target of 4, the list can only be those thirty and the basic lands.
    const dana = await mkUser("d");
    const danaCards = await sql`
      select p.id as printing_id, ci.id as identity_id
      from card_identities ci
      join card_printings p on p.card_identity_id = ci.id and p.is_default and p.is_removed = false
      where ci.game_id = ${GAME_ID.mtg} and ci.is_removed = false and ci.is_preview = false
        and ci.id <> ${talrand.identityId}
        and ci.primary_type <> 'Land' and ci.cost_value is not null
        and ci.popularity is not null
        and (ci.ci_mask & ~(select ci_mask from card_identities where id = ${talrand.identityId})) = 0
        and not (ci.attrs @> '{"is_token": true}'::jsonb)
        and not (ci.attrs @> '{"game_changer": true}'::jsonb)
        and coalesce(ci.attrs->>'type_line', '') not like '%Basic%'
        and not exists (
          select 1 from legalities l
          where l.card_identity_id = ci.id and l.format_id = ${FORMAT_ID.commander}
            and l.effective_to is null and l.condition is null
            and l.status in ('banned', 'not_legal'))
      order by ci.popularity asc, ci.id
      limit 30`;
    if (danaCards.length !== 30)
      throw new Error("fewer than thirty cards for the Autofill fixture");
    const danaIds = new Set(danaCards.map((r) => r.identity_id as string));
    await sql`
      insert into collections (user_id, printing_id, finish, quantity)
      select ${dana.id},
             unnest(${[talrand.printingId, ...danaCards.map((r) => r.printing_id as string)]}::uuid[]),
             'nonfoil', 1`;
    const danaOwned = new Set(
      (
        await sql`
          select distinct p.card_identity_id as id from collections c
          join card_printings p on p.id = c.printing_id where c.user_id = ${dana.id}`
      ).map((r) => r.id as string),
    );

    interface ShellPick {
      cardId: string;
      name: string;
      qty: number;
      tier: string;
    }
    const shellAsk = {
      game: "mtg",
      format: "commander",
      leaderIds: [talrand.identityId],
      seed: 1_234_567,
      ownedOnly: true,
      goals: { v: 1, targetLevel: 4 },
    };
    const fillStarted = Date.now();
    const fill = await api("POST", "/api/decks/autofill", { cookie: dana.cookie, body: shellAsk });
    const fillMs = Date.now() - fillStarted;
    const fillBody = j<{
      picks: ShellPick[];
      notes: string[];
      totals: { picks: number };
      owned?: { applied: boolean };
      cards: { id: string }[];
    }>(fill.json);
    const ranked = (fillBody.picks ?? []).filter((p) => p.tier !== "filler");
    const basics = (fillBody.picks ?? []).filter((p) => p.tier === "filler");
    check(
      `autofill ownedOnly with a collection → 200, owned.applied, no-store (${fillMs} ms)`,
      fill.status === 200 &&
        fillBody.owned?.applied === true &&
        fill.headers.get("cache-control") === "no-store",
      { status: fill.status, owned: fillBody.owned, text: fill.text.slice(0, 200) },
    );
    check(
      "…every pick that is not a basic-land filler is a card the player owns",
      ranked.length > 0 && ranked.every((p) => danaOwned.has(p.cardId)),
      ranked.filter((p) => !danaOwned.has(p.cardId)).map((p) => p.name),
    );
    check(
      "…and they are exactly the thirty the collection holds: nothing topped up, nothing left out",
      ranked.length === 30 && ranked.every((p) => danaIds.has(p.cardId) && p.qty === 1),
      { ranked: ranked.length, strangers: ranked.filter((p) => !danaIds.has(p.cardId)).length },
    );
    const basicQty = basics.reduce((n, p) => n + p.qty, 0);
    check(
      "…the rest are basic lands, added without being owned: 37 of them, 67 cards in all",
      basicQty === 37 && basics.every((p) => p.name === "Island") && fillBody.totals?.picks === 67,
      { basics: basics.map((p) => `${p.name} × ${p.qty}`), total: fillBody.totals?.picks },
    );
    check(
      "…the first note says the basic lands are not checked against the collection",
      fillBody.notes?.[0] ===
        "Basic lands are added as needed and aren't checked against your collection.",
      fillBody.notes,
    );
    check(
      "…the next counts the open slots and names where they are",
      fillBody.notes?.[1]?.startsWith(
        "Filled 67 of 99. Your collection ran out of cards that fit, leaving 32 slots open in Mana value ",
      ) === true,
      fillBody.notes,
    );
    check(
      "…and at a target of 4 the collection had no Game Changer to bring in",
      fillBody.notes?.includes(
        "Still 4 Game Changers short of Bracket 4. Autofill had no more to bring in from your collection (Wizards' list)",
      ) === true,
      fillBody.notes,
    );
    check(
      "…the answer's cards hold the commander too",
      fillBody.cards?.some((c) => c.id === talrand.identityId) === true,
    );

    const fillGuest = await api("POST", "/api/decks/autofill", { body: shellAsk });
    check(
      "autofill ownedOnly signed out → 401 with a sentence and no list",
      fillGuest.status === 401 &&
        typeof j(fillGuest.json).error === "string" &&
        !("picks" in j(fillGuest.json)),
      { status: fillGuest.status, text: fillGuest.text.slice(0, 200) },
    );
    const fillBob = await api("POST", "/api/decks/autofill", {
      cookie: bob.cookie,
      body: shellAsk,
    });
    check(
      "autofill ownedOnly without a collection → 409, reason no-collection, no list (never an unfiltered one)",
      fillBob.status === 409 &&
        j(fillBob.json).reason === "no-collection" &&
        !("picks" in j(fillBob.json)),
      { status: fillBob.status, text: fillBob.text.slice(0, 200) },
    );

    // ---- replace: wipe-then-insert ---------------------------------------
    const replace = await api("POST", "/api/collection", {
      cookie: alice.cookie,
      body: {
        mode: "replace",
        rows: [
          { scryfallId: brainstorm.printingId, name: "Brainstorm", finish: "nonfoil", quantity: 1 },
          { scryfallId: ponder.printingId, name: "Ponder", finish: "nonfoil", quantity: 1 },
        ],
      },
    });
    const r3 = j<Report>(replace.json);
    check(
      "replace → deleted 10 first, inserted 2, summary rows 2",
      replace.status === 200 && r3.deleted === 10 && r3.inserted === 2 && r3.summary?.rows === 2,
      { deleted: r3.deleted, inserted: r3.inserted, summary: r3.summary },
    );
    const [{ n: afterReplace }] =
      await sql`select count(*)::int as n from collections where user_id = ${alice.id}`;
    check("DB agrees: 2 rows", Number(afterReplace) === 2);

    // ---- wipe ------------------------------------------------------------
    const wipe = await api("DELETE", "/api/collection", { cookie: alice.cookie });
    check("DELETE → {deleted: 2}", wipe.status === 200 && j(wipe.json).deleted === 2, wipe.json);
    check(
      "GET summary after wipe → 0 rows",
      j<{ summary: Report["summary"] }>(
        (await api("GET", "/api/collection", { cookie: alice.cookie })).json,
      ).summary?.rows === 0,
    );

    // ---- the per-user cap (real constant, real rows, deleted right after) --
    // On a fresh user: the import limiter is 10/hour per user (the zod 400s
    // above count — it runs before body parsing) and alice has spent hers.
    const carol = await mkUser("c");
    const limit = COLLECTION_LIMITS.perUser;
    const seed = limit - 5;
    const fillerIds = (
      await sql`select id from card_printings where is_removed = false order by id limit ${seed + 10}`
    ).map((r) => r.id as string);
    if (fillerIds.length < seed + 10) throw new Error("not enough printings for the cap test");
    await sql`
      insert into collections (user_id, printing_id, finish, quantity)
      select ${carol.id}, unnest(${fillerIds.slice(0, seed)}::uuid[]), 'nonfoil', 1`;
    const capRows = fillerIds
      .slice(seed, seed + 10)
      .map((id) => ({ scryfallId: id, name: "x", finish: "nonfoil", quantity: 1 }));
    const capRes = await api("POST", "/api/collection", {
      cookie: carol.cookie,
      body: { rows: capRows },
    });
    const r4 = j<Report>(capRes.json);
    check(
      `cap: ${seed} held + 10 new → 5 inserted, capped {limit ${limit}, dropped 5}, rows = ${limit}`,
      capRes.status === 200 &&
        r4.inserted === 5 &&
        r4.capped?.limit === limit &&
        r4.capped?.dropped === 5 &&
        r4.summary?.rows === limit,
      {
        status: capRes.status,
        inserted: r4.inserted,
        capped: r4.capped,
        rows: r4.summary?.rows,
        text: capRes.text.slice(0, 300),
      },
    );
    // Updates to held rows still go through at the cap.
    const atCap = await api("POST", "/api/collection", {
      cookie: carol.cookie,
      body: { rows: [{ scryfallId: fillerIds[0], name: "x", finish: "nonfoil", quantity: 3 }] },
    });
    const r5 = j<Report>(atCap.json);
    check(
      "at the cap, updating a held row still works (0 inserted, 1 updated, not capped)",
      r5.updated === 1 && r5.inserted === 0 && r5.capped === null,
      r5,
    );
    // The owned filter at the cap (OWNED-FILTER, LATER row 69): the same
    // answer as for ten rows — applied, every suggestion one of the player's
    // cards — for a player whose collection is the largest the import keeps.
    // Carol asks about alice's deck (unlisted, so readable): the collection
    // is the session's, never the deck owner's.
    const carolOwned = new Set(
      (
        await sql`
          select distinct p.card_identity_id as id from collections c
          join card_printings p on p.id = c.printing_id where c.user_id = ${carol.id}`
      ).map((r) => r.id as string),
    );
    const capStarted = Date.now();
    const recCap = await api("GET", `/api/decks/${deck.id}/recommendations?owned=1`, {
      cookie: carol.cookie,
    });
    const capMs = Date.now() - capStarted;
    const recCapBody = j<{
      owned: { requested: boolean; applied: boolean; reason?: string };
      recommendations: Rec[];
    }>(recCap.json);
    check(
      `?owned=1 at the cap (${limit} rows, ${carolOwned.size} cards) → applied, every suggestion is an owned card, evidence intact (${capMs} ms)`,
      recCap.status === 200 &&
        recCapBody.owned?.applied === true &&
        recCapBody.recommendations.length > 0 &&
        recCapBody.recommendations.every((r) => carolOwned.has(r.cardId) && r.evidence.length > 0),
      {
        status: recCap.status,
        owned: recCapBody.owned,
        count: recCapBody.recommendations?.length,
      },
    );
    check(
      "…and never a card already in the deck, at the cap either",
      recCapBody.recommendations?.every(
        (r) => r.cardId !== counterspell.identityId && r.cardId !== remora.identityId,
      ) === true,
    );

    const wipeAll = await api("DELETE", "/api/collection", { cookie: carol.cookie });
    check(
      `DELETE at the cap → {deleted: ${limit}}`,
      j(wipeAll.json).deleted === limit,
      wipeAll.json,
    );

    // ---- cascade: deleting the user takes the collection ------------------
    await api("POST", "/api/collection", {
      cookie: bob.cookie,
      body: {
        rows: [
          { scryfallId: solRing.printingId, name: "Sol Ring", finish: "nonfoil", quantity: 1 },
        ],
      },
    });
    const [{ n: bobRows }] =
      await sql`select count(*)::int as n from collections where user_id = ${bob.id}`;
    check("bob imported 1 row", Number(bobRows) === 1);
    await sql`delete from users where id = ${bob.id}`;
    cleanup.userIds = cleanup.userIds.filter((id) => id !== bob.id);
    const [{ n: bobAfter }] =
      await sql`select count(*)::int as n from collections where user_id = ${bob.id}`;
    check("user delete cascades the collection", Number(bobAfter) === 0);
  } finally {
    if (cleanup.deckIds.length > 0) {
      await sql`delete from decks where id in ${sql(cleanup.deckIds)}`;
    }
    if (cleanup.userIds.length > 0) {
      await sql`delete from users where id in ${sql(cleanup.userIds)}`;
    }
    await sql.end();
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nall checks passed");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
