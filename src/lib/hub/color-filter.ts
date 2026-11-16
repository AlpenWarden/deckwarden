/**
 * The commander index's color filter (COLOR-INCLUDES, the owner's note of
 * 2026-11-15): what `?colors=` and `?match=` mean, the query string every
 * link on the page carries, the chips' toggling, and the words. Pure: the
 * page (`src/app/(site)/commanders/page.tsx`) reads the URL through this,
 * and `loadLeaderIndex` (`./queries`) takes its answer.
 *
 * Two ways to read the same chips. **Exactly** is the index's recorded
 * decision and stays the default: Black is mono-black, Black with Green is
 * Golgari, the way players name the space. **Including** is the second
 * reading: every commander whose identity holds all the picked colors,
 * alone or with others, for the reader who remembers "it had black in it".
 * The two words are the card search's own colorset modes (`translate.ts`:
 * `within | including | exactly`), not a new vocabulary.
 *
 * The URL: `match=including`. Absent, or any other value, is exactly, so
 * every link that existed before the mode means what it meant, and the page
 * builds the same query string for it, byte for byte. The mode is the
 * reader's choice and rides on every link, also while no color is picked:
 * choosing the mode first and a color second works.
 *
 * Colorless is always exact. It is the absence of colors, so there is
 * nothing to include: `(ci_mask & 0) = 0` holds for every row, and
 * "including Colorless" would quietly be the whole index. The links keep
 * the reader's mode, the query runs exactly, and the page says so in words.
 */
import { lettersToMask, maskToLetters, type ColorLetter } from "@/lib/games/colors";

/** The chips' two readings, the default first: the order the page draws them in. */
export const COLOR_MATCHES = ["exactly", "including"] as const;
export type ColorMatch = (typeof COLOR_MATCHES)[number];

/** The URL parameter beside `colors`, and the name of the name form's hidden input. */
export const MATCH_PARAM = "match";

export interface ColorFilter {
  /** null: no color picked. 0: Colorless. Otherwise the picked colors' mask (W1 U2 B4 R8 G16). */
  mask: number | null;
  /** The reading the reader chose. Every link carries it; `appliedMatch` is what the query runs. */
  match: ColorMatch;
}

/**
 * `?colors=` and `?match=` as the page receives them (a string, an array for
 * a repeated key, or nothing). `colors` reads as it always has: letters in
 * any case and order, unknown characters ignored, "c" alone Colorless, and a
 * color beside a "c" wins. `match` is "including" in any case; anything else
 * is exactly.
 */
export function parseColorFilter(colors: unknown, match: unknown): ColorFilter {
  const raw = typeof colors === "string" ? colors : "";
  const colorMask = lettersToMask(raw.replace(/c/gi, ""));
  const mask = colorMask > 0 ? colorMask : /c/i.test(raw) ? 0 : null;
  const including = typeof match === "string" && match.trim().toLowerCase() === "including";
  return { mask, match: including ? "including" : "exactly" };
}

/** The picked letters in WUBRG order: "" for none, "C" for Colorless. */
export function colorFilterLetters(filter: Pick<ColorFilter, "mask">): string {
  if (filter.mask === null) return "";
  return filter.mask === 0 ? "C" : maskToLetters(filter.mask).join("");
}

/**
 * The reading the query runs. Including needs a color to include, so
 * Colorless and an empty selection are exact whatever the reader chose.
 */
export function appliedMatch(filter: ColorFilter): ColorMatch {
  return filter.match === "including" && filter.mask !== null && filter.mask > 0
    ? "including"
    : "exactly";
}

/**
 * A color chip's next selection, from the picked letters: the chip's own
 * letter toggles, Colorless stands alone (picking it drops the colors, and
 * picking a color drops it), and a new letter joins at the end. The same
 * rule in both readings, and the letters the page built before the mode.
 */
export function toggleColorLetter(active: string, letter: ColorLetter): string {
  if (letter === "C") return active === "C" ? "" : "C";
  return active.includes(letter)
    ? active.replace(letter, "").replace("C", "")
    : active.replace("C", "") + letter;
}

/**
 * The query string of one link ("" for the bare index): `colors`, then
 * `match` when including, then `page` past 1, then `q`. Exactly adds
 * nothing, so its links are the ones the page has always built.
 */
export function colorFilterQuery(opts: {
  letters: string;
  match: ColorMatch;
  page?: number;
  q?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.letters) params.set("colors", opts.letters.toLowerCase());
  if (opts.match === "including") params.set(MATCH_PARAM, "including");
  if (opts.page !== undefined && opts.page > 1) params.set("page", String(opts.page));
  if (opts.q) params.set("q", opts.q);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

/** "Black", "Black and Green", "White, Blue and Black". */
function andList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const onThisPage = (page: number) => (page > 1 ? " on this page" : "");

/**
 * The filter's words, in one table so its guard (color-filter.test.ts) reads
 * every string. U9's policy: periods, colons and commas, no dash, no middle
 * dot. The two chips take the card search's words with "these colors", so
 * each reads as a whole instruction with or without a color picked.
 */
export const COLOR_FILTER_COPY = {
  /** The accessible name of the two chips' group. */
  matchLabel: "Color match",
  /** The default chip. */
  exactly: "Exactly these colors",
  /** The second chip. */
  including: "Including these colors",
  /**
   * The rule, under the chips while including is on and a color is picked.
   * All five colors leave nothing to combine with, so that line says only
   * what the list is.
   */
  includes: (names: readonly string[]) =>
    names.length >= 5
      ? "Commanders with all five colors."
      : `Commanders whose colors include ${andList(names)}, alone or with others.`,
  /** Including chosen before any color: what the next pick will do. */
  pickAColor: "Pick a color to see every commander whose colors include it.",
  /** Including chosen, Colorless picked: the list is exact, and why. */
  colorlessIsExact: "Colorless is always exact: these commanders have no colors to include.",
  /** A page past the end of an exact list (the sentence the page has always shown there). */
  emptyExactly: (page: number) =>
    `No commanders match that exact color identity${onThisPage(page)}.`,
  /** A page past the end of an including list. */
  emptyIncluding: (colors: number, page: number) =>
    `No commanders include ${colors === 1 ? "that color" : "those colors"}${onThisPage(page)}.`,
  /** A page past the end of the whole index, with no color picked. */
  emptyAll: (page: number) => `No commanders${onThisPage(page)}.`,
} as const;

/**
 * The line under the two chips, or null. Exactly says nothing, as before.
 * Including always says what it is doing: the rule for the picked colors
 * (`names`, the picked colors' names in WUBRG order), what a pick will do
 * while none is, or that Colorless is exact.
 */
export function colorFilterNote(filter: ColorFilter, names: readonly string[]): string | null {
  if (filter.match !== "including") return null;
  if (filter.mask === null) return COLOR_FILTER_COPY.pickAColor;
  if (filter.mask === 0) return COLOR_FILTER_COPY.colorlessIsExact;
  return COLOR_FILTER_COPY.includes(names);
}

/**
 * The sentence for a list with no rows and no name filter (a page past the
 * end): it names the search that ran, so it says "exact" only for an exact
 * one.
 */
export function colorFilterEmpty(filter: ColorFilter, page: number): string {
  if (filter.mask === null) return COLOR_FILTER_COPY.emptyAll(page);
  return appliedMatch(filter) === "including"
    ? COLOR_FILTER_COPY.emptyIncluding(maskToLetters(filter.mask).length, page)
    : COLOR_FILTER_COPY.emptyExactly(page);
}
