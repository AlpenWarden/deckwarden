/**
 * Magic's themes (COMMANDER-FIT) — pure, client-safe: which types a
 * Commander list is built around, as far as its cards' type lines and its
 * commander's rules text can say it. Nothing here reads what a card DOES:
 * a theme is a type word, counted on the list or named by the commander,
 * and the evidence line always says which of the two it is.
 *
 * Why it exists: every other suggestion signal is global or competitive
 * (EDHREC's rank over all decklists, Topdeck's top-16 lists, the curve
 * template), so a Sliver was never a suggestion for a Sliver deck and was
 * the first card its Cut Coach named. Measured on the 182 precons
 * (2026-11-16, the dev branch): a list built around a type holds 13 to 43
 * cards of it where the 2,000 most-played nonland cards would put one or
 * two there by chance.
 *
 * The two readings:
 *
 * 1. The list's count — a type on at least LIST_MIN of its cards. Three
 *    words are everyday enough to need more than a count (SHARE_FLOORS, as a
 *    share of the nonland cards): Human rides along on other types' cards
 *    (18 of the Pirates precon's 63), and every list runs artifacts and
 *    enchantments. A type most of whose cards already carry a bigger theme
 *    is that theme's shadow, not one of its own (the ten Druids of an Elf
 *    list are Elf Druids): CO_TYPE_SHARE.
 * 2. The commander's rules text naming a type — "Whenever you cast another
 *    Vampire spell". Read literally and narrowly: reminder text, the card's
 *    own name, the types a token is made with ("create a 1/1 green Elf
 *    Warrior creature token") and the types an effect turns something into
 *    (Anikthea's "3/3 black Zombie creature") are taken out first, a word
 *    after "non-" is no mention, and the name alone is never enough — the
 *    commander carries the type itself, or NAMED_MIN cards of the list do.
 *    That second check is what keeps another card's name in the text from
 *    reading as a theme (Gisela names her meld partner, Brisela, Voice of
 *    Nightmares), and an everyday word needs the cards even on a commander
 *    that carries it (the Human of "Human Werewolves you control").
 *
 * Only words on the type line are themes: subtypes, and the three card
 * types a list is built around (THEME_CARD_TYPES). A land face gives none —
 * lands are every list's base, and their types are colors. Instants and
 * sorceries are left out: the lists built on them count "instant or
 * sorcery" together, which one type word cannot say (LATER row 480). And a
 * card that makes a theme work without carrying its word is not read at
 * all: a typal list's "choose a creature type" cards, an enchantment
 * list's enchantresses (LATER row 479).
 *
 * This is the one place roles' neighbour rule bends (`CutsMeta.roles`:
 * "roles are never inferred from card text"): a commander's text is read
 * for a type WORD, by the owner's call of 2026-11-16, and for nothing else.
 */
import type { CutsMeta, DeckTheme, ThemesMeta } from "../types";

/** A type on this many of the list's cards is a theme by count alone. */
export const LIST_MIN = 10;
/** A type the commander names needs this many cards, unless the commander carries it. */
export const NAMED_MIN = 4;
/** The count at which a theme is at full strength. */
export const FULL_COUNT = 20;
/** A named theme's strength before the list has filled in around it. */
export const NAMED_FLOOR = 0.5;
/** A type with this share of its cards inside a bigger theme is that theme's shadow. */
export const CO_TYPE_SHARE = 0.7;

/**
 * Everyday words: a theme by count only from this share of the list's
 * nonland cards. Among the 2,000 most-played nonland cards 19.1 % are
 * artifacts, 14.8 % enchantments and 8.4 % Humans; on the precons the
 * lists built around them start at 31 artifacts, 23 enchantments and 27
 * Humans of about 62, and the rest stop at 22, 17 and 20.
 */
export const SHARE_FLOORS: Readonly<Record<string, number>> = {
  Artifact: 0.45,
  Enchantment: 0.33,
  Human: 0.35,
};

/**
 * What an everyday word says of a card that carries it (`DeckTheme
 * .selectivity`; every other word says 1), in both directions. Measured on
 * the 26 precons with an everyday-word theme, ten nonland cards held out of
 * each: at full weight all 25 suggestions carried the word and none of the
 * held-out cards outside the theme came back (4.9 % of them did before); at
 * 0.3 the held-out theme cards came back as often (13.8 % against 13.0 %)
 * and the others nearly as before (3.3 %). On the cut side, protecting
 * every enchantment of the enchantment precon in full made its
 * enchantresses, which are creatures, its fifth and sixth cheapest cuts.
 */
export const EVERYDAY_SELECTIVITY = 0.3;

/** The card types a list can be built around; a type line's other left-side words never are. */
export const THEME_CARD_TYPES: ReadonlySet<string> = new Set([
  "Artifact",
  "Enchantment",
  "Planeswalker",
]);

/** Subtypes printed as two words — one type, one theme. */
const TWO_WORD_TYPES: readonly string[] = ["Time Lord"];

const FACE_SEPARATOR = " // ";
const SUBTYPE_DASH = " — ";

function faceParts(face: string): { types: string[]; subtypes: string[] } {
  const [left = "", right = ""] = face.split(SUBTYPE_DASH);
  const words = right.split(" ").filter(Boolean);
  const subtypes: string[] = [];
  for (let i = 0; i < words.length; i++) {
    const pair = i + 1 < words.length ? words[i] + " " + words[i + 1] : null;
    if (pair !== null && TWO_WORD_TYPES.includes(pair)) {
      subtypes.push(pair);
      i += 1;
    } else {
      subtypes.push(words[i]);
    }
  }
  return { types: left.split(" ").filter(Boolean), subtypes };
}

/** Whether a card is a land where it counts: its front face. */
function isLand(typeLine: string): boolean {
  return faceParts(typeLine.split(FACE_SEPARATOR)[0]).types.includes("Land");
}

/** A type line's words that could be a theme: every nonland face's subtypes and theme card types. */
export function mtgThemeWords(typeLine: string): string[] {
  const words = new Set<string>();
  for (const face of typeLine.split(FACE_SEPARATOR)) {
    const { types, subtypes } = faceParts(face);
    if (types.includes("Land")) continue;
    for (const t of types) if (THEME_CARD_TYPES.has(t)) words.add(t);
    for (const s of subtypes) words.add(s);
  }
  return [...words];
}

const IRREGULAR_PLURALS: Readonly<Record<string, string>> = {
  Cyclops: "Cyclopes",
  Mouse: "Mice",
  Ox: "Oxen",
};

/** The forms rules text prints a type in: itself and its plurals. */
function typeForms(word: string): string[] {
  const forms = [word, `${word}s`, `${word}es`];
  const irregular = IRREGULAR_PLURALS[word];
  if (irregular) forms.push(irregular);
  if (/[^aeiou]y$/.test(word)) forms.push(`${word.slice(0, -1)}ies`); // Ally, Harpy
  if (/f$/.test(word)) forms.push(`${word.slice(0, -1)}ves`); // Elf, Dwarf, Wolf
  if (/us$/.test(word)) forms.push(`${word.slice(0, -2)}i`); // Fungus, Pegasus
  return forms;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether cleaned rules text names a type: the word or a plural, standing
 * alone and capitalized as rules text prints types. A letter or a hyphen
 * before it is no mention ("non-Human", "Ur-Dragon"); a letter after it is
 * another word ("Wizardcycling", "Heroic").
 */
function names(text: string, word: string): boolean {
  const forms = typeForms(word).map(escapeRegExp).join("|");
  return new RegExp(`(?:^|[^A-Za-z-])(?:${forms})(?![A-Za-z])`).test(text);
}

/** A card's names as its own text may print them: each face's full name and its part before the comma. */
function ownNames(name: string): string[] {
  const out = new Set<string>();
  for (const face of name.split(FACE_SEPARATOR)) {
    const full = face.trim();
    const short = full.split(",")[0].trim();
    if (full) out.add(full);
    if (short) out.add(short);
  }
  // Longest first, so a full name goes before the short name inside it.
  return [...out].sort((a, b) => b.length - a.length);
}

/**
 * A commander's rules text with what never names a theme taken out:
 * reminder text; the card's own name ("Squee, Goblin Nabob"); the types a
 * token is made with ("create a 1/1 green Elf Warrior creature token"); and
 * the types an effect turns something into, to the end of its clause
 * ("it's a 3/3 black Zombie creature", "becomes an X/X Elemental creature",
 * "he's a legendary Human Mercenary Villain creature").
 */
export function namingText(name: string, rules: string): string {
  let text = rules.replace(/\([^)]*\)/g, " ");
  for (const own of ownNames(name)) text = text.split(own).join(" ");
  return text
    .replace(/\b[Cc]reates?\b[^.]*?\btokens?\b/g, " ")
    .replace(/\b(?:is|are|it's|he's|she's|they're|becomes?)\b[^.,;:]*?\bcreatures?\b/g, " ")
    .replace(/\bbecomes?\b[^.,;:]*?\bin addition to (?:its|their) other types\b/g, " ");
}

function strengthOf(count: number, named: boolean): number {
  return Math.min(1, Math.max(named ? NAMED_FLOOR : 0, count / FULL_COUNT));
}

/** Strongest first; a named theme before an equal counted one; then the bigger count, then the word. */
function byStrength(a: DeckTheme, b: DeckTheme): number {
  if (a.strength !== b.strength) return b.strength - a.strength;
  if ((a.namedBy === null) !== (b.namedBy === null)) return a.namedBy === null ? 1 : -1;
  if (a.count !== b.count) return b.count - a.count;
  return a.word < b.word ? -1 : a.word > b.word ? 1 : 0;
}

export const mtgThemes: ThemesMeta = {
  source: "deck-types",
  path: "type_line",
  leaderPath: "oracle_text",
  wordsOf: mtgThemeWords,

  read({ leaders, cards }) {
    // Every nonland card's words once, with its copies.
    const held: { words: string[]; qty: number }[] = [];
    let nonland = 0;
    for (const card of cards) {
      if (!card.text || isLand(card.text)) continue;
      nonland += card.qty;
      held.push({ words: mtgThemeWords(card.text), qty: card.qty });
    }
    const count = new Map<string, number>();
    for (const { words, qty } of held) {
      for (const w of words) count.set(w, (count.get(w) ?? 0) + qty);
    }

    const leaderWords = leaders.map((l) => new Set(mtgThemeWords(l.text)));
    const leaderTexts = leaders.map((l) => namingText(l.name, l.rules));
    const words = new Set([...count.keys(), ...leaderWords.flatMap((s) => [...s])]);

    const themes: DeckTheme[] = [];
    for (const word of words) {
      const n = count.get(word) ?? 0;
      let namedBy: string | null = null;
      if (!THEME_CARD_TYPES.has(word)) {
        const i = leaderTexts.findIndex((text) => names(text, word));
        // An everyday word the commander carries proves nothing ("Human
        // Werewolves you control" on a Human Werewolf): it needs the cards.
        const carried = SHARE_FLOORS[word] === undefined && leaderWords.some((s) => s.has(word));
        // The sentence names the commander by its front face: a two-faced
        // card's whole name is two names.
        if (i >= 0 && (carried || n >= NAMED_MIN)) {
          namedBy = leaders[i].name.split(FACE_SEPARATOR)[0].trim();
        }
      }
      if (namedBy === null) {
        if (n < LIST_MIN) continue;
        const floor = SHARE_FLOORS[word];
        if (floor !== undefined && n < floor * nonland) continue;
      }
      themes.push({
        word,
        count: n,
        namedBy,
        strength: strengthOf(n, namedBy !== null),
        selectivity: SHARE_FLOORS[word] === undefined ? 1 : EVERYDAY_SELECTIVITY,
      });
    }

    // A subtype most of whose cards carry another subtype theme is that
    // theme's shadow. A counted one shadows under a bigger theme, or an
    // equal one the commander names (the Druids of an Elf list). A named
    // one never does — what the commander names outranks a count — except
    // an everyday word under another named type: the Human of "Human
    // Werewolves you control" is the Werewolves'.
    const subtypeThemes = themes.filter((t) => !THEME_CARD_TYPES.has(t.word));
    const shadows = new Set<string>();
    for (const t of subtypeThemes) {
      const everyday = SHARE_FLOORS[t.word] !== undefined;
      if (t.namedBy !== null && !everyday) continue;
      for (const other of subtypeThemes) {
        if (other === t) continue;
        const outranks =
          t.namedBy !== null
            ? other.namedBy !== null
            : other.count > t.count || (other.count === t.count && other.namedBy !== null);
        if (!outranks) continue;
        let both = 0;
        for (const { words: w, qty } of held) {
          if (w.includes(t.word) && w.includes(other.word)) both += qty;
        }
        if (both >= CO_TYPE_SHARE * t.count) {
          shadows.add(t.word);
          break;
        }
      }
    }

    return themes.filter((t) => !shadows.has(t.word)).sort(byStrength);
  },

  evidence(theme) {
    if (theme.namedBy !== null) {
      return {
        why: `Has the ${theme.word} type, which ${theme.namedBy}'s rules text names`,
        howOften: theme.count > 0 ? `${theme.count} of your cards share it` : null,
      };
    }
    return {
      why: `Shares the ${theme.word} type with ${theme.count} of your cards`,
      howOften: null,
    };
  },
};

/** The cut side of the same reading: what cutting a card takes from a theme. */
export const mtgCutThemes: NonNullable<CutsMeta["themes"]> = {
  evidence({ theme, others }) {
    if (theme.namedBy !== null) {
      const left = others === 0 ? "none" : String(others);
      return {
        why: `Has the ${theme.word} type, which ${theme.namedBy}'s rules text names. Cutting it leaves ${left} in your list`,
      };
    }
    return {
      why: `Shares the ${theme.word} type with ${others} of your other cards. Cutting it thins that type in your list`,
    };
  },
};
