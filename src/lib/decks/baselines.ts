/**
 * deck_baselines IO (FIRST-LIST): the owner's GET reads the row, the owner's
 * PATCH writes it. The shapes and the rules are first-list.ts'; the table's
 * reasons are its docblock in src/db/schema.ts.
 */
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import type { DeckBaseline, normalizeBaseline } from "@/lib/decks/first-list";

const { deckBaselines } = schema;

/** The deck's baseline as the owner's wire carries it; null = none set. */
export async function loadDeckBaseline(deckId: string): Promise<DeckBaseline | null> {
  const [row] = await getDb()
    .select({
      source: deckBaselines.source,
      setAt: deckBaselines.setAt,
      cards: deckBaselines.cards,
    })
    .from(deckBaselines)
    .where(eq(deckBaselines.deckId, deckId))
    .limit(1);
  if (!row) return null;
  return { source: row.source, setAt: row.setAt.toISOString(), cards: row.cards };
}

/** Store the baseline whole (an upsert), or delete it (null). */
export async function writeDeckBaseline(
  deckId: string,
  baseline: ReturnType<typeof normalizeBaseline>,
): Promise<void> {
  const db = getDb();
  if (baseline === null) {
    await db.delete(deckBaselines).where(eq(deckBaselines.deckId, deckId));
    return;
  }
  await db
    .insert(deckBaselines)
    .values({ deckId, ...baseline })
    .onConflictDoUpdate({ target: deckBaselines.deckId, set: { ...baseline } });
}
