import { describe, expect, it } from "vitest";

import { toDeckSnapshot, type SnapshotEntry } from "@/lib/decks/validation";
import { mtgAdapter } from "./adapter";
import { analyzeMtg, DECK_FACTS_WORDS } from "./analyze";
import { COMMANDER } from "./formats";
import { MTG_CURVE_TEMPLATE, STAPLE_RANK } from "./recommend";
import {
  atraxa,
  card,
  cardMap,
  commanderDeck,
  entry,
  island,
  lightningBolt,
  solRing,
  type MtgCard,
} from "./test-fixtures";

function block(blocks: ReturnType<typeof analyzeMtg>, id: string) {
  const b = blocks.find((x) => x.id === id);
  if (!b) throw new Error(`missing block ${id}`);
  return b;
}

describe("analyzeMtg", () => {
  const deck = commanderDeck([atraxa], [entry(solRing), entry(lightningBolt), entry(island, 30)]);
  const cards = cardMap([atraxa, solRing, lightningBolt, island]);
  const blocks = analyzeMtg(deck, cards);

  it("emits data blocks only (never components)", () => {
    for (const b of blocks) expect(["histogram", "breakdown", "stat", "table"]).toContain(b.kind);
  });

  it("builds a qty-weighted mana curve excluding lands", () => {
    const curve = block(blocks, "mana-curve");
    if (curve.kind !== "histogram") throw new Error("wrong kind");
    // MV 1: Sol Ring + Bolt; MV 4: Atraxa; 30 Islands excluded.
    expect(curve.buckets.map((b) => b.value)).toEqual([0, 2, 0, 0, 1, 0, 0, 0]);
    expect(curve.buckets[7].label).toBe("7+");
  });

  it("the mana curve carries the editorial curve template as its target (R6, G9)", () => {
    const curve = block(blocks, "mana-curve");
    if (curve.kind !== "histogram") throw new Error("wrong kind");
    expect(curve.target).toEqual({ label: "Curve template", values: MTG_CURVE_TEMPLATE });
    expect(curve.target!.values).toHaveLength(curve.buckets.length);
    // The same skeleton the Cut Coach reads — one template, two views.
    expect(curve.target!.values).toBe(mtgAdapter.recommend!.curve!.buckets);
    // No other block carries a target.
    for (const b of blocks) if (b.id !== "mana-curve") expect("target" in b).toBe(false);
  });

  it("computes average mana value over nonland cards", () => {
    const stat = block(blocks, "avg-mv");
    if (stat.kind !== "stat") throw new Error("wrong kind");
    expect(stat.value).toBe("2.00"); // (1 + 1 + 4) / 3
  });

  it("counts lands and breaks down types in the deck list's type order (DECK-TOKENS)", () => {
    const lands = block(blocks, "lands");
    if (lands.kind !== "stat") throw new Error("wrong kind");
    expect(lands.value).toBe("30");

    // Not biggest-first: the 30 Islands stay last, as Lands do in the list.
    const types = block(blocks, "types");
    if (types.kind !== "breakdown") throw new Error("wrong kind");
    expect(types.slices).toEqual([
      { label: "Creature", value: 1 },
      { label: "Instant", value: 1 },
      { label: "Artifact", value: 1 },
      { label: "Land", value: 30 },
    ]);
  });

  it("tallies mana sources by color, lands split from other producers", () => {
    const sources = block(blocks, "mana-sources");
    if (sources.kind !== "table") throw new Error("wrong kind");
    expect(sources.columns).toEqual(["Color", "Lands", "Other"]);
    // 30 Islands add {U}; Sol Ring adds {C}{C}; Atraxa and Bolt produce nothing.
    expect(sources.rows).toEqual([
      ["Blue", 30, 0],
      ["Colorless", 0, 1],
    ]);
  });

  it("counts an any-color producer once for each color the commander allows", () => {
    const birds = card({
      name: "Birds of Paradise",
      costValue: 1,
      colorsMask: 16,
      ciMask: 16,
      attrs: {
        type_line: "Creature — Bird",
        oracle_text: "Flying\n{T}: Add one mana of any color.",
        mana_cost: "{G}",
      },
    });
    const d = commanderDeck([atraxa], [entry(birds), entry(island, 2)]);
    const sources = block(analyzeMtg(d, cardMap([atraxa, birds, island])), "mana-sources");
    if (sources.kind !== "table") throw new Error("wrong kind");
    // Birds is an "Other" source of Atraxa's WUBG — no Red row; the 2 Islands are Blue lands.
    expect(sources.rows).toEqual([
      ["White", 0, 1],
      ["Blue", 2, 1],
      ["Black", 0, 1],
      ["Green", 0, 1],
    ]);
    expect(sources.hint).toBe(
      "Cards that make \u201cany color\u201d count once for each color your commander allows; Treasure makers count through their reminder text.",
    );
  });

  it("lists only White and Colorless for a mono-white deck with Arcane Signet and a Treasure maker", () => {
    const sram = card({
      name: "Sram, Senior Edificer",
      primaryType: "Creature",
      costValue: 2,
      colorsMask: 1,
      ciMask: 1,
      attrs: {
        type_line: "Legendary Creature — Dwarf Advisor",
        oracle_text: "Whenever you cast an Aura, Equipment, or Vehicle spell, draw a card.",
        mana_cost: "{1}{W}",
      },
    });
    const signet = card({
      name: "Arcane Signet",
      primaryType: "Artifact",
      costValue: 2,
      attrs: {
        type_line: "Artifact",
        oracle_text: "{T}: Add one mana of any color in your commander's color identity.",
        mana_cost: "{2}",
      },
    });
    const treasureMaker = card({
      name: "Smothering Tithe",
      primaryType: "Enchantment",
      costValue: 4,
      colorsMask: 1,
      ciMask: 1,
      attrs: {
        type_line: "Enchantment",
        oracle_text:
          "Whenever an opponent draws a card, that player may pay {2}. If the player doesn't, you create a Treasure token. (It's an artifact with \"{T}, Sacrifice this artifact: Add one mana of any color.\")",
        mana_cost: "{3}{W}",
      },
    });
    const plains = card({
      name: "Plains",
      primaryType: "Land",
      costValue: 0,
      attrs: { type_line: "Basic Land — Plains", oracle_text: "({T}: Add {W}.)", mana_cost: "" },
    });
    const d = commanderDeck(
      [sram],
      [entry(signet), entry(treasureMaker), entry(solRing), entry(plains, 30)],
    );
    const sources = block(
      analyzeMtg(d, cardMap([sram, signet, treasureMaker, solRing, plains])),
      "mana-sources",
    );
    if (sources.kind !== "table") throw new Error("wrong kind");
    expect(sources.rows).toEqual([
      ["White", 30, 2],
      ["Colorless", 0, 1],
    ]);
  });

  it("keeps every produced color while the deck has no commander", () => {
    const signet = card({
      name: "Arcane Signet",
      primaryType: "Artifact",
      costValue: 2,
      attrs: {
        type_line: "Artifact",
        oracle_text: "{T}: Add one mana of any color in your commander's color identity.",
        mana_cost: "{2}",
      },
    });
    const d = commanderDeck([], [entry(signet), entry(island, 3)]);
    const sources = block(analyzeMtg(d, cardMap([signet, island])), "mana-sources");
    if (sources.kind !== "table") throw new Error("wrong kind");
    expect(sources.rows).toEqual([
      ["White", 0, 1],
      ["Blue", 3, 1],
      ["Black", 0, 1],
      ["Red", 0, 1],
      ["Green", 0, 1],
    ]);
  });

  it("sums cheapest-printing prices", () => {
    const price = block(blocks, "price");
    if (price.kind !== "stat") throw new Error("wrong kind");
    expect(price.value).toBe("$19.70"); // Atraxa 18.50 + Sol Ring 1.20
  });
});

// DECK-FACTS: Edgar Markov's real rules text names the Vampire type, and he carries it.
const edgar = card({
  name: "Edgar Markov",
  costValue: 6,
  colorsMask: 1 | 4 | 8,
  ciMask: 1 | 4 | 8,
  isLeaderCandidate: true,
  popularity: 1200,
  attrs: {
    type_line: "Legendary Creature — Vampire Knight",
    oracle_text:
      "Eminence — Whenever you cast another Vampire spell, if Edgar Markov is in the command zone or on the battlefield, create a 1/1 black Vampire creature token.\nFirst strike, haste\nWhenever Edgar Markov attacks, put a +1/+1 counter on each Vampire you control.",
  },
});
const vampire = (n: number, popularity: number | null): MtgCard =>
  card({
    name: `Vampire ${n}`,
    costValue: 2,
    popularity,
    attrs: { type_line: "Creature — Vampire", oracle_text: "" },
  });
const commandTower = card({
  name: "Command Tower",
  primaryType: "Land",
  costValue: 0,
  popularity: 2,
  attrs: {
    type_line: "Land",
    oracle_text: "{T}: Add one mana of any color in your commander's color identity.",
  },
});
const rankedSol: MtgCard = { ...solRing, popularity: 1 };
const rankedBolt: MtgCard = { ...lightningBolt, popularity: 2500 };

function stat(blocks: ReturnType<typeof analyzeMtg>, id: string) {
  const b = block(blocks, id);
  if (b.kind !== "stat") throw new Error("wrong kind");
  return b;
}

describe("analyzeMtg — DECK-FACTS: two counted facts about the list", () => {
  const ranks = [100, 300, 500, 1999, STAPLE_RANK, STAPLE_RANK + 1, 5000, null];
  const vampires = ranks.map((rank, i) => vampire(i + 1, rank));
  const deck = commanderDeck(
    [edgar],
    [
      ...vampires.map((v) => entry(v)),
      entry(rankedSol),
      entry(rankedBolt),
      entry(commandTower),
      entry(island, 30),
    ],
  );
  const cards = cardMap([edgar, ...vampires, rankedSol, rankedBolt, commandTower, island]);
  const blocks = analyzeMtg(deck, cards);

  it("closes the stat row with the deck's type and its Commander staples, each a count of the nonland cards with its source", () => {
    expect(blocks.filter((b) => b.kind === "stat").map((b) => b.id)).toEqual([
      "avg-mv",
      "lands",
      "price",
      "deck-type",
      "staples",
    ]);
    // Edgar and his eight Vampires; the nonland cards are those nine, Sol Ring and Bolt.
    expect(stat(blocks, "deck-type")).toEqual({
      kind: "stat",
      id: "deck-type",
      title: "Vampire cards",
      value: "9 of 11",
      hint: "Nonland cards, by type line",
    });
    // Edgar (1,200), the Vampires at 100, 300, 500, 1,999 and 2,000, and Sol Ring (1).
    expect(stat(blocks, "staples")).toEqual({
      kind: "stat",
      id: "staples",
      title: "Commander staples",
      value: "7 of 11",
      hint: "Nonland cards in EDHREC's top 2,000",
    });
    // "Lands" and "of N" add up to the deck: 31 + 11 = 42 cards.
    expect(stat(blocks, "lands").value).toBe("31");
    expect(
      Object.values(deck.zones)
        .flat()
        .reduce((n, e) => n + e.qty, 0),
    ).toBe(42);
  });

  it("the cut-off is the one step 0 measured, and the line names it", () => {
    expect(STAPLE_RANK).toBe(2000);
    expect(DECK_FACTS_WORDS.staplesHint).toBe("Nonland cards in EDHREC's top 2,000");
  });

  it("counts copies in both facts; a card at rank 2,000 is a staple, one at 2,001 or with no rank is not", () => {
    const atCut = vampire(21, STAPLE_RANK);
    const pastCut = vampire(22, STAPLE_RANK + 1);
    const unranked = vampire(23, null);
    const d = commanderDeck([edgar], [entry(atCut, 3), entry(pastCut, 2), entry(unranked, 2)]);
    const b = analyzeMtg(d, cardMap([edgar, atCut, pastCut, unranked]));
    expect(stat(b, "deck-type").value).toBe("8 of 8");
    expect(stat(b, "staples").value).toBe("4 of 8"); // Edgar + three copies at 2,000
  });

  it("a land is in neither: a land at rank 2 is no staple, and a land's own types make no deck type", () => {
    const loci = Array.from({ length: 12 }, (_, i) =>
      card({
        name: `Locus ${i + 1}`,
        primaryType: "Land",
        costValue: 0,
        popularity: 2,
        attrs: { type_line: "Land — Locus", oracle_text: "{T}: Add {C}." },
      }),
    );
    const d = commanderDeck([atraxa], [entry(rankedSol), ...loci.map((l) => entry(l))]);
    const b = analyzeMtg(d, cardMap([atraxa, rankedSol, ...loci]));
    expect(b.find((x) => x.id === "deck-type")).toBeUndefined();
    expect(stat(b, "staples").value).toBe("1 of 2"); // Sol Ring; Atraxa has no rank here
  });

  it("no type found means no type tile (the Atraxa precon's shape); the staples tile still counts", () => {
    const atraxaBlocks = analyzeMtg(
      commanderDeck([atraxa], [entry(solRing), entry(lightningBolt), entry(island, 30)]),
      cardMap([atraxa, solRing, lightningBolt, island]),
    );
    expect(atraxaBlocks.find((x) => x.id === "deck-type")).toBeUndefined();
    expect(stat(atraxaBlocks, "staples").value).toBe("0 of 3");
  });

  it("a type no card of the list holds is no tile, never '0 of N' (a land-fronted card in the command zone names its back face's type)", () => {
    const abbey = card({
      name: "Test Abbey // Test Prince",
      primaryType: "Land",
      costValue: 0,
      attrs: {
        type_line: "Land // Legendary Creature — Demon",
        oracle_text: "Whenever another Demon you control dies, draw a card.",
      },
    });
    const d = commanderDeck([abbey], [entry(rankedSol), entry(island, 10)]);
    const b = analyzeMtg(d, cardMap([abbey, rankedSol, island]));
    expect(b.find((x) => x.id === "deck-type")).toBeUndefined();
    expect(stat(b, "staples").value).toBe("1 of 1");
  });

  it("only the commander's rules text names a type: a card of the 99 naming its own type makes no deck type", () => {
    const lord = card({
      name: "Lord of the Undead",
      costValue: 3,
      attrs: {
        type_line: "Creature — Zombie",
        oracle_text:
          "Other Zombie creatures get +1/+1.\n{1}{B}, {T}: Return target Zombie card from your graveyard to your hand.",
      },
    });
    const b = analyzeMtg(
      commanderDeck([atraxa], [entry(lord), entry(island, 30)]),
      cardMap([atraxa, lord, island]),
    );
    expect(b.find((x) => x.id === "deck-type")).toBeUndefined();
  });

  it("a list with no nonland card shows neither fact", () => {
    for (const d of [commanderDeck([], []), commanderDeck([], [entry(island, 5)])]) {
      const b = analyzeMtg(d, cardMap([island]));
      expect(b.find((x) => x.id === "deck-type")).toBeUndefined();
      expect(b.find((x) => x.id === "staples")).toBeUndefined();
    }
  });

  it("a list of several types names the strongest only (the owner's answer at the gate)", () => {
    const kaalia = card({
      name: "Kaalia of the Vast",
      costValue: 4,
      colorsMask: 1 | 4 | 8,
      ciMask: 1 | 4 | 8,
      isLeaderCandidate: true,
      attrs: {
        type_line: "Legendary Creature — Human Cleric",
        oracle_text:
          "Flying\nWhenever Kaalia of the Vast attacks an opponent, you may put an Angel, Demon, or Dragon creature card from your hand onto the battlefield tapped and attacking that opponent.",
      },
    });
    const of = (type: string, n: number) =>
      Array.from({ length: n }, (_, i) =>
        card({
          name: `${type} ${i + 1}`,
          attrs: { type_line: `Creature — ${type}`, oracle_text: "" },
        }),
      );
    const list = [...of("Angel", 11), ...of("Dragon", 6), ...of("Demon", 5)];
    const b = analyzeMtg(
      commanderDeck(
        [kaalia],
        list.map((c) => entry(c)),
      ),
      cardMap([kaalia, ...list]),
    );
    expect(b.filter((x) => x.id === "deck-type")).toHaveLength(1);
    expect(stat(b, "deck-type")).toMatchObject({ title: "Angel cards", value: "11 of 23" });
  });

  it("a Maybe card and a token change neither fact: the playable list is what is counted (toDeckSnapshot)", () => {
    const parked = vampire(31, 1);
    const token = card({
      name: "Vampire Token",
      popularity: 1,
      attrs: { type_line: "Token Creature — Vampire", oracle_text: "Lifelink", is_token: true },
    });
    const row = (c: MtgCard, zone: string): SnapshotEntry => ({
      cardId: c.id,
      zone,
      qty: 1,
      tags: [],
    });
    const base: SnapshotEntry[] = [
      row(edgar, "commander"),
      ...vampires.map((v) => row(v, "main")),
      row(rankedSol, "main"),
    ];
    const withExtras = [...base, row(parked, "maybeboard"), row(token, "tokens")];
    expect(COMMANDER.zones.map((z) => z.id)).toEqual(
      expect.arrayContaining(["maybeboard", "tokens"]),
    );
    const all = cardMap([edgar, ...vampires, rankedSol, parked, token]);
    const facts = (entries: SnapshotEntry[]) =>
      analyzeMtg(toDeckSnapshot("mtg", COMMANDER, entries), all).filter(
        (b) => b.id === "deck-type" || b.id === "staples",
      );
    expect(facts(withExtras)).toEqual(facts(base));
    expect(facts(base).map((b) => (b.kind === "stat" ? b.value : null))).toEqual([
      "9 of 10",
      "7 of 10",
    ]);
  });

  it("no word of the facts judges the deck", () => {
    const strings = [
      DECK_FACTS_WORDS.typeTitle("Vampire"),
      DECK_FACTS_WORDS.typeHint,
      DECK_FACTS_WORDS.staplesTitle,
      DECK_FACTS_WORDS.staplesHint,
      DECK_FACTS_WORDS.count(7, 11),
      ...blocks
        .filter((b) => b.id === "deck-type" || b.id === "staples")
        .flatMap((b) => (b.kind === "stat" ? [b.title, b.value, b.hint ?? ""] : [])),
    ];
    for (const s of strings) expect(s).not.toMatch(/\b(fun|boring|generic|score)\b/i);
  });
});
