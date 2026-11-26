/**
 * The words of "Changes from your first full list" (FIRST-LIST), in one
 * place: the deck pane's line, the sheet's title and lead, its "I've made
 * these changes" section and toast, and the deck rows' mark. The sheet's
 * other words (Take out, Add, the cost line, Copy as text, the mark's note)
 * are PRECON-CHANGES' own (PRECON_COPY): one sheet, two baselines.
 *
 * Two voices, by who set the baseline: the list reaching full size ("your
 * first full list") or the owner's "I've made these changes" ("your list of
 * Nov 26", the day it was set). Game-ignorant: "full list", never "100".
 */
import type { BaselineSource } from "@/lib/decks/first-list";

/** What the baseline is called in a sentence: "your first full list" / "your list of Nov 26". */
const named = (source: BaselineSource, date: string) =>
  source === "complete" ? "your first full list" : `your list of ${date}`;

export const FIRST_LIST_COPY = {
  /** The line with nothing changed: "No changes from your first full list yet." */
  noChanges: (source: BaselineSource, date: string) =>
    source === "complete"
      ? "No changes from your first full list yet."
      : `No changes since your list of ${date}.`,
  /** "Changed from your first full list: 3 out, 3 in." */
  changed: (source: BaselineSource, date: string, out: number, added: number) =>
    `${source === "complete" ? "Changed from" : "Changed since"} ${named(source, date)}: ${out} out, ${added} in.`,

  /** The sheet's title. */
  title: (source: BaselineSource, date: string) =>
    source === "complete"
      ? "Changes from your first full list"
      : `Changes since your list of ${date}`,
  /** The sheet's lead, PRECON_COPY.changesLead's sentence for this baseline. */
  lead: (source: BaselineSource, date: string) =>
    `What to take out of ${named(source, date)} and what to add to build this one.`,

  /** The sheet's last section: after the swaps are made in the physical deck. */
  resetLead: "Made these changes to your deck?",
  reset: "I've made these changes",
  resetNote: "Changes will count from the list as it is now.",
  /** The toast after it, with Undo. */
  resetToast: "Changes now count from this list",

  /** The deck row's mark: every copy is new since the baseline, or only some are. */
  rowMark: (source: BaselineSource, date: string, beyond: number, qty: number) =>
    beyond >= qty ? `Not in ${named(source, date)}` : `${beyond} not in ${named(source, date)}`,
} as const;
