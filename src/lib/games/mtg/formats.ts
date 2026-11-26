import type { FormatDef } from "../types";

/**
 * Commander: 100 cards total INCLUDING the command zone; 1 commander, or 2
 * with a legal pairing (Partner / Partner with / Friends forever / Background /
 * Doctor's companion — checked in validate.ts, not schema-tized).
 *
 * main.defaultCopyLimit is null = singleton with the adapter's exemption logic
 * (basics, "a deck can have any number…" cards).
 *
 * tokens (DECK-TOKENS): the tokens, emblems and game pieces kept with the
 * deck — outside the 100 (countsTowardSize false), any number of each, never
 * validated.
 *
 * maybeboard (MAYBE-LIST): the cards the player is considering — Maybe,
 * outside the 100 like Tokens, but holding cards, any number, never
 * validated. Its id is the word the decklist parser already writes for a
 * "Maybeboard" header and Archidekt's out-of-deck categories, so a paste
 * lands there with no parser change. The core finds it by its shape
 * (playable.ts `maybeZoneOf`: counts toward no size, no leader's, holds
 * cards), never by this id.
 *
 * Tokens and Maybe are last on purpose: "the first non-leader zone" means
 * main wherever the core looks one up.
 */
export const COMMANDER: FormatDef = {
  code: "commander",
  label: "Commander",
  zones: [
    {
      id: "commander",
      label: "Commander",
      min: 1,
      max: 2,
      countsTowardSize: true,
      defaultCopyLimit: 1,
      isLeaderZone: true,
    },
    {
      id: "main",
      label: "Main deck",
      min: 0,
      max: null,
      countsTowardSize: true,
      defaultCopyLimit: null,
    },
    {
      id: "tokens",
      label: "Tokens",
      min: 0,
      max: null,
      countsTowardSize: false,
      defaultCopyLimit: null,
      holds: "tokens",
    },
    {
      id: "maybeboard",
      label: "Maybe",
      min: 0,
      max: null,
      countsTowardSize: false,
      defaultCopyLimit: null,
    },
  ],
  deckSize: { min: 100, max: 100 },
  openingHandSize: 7,
};

export const MTG_FORMATS: FormatDef[] = [COMMANDER];

export function mtgFormat(code: string): FormatDef | undefined {
  return MTG_FORMATS.find((f) => f.code === code);
}
