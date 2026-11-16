/**
 * The words of "Do you own this precon?" (PRECON-OWNED), in one table so
 * its guard (precon-copy.test.ts) reads every string: the editor's one
 * line in the deck pane and the sentence the ownership line's method
 * gains. U9's policy: periods, commas and parentheses, no dash, no middle
 * dot; the line's controls follow its words after a gap, underlined.
 *
 * The precon is named as an apposition ("Started from Breed Lethality, a
 * precon.") because product names are data and some begin with "The" (The
 * Hosts of Mordor): "the {name} precon" would read "the The …".
 *
 * PRECON-CHANGES (the owner's pick of 2026-11-15) adds what the deck changed
 * from the box: the second line under the commander, the sheet's two lists
 * and its cost line, and the mark on a row the precon did not hold. The
 * sheet's title carries the product's name after "from", where a name that
 * begins with "The" reads as a name.
 */

/** "$1,234.56": grouped like the swap sheets' price line (BRACKET_COPY.fitCost). */
const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const PRECON_COPY = {
  /** Unanswered, or asked again after Change: the precon's name and the question. */
  ask: (name: string) => `Started from ${name}, a precon. Do you own it?`,
  yes: "Yes",
  no: "No",
  /** Answered yes: a quiet line naming the precon. */
  owned: (name: string) => `Started from ${name}, a precon you own.`,
  /** Answered no. */
  notOwned: (name: string) => `Started from ${name}, a precon you don't own.`,
  /** Asks again; the saved answer stands until Yes or No is picked. */
  change: "Change",
  /** The ownership line's method gains the precon's rule in this sentence (ownership.ts). */
  method: "Cards from the precon you own count as owned, up to the precon's own quantities.",

  // PRECON-CHANGES — the line under "Do you own this precon?".
  /** The list is the precon's own, card for card. */
  noChanges: "No changes from the precon yet.",
  /** Copies out of the box and copies added to it: "Changed from the precon: 25 out, 25 in." */
  changed: (out: number, added: number) => `Changed from the precon: ${out} out, ${added} in.`,
  /** The line's control, after a gap: opens the sheet. */
  seeChanges: "See changes",

  // PRECON-CHANGES — the sheet.
  /** The sheet's title: "Changes from Breed Lethality". */
  changesTitle: (name: string) => `Changes from ${name}`,
  changesLead: "What to take out of the precon and what to add to build this list.",
  /** The two lists' headings, each beside its count; the copied text's headings too. */
  takeOut: "Take out",
  add: "Add",
  /** Under "Add": what the deck list's mark means, said where a finger can read it. */
  markNote: "A circled plus marks these cards in the deck list.",
  /** A list with nothing in it. */
  nothingOut: "Nothing to take out.",
  nothingIn: "Nothing to add.",
  /** While the precon's own cards load: the names of cards this session has not seen. */
  loading: "Loading the precon's cards…",
  loadFailed: "Couldn't load the precon's cards.",
  retry: "Try again",
  /** A card of the box that the precon's own list can't name (a product re-read since). */
  unknownCard: "Unknown card",
  /** The collection's mark on an Add row: the deck rows' own words. */
  inCollection: "In your collection",
  /** A row of several copies: its price is one copy's. */
  each: (price: string) => `${price} each`,
  /**
   * What the cards to add cost, counted in copies: their cheapest printings,
   * the ones in the collection left out, the ones without a price counted
   * beside the sum.
   */
  addCost: (cost: { usd: number; owned: number; unpriced: number; total: number }) => {
    const { owned, unpriced, total } = cost;
    if (total === 0) return null;
    if (owned >= total) {
      return total === 1 ? "You own the card to add." : "You own every card to add.";
    }
    const toBuy = total - owned;
    const mine = owned > 0 ? " that you don't own" : "";
    if (unpriced >= toBuy) {
      return `No price is known for the ${toBuy === 1 ? "card" : `${toBuy} cards`} to add${mine}.`;
    }
    const head = `The ${toBuy === 1 ? "card to add costs" : "cards to add cost"} ${usd(cost.usd)}${
      owned > 0 ? `, not counting the ${owned} you own` : ""
    }.`;
    return unpriced > 0
      ? `${head} ${unpriced} more ${unpriced === 1 ? "has" : "have"} no price yet.`
      : head;
  },
  copy: "Copy as text",
  copyFailed: "Couldn't copy.",

  // PRECON-CHANGES — the mark on a row the precon did not hold.
  /**
   * The mark's name: every copy of the row is beyond the precon's, or only
   * some are (14 Forests over a 12-Forest precon: "2 not in the precon").
   */
  rowMark: (beyond: number, qty: number) =>
    beyond >= qty ? "Not in the precon" : `${beyond} not in the precon`,
  /** The grid's badge word beside the mark. */
  added: "Added",
} as const;
