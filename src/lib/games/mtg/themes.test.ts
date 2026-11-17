/**
 * COMMANDER-FIT — Magic's themes: a type the list's cards share, or one its
 * commander's rules text names. Pinned here: which words a type line gives,
 * when a count is a theme (and when an everyday word isn't), how narrowly a
 * commander's text is read, which type is another's shadow, and that the
 * sentences say what was counted or read and nothing about what a card does.
 */
import { describe, expect, it } from "vitest";

import {
  CO_TYPE_SHARE,
  EVERYDAY_SELECTIVITY,
  FULL_COUNT,
  LIST_MIN,
  mtgCutThemes,
  mtgThemes,
  mtgThemeWords,
  NAMED_FLOOR,
  NAMED_MIN,
  namingText,
  SHARE_FLOORS,
} from "./themes";

/** `n` single copies of one type line. */
const of = (n: number, text: string) => Array.from({ length: n }, () => ({ text, qty: 1 }));

/** A commander and the list around it, the commander's own card included. */
function read(
  leader: { name: string; text: string; rules: string } | null,
  cards: { text: string; qty: number }[],
) {
  return mtgThemes.read({
    leaders: leader ? [leader] : [],
    cards: leader ? [{ text: leader.text, qty: 1 }, ...cards] : cards,
  });
}

const EDGAR = {
  name: "Edgar Markov",
  text: "Legendary Creature — Vampire Knight",
  rules:
    "Eminence — Whenever you cast another Vampire spell, if Edgar is in the command zone or on the battlefield, create a 1/1 black Vampire creature token.\nFirst strike, haste\nWhenever Edgar attacks, put a +1/+1 counter on each Vampire you control.",
};
const KAALIA = {
  name: "Kaalia of the Vast",
  text: "Legendary Creature — Human Cleric",
  rules:
    "Flying\nWhenever Kaalia attacks an opponent, you may put an Angel, Demon, or Dragon creature card from your hand onto the battlefield tapped and attacking that opponent.",
};
const ATRAXA = {
  name: "Atraxa, Praetors' Voice",
  text: "Legendary Creature — Phyrexian Angel Horror",
  rules:
    "Flying, vigilance, deathtouch, lifelink\nAt the beginning of your end step, proliferate. (Choose any number of permanents and/or players, then give each another counter of each kind already there.)",
};

describe("mtgThemeWords", () => {
  it("gives a type line's subtypes and the three card types a list is built around", () => {
    expect(mtgThemeWords("Legendary Creature — Vampire Knight")).toEqual(["Vampire", "Knight"]);
    expect(mtgThemeWords("Artifact Creature — Sliver Construct")).toEqual([
      "Artifact",
      "Sliver",
      "Construct",
    ]);
    expect(mtgThemeWords("Enchantment — Aura")).toEqual(["Enchantment", "Aura"]);
    expect(mtgThemeWords("Legendary Planeswalker — Jace")).toEqual(["Planeswalker", "Jace"]);
  });

  it("gives nothing for the types every list holds", () => {
    expect(mtgThemeWords("Instant")).toEqual([]);
    expect(mtgThemeWords("Sorcery")).toEqual([]);
    expect(mtgThemeWords("Legendary Creature")).toEqual([]);
    expect(mtgThemeWords("")).toEqual([]);
  });

  it("gives nothing for a land face: its types are colors, and lands are every list's base", () => {
    expect(mtgThemeWords("Basic Land — Forest")).toEqual([]);
    expect(mtgThemeWords("Artifact Land")).toEqual([]);
    expect(mtgThemeWords("Enchantment Land — Urza's Saga")).toEqual([]);
    expect(mtgThemeWords("Land Creature — Forest Dryad")).toEqual([]);
    // The spell face of a modal double-faced card still counts.
    expect(mtgThemeWords("Creature — Elf Druid // Land")).toEqual(["Elf", "Druid"]);
  });

  it("reads every face once", () => {
    expect(mtgThemeWords("Creature — Human Werewolf // Creature — Werewolf")).toEqual([
      "Human",
      "Werewolf",
    ]);
    expect(mtgThemeWords("Legendary Creature — God // Legendary Artifact — Equipment")).toEqual([
      "God",
      "Artifact",
      "Equipment",
    ]);
  });

  it("keeps a two-word type whole", () => {
    expect(mtgThemeWords("Legendary Creature — Time Lord Doctor")).toEqual(["Time Lord", "Doctor"]);
  });
});

describe("mtgThemes.read — the list's count", () => {
  it(`makes a type on ${LIST_MIN} cards a theme, and no fewer`, () => {
    expect(read(null, of(LIST_MIN - 1, "Creature — Sliver"))).toEqual([]);
    expect(read(null, of(LIST_MIN, "Creature — Sliver"))).toEqual([
      {
        word: "Sliver",
        count: LIST_MIN,
        namedBy: null,
        strength: LIST_MIN / FULL_COUNT,
        selectivity: 1,
      },
    ]);
  });

  it(`is at full strength from ${FULL_COUNT} cards and never past it`, () => {
    expect(read(null, of(15, "Creature — Sliver"))[0].strength).toBe(0.75);
    expect(read(null, of(FULL_COUNT, "Creature — Sliver"))[0].strength).toBe(1);
    expect(read(null, of(41, "Creature — Sliver"))[0].strength).toBe(1);
  });

  it("counts copies, not entries", () => {
    expect(read(null, [{ text: "Creature — Rat", qty: 12 }])[0]).toMatchObject({
      word: "Rat",
      count: 12,
    });
  });

  it("asks more than a count of the three everyday words: a share of the nonland cards", () => {
    const rest = (n: number) => of(n, "Sorcery");
    // 60 nonland cards each time; the lands beside them change nothing.
    const lands = of(37, "Basic Land — Forest");
    const humans = (n: number) =>
      read(null, [...of(n, "Creature — Human"), ...rest(60 - n), ...lands]);
    expect(humans(20)).toEqual([]);
    expect(humans(21).map((t) => t.word)).toEqual(["Human"]);
    const artifacts = (n: number) => read(null, [...of(n, "Artifact"), ...rest(60 - n), ...lands]);
    expect(artifacts(26)).toEqual([]);
    expect(artifacts(27).map((t) => t.word)).toEqual(["Artifact"]);
    const enchantments = (n: number) =>
      read(null, [...of(n, "Enchantment"), ...rest(60 - n), ...lands]);
    expect(enchantments(19)).toEqual([]);
    expect(enchantments(20).map((t) => t.word)).toEqual(["Enchantment"]);
    expect(Object.keys(SHARE_FLOORS).sort()).toEqual(["Artifact", "Enchantment", "Human"]);
  });

  it("marks the same three words as saying less of a card outside the list, and no other", () => {
    const list = [
      ...of(30, "Artifact — Equipment"),
      ...of(22, "Creature — Human Soldier"),
      ...of(8, "Sorcery"),
    ];
    expect(Object.fromEntries(read(null, list).map((t) => [t.word, t.selectivity]))).toEqual({
      Artifact: EVERYDAY_SELECTIVITY,
      Equipment: 1,
      Human: EVERYDAY_SELECTIVITY,
      Soldier: 1,
    });
    expect(EVERYDAY_SELECTIVITY).toBeGreaterThan(0);
    expect(EVERYDAY_SELECTIVITY).toBeLessThan(1);
  });

  it("reads no theme from a list built around nothing its type lines show", () => {
    const list = [
      ...of(9, "Creature — Human Wizard"),
      ...of(6, "Creature — Elf Druid"),
      ...of(9, "Artifact"),
      ...of(8, "Enchantment"),
      ...of(14, "Instant"),
      ...of(13, "Sorcery"),
      ...of(37, "Basic Land — Island"),
    ];
    expect(read(ATRAXA, list)).toEqual([]);
  });
});

describe("mtgThemes.read — what the commander's rules text names", () => {
  it("makes a named type the commander carries a theme from the first card", () => {
    expect(read(EDGAR, [])).toEqual([
      {
        word: "Vampire",
        count: 1,
        namedBy: "Edgar Markov",
        strength: NAMED_FLOOR,
        selectivity: 1,
      },
    ]);
  });

  it("never takes the commander's own type alone for a theme", () => {
    // Atraxa is a Phyrexian Angel Horror and names none of them.
    expect(read(ATRAXA, [])).toEqual([]);
    // Edgar is a Knight too, and names no Knights.
    expect(read(EDGAR, []).map((t) => t.word)).not.toContain("Knight");
  });

  it(`asks ${NAMED_MIN} cards of a named type the commander doesn't carry`, () => {
    expect(read(KAALIA, of(NAMED_MIN - 1, "Creature — Angel"))).toEqual([]);
    const themes = read(KAALIA, [
      ...of(NAMED_MIN, "Creature — Angel"),
      ...of(5, "Creature — Dragon"),
      ...of(2, "Creature — Demon"),
    ]);
    expect(themes).toEqual([
      {
        word: "Dragon",
        count: 5,
        namedBy: "Kaalia of the Vast",
        strength: NAMED_FLOOR,
        selectivity: 1,
      },
      {
        word: "Angel",
        count: 4,
        namedBy: "Kaalia of the Vast",
        strength: NAMED_FLOOR,
        selectivity: 1,
      },
    ]);
  });

  it("grows a named theme past its floor with the list", () => {
    expect(read(EDGAR, of(13, "Creature — Vampire"))[0]).toMatchObject({
      count: 14,
      strength: 0.7,
    });
    expect(read(EDGAR, of(26, "Creature — Vampire"))[0]).toMatchObject({ count: 27, strength: 1 });
  });

  it("reads plurals, regular and not", () => {
    const lathril = {
      name: "Lathril, Blade of the Elves",
      text: "Legendary Creature — Elf Noble",
      rules:
        "Menace\nWhenever Lathril deals combat damage to a player, create that many 1/1 green Elf Warrior creature tokens.\n{T}, Tap ten untapped Elves you control: Each opponent loses 10 life and you gain 10 life.",
    };
    expect(read(lathril, []).map((t) => t.word)).toEqual(["Elf"]);
    const gravemother = {
      name: "Sliver Gravemother",
      text: "Legendary Creature — Sliver",
      rules: `The "legend rule" doesn't apply to Slivers you control.`,
    };
    expect(read(gravemother, []).map((t) => t.word)).toEqual(["Sliver"]);
  });

  it("takes no theme from the types a token is made with", () => {
    const queen = {
      name: "Sliver Queen",
      text: "Legendary Creature — Sliver",
      rules: "{2}: Create a 1/1 colorless Sliver creature token.",
    };
    expect(read(queen, [])).toEqual([]);
    // The same sentence can still name the type outside the token.
    const krenko = {
      name: "Krenko, Mob Boss",
      text: "Legendary Creature — Goblin Warrior",
      rules:
        "{T}: Create X 1/1 red Goblin creature tokens, where X is the number of Goblins you control.",
    };
    expect(read(krenko, []).map((t) => t.word)).toEqual(["Goblin"]);
  });

  it("takes no theme from the types an effect turns something into", () => {
    const anikthea = {
      name: "Anikthea, Hand of Erebos",
      text: "Legendary Enchantment Creature — Demigod",
      rules:
        "Menace\nOther enchantment creatures you control have menace.\nWhenever Anikthea enters or attacks, exile up to one target non-Aura enchantment card from your graveyard. Create a token that's a copy of that card, except it's a 3/3 black Zombie creature in addition to its other types.",
    };
    expect(read(anikthea, of(6, "Creature — Zombie"))).toEqual([]);
    const taskmaster = {
      name: "Taskmaster, Mercenary Mimic",
      text: "Legendary Creature — Human Mercenary Villain",
      rules:
        "Photographic Reflexes — At the beginning of your first main phase, until your next turn, Taskmaster becomes a copy of up to one target creature on the battlefield or creature card in a graveyard, except his name is Taskmaster, Mercenary Mimic and he's a legendary Human Mercenary Villain creature.",
    };
    expect(read(taskmaster, [])).toEqual([]);
  });

  it("reads a type after non- as no mention, and one inside another word as another word", () => {
    const leader = (rules: string) => ({
      name: "Test, the Leader",
      text: "Legendary Creature — Human Wizard Hero",
      rules,
    });
    const humans = of(5, "Creature — Human Soldier");
    expect(read(leader("Non-Human creatures you control get +1/+1."), humans)).toEqual([]);
    expect(read(leader("Wizardcycling {2}"), [])).toEqual([]);
    expect(
      read(leader("Heroic — Whenever you cast a spell that targets Test, draw a card."), []),
    ).toEqual([]);
    expect(read(leader("Other Wizards you control have flying."), []).map((t) => t.word)).toEqual([
      "Wizard",
    ]);
  });

  it("ignores reminder text and the card's own name", () => {
    const squee = {
      name: "Squee, Goblin Nabob",
      text: "Legendary Creature — Goblin",
      rules:
        "At the beginning of your upkeep, you may return Squee, Goblin Nabob from your graveyard to your hand.",
    };
    expect(read(squee, [])).toEqual([]);
    // The reminder in brackets is gone before anything is read.
    expect(
      namingText(
        "Atraxa, Praetors' Voice",
        "Proliferate. (Choose any number of permanents and/or players.)",
      ).trim(),
    ).toBe("Proliferate.");
  });

  it("asks the cards of an everyday word even when the commander carries it", () => {
    const tovolar = {
      name: "Tovolar, Dire Overlord // Tovolar, the Midnight Scourge",
      text: "Legendary Creature — Human Werewolf // Legendary Creature — Werewolf",
      rules:
        "Whenever a Wolf or Werewolf you control deals combat damage to a player, draw a card.\nAt the beginning of your upkeep, if you control three or more Wolves and/or Werewolves, it becomes night. Then transform any number of Human Werewolves you control.\nDaybound",
    };
    expect(read(tovolar, []).map((t) => t.word)).toEqual(["Werewolf"]);
    // A two-faced commander is named by its front face, so the sentence stays one name long.
    expect(read(tovolar, [])[0].namedBy).toBe("Tovolar, Dire Overlord");
    // With the list around it, its Humans are the Werewolves': a shadow.
    const pack = [
      ...of(18, "Creature — Human Werewolf // Creature — Werewolf"),
      ...of(4, "Creature — Wolf"),
      ...of(3, "Creature — Human Shaman"),
    ];
    expect(read(tovolar, pack).map((t) => t.word)).toEqual(["Werewolf", "Wolf"]);
    // A commander that names Humans alone keeps them.
    const jirina = {
      name: "Jirina Kudro",
      text: "Legendary Creature — Human Soldier",
      rules: "Other Humans you control get +2/+0.",
    };
    expect(read(jirina, of(5, "Creature — Human Warrior")).map((t) => t.word)).toEqual(["Human"]);
  });
});

describe("mtgThemes.read — shadows and order", () => {
  it(`drops a counted type with ${CO_TYPE_SHARE * 100} % of its cards inside a bigger theme`, () => {
    const elves = [...of(30, "Creature — Elf Warrior"), ...of(12, "Creature — Elf Druid")];
    expect(read(null, elves).map((t) => t.word)).toEqual(["Elf"]);
    // Druids that are not Elves are a theme of their own.
    const apart = [
      ...of(22, "Creature — Elf"),
      ...of(12, "Creature — Druid"),
      ...of(30, "Sorcery"),
    ];
    expect(read(null, apart).map((t) => t.word)).toEqual(["Elf", "Druid"]);
  });

  it("never drops a type the commander names, or a card type for holding a subtype", () => {
    const party = {
      name: "Nalia de'Arnise",
      text: "Legendary Creature — Human Cleric",
      rules:
        "You may look at the top card of your library any time. You may cast Cleric, Rogue, Warrior, and Wizard spells from the top of your library.",
    };
    // The Dwarves are the Clerics and the Elves are the Wizards: the named types stay.
    const list = [
      ...of(13, "Creature — Dwarf Cleric"),
      ...of(11, "Creature — Elf Wizard"),
      ...of(30, "Sorcery"),
    ];
    expect(read(party, list).map((t) => t.word)).toEqual(["Cleric", "Wizard"]);
    const artifacts = [
      ...of(14, "Artifact — Equipment"),
      ...of(16, "Artifact"),
      ...of(30, "Sorcery"),
    ];
    expect(read(null, artifacts).map((t) => t.word)).toEqual(["Artifact", "Equipment"]);
  });

  it("orders by strength, a named theme before an equal counted one, then the count, then the word", () => {
    const themes = read(EDGAR, [
      ...of(9, "Creature — Vampire"), // 10 with Edgar: named, 0.5
      ...of(10, "Creature — Zombie"), // counted, 0.5
      ...of(10, "Creature — Bat"), // counted, 0.5
      ...of(22, "Creature — Spirit"), // counted, 1
    ]);
    expect(themes.map((t) => t.word)).toEqual(["Spirit", "Vampire", "Bat", "Zombie"]);
  });
});

describe("the sentences", () => {
  const counted = { word: "Sliver", count: 41, namedBy: null, strength: 1, selectivity: 1 };
  const named = {
    word: "Vampire",
    count: 27,
    namedBy: "Edgar Markov",
    strength: 1,
    selectivity: 1,
  };

  it("say what was counted, or what the commander's text names", () => {
    expect(mtgThemes.evidence(counted)).toEqual({
      why: "Shares the Sliver type with 41 of your cards",
      howOften: null,
    });
    expect(mtgThemes.evidence(named)).toEqual({
      why: "Has the Vampire type, which Edgar Markov's rules text names",
      howOften: "27 of your cards share it",
    });
  });

  it("say what cutting takes from the list, with the card's own copies left out", () => {
    expect(mtgCutThemes.evidence({ theme: counted, others: 40 })).toEqual({
      why: "Shares the Sliver type with 40 of your other cards. Cutting it thins that type in your list",
    });
    expect(mtgCutThemes.evidence({ theme: named, others: 26 })).toEqual({
      why: "Has the Vampire type, which Edgar Markov's rules text names. Cutting it leaves 26 in your list",
    });
    expect(mtgCutThemes.evidence({ theme: { ...named, count: 1 }, others: 0 }).why).toBe(
      "Has the Vampire type, which Edgar Markov's rules text names. Cutting it leaves none in your list",
    );
  });

  it("never say what a card does", () => {
    const lines = [
      mtgThemes.evidence(counted).why,
      mtgThemes.evidence(named).why,
      mtgCutThemes.evidence({ theme: counted, others: 40 }).why,
      mtgCutThemes.evidence({ theme: named, others: 26 }).why,
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/\b(synerg|works? well|combo|best|strong|powerful|theme)\w*/i);
    }
  });

  it("declares where it reads and under which source", () => {
    expect(mtgThemes).toMatchObject({
      source: "deck-types",
      path: "type_line",
      leaderPath: "oracle_text",
    });
  });
});
