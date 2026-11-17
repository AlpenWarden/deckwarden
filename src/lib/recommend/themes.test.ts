/**
 * COMMANDER-FIT — the shared plumbing between an adapter's themes and the
 * two rankers. A synthetic declaration, deliberately not Magic's: the core
 * names no word and no game, so a theme here is a "clan" printed on a
 * card's `clan` text. Magic's reading is pinned in games/mtg/themes.test.ts.
 */
import { describe, expect, it } from "vitest";

import type { DeckTheme, ThemesMeta } from "@/lib/games/types";
import {
  attrText,
  readThemes,
  themeByCard,
  themeConfidence,
  themeOf,
  themePull,
  themesOfList,
  type ThemeListEntry,
} from "./themes";

const META: ThemesMeta = {
  source: "test-themes",
  path: "clan",
  leaderPath: "rules",
  wordsOf: (text) => text.split("/"),
  // Every clan on three or more cards, and whatever a leader's rules spell out.
  read({ leaders, cards }) {
    const count = new Map<string, number>();
    for (const c of cards) {
      for (const w of c.text ? c.text.split("/") : []) count.set(w, (count.get(w) ?? 0) + c.qty);
    }
    const themes: DeckTheme[] = [];
    for (const [word, n] of count) {
      const namedBy = leaders.find((l) => l.rules.includes(word))?.name ?? null;
      if (n >= 3 || namedBy) {
        themes.push({ word, count: n, namedBy, strength: Math.min(1, n / 4), selectivity: 1 });
      }
    }
    return themes.sort((a, b) => b.strength - a.strength || (a.word < b.word ? -1 : 1));
  },
  evidence: (theme) => ({ why: `clan ${theme.word}`, howOften: `${theme.count} cards` }),
};

const theme = (word: string, strength: number, selectivity = 1): DeckTheme => ({
  word,
  count: 4,
  namedBy: null,
  strength,
  selectivity,
});

describe("readThemes", () => {
  it("hands the adapter the whole list and its leaders, and takes its themes back", () => {
    const themes = readThemes(META, [
      { text: "Crane", qty: 1, leader: { name: "Boss", rules: "Crane cards cost less." } },
      { text: "Crane", qty: 1 },
      { text: "Lion", qty: 3 },
      { text: null, qty: 2 },
    ]);
    expect(themes).toEqual([
      { word: "Lion", count: 3, namedBy: null, strength: 0.75, selectivity: 1 },
      { word: "Crane", count: 2, namedBy: "Boss", strength: 0.5, selectivity: 1 },
    ]);
  });

  it("answers none for a game that declares no themes", () => {
    expect(readThemes(undefined, [{ text: "Crane", qty: 9 }])).toEqual([]);
  });
});

describe("themeOf", () => {
  const themes = [theme("Lion", 1), theme("Crane", 0.5)];

  it("names one theme for a card on two, the one that pulls hardest", () => {
    expect(themeOf(META, themes, "Crane/Lion")?.word).toBe("Lion");
    expect(themeOf(META, themes, "Crane")?.word).toBe("Crane");
  });

  it("picks by pull: an everyday theme at full strength loses to a smaller one that says more", () => {
    // Everyone 1.0 × 0.3 = 0.3 of pull; Scorpion 0.6 × 1 = 0.6.
    const mixed = [theme("Everyone", 1, 0.3), theme("Scorpion", 0.6)];
    expect(themeOf(META, mixed, "Everyone/Scorpion")?.word).toBe("Scorpion");
    expect(themeOf(META, mixed, "Everyone")?.word).toBe("Everyone");
    expect(themePull(mixed[0])).toBeCloseTo(0.3, 10);
    expect(themePull(mixed[1])).toBeCloseTo(0.6, 10);
    // A tie keeps the adapter's order.
    expect(themeOf(META, [theme("A", 0.5), theme("B", 0.5)], "B/A")?.word).toBe("A");
  });

  it("names none for a card outside every theme, without the text, or with no themes read", () => {
    expect(themeOf(META, themes, "Scorpion")).toBeNull();
    expect(themeOf(META, themes, null)).toBeNull();
    expect(themeOf(META, themes, undefined)).toBeNull();
    expect(themeOf(META, [], "Lion")).toBeNull();
  });
});

describe("themeConfidence", () => {
  it("is high at full strength and medium below — a count from the player's own list is never low", () => {
    expect(themeConfidence(theme("Lion", 1))).toBe("high");
    expect(themeConfidence(theme("Lion", 0.95))).toBe("medium");
    expect(themeConfidence(theme("Lion", 0.5))).toBe("medium");
  });
});

describe("the editor's door", () => {
  const card = (id: string, clan: string | undefined, rules?: string) => ({
    id,
    name: `Card ${id}`,
    attrs: { ...(clan !== undefined ? { clan } : {}), ...(rules !== undefined ? { rules } : {}) },
  });
  const entries: ThemeListEntry[] = [
    { card: card("boss", "Crane", "Crane cards cost less."), qty: 1, isLeader: true },
    { card: card("a", "Crane"), qty: 1, isLeader: false },
    { card: card("b", "Lion"), qty: 3, isLeader: false },
    { card: card("c", undefined), qty: 1, isLeader: false },
  ];

  it("reads the list the way the server does: the same rows, the leader's rules beside its text", () => {
    expect(themesOfList(META, entries)).toEqual([
      { word: "Lion", count: 3, namedBy: null, strength: 0.75, selectivity: 1 },
      { word: "Crane", count: 2, namedBy: "Card boss", strength: 0.5, selectivity: 1 },
    ]);
    expect(themesOfList(undefined, entries)).toEqual([]);
  });

  it("maps each card that carries a theme to the strongest one, and leaves the rest out", () => {
    const themes = themesOfList(META, entries);
    const byCard = themeByCard(META, themes, entries);
    expect([...byCard].map(([id, t]) => [id, t.word])).toEqual([
      ["boss", "Crane"],
      ["a", "Crane"],
      ["b", "Lion"],
    ]);
    expect(themeByCard(META, [], entries).size).toBe(0);
    expect(themeByCard(undefined, themes, entries).size).toBe(0);
  });

  it("takes only a string at the declared path for a card's text", () => {
    expect(attrText({ clan: "Crane" }, "clan")).toBe("Crane");
    expect(attrText({ clan: "" }, "clan")).toBeNull();
    expect(attrText({ clan: 7 }, "clan")).toBeNull();
    expect(attrText({}, "clan")).toBeNull();
    expect(attrText(undefined, "clan")).toBeNull();
  });
});
