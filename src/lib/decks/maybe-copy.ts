/**
 * The Maybe list's words (MAYBE-LIST), in one place: the editor's toasts and
 * refusals, the section's heading line, its rows' and tiles' actions, the
 * Suggestions and search rows' button, the search row's mark. Game-ignorant: "the deck", never a
 * game's own size or zone names (the section's heading is the zone's label,
 * `ZoneDef.label`, Magic's "Maybe").
 */
export const MAYBE_COPY = {
  /** The Suggestions, search and Combos rows' button, and the phone card sheet's. */
  button: "Maybe",
  buttonLabel: (name: string) => `Add ${name} to Maybe`,
  /** The search box's Shift+Enter (LATER 549): the hint line's words, and the `?` sheet's row. */
  keyHint: "Maybe",
  keyRow: "Add the selected card to Maybe",
  /** A row whose card already sits in Maybe. */
  inMaybe: "In Maybe",
  /** "Added Sol Ring to Maybe" — the Maybe add's toast ("Added 4× …" from a "4 Name" search). */
  added: (name: string, qty = 1) => `Added ${qty > 1 ? `${qty}× ` : ""}${name} to Maybe`,
  /** The second line of an add's toast when the card left Maybe on its way in. */
  leftMaybe: "Taken out of Maybe.",
  /** A Maybe add of a card the deck plays, or one already parked. */
  alreadyInDeck: "Already in the deck",
  alreadyInMaybe: "Already in Maybe",
  /** A Maybe row's and tile's way into the deck (its words, always shown), and its toast. */
  move: "Move to deck",
  moveLabel: (name: string) => `Move ${name} to the deck`,
  /** The same button at the deck's maximum, which opens the swap sheet. */
  swapIn: "Swap in…",
  swapInLabel: (name: string) => `Swap in ${name}…`,
  /** A Maybe tile's ×N badge, named for the list it counts. */
  countLabel: (qty: number) => `${qty} in Maybe`,
  moved: (name: string, qty: number) => `Moved ${qty > 1 ? `${qty}× ` : ""}${name} to the deck`,
  /** The Maybe row's remove, the card sheet's, and its toast. */
  remove: "Remove from Maybe",
  removeLabel: (name: string) => `Remove ${name} from Maybe`,
  removed: (name: string, qty: number) => `Removed ${qty > 1 ? `${qty}× ` : ""}${name} from Maybe`,
  /** The open section's line above its rows: the editor's, and the share page's. */
  note: "Cards you’re considering. They don’t count toward the deck and aren’t checked.",
  visitorNote: "Cards the builder is considering. They’re not part of the deck.",
  /** The open section with nothing in it (the editor's only). */
  empty:
    "Nothing here yet. Search, Suggestions and Combos can park a card here with Maybe; it won’t count toward the deck.",
  /** The empty deck's hint while Maybe holds a card. */
  emptyDeckHint: "Add them from Search, or move one in from Maybe.",
} as const;
