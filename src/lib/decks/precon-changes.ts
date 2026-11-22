/**
 * What a deck started from a precon has changed from the box
 * (PRECON-CHANGES, the owner's pick of 2026-11-15: two lists and row marks;
 * LATER row 345). Pure and client-safe, beside precon-owned.ts, whose
 * `preconCards` it counts both sides with.
 *
 * - **Derived, never stored.** The deck remembers its precon's own list
 *   (`deck.precon.cards`, PRECON-OWNED), so what changed is the difference
 *   between that list and the list on screen, worked out on every render:
 *   true after a reload, an Undo, a sheet's swap or an edit by hand. No
 *   column, no log of swaps to go stale at the first hand edit.
 * - **Per identity, over the format's counted zones.** Both sides are folded
 *   by `preconCards` itself, the price line's own rule, so a move between
 *   counted zones is no change (two partners trading places), a card cut and
 *   added back is no change, and a zone that counts toward no size (Magic's
 *   Tokens) is never read.
 * - **Two lists, not pairs.** `out` is what the box holds and the list no
 *   longer does (take these out); `in` is what the list holds beyond the
 *   box's copies (add these). 14 Forests over a 12-Forest precon is Forest
 *   × 2 in; 10 is Forest × 2 out. Which card left for which is a planner's
 *   bookkeeping, and no edit records it.
 * - **The baseline is the precon's list as the database holds it now**, the
 *   price line's rule: a re-ingest that corrects a product's list moves
 *   these lists and the price together. History's fork baseline is frozen at
 *   fork time, so after such a re-ingest that one stays and this one moves.
 * - **One number.** `preconAddCost` prices the copies in `in` the way
 *   `deckOwnership` prices a list's missing copies (cheapest printing, a
 *   collection's identities at $0, unpriced cards counted and left out of
 *   the sum). With the precon owned, the copies the price line calls missing
 *   are exactly `in`, so the two sums are one number by two paths.
 */
import { preconCards, type PreconCard } from "@/lib/decks/precon-owned";
import type { FormatDef } from "@/lib/games/types";

/** One identity's copies on one side of the difference. */
export interface PreconChange {
  cardId: string;
  qty: number;
}

export interface PreconChanges {
  /** What the precon holds and the list no longer does, per identity, sorted by id. */
  out: PreconChange[];
  /** What the list holds beyond the precon's copies, per identity, sorted by id. */
  in: PreconChange[];
  /** Copies over `out`. */
  outQty: number;
  /** Copies over `in`. */
  inQty: number;
}

const byId = (a: PreconChange, b: PreconChange) =>
  a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0;

/**
 * The difference between the precon's list (`deck.precon.cards`: one row per
 * identity, its copies over the counted zones) and the live entries.
 */
export function preconChanges(
  precon: readonly PreconCard[],
  entries: readonly { cardId: string; zone: string; qty: number }[],
  format: Pick<FormatDef, "zones">,
): PreconChanges {
  const box = new Map<string, number>();
  for (const c of precon) {
    if (c.qty > 0) box.set(c.cardId, (box.get(c.cardId) ?? 0) + c.qty);
  }
  const live = new Map(preconCards(entries, format).map((c) => [c.cardId, c.qty]));

  const out: PreconChange[] = [];
  const added: PreconChange[] = [];
  let outQty = 0;
  let inQty = 0;
  for (const [cardId, held] of box) {
    const gone = held - (live.get(cardId) ?? 0);
    if (gone > 0) {
      out.push({ cardId, qty: gone });
      outQty += gone;
    }
  }
  for (const [cardId, qty] of live) {
    const extra = qty - (box.get(cardId) ?? 0);
    if (extra > 0) {
      added.push({ cardId, qty: extra });
      inQty += extra;
    }
  }
  return { out: out.sort(byId), in: added.sort(byId), outQty, inQty };
}

/**
 * The row marks' input: identity → the copies the list holds beyond the
 * precon's. Null when the list holds nothing the precon didn't.
 */
export function beyondPrecon(
  changes: Pick<PreconChanges, "in">,
): ReadonlyMap<string, number> | null {
  if (changes.in.length === 0) return null;
  return new Map(changes.in.map((c) => [c.cardId, c.qty]));
}

/** What the copies to add cost, counted in copies. */
export interface PreconAddCost {
  /** Σ copies × cheapest printing over the copies not owned, to the cent. */
  usd: number;
  /** Copies of cards the collection holds: left out of `usd`. */
  owned: number;
  /** Copies not owned with no known price: left out of `usd`, never counted as $0. */
  unpriced: number;
  /** Every copy to add. */
  total: number;
}

/**
 * The cost of the cards to add that the player does not own. `owned` is the
 * collection's identity set, the one `deckOwnership` takes (null = no
 * collection): the precon's own copies are never in `added`, so an owned
 * precon needs no counting here. Summed in cents, so the cent is exact.
 */
export function preconAddCost(
  added: readonly PreconChange[],
  cards: ReadonlyMap<string, { cheapestUsd: number | null }>,
  owned: ReadonlySet<string> | null,
): PreconAddCost {
  let cents = 0;
  let mine = 0;
  let unpriced = 0;
  let total = 0;
  for (const c of added) {
    total += c.qty;
    if (owned?.has(c.cardId)) {
      mine += c.qty;
      continue;
    }
    const price = cards.get(c.cardId)?.cheapestUsd ?? null;
    if (price === null || !Number.isFinite(price)) unpriced += c.qty;
    else cents += c.qty * Math.round(price * 100);
  }
  return { usd: cents / 100, owned: mine, unpriced, total };
}

/**
 * "Copy as text": two headed blocks of `1 Name` lines, the export's grammar
 * (a heading, its lines A to Z, a blank line between blocks, a final
 * newline). A side with nothing in it has no block. Null while a card has
 * no name yet, so a half-named list is never copied.
 */
export function preconChangesText(
  changes: Pick<PreconChanges, "out" | "in">,
  nameOf: (cardId: string) => string | undefined,
  headings: { out: string; in: string },
): string | null {
  const block = (heading: string, list: readonly PreconChange[]): string | null | undefined => {
    if (list.length === 0) return undefined;
    const lines: { qty: number; name: string }[] = [];
    for (const c of list) {
      const name = nameOf(c.cardId);
      if (name === undefined) return null;
      lines.push({ qty: c.qty, name });
    }
    lines.sort((a, b) => a.name.localeCompare(b.name));
    return `${heading}\n${lines.map((l) => `${l.qty} ${l.name}`).join("\n")}`;
  };
  const blocks = [block(headings.out, changes.out), block(headings.in, changes.in)];
  if (blocks.includes(null)) return null;
  const text = blocks.filter((b): b is string => typeof b === "string").join("\n\n");
  return text === "" ? "" : `${text}\n`;
}
