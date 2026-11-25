/**
 * The suggest query (X2, WAVE3.md D2) behind GET /api/cards/suggest: at most
 * SUGGEST_LIMIT slim rows for a typed name, ranked by the shared matcher
 * (`name-match.ts`). Split from the route so the statements can be read,
 * EXPLAINed and measured by the same code that serves them.
 *
 * Statements, and only these:
 *   - a One Piece card number or prefix ("op01-02", searchIdPrefix — the
 *     search route's P4.8 pass) → ONE statement over `external_key LIKE`,
 *     in card-number order; a miss is an honest empty list (an id is not a
 *     misspelled name);
 *   - otherwise ONE statement for classes 1–3, and a SECOND — class 5, the
 *     trigram near misses — only when the first found fewer than
 *     SUGGEST_LIMIT rows and the text has NEAR_MISS_MIN_CHARS or more.
 *
 * `scope: "leaders"` is the hub scope: leader candidates WITH a slug (every
 * one has one, measured 2026-09-27; the condition is the hub's own). Banned
 * commanders stay in — their hubs exist for reference. The image is the
 * `small` thumbnail through `thumbnailUrl()`, the single gate: Scryfall's
 * `small` for Magic, the mirror's small WebP for One Piece since P4.9.
 *
 * COMMANDER-DOOR: every statement selects one more column, last
 * (`buildBlockedSql`): whether the card has a current unconditional ruling
 * other than `legal` in the format a new deck of its game opens in. It is a
 * column, never a condition, so a banned commander's row stays in the
 * answer, and it is one probe of a unique index for each of the at most 8
 * rows a statement returns. A row carries `buildBlocked: true` only when it
 * is a leader candidate AND the column is true, the two halves of the rule
 * in src/lib/decks/leader-build.ts read in the negative; every other row
 * keeps exactly its nine keys. The header's dropdown reads the member to
 * decide whether its top row gets a "Build with <card name>" entry; the
 * other boxes ignore it, in both scopes.
 */
import { and, eq, notInArray, sql, type SQL } from "drizzle-orm";

import { schema, type DbExecutor } from "@/db";
import { GAME_ID } from "@/db/seed-data";
import { embeddablePrintingImageUrl, thumbnailUrl } from "@/lib/cards/images";
import { searchIdPrefix } from "@/lib/cards/resolve-token";
import { notTokenSql } from "@/lib/cards/tokens-sql";
import { leaderFormat } from "@/lib/decks/leader-build";
import { NAME_MIN_CHARS, nameKey } from "@/lib/search/name-key";
import {
  nameMatchCondition,
  nameMatchOrder,
  nameNearMissCondition,
  NEAR_MISS_MIN_CHARS,
  parseNameQuery,
  SUGGEST_LIMIT,
} from "@/lib/search/name-match";

const { cardIdentities: ci, cardPrintings: cp, legalities } = schema;

export type SuggestGame = "mtg" | "optcg";
export type SuggestScope = "cards" | "leaders";

/** One dropdown row (D2's endpoint shape). */
export interface SuggestRow {
  id: string;
  name: string;
  /** The hub slug — set for leaders, null for everything else. */
  slug: string | null;
  isLeader: boolean;
  typeLine: string | null;
  colorsMask: number;
  ciMask: number;
  /** Magic: the oracle id; One Piece: the card number ("OP01-025"). */
  externalKey: string;
  /** The `small` thumbnail, or null (a card with no printing or no small rendition). */
  image: string | null;
  /**
   * COMMANDER-DOOR: present, and true, only on a leader candidate that gets
   * no build action: one with a current unconditional ruling other than
   * `legal` in the format a new deck opens in (banned, not legal). Absent on
   * every other row, so those rows are the nine keys above.
   */
  buildBlocked?: true;
}

export interface SuggestResponse {
  /** The normalized text the answer is for (the request key). */
  q: string;
  results: SuggestRow[];
}

export interface SuggestOptions {
  game: SuggestGame;
  scope: SuggestScope;
  /** Raw or already-normalized typed text — normalized here either way. */
  q: string;
}

function baseConditions(game: SuggestGame, scope: SuggestScope): SQL[] {
  // Never a token (DECK-TOKENS): the dropdowns pick cards, and a typed "Mutavault" means the land.
  const conditions = [eq(ci.gameId, GAME_ID[game]), eq(ci.isRemoved, false), notTokenSql(ci.attrs)];
  if (scope === "leaders") {
    conditions.push(eq(ci.isLeaderCandidate, true), sql`${ci.slug} IS NOT NULL`);
  }
  return conditions;
}

/**
 * The dropdown's ruling column (COMMANDER-DOOR), exported for EXPLAIN and
 * for the script that checks it against the rule on the real data: true
 * when the card has a current unconditional row in the format a new deck of
 * `game` opens in (`leaderFormat`) whose status is not `legal`. A
 * conditional row (One Piece's pair bans) is not read. Whether the card can
 * lead a deck at all is the row's own `isLeader`, tested in `toSuggestRow`,
 * so the statements' text gains no test of the leader flag.
 *
 * The outer card is nested one level (`card` below) on purpose. In the
 * select list of a statement with no join, drizzle writes that list's own
 * columns without their table, and a bare "id" inside this subquery would
 * be the ruling's id, not the card's ("operator does not exist: uuid =
 * bigint", met on the dev database). The statements here all join the
 * printing, so they were never at risk; a caller that selects the column
 * from the card table alone is.
 */
export function buildBlockedSql(game: SuggestGame): SQL<boolean> {
  const format = leaderFormat(game);
  // A game with no seeded format has no ruling to read.
  if (!format) return sql<boolean>`false`;
  const card = sql`${ci.id}`;
  return sql<boolean>`EXISTS (
    SELECT 1 FROM ${legalities} l
    WHERE l.card_identity_id = ${card}
      AND l.format_id = ${format.id}
      AND l.effective_to IS NULL AND l.condition IS NULL
      AND l.status <> 'legal')`;
}

function slimSelect(db: DbExecutor, game: SuggestGame) {
  return db
    .select({
      id: ci.id,
      name: ci.name,
      slug: ci.slug,
      isLeader: ci.isLeaderCandidate,
      typeLine: sql<string | null>`${ci.attrs}->>'type_line'`,
      colorsMask: ci.colorsMask,
      ciMask: ci.ciMask,
      externalKey: ci.externalKey,
      printingId: cp.id,
      imageOverride: cp.imageOverride,
      // Last on purpose: the route's test feeds rows by position.
      buildBlocked: buildBlockedSql(game),
    })
    .from(ci)
    .leftJoin(cp, and(eq(cp.cardIdentityId, ci.id), eq(cp.isDefault, true)));
}

/**
 * The statements as builders (unexecuted), for the route and for EXPLAIN.
 * `plan.kind` says which path the text takes; "none" means no statement.
 */
export function suggestPlan(db: DbExecutor, opts: SuggestOptions) {
  const text = nameKey(opts.q);
  if (text.length < NAME_MIN_CHARS) return { kind: "none" as const, text };
  const base = baseConditions(opts.game, opts.scope);

  const idPrefix = searchIdPrefix(opts.game, text);
  if (idPrefix !== null) {
    // searchIdPrefix admits [A-Z0-9-] only: the pattern needs no escaping.
    const statement = slimSelect(db, opts.game)
      .where(and(...base, sql`${ci.externalKey} LIKE ${idPrefix + "%"}`))
      .orderBy(sql`${ci.externalKey} ASC`)
      .limit(SUGGEST_LIMIT);
    return { kind: "id" as const, text, statement };
  }

  // nameKey(text) === text, so this parse cannot come back null.
  const query = parseNameQuery(text)!;
  const order = nameMatchOrder(query);
  const statement = slimSelect(db, opts.game)
    .where(and(...base, nameMatchCondition(query, "suggest")))
    .orderBy(...order)
    .limit(SUGGEST_LIMIT);
  const nearMisses = (excludeIds: string[], limit: number) =>
    slimSelect(db, opts.game)
      .where(
        and(
          ...base,
          nameNearMissCondition(query),
          excludeIds.length ? notInArray(ci.id, excludeIds) : undefined,
        ),
      )
      .orderBy(...order)
      .limit(limit);
  return { kind: "name" as const, text, statement, nearMisses };
}

type SlimRow = Omit<SuggestRow, "image" | "buildBlocked"> & {
  printingId: string | null;
  imageOverride: unknown;
  /** The raw column (`buildBlockedSql`); it never rides the wire as selected. */
  buildBlocked: boolean;
};

function toSuggestRow({ printingId, imageOverride, buildBlocked, ...row }: SlimRow): SuggestRow {
  return {
    ...row,
    image: printingId
      ? thumbnailUrl(embeddablePrintingImageUrl({ id: printingId, imageOverride }, "normal"))
      : null,
    // The member rides only on a leader candidate that fails the rule.
    ...(row.isLeader && buildBlocked === true ? { buildBlocked: true as const } : {}),
  };
}

export async function loadSuggestions(
  db: DbExecutor,
  opts: SuggestOptions,
): Promise<SuggestResponse> {
  const plan = suggestPlan(db, opts);
  if (plan.kind === "none") return { q: plan.text, results: [] };
  const rows = await plan.statement;
  if (
    plan.kind === "name" &&
    rows.length < SUGGEST_LIMIT &&
    plan.text.length >= NEAR_MISS_MIN_CHARS
  ) {
    rows.push(
      ...(await plan.nearMisses(
        rows.map((r) => r.id),
        SUGGEST_LIMIT - rows.length,
      )),
    );
  }
  return { q: plan.text, results: rows.map(toSuggestRow) };
}
