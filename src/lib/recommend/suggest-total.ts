/**
 * A deck total in Suggestions (SUGGEST-TOTAL, 2026-11-26, the owner's ask:
 * "i want to add the same budget features that are now in the autofill page
 * when creating a new deck to the suggestion tab also … the same option to
 * type your budget to get more specific"; LATER row 195 fired for
 * Suggestions). Pure: the panel renders what these return, and the test
 * beside this file reads every line they can say.
 *
 * The owner's two answers (2026-11-26, the question dialog, before the
 * build):
 * - **"Fits what's left".** A total narrows the list to the cards at or
 *   under what is left of it: the total less the deck's estimate (the
 *   editor's `deckEstimate`: cheapest printings, owned copies at $0 with a
 *   collection, cards without a price left out and counted beside it). So
 *   adding any one card the list shows keeps the deck at or under its
 *   total. What is left is a price limit like the per-card tiers, and the
 *   tighter of the two is the one asked for (the routes' `budget`, which
 *   queries.ts reads as `cheapest_usd <= budget`): no route changes, and no
 *   route ever reads the total. Nothing left, at or over the total: nothing
 *   is asked, and the panel says so.
 * - **"Save link, like Budget".** The panel's total is its own until it is
 *   saved, as its per-card pick is: it starts from the deck's saved total,
 *   and a different one offers "Save $100 as this deck's total" (or "Remove
 *   this deck's total" for Not set), the Fit sheet's words.
 *
 * Cards you own: with "Only cards I own" ticked and applied the total
 * narrows nothing. Every card in that list is the player's own, and an
 * owned card costs nothing to add, so it never moves the estimate (the
 * Autofill sheet's decision 5, read for this panel). A tick the server
 * declined (signed out, no collection) filters nothing, so there the total
 * narrows the list again.
 */
import { formatUsd } from "@/lib/collection/ownership";
import type { FitEstimate } from "./fit";

/** The price limit Suggestions ask with, and why. */
export interface SuggestionLimit {
  /** The most a suggestion may cost, in USD; null = no limit. */
  priceUsd: number | null;
  /** Which limit that is: the per-card tier's, what's left of the total, or none. */
  binding: "tier" | "total" | null;
  /** What's left of the total in force; null when no total narrows the list. */
  leftUsd: number | null;
  /** Nothing is left (the deck is at or over its total): no card fits, nothing is asked. */
  full: boolean;
}

/** Whole cents, so a sum of prices never lands a hair off the figure it reads as. */
const cents = (usd: number) => Math.round(usd * 100);

/**
 * The limit for one ask. `tierUsd` is the per-card tier picked (null for
 * All), `totalUsd` the total in force (the panel's pick, else the deck's),
 * `estimate` the deck's cost now (null while unknown: then no total narrows
 * anything), `owned` the "Only cards I own" filter being asked for.
 */
export function suggestionLimit({
  tierUsd,
  totalUsd,
  estimate,
  owned,
}: {
  tierUsd: number | null;
  totalUsd: number | null;
  estimate: FitEstimate | null;
  owned: boolean;
}): SuggestionLimit {
  if (totalUsd === null || estimate === null || owned) {
    return {
      priceUsd: tierUsd,
      binding: tierUsd === null ? null : "tier",
      leftUsd: null,
      full: false,
    };
  }
  const left = cents(totalUsd) - cents(estimate.usd);
  const leftUsd = left / 100;
  if (left <= 0) return { priceUsd: null, binding: null, leftUsd, full: true };
  // A tie reads as the tier's: the per-card words were there first.
  if (tierUsd !== null && cents(tierUsd) <= left) {
    return { priceUsd: tierUsd, binding: "tier", leftUsd, full: false };
  }
  return { priceUsd: leftUsd, binding: "total", leftUsd, full: false };
}

/** The limit as the fetch key reads it: one string per distinct ask. */
export function limitKey(limit: SuggestionLimit): string {
  if (limit.full) return "full";
  return limit.priceUsd === null ? "all" : String(cents(limit.priceUsd));
}

/**
 * A shown row against the limit in force now, to the cent: the panel keeps
 * the last answer's rows to it, since an Add tightens what's left at once
 * while the next answer waits for the save to settle. A card with no known
 * price never fits a limit (a budget is a claim about a known price).
 */
export function fitsLimit(cheapestUsd: string | number | null, priceUsd: number | null): boolean {
  if (priceUsd === null) return true;
  if (cheapestUsd === null) return false;
  const usd = Number(cheapestUsd);
  return Number.isFinite(usd) && cents(usd) <= cents(priceUsd);
}

/** An amount left, to the cent where it has cents: "$38", "$37.62", "$1,204.50". */
export function usdLeft(usd: number): string {
  if (cents(usd) % 100 === 0) return formatUsd(usd);
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export const SUGGEST_TOTAL_COPY = {
  /** What's left of the total, and the cards the deck still needs (none once it is complete). */
  left: (left: string, toAdd: number) =>
    toAdd > 0 ? `${left} left for ${plural(toAdd, "more card")}` : `${left} left`,
  /** In the list's place when nothing is left (Not set drops the total; a per-card tier still holds). */
  full: (total: string) =>
    `Nothing more fits under your ${total} total. Raise it, or choose Not set to drop it.`,
  /** The list came back empty under what's left. */
  noneLeft: (left: string, total: string) =>
    `No suggestions fit the ${left} left of your ${total} total.`,
  /** "Only cards I own" ticked: the total narrows nothing. */
  owned: "Cards you own cost nothing to add, so the total doesn't narrow this list.",
} as const;

/**
 * The line under the panel's Deck total, or null when it has nothing to
 * add. The goals line above it reads the deck's SAVED total ("est. $62 of
 * your $100", with "Fit my budget" while over), so while the total in force
 * is the saved one this line says only what is left; a total of the panel's
 * own leads with its own phrase (`phrase`, the goals line's `totalPhrase`
 * for it): "est. $62 of your $100 · $38 left for 38 more cards". With nothing
 * left, the list's place says so, and only an unsaved total's phrase stays
 * here.
 */
export function suggestTotalLine({
  totalUsd,
  savedUsd,
  limit,
  toAdd,
  owned,
  phrase,
}: {
  totalUsd: number | null;
  savedUsd: number | null;
  limit: SuggestionLimit;
  /** Cards short of the format's minimum (the progress line's "N to go"). */
  toAdd: number;
  owned: boolean;
  /** The goals line's phrase for the total in force: "est. $62 of your $100". */
  phrase: string;
}): string | null {
  if (totalUsd === null) return null;
  if (owned) return SUGGEST_TOTAL_COPY.owned;
  if (limit.leftUsd === null) return null;
  const head = totalUsd !== savedUsd ? phrase : null;
  if (limit.full) return head;
  const left = SUGGEST_TOTAL_COPY.left(usdLeft(limit.leftUsd), toAdd);
  return head ? `${head} · ${left}` : left;
}
