/**
 * What a deck built by hand has changed from its first full list
 * (FIRST-LIST, the owner's ask of 2026-11-26: "add this same feature to view
 * the list of changes from a pre con to any deck you built from the first
 * time you get your 100 cards built"). Pure and client-safe, beside
 * precon-changes.ts, whose difference, cost and text it reuses whole: the
 * baseline has the precon list's own shape (`preconCards`).
 *
 * The owner's four calls of 2026-11-26 (REDESIGN.md, "Changes from your
 * first full list"):
 *
 * 1. **The baseline is the first full list**, saved the first time the list
 *    reaches its format's full size (Commander's 100 of 100), and Upgrade
 *    toward does not move it: what an upgrade swaps shows up as changes,
 *    beside what was changed by hand.
 * 2. **"I've made these changes"** in the sheet makes the list on screen the
 *    new baseline (`source: "owner"`), for after the swaps are made in the
 *    physical deck.
 * 3. **Its own spot**: the `deck_baselines` table, never a deck version.
 * 4. **A deck already full when this shipped** keeps the list it holds as
 *    it stood before its next edit: the editor takes it on load and saves it
 *    with that edit's save (deck-editor.tsx).
 *
 * The editor sets the baseline and the owner's PATCH stores it, the goals'
 * way: the server never guesses, and a list the screen never showed is
 * never a baseline. A deck with a precon lineage has none (its precon is
 * its baseline, PRECON-CHANGES), and the PATCH refuses one.
 */
import { z } from "zod";

import { MAX_ENTRIES } from "@/lib/decks/editor-state";
import { preconCards, type PreconCard } from "@/lib/decks/precon-owned";
import type { FormatDef } from "@/lib/games/types";

/** Who set the baseline: the list reaching full size, or the owner's "I've made these changes". */
export type BaselineSource = "complete" | "owner";

/** The owner's wire (GET /api/decks/[id]'s `deck.baseline`) and the editor's state. */
export interface DeckBaseline {
  source: BaselineSource;
  /** ISO time it was set: "Changes since your list of Nov 26" (an owner's baseline). */
  setAt: string;
  /** One row per identity over the counted zones, sorted by id (`preconCards`). */
  cards: PreconCard[];
}

/** A copy count no real list reaches (a 500-line deck of basics), so a typo can't store a million. */
const MAX_QTY = 999;

/**
 * The PATCH body's `baseline` (null deletes it). The cards are folded per
 * identity and sorted by `normalizeBaseline`, so a body that repeats an id
 * stores one row.
 */
export const baselineSchema = z
  .object({
    source: z.enum(["complete", "owner"]),
    setAt: z.iso.datetime({ offset: true }),
    cards: z
      .array(z.object({ cardId: z.uuid(), qty: z.number().int().min(1).max(MAX_QTY) }))
      .max(MAX_ENTRIES),
  })
  .nullable();

/**
 * The stored form: copies folded per identity, sorted by id, and a set time
 * no later than `now` (a client clock running ahead can't date a baseline in
 * the future).
 */
export function normalizeBaseline(
  baseline: z.infer<typeof baselineSchema>,
  now: Date = new Date(),
): { source: BaselineSource; setAt: Date; cards: PreconCard[] } | null {
  if (baseline === null) return null;
  const copies = new Map<string, number>();
  for (const c of baseline.cards) {
    copies.set(c.cardId, Math.min(MAX_QTY, (copies.get(c.cardId) ?? 0) + c.qty));
  }
  const cards = [...copies]
    .map(([cardId, qty]) => ({ cardId, qty }))
    .sort((a, b) => (a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0));
  const at = new Date(baseline.setAt);
  return { source: baseline.source, setAt: at > now ? now : at, cards };
}

/** The canonical PATCH body: the editor's last-saved check compares these as strings. */
export function baselinePatchBody(baseline: DeckBaseline | null): string {
  return JSON.stringify({ baseline });
}

/**
 * The list is full: its copies over the counted zones sit inside the
 * format's size (Commander exactly 100; a format with no maximum, at least
 * its minimum). The zones are `deckSizeCount`'s, the "100 / 100" counter's.
 */
export function listComplete(
  entries: readonly { zone: string; qty: number }[],
  format: Pick<FormatDef, "zones" | "deckSize">,
): boolean {
  const counted = new Set(format.zones.filter((z) => z.countsTowardSize).map((z) => z.id));
  const total = entries.reduce((n, e) => (counted.has(e.zone) ? n + e.qty : n), 0);
  const { min, max } = format.deckSize;
  return total > 0 && total >= min && (max === null || total <= max);
}

/** A baseline of the given list: its counted copies per identity, the precon list's shape. */
export function baselineOf(
  entries: readonly { cardId: string; zone: string; qty: number }[],
  format: Pick<FormatDef, "zones">,
  source: BaselineSource,
  setAt: string,
): DeckBaseline {
  return { source, setAt, cards: preconCards(entries, format) };
}

/**
 * "Nov 26", or "Nov 26, 2025" outside the current year: the day an owner's
 * baseline was set, in the reader's own time zone (the editor renders on the
 * client only, so nothing hydrates against a server's clock).
 */
export function baselineDate(setAt: string, now: Date = new Date(), timeZone?: string): string {
  const at = new Date(setAt);
  const year = (d: Date) =>
    new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone }).format(d);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(year(at) !== year(now) ? { year: "numeric" } : {}),
    timeZone,
  }).format(at);
}
