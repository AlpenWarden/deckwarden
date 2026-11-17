/**
 * A list's themes for the rankers (COMMANDER-FIT) — pure, game-ignorant,
 * client-safe. What a theme IS belongs to the adapter (`RecommendMeta
 * .themes`: Magic reads type lines and the commander's rules text,
 * src/lib/games/mtg/themes.ts); this module is the shared plumbing both
 * directions use, so Suggestions (the server, rank.ts) and the Cut Coach
 * (the browser, cuts.ts) read the same list the same way:
 *
 * - `readThemes` hands the adapter the list's texts and takes its themes
 *   back, strongest first;
 * - `themeOf` says which of them a card carries — one, so a card on two
 *   themes isn't counted twice: the one with the most pull (strength ×
 *   selectivity), which is what both rankers score;
 * - `themesOfList` and `themeByCard` are the editor's door: its entries and
 *   client-held cards in, the Cut Coach's per-card signal out.
 *
 * Honest absence, like every signal here: a game that declares no themes, a
 * list its adapter reads none from, a card without the text — each one
 * contributes nothing, in either direction.
 */
import type { DeckTheme, ThemesMeta } from "@/lib/games/types";
import type { Confidence } from "./types";

/** Theme-sourced candidates per theme (the engine's source D), the most played first. */
export const THEME_POOL_LIMIT = 60;
/** How many of a list's themes get a candidate pool of their own — the strongest. */
export const THEME_POOL_THEMES = 3;

/** One card of a list as the themes read takes it; a leader carries its name and rules text. */
export interface ThemeRow {
  /** The card's text at the adapter's `themes.path`; null = it holds none. */
  text: string | null;
  qty: number;
  leader?: { name: string; rules: string | null };
}

/** The list's themes, strongest first; [] without a declaration or without one found. */
export function readThemes(meta: ThemesMeta | undefined, rows: readonly ThemeRow[]): DeckTheme[] {
  if (!meta) return [];
  return meta.read({
    leaders: rows.flatMap((r) =>
      r.leader ? [{ name: r.leader.name, text: r.text ?? "", rules: r.leader.rules ?? "" }] : [],
    ),
    cards: rows.map((r) => ({ text: r.text ?? "", qty: r.qty })),
  });
}

/**
 * What a theme is worth to a card that carries its word, in either
 * direction: its strength, scaled by how much the word says.
 */
export function themePull(theme: DeckTheme): number {
  return theme.strength * theme.selectivity;
}

/**
 * The one of the list's themes a card's text carries that counts: the one
 * that pulls hardest — a Human Soldier in a list of Humans and Soldiers is
 * there for the Soldiers. null = none. Ties keep the adapter's order
 * (strongest first).
 */
export function themeOf(
  meta: ThemesMeta,
  themes: readonly DeckTheme[],
  text: string | null | undefined,
): DeckTheme | null {
  if (!text || themes.length === 0) return null;
  const words = new Set(meta.wordsOf(text));
  let best: DeckTheme | null = null;
  for (const theme of themes) {
    if (words.has(theme.word) && (best === null || themePull(theme) > themePull(best))) {
      best = theme;
    }
  }
  return best;
}

/**
 * How far a theme line can be trusted: the count is the list's own, so it
 * is never low — "high" once the theme is at full strength, "medium" while
 * it is a named type the list has not filled in around, or a smaller count.
 */
export function themeConfidence(theme: DeckTheme): Confidence {
  return theme.strength >= 1 ? "high" : "medium";
}

/** A card's text at a declared single-segment attrs path; null when it holds none. */
export function attrText(attrs: Record<string, unknown> | undefined, path: string): string | null {
  const value = attrs?.[path];
  return typeof value === "string" && value !== "" ? value : null;
}

/** One entry of the editor's list with its client-held card. */
export interface ThemeListEntry {
  card: { id: string; name: string; attrs: Record<string, unknown> };
  qty: number;
  /** In a leader zone. */
  isLeader: boolean;
}

/** The editor's list read for themes — the same read the server makes from its rows. */
export function themesOfList(
  meta: ThemesMeta | undefined,
  entries: readonly ThemeListEntry[],
): DeckTheme[] {
  if (!meta) return [];
  return readThemes(
    meta,
    entries.map((e) => ({
      text: attrText(e.card.attrs, meta.path),
      qty: e.qty,
      ...(e.isLeader
        ? { leader: { name: e.card.name, rules: attrText(e.card.attrs, meta.leaderPath) } }
        : {}),
    })),
  );
}

/** The Cut Coach's signal: each of the list's cards that carries a theme, with the one that counts. */
export function themeByCard(
  meta: ThemesMeta | undefined,
  themes: readonly DeckTheme[],
  entries: readonly ThemeListEntry[],
): Map<string, DeckTheme> {
  const byCard = new Map<string, DeckTheme>();
  if (!meta || themes.length === 0) return byCard;
  for (const e of entries) {
    const theme = themeOf(meta, themes, attrText(e.card.attrs, meta.path));
    if (theme) byCard.set(e.card.id, theme);
  }
  return byCard;
}
