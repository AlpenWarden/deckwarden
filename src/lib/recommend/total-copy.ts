/**
 * The Autofill sheet's Deck total, in words (AUTOFILL-TOTAL, the owner's idea
 * 5 of 2026-11-24: "a spot to type your total budget to keep the deck in
 * that range"). Pure: the sheet and the editor render what these return, and
 * the test beside this file reads every line they can say.
 *
 * - `autofillTotalNote`: under the control, what Add will do to the deck's
 *   total, and only when it would change it (the owner's decision 16: Add
 *   saves the total on the deck, as it saves a picked target). A total is the
 *   owner's alone on every wire, so the line says who sees it.
 * - `autofillTotalTitle`: what Add did to the deck's total, for the toast.
 * - `autofillSavedToast`: the toast's second line. Add may have moved the
 *   target, the total or both, and its Undo is the list's alone, so the line
 *   names what it leaves. With the target alone it is AUTOFILL-TARGET's
 *   sentence, word for word.
 * - `deckTotalLine`: the footer's figure for the whole deck against its
 *   total, in the Fit sheet's own phrase.
 *
 * The note the route sends when a list cannot reach its total is the
 * planner's (`overTotalNote`, ./autofill.ts), and the line about a target
 * left short under a total is the adapter's (`reachNotes`).
 */
import { BRACKET_COPY } from "@/lib/brackets/copy";
import { formatUsd } from "@/lib/collection/ownership";
import { FIT_COPY, totalPhrase, type FitEstimate } from "./fit";

export const TOTAL_COPY = {
  /** The field's submit in the Autofill sheet (the Fit sheet's says Fit). */
  set: "Set",
  /** The chip that clears the total: pressed while there is none. */
  notSet: "Not set",
  /** A total is the owner's alone: no visitor's wire carries the budget. */
  onlyYou: "Only you see a deck's total.",
  addSaves: (total: string) => `Adding these cards saves ${total} as this deck's total.`,
  addChanges: (from: string, to: string) =>
    `Adding these cards changes this deck's total from ${from} to ${to}.`,
  addRemoves: "Adding these cards removes this deck's total.",
  totalSet: (total: string) => `Deck total set: ${total}`,
  totalChanged: (from: string, to: string) => `Deck total changed from ${from} to ${to}`,
  totalRemoved: "Deck total removed",
  undoKeepsTotal: "Undo takes the cards back, not the total.",
  undoKeepsBoth: "Undo takes the cards back, not the target or the total.",
} as const;

/** Under the control: what Add will do to the deck's total; null when it would leave it as it is. */
export function autofillTotalNote(from: number | null, to: number | null): string | null {
  if (from === to) return null;
  if (to === null) return TOTAL_COPY.addRemoves;
  const what =
    from === null
      ? TOTAL_COPY.addSaves(formatUsd(to))
      : TOTAL_COPY.addChanges(formatUsd(from), formatUsd(to));
  return `${what} ${TOTAL_COPY.onlyYou}`;
}

/** What Add did to the deck's total, for the toast; null when it left it. */
export function autofillTotalTitle(from: number | null, to: number | null): string | null {
  if (from === to) return null;
  if (to === null) return TOTAL_COPY.totalRemoved;
  return from === null
    ? TOTAL_COPY.totalSet(formatUsd(to))
    : TOTAL_COPY.totalChanged(formatUsd(from), formatUsd(to));
}

/**
 * The toast's second line after Add: what it saved on the deck besides the
 * cards (`target`: AUTOFILL-TARGET's title; `total`: `autofillTotalTitle`),
 * then what its Undo leaves. Null when Add saved neither.
 */
export function autofillSavedToast(target: string | null, total: string | null): string | null {
  if (target !== null && total !== null) {
    return `${target}. ${total}. ${TOTAL_COPY.undoKeepsBoth}`;
  }
  if (target !== null) return `${target}. ${BRACKET_COPY.autofillUndoKeeps}`;
  if (total !== null) return `${total}. ${TOTAL_COPY.undoKeepsTotal}`;
  return null;
}

/** The footer: "Deck total: est. $97 of your $100", "(+3 unpriced)" when cards have no price. */
export function deckTotalLine(totalUsd: number, estimate: FitEstimate): string {
  return `${FIT_COPY.totalLabel}: ${totalPhrase(totalUsd, estimate)}`;
}
