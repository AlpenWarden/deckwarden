/**
 * Commander deck analytics — declarative blocks (histogram/breakdown/stat),
 * never components (build plan §3). Pure, qty-weighted, lands excluded from
 * curve math. colorVar names are CSS custom properties the core's theme defines.
 *
 * DECK-FACTS (2026-11-26, the owner's idea 2 of 2026-11-24, "a metric of how
 * fun the deck is", and their answer that day: facts about the list, never a
 * score): two counted facts close the stat row, each with its denominator and
 * its source and no word that judges (`DECK_FACTS_WORDS`; "never one
 * authoritative number", types.ts). Both count the nonland cards the curve
 * and "Avg. mana value" count, so "Lands" and "of N" add up to the deck. The
 * type tile is the theme reader's first type with the count a Suggestions row
 * prints (the reader's input built as the server's `snapshotThemes` builds
 * it); the staples tile is the cards at `STAPLE_RANK` or better, the cut-off
 * the site already calls a staple (measured to spread the 174 precon lists
 * apart: 24 to 53 % between the 10th and 90th percentile). Nothing new is
 * read from card text. The snapshot is the playable list (`toDeckSnapshot`),
 * so a token or a Maybe card is in neither.
 */
import { COLOR_BIT } from "../colors";
import { typeGroupRank } from "../type-order";
import type { AnalyticsBlock, CardData, DeckSnapshot } from "../types";
import type { MtgAttrs } from "./attrs";
import { MTG_CURVE_TEMPLATE, STAPLE_RANK } from "./recommend";
import { mtgThemes } from "./themes";
import { MTG_TYPE_ORDER } from "./type-order";

type MtgCard = CardData<MtgAttrs>;

/**
 * DECK-FACTS' words, in one place: a count and what it is out of, a title
 * naming what is counted, and a quiet line naming where the count comes from.
 * A test bans "fun", "boring", "generic" and "score" in them.
 */
export const DECK_FACTS_WORDS = {
  typeTitle: (word: string) => `${word} cards`,
  typeHint: "Nonland cards, by type line",
  staplesTitle: "Commander staples",
  staplesHint: `Nonland cards in EDHREC's top ${STAPLE_RANK.toLocaleString("en-US")}`,
  count: (n: number, of: number) => `${n} of ${of}`,
} as const;

/** A card's text at an attrs key the reader takes, "" when it holds none (core's `attrText`). */
function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const COLOR_SLICES = [
  { bit: 1, label: "White", colorVar: "--mana-w" },
  { bit: 2, label: "Blue", colorVar: "--mana-u" },
  { bit: 4, label: "Black", colorVar: "--mana-b" },
  { bit: 8, label: "Red", colorVar: "--mana-r" },
  { bit: 16, label: "Green", colorVar: "--mana-g" },
  { bit: 32, label: "Colorless", colorVar: "--mana-c" },
] as const;

function isLand(card: MtgCard): boolean {
  return card.primaryType === "Land";
}

/**
 * Bitmask of colors this card's rules text can produce, from "Add …" clauses
 * (WUBRGC; "any color"/"any combination" counts as all five). Heuristic v1:
 * conditional producers (Command Tower's "…in your commander's color identity")
 * and Treasure makers (through their reminder text) count for every color here;
 * `analyzeMtg` clamps the mask to the commander's identity (Y1, LATER row 31).
 */
export function producedMask(card: MtgCard): number {
  let mask = 0;
  for (const clause of card.attrs.oracle_text.matchAll(/\bAdd\b([^.\n]*)/g)) {
    if (/any (?:one )?color|any combination/i.test(clause[1])) mask |= 31;
    for (const sym of clause[1].matchAll(/\{([WUBRGC])\}/g)) mask |= COLOR_BIT[sym[1]];
  }
  return mask;
}

export function analyzeMtg(
  deck: DeckSnapshot,
  cards: ReadonlyMap<string, MtgCard>,
): AnalyticsBlock[] {
  // Commander analytics cover the whole 100 (command zone included).
  const entries = Object.values(deck.zones)
    .flat()
    .map((e) => ({ qty: e.qty, card: cards.get(e.cardId) }))
    .filter((e): e is { qty: number; card: MtgCard } => e.card != null);

  // Mana curve: 0..6 and 7+, nonland only.
  const curve = new Array<number>(8).fill(0);
  let nonlandQty = 0;
  let mvSum = 0;
  let landQty = 0;
  let priceSum = 0;
  let pricedQty = 0;
  let stapleQty = 0;
  const typeQty = new Map<string, number>();
  const colorQty = new Map<string, number>();
  // label → [land qty, other qty] of cards producing that color.
  const sourceQty = new Map<string, [number, number]>();
  // Y1: with a commander, a source counts only for the colors the commander
  // allows (plus colorless) — validate.ts's commanderCi. With none, every
  // produced color counts, as before.
  const commanders = (deck.zones["commander"] ?? [])
    .map((e) => cards.get(e.cardId))
    .filter((c): c is MtgCard => c != null);
  const sourceClamp = commanders.length
    ? commanders.reduce((mask, c) => mask | c.ciMask, 0) | 32
    : 63;

  for (const { qty, card } of entries) {
    typeQty.set(card.primaryType ?? "Other", (typeQty.get(card.primaryType ?? "Other") ?? 0) + qty);
    if (card.cheapestUsd != null) {
      priceSum += card.cheapestUsd * qty;
      pricedQty += qty;
    }
    const produced = producedMask(card) & sourceClamp;
    for (const { bit, label } of COLOR_SLICES) {
      if (!(produced & bit)) continue;
      const row = sourceQty.get(label) ?? [0, 0];
      row[isLand(card) ? 0 : 1] += qty;
      sourceQty.set(label, row);
    }
    if (isLand(card)) {
      landQty += qty;
      continue;
    }
    nonlandQty += qty;
    // DECK-FACTS: a card with no rank is in no top 2,000.
    if (typeof card.popularity === "number" && card.popularity <= STAPLE_RANK) stapleQty += qty;
    const mv = card.costValue ?? 0;
    mvSum += mv * qty;
    curve[Math.min(mv, 7)] += qty;
    const mask = card.colorsMask === 0 ? 32 : card.colorsMask; // colorless spells → C slice
    for (const { bit, label } of COLOR_SLICES) {
      if (mask & bit) colorQty.set(label, (colorQty.get(label) ?? 0) + qty);
    }
  }

  const blocks: AnalyticsBlock[] = [
    {
      kind: "histogram",
      id: "mana-curve",
      title: "Mana curve",
      buckets: curve.map((value, mv) => ({ label: mv === 7 ? "7+" : String(mv), value })),
      // G9 (R6): the editorial target curve as a ghost outline behind the
      // bars — the same template the Cut Coach reads (recommend.ts), one
      // import between two pure adapter modules; labeled as a template, never
      // as community data (cold-start rule).
      target: { label: "Curve template", values: MTG_CURVE_TEMPLATE },
    },
    {
      kind: "breakdown",
      id: "types",
      title: "Card types",
      // DECK-TOKENS: the deck list's type order (one constant), not biggest-first.
      slices: [...typeQty.entries()]
        .sort(
          ([a], [b]) =>
            typeGroupRank(MTG_TYPE_ORDER, a) - typeGroupRank(MTG_TYPE_ORDER, b) ||
            a.localeCompare(b),
        )
        .map(([label, value]) => ({ label, value })),
    },
    {
      kind: "breakdown",
      id: "colors",
      title: "Colors",
      slices: COLOR_SLICES.filter((c) => colorQty.has(c.label)).map((c) => ({
        label: c.label,
        value: colorQty.get(c.label)!,
        colorVar: c.colorVar,
      })),
    },
    {
      kind: "table",
      id: "mana-sources",
      title: "Mana sources",
      columns: ["Color", "Lands", "Other"],
      hint: "Cards that make \u201cany color\u201d count once for each color your commander allows; Treasure makers count through their reminder text.",
      rows: COLOR_SLICES.filter((c) => sourceQty.has(c.label)).map((c) => {
        const [lands, other] = sourceQty.get(c.label)!;
        return [c.label, lands, other];
      }),
    },
    {
      kind: "stat",
      id: "avg-mv",
      title: "Avg. mana value",
      value: nonlandQty ? (mvSum / nonlandQty).toFixed(2) : "—",
      hint: "Nonland cards",
    },
    { kind: "stat", id: "lands", title: "Lands", value: String(landQty) },
    {
      kind: "stat",
      id: "price",
      title: "Est. price",
      value: `$${priceSum.toFixed(2)}`,
      hint:
        pricedQty < entries.reduce((n, e) => n + e.qty, 0)
          ? "Some cards unpriced"
          : "Cheapest printings",
    },
  ];

  // DECK-FACTS, the type tile: the list as the server's `snapshotThemes`
  // hands it to the reader (copies summed per card; each commander once more
  // as a leader, with its rules text), so its count is a Suggestions row's.
  const held = new Map<string, { card: MtgCard; qty: number }>();
  for (const { qty, card } of entries) {
    const row = held.get(card.id);
    if (row) row.qty += qty;
    else held.set(card.id, { card, qty });
  }
  const leaderIds = new Set(commanders.map((c) => c.id));
  const theme = mtgThemes.read({
    leaders: [...held.values()]
      .filter(({ card }) => leaderIds.has(card.id))
      .map(({ card }) => ({
        name: card.name,
        text: textOf(card.attrs.type_line),
        rules: textOf(card.attrs.oracle_text),
      })),
    cards: [...held.values()].map(({ card, qty }) => ({ text: textOf(card.attrs.type_line), qty })),
  })[0];
  if (theme && theme.count > 0) {
    blocks.push({
      kind: "stat",
      id: "deck-type",
      title: DECK_FACTS_WORDS.typeTitle(theme.word),
      value: DECK_FACTS_WORDS.count(theme.count, nonlandQty),
      hint: DECK_FACTS_WORDS.typeHint,
    });
  }
  // DECK-FACTS, the staples tile: nothing to count without a nonland card.
  if (nonlandQty > 0) {
    blocks.push({
      kind: "stat",
      id: "staples",
      title: DECK_FACTS_WORDS.staplesTitle,
      value: DECK_FACTS_WORDS.count(stapleQty, nonlandQty),
      hint: DECK_FACTS_WORDS.staplesHint,
    });
  }
  return blocks;
}
