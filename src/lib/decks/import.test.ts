import { describe, expect, it, vi } from "vitest";

import { MAX_ENTRIES, type CardWire } from "@/lib/decks/editor-state";
import { applyImport, buildImportItems, defaultZoneId, type Resolution } from "@/lib/decks/import";
import { mtgAdapter } from "@/lib/games/mtg/adapter";
import { parseMtgDecklist } from "@/lib/games/mtg/decklist";
import { mtgImportLeaderGuess } from "@/lib/games/mtg/import-guess";
import { COMMANDER } from "@/lib/games/mtg/formats";
import { MOXFIELD_TLA_PASTE } from "@/lib/games/mtg/test-fixtures";
import { optcgAdapter } from "@/lib/games/optcg/adapter";

const OP_STANDARD = optcgAdapter.formats[0];

let n = 0;
function wire(name: string): CardWire {
  return {
    id: `00000000-0000-4000-9000-${String(++n).padStart(12, "0")}`,
    name,
    externalKey: `oracle-${n}`,
    primaryType: "Creature",
    costValue: 2,
    colorsMask: 0,
    ciMask: 0,
    isLeaderCandidate: false,
    isPreview: false,
    cheapestUsd: null,
    popularity: null,
    attrs: {},
    image: null,
  };
}

const atraxa = wire("Atraxa, Praetors' Voice");
const solRing = wire("Sol Ring");
const island = wire("Island");

function resolutions(pairs: [string, CardWire | null][]): Resolution[] {
  return pairs.map(([input, match]) => ({ input, match, suggestions: [] }));
}

describe("buildImportItems", () => {
  it("maps zone hints to format zones, default zone when unhinted, null when unknown", () => {
    const items = buildImportItems(
      COMMANDER,
      [
        { rawName: "Atraxa, Praetors' Voice", qty: 1, zoneHint: "commander" },
        { rawName: "Sol Ring", qty: 1 },
        { rawName: "Swords to Plowshares", qty: 1, zoneHint: "sideboard" },
      ],
      resolutions([
        ["Atraxa, Praetors' Voice", atraxa],
        ["Sol Ring", solRing],
        ["Swords to Plowshares", null],
      ]),
    );
    expect(defaultZoneId(COMMANDER)).toBe("main");
    expect(items.map((i) => i.zone)).toEqual(["commander", "main", null]);
    expect(items.map((i) => i.card?.name ?? null)).toEqual([
      "Atraxa, Praetors' Voice",
      "Sol Ring",
      null,
    ]);
  });

  it("routes cards via the adapter hook when unhinted — OP leader lines land in the leader zone (P4.6)", () => {
    const enel = { ...wire("Enel"), attrs: { category: "leader" } };
    const ohm = { ...wire("Ohm"), attrs: { category: "character" } };
    const zoneFor = (card: CardWire) => optcgAdapter.importZoneFor!(card);
    const items = buildImportItems(
      OP_STANDARD,
      [
        { rawName: "Enel (OP15-058)", qty: 1 },
        { rawName: "Ohm (OP15-061)", qty: 4 },
      ],
      resolutions([
        ["Enel (OP15-058)", enel],
        ["Ohm (OP15-061)", ohm],
      ]),
      zoneFor,
    );
    expect(items.map((i) => i.zone)).toEqual(["leader", "main"]);
  });

  it("a zone hint beats the adapter routing hook", () => {
    const enel = { ...wire("Enel"), attrs: { category: "leader" } };
    const items = buildImportItems(
      OP_STANDARD,
      [{ rawName: "Enel", qty: 1, zoneHint: "main" }],
      resolutions([["Enel", enel]]),
      (card) => optcgAdapter.importZoneFor!(card),
    );
    expect(items[0].zone).toBe("main");
  });
});

describe("applyImport", () => {
  const items = buildImportItems(
    COMMANDER,
    [
      { rawName: "Atraxa, Praetors' Voice", qty: 1, zoneHint: "commander" },
      { rawName: "Sol Ring", qty: 1 },
      { rawName: "Island", qty: 30 },
    ],
    resolutions([
      ["Atraxa, Praetors' Voice", atraxa],
      ["Sol Ring", solRing],
      ["Island", island],
    ]),
  );

  it("replace mode builds a fresh list", () => {
    const existing = [{ cardId: "old", zone: "main", qty: 5, tags: [] }];
    const { entries, cards, warnings } = applyImport(existing, items, COMMANDER, "replace");
    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      { cardId: atraxa.id, zone: "commander", qty: 1, tags: [] },
      { cardId: solRing.id, zone: "main", qty: 1, tags: [] },
      { cardId: island.id, zone: "main", qty: 30, tags: [] },
    ]);
    expect(cards.map((c) => c.name)).toContain("Island");
  });

  it("replace mode keeps the Tokens zone (DECK-TOKENS): a paste replaces the 100, not the tokens", () => {
    const existing = [
      { cardId: "old", zone: "main", qty: 5, tags: [] },
      { cardId: "treasure", zone: "tokens", qty: 3, tags: [] },
    ];
    const { entries } = applyImport(existing, items, COMMANDER, "replace");
    expect(entries.map((e) => `${e.zone}:${e.cardId}`)).toEqual([
      "tokens:treasure",
      `commander:${atraxa.id}`,
      `main:${solRing.id}`,
      `main:${island.id}`,
    ]);
  });

  it("add mode merges quantities into existing entries", () => {
    const existing = [{ cardId: island.id, zone: "main", qty: 2, tags: ["mana"] }];
    const { entries } = applyImport(existing, items, COMMANDER, "add");
    const islandEntry = entries.find((e) => e.cardId === island.id);
    expect(islandEntry).toEqual({ cardId: island.id, zone: "main", qty: 32, tags: ["mana"] });
    expect(entries).toHaveLength(3);
  });

  it("merges duplicate lines within one paste", () => {
    const dup = buildImportItems(
      COMMANDER,
      [
        { rawName: "Sol Ring", qty: 1 },
        { rawName: "Sol Ring", qty: 2 },
      ],
      resolutions([["Sol Ring", solRing]]),
    );
    const { entries } = applyImport([], dup, COMMANDER, "replace");
    expect(entries).toEqual([{ cardId: solRing.id, zone: "main", qty: 3, tags: [] }]);
  });

  it("spills commander-zone overflow into the main deck with a warning", () => {
    const kenrith = wire("Kenrith, the Returned King");
    const thrasios = wire("Thrasios, Triton Hero");
    const overfull = buildImportItems(
      COMMANDER,
      [
        { rawName: "Atraxa, Praetors' Voice", qty: 1, zoneHint: "commander" },
        { rawName: "Kenrith, the Returned King", qty: 1, zoneHint: "commander" },
        { rawName: "Thrasios, Triton Hero", qty: 1, zoneHint: "commander" },
      ],
      resolutions([
        ["Atraxa, Praetors' Voice", atraxa],
        ["Kenrith, the Returned King", kenrith],
        ["Thrasios, Triton Hero", thrasios],
      ]),
    );
    const { entries, warnings } = applyImport([], overfull, COMMANDER, "replace");
    expect(entries.filter((e) => e.zone === "commander")).toHaveLength(2);
    expect(entries.find((e) => e.cardId === thrasios.id)?.zone).toBe("main");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/Commander is full/);
  });

  it("skips a line whose exact card already fills a capped zone — idempotent re-import (P4.6)", () => {
    // The latched-leader funnel: hub CTA seeds Enel, then a pasted Limitless
    // export names Enel again. Same card at the zone max = a silent no-op,
    // not a spill into the 50.
    const enel = { ...wire("Enel"), attrs: { category: "leader" } };
    const items = buildImportItems(
      OP_STANDARD,
      [{ rawName: "Enel (OP15-058)", qty: 1 }],
      resolutions([["Enel (OP15-058)", enel]]),
      (card) => optcgAdapter.importZoneFor!(card),
    );
    const existing = [{ cardId: enel.id, zone: "leader", qty: 1, tags: [] }];
    const { entries, warnings } = applyImport(existing, items, OP_STANDARD, "add");
    expect(warnings).toEqual([]);
    expect(entries).toEqual(existing);
  });

  it("says a full default zone honestly instead of 'moved X to' itself (P4.6)", () => {
    // 51 real cards into OP's 50-max main: the old text claimed to move the
    // overflow "to Deck" — from Deck. It still lands (validation renders the
    // over-size verdict), but the words now say what happened.
    const fill = { ...wire("Filler"), attrs: { category: "character" } };
    const extra = { ...wire("Extra"), attrs: { category: "character" } };
    const items = buildImportItems(
      OP_STANDARD,
      [
        { rawName: "Filler", qty: 50 },
        { rawName: "Extra", qty: 1 },
      ],
      resolutions([
        ["Filler", fill],
        ["Extra", extra],
      ]),
    );
    const { entries, warnings } = applyImport([], items, OP_STANDARD, "replace");
    expect(entries.reduce((s, e) => s + e.qty, 0)).toBe(51);
    expect(warnings).toEqual(["Deck is full: Extra puts it over"]);
  });

  it("collapses a multi-card spill into ONE grouped warning — the P2.8b wall fix", () => {
    // The owner's dry-run workaround: a typed "Commander" header latches
    // every following line into the commander zone. Toph and Aang fill the
    // max-2 zone; the other 78 lines spill — as one warning, not 78.
    const parsed = parseMtgDecklist("Commander\n" + MOXFIELD_TLA_PASTE).lines;
    expect(parsed.every((l) => l.zoneHint === "commander")).toBe(true);
    const items = buildImportItems(
      COMMANDER,
      parsed,
      resolutions(parsed.map((l) => [l.rawName, wire(l.rawName)])),
    );
    const { entries, warnings } = applyImport([], items, COMMANDER, "replace");
    expect(entries.filter((e) => e.zone === "commander")).toHaveLength(2);
    expect(entries.reduce((s, e) => s + e.qty, 0)).toBe(100);
    expect(warnings).toEqual([
      "Commander is full: moved 78 cards to Main deck (Abandoned Air Temple, Airbending Lesson, Appa, Steadfast Guardian, …)",
    ]);
  });

  it("reports unresolved and zoneless lines as skipped warnings", () => {
    const partial = buildImportItems(
      COMMANDER,
      [
        { rawName: "Not A Real Card", qty: 1 },
        { rawName: "Sol Ring", qty: 1, zoneHint: "sideboard" },
      ],
      resolutions([
        ["Not A Real Card", null],
        ["Sol Ring", solRing],
      ]),
    );
    const { entries, warnings, skipped } = applyImport([], partial, COMMANDER, "replace");
    expect(entries).toEqual([]);
    expect(skipped).toHaveLength(2);
    expect(warnings).toEqual([
      'Not found: "Not A Real Card", skipped',
      'No "sideboard" zone in Commander: skipped Sol Ring',
    ]);
  });
});

describe("the Moxfield commander guess at import level (P2.8b)", () => {
  const toph = { ...wire("Toph, the First Metalbender"), isLeaderCandidate: true };
  /** The owner's paste through the real tokenizer + the real MTG hook. */
  function pasteItems() {
    const lines = parseMtgDecklist(MOXFIELD_TLA_PASTE).lines;
    return buildImportItems(
      COMMANDER,
      lines,
      resolutions(lines.map((l) => [l.rawName, l.rawName === toph.name ? toph : wire(l.rawName)])),
      undefined,
      mtgImportLeaderGuess,
    );
  }

  it("routes Toph to the commander zone, flagged guessed; the other 79 lines untouched", () => {
    // pasteItems passes mtgImportLeaderGuess directly (the test's adapter is
    // the typed GameAdapter<MtgAttrs>; the dialog holds the erased GameAdapter
    // and binds it) — pin that it IS the adapter's wired hook.
    expect(mtgAdapter.importLeaderGuess).toBe(mtgImportLeaderGuess);
    const items = pasteItems();
    expect(items[0].line.rawName).toBe(toph.name);
    expect(items[0].zone).toBe("commander");
    expect(items[0].guessed).toBe(true);
    expect(items.slice(1).every((i) => i.zone === "main" && !i.guessed)).toBe(true);
    expect(items.every((i) => i.card)).toBe(true);
  });

  it("replace mode applies the guess: Toph commands, 99 in the main deck, no warnings", () => {
    const { entries, warnings } = applyImport([], pasteItems(), COMMANDER, "replace");
    expect(warnings).toEqual([]);
    const commanders = entries.filter((e) => e.zone === "commander");
    expect(commanders).toEqual([{ cardId: toph.id, zone: "commander", qty: 1, tags: [] }]);
    expect(entries.filter((e) => e.zone === "main").reduce((s, e) => s + e.qty, 0)).toBe(99);
  });

  it("add mode into an empty deck applies the guess — the fresh-draft import path", () => {
    const { entries, warnings } = applyImport([], pasteItems(), COMMANDER, "add");
    expect(warnings).toEqual([]);
    expect(entries.filter((e) => e.zone === "commander").map((e) => e.cardId)).toEqual([toph.id]);
  });

  it("add mode: a guessed leader yields to a DIFFERENT occupant — default zone, no warning", () => {
    const existing = [{ cardId: atraxa.id, zone: "commander", qty: 1, tags: [] }];
    const { entries, warnings } = applyImport(existing, pasteItems(), COMMANDER, "add");
    expect(warnings).toEqual([]);
    expect(entries.filter((e) => e.zone === "commander")).toEqual(existing);
    expect(entries.find((e) => e.cardId === toph.id)?.zone).toBe("main");
  });

  it("add mode: the guessed card already commanding stays the idempotent silent skip", () => {
    const existing = [{ cardId: toph.id, zone: "commander", qty: 1, tags: [] }];
    const { entries, warnings } = applyImport(existing, pasteItems(), COMMANDER, "add");
    expect(warnings).toEqual([]);
    expect(entries.filter((e) => e.zone === "commander")).toEqual(existing);
    expect(entries.filter((e) => e.cardId === toph.id)).toHaveLength(1);
  });

  it("a leader-zone hint anywhere in the paste disables the guess at core level", () => {
    const hook = vi.fn(() => [1]);
    const items = buildImportItems(
      COMMANDER,
      [
        { rawName: "Atraxa, Praetors' Voice", qty: 1, zoneHint: "commander" },
        { rawName: "Sol Ring", qty: 1 },
      ],
      resolutions([
        ["Atraxa, Praetors' Voice", atraxa],
        ["Sol Ring", solRing],
      ]),
      undefined,
      hook,
    );
    expect(hook).not.toHaveBeenCalled();
    expect(items[1].zone).toBe("main");
    expect(items[1].guessed).toBeUndefined();
  });
});

describe("Maybe in an import (MAYBE-LIST)", () => {
  const cover = wire("Cover of Darkness");
  const fountain = wire("Radiant Fountain");
  const virtue = wire("Intangible Virtue");
  const burial = wire("Proper Burial");
  const signet = wire("Arcane Signet");
  const byName = new Map(
    [atraxa, solRing, island, cover, fountain, virtue, burial, signet].map((c) => [c.name, c]),
  );
  /** The real parser's lines, resolved by name, through buildImportItems. */
  const itemsOf = (text: string) => {
    const { lines } = parseMtgDecklist(text);
    return buildImportItems(
      COMMANDER,
      lines,
      resolutions(lines.map((l) => [l.rawName, byName.get(l.rawName) ?? null])),
    );
  };
  const zones = (entries: { zone: string; cardId: string }[]) =>
    entries.map(
      (e) => `${e.zone}:${[...byName.values()].find((c) => c.id === e.cardId)?.name ?? e.cardId}`,
    );

  const MOXFIELD = [
    "Commander",
    "1 Atraxa, Praetors' Voice",
    "",
    "Deck",
    "1 Sol Ring",
    "30 Island",
    "",
    "Sideboard",
    "1 Intangible Virtue",
    "",
    "Maybeboard",
    "1 Cover of Darkness",
    "1 Radiant Fountain",
  ].join("\n");

  it("a pasted Maybeboard section lands in Maybe with no parser change; Sideboard stays skipped", () => {
    const { entries, warnings } = applyImport([], itemsOf(MOXFIELD), COMMANDER, "replace");
    expect(zones(entries)).toEqual([
      "commander:Atraxa, Praetors' Voice",
      "main:Sol Ring",
      "main:Island",
      "maybeboard:Cover of Darkness",
      "maybeboard:Radiant Fountain",
    ]);
    expect(warnings).toEqual(['No "sideboard" zone in Commander: skipped Intangible Virtue']);
  });

  it("Archidekt's out-of-deck categories land in Maybe; its Sideboard stays skipped", () => {
    const text = [
      "1x Atraxa, Praetors' Voice (one) 190 [Commander{top}]",
      "1x Cover of Darkness (ons) 133 [Maybeboard{noDeck}{noPrice}]",
      "1x Radiant Fountain (clb) 908 [Maybeboard{noDeck}{noPrice},Land]",
      "1x Intangible Virtue (isd) 19 [Sideboard{noDeck}]",
      "1x Proper Burial (ody) 20 [Considering{noDeck}]",
      "1x Sol Ring (c21) 263 [Ramp]",
    ].join("\n");
    const { entries, warnings } = applyImport([], itemsOf(text), COMMANDER, "add");
    expect(zones(entries)).toEqual([
      "commander:Atraxa, Praetors' Voice",
      "maybeboard:Cover of Darkness",
      "maybeboard:Radiant Fountain",
      "maybeboard:Proper Burial",
      "main:Sol Ring",
    ]);
    expect(warnings).toEqual(['No "sideboard" zone in Commander: skipped Intangible Virtue']);
  });

  it("Replace keeps the Maybe list when the paste has no Maybe lines, as it keeps Tokens", () => {
    const existing = [
      { cardId: "old", zone: "main", qty: 5, tags: [] },
      { cardId: signet.id, zone: "maybeboard", qty: 1, tags: [] },
      { cardId: "treasure", zone: "tokens", qty: 3, tags: [] },
    ];
    const { entries } = applyImport(
      existing,
      itemsOf("1 Sol Ring\n30 Island"),
      COMMANDER,
      "replace",
    );
    expect(zones(entries)).toEqual([
      "maybeboard:Arcane Signet",
      "tokens:treasure",
      "main:Sol Ring",
      "main:Island",
    ]);
  });

  it("Replace replaces the Maybe list when the paste brings Maybe lines of its own", () => {
    const existing = [
      { cardId: "old", zone: "main", qty: 5, tags: [] },
      { cardId: signet.id, zone: "maybeboard", qty: 1, tags: [] },
      { cardId: "treasure", zone: "tokens", qty: 3, tags: [] },
    ];
    const { entries } = applyImport(existing, itemsOf(MOXFIELD), COMMANDER, "replace");
    expect(zones(entries)).toEqual([
      "tokens:treasure",
      "commander:Atraxa, Praetors' Voice",
      "main:Sol Ring",
      "main:Island",
      "maybeboard:Cover of Darkness",
      "maybeboard:Radiant Fountain",
    ]);
  });

  it("a card the deck holds after the import is in no Maybe row: its own Maybe line is left out, said once", () => {
    const text = ["Deck", "1 Sol Ring", "", "Maybeboard", "1 Sol Ring", "1 Cover of Darkness"].join(
      "\n",
    );
    const { entries, warnings } = applyImport([], itemsOf(text), COMMANDER, "add");
    expect(zones(entries)).toEqual(["main:Sol Ring", "maybeboard:Cover of Darkness"]);
    expect(warnings).toEqual(["Already in the deck, so left out of Maybe: Sol Ring"]);
    // A Maybe line for a card already in the deck, in add mode.
    const again = applyImport(
      [{ cardId: solRing.id, zone: "main", qty: 1, tags: [] }],
      itemsOf("Maybeboard\n1 Sol Ring"),
      COMMANDER,
      "add",
    );
    expect(zones(again.entries)).toEqual(["main:Sol Ring"]);
    expect(again.warnings).toEqual(["Already in the deck, so left out of Maybe: Sol Ring"]);
  });

  it("a Maybe card the paste puts in the deck leaves Maybe quietly, as any add takes it", () => {
    const existing = [
      { cardId: signet.id, zone: "maybeboard", qty: 1, tags: [] },
      { cardId: cover.id, zone: "maybeboard", qty: 1, tags: [] },
    ];
    const { entries, warnings } = applyImport(
      existing,
      itemsOf("1 Arcane Signet"),
      COMMANDER,
      "add",
    );
    expect(zones(entries)).toEqual(["maybeboard:Cover of Darkness", "main:Arcane Signet"]);
    expect(warnings).toEqual([]);
  });

  it("past the save route's 500 lines, new rows are skipped with one warning", () => {
    const existing = Array.from({ length: MAX_ENTRIES - 1 }, (_, i) => ({
      cardId: `m${i}`,
      zone: "maybeboard",
      qty: 1,
      tags: [],
    }));
    const { entries, warnings } = applyImport(
      existing,
      itemsOf("1 Sol Ring\n1 Arcane Signet\n1 Cover of Darkness"),
      COMMANDER,
      "add",
    );
    expect(entries).toHaveLength(MAX_ENTRIES);
    expect(zones(entries.slice(-1))).toEqual(["main:Sol Ring"]);
    expect(warnings).toEqual([
      "A deck can hold 500 lines at most, Maybe and Tokens included: skipped 2 cards (Arcane Signet, Cover of Darkness)",
    ]);
  });

  it("One Piece declares no Maybe: a maybeboard hint is a zone it lacks, as before", () => {
    const lines = [{ rawName: "Sol Ring", qty: 1, zoneHint: "maybeboard" }];
    const items = buildImportItems(OP_STANDARD, lines, resolutions([["Sol Ring", solRing]]));
    expect(items[0].zone).toBeNull();
    expect(applyImport([], items, OP_STANDARD, "add").warnings).toEqual([
      'No "maybeboard" zone in Standard: skipped Sol Ring',
    ]);
  });
});
