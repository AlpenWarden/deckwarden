/**
 * The playable list (DECK-TOKENS): which zones the deck is PLAYED from, and
 * the two readers that make everything downstream token-free —
 * toDeckSnapshot (validate, analyze, the bracket read, the export) and
 * splitLeaderEntries (the groups, the sample hand). One Piece's Leader is
 * the trap the zone census found: it counts toward no size, yet it is played.
 */
import { describe, expect, it } from "vitest";

import { COMMANDER } from "@/lib/games/mtg/formats";
import { atraxa, cardMap, card, legalDeck, lightningBolt } from "@/lib/games/mtg/test-fixtures";
import { mtgAdapter } from "@/lib/games/mtg/adapter";
import { optcgAdapter } from "@/lib/games/optcg/adapter";
import type { BracketFreshness } from "@/lib/games/types";

import { deckSizeCount } from "./editor-state";
import {
  isMaybeZone,
  isPlayableZone,
  maybeZoneOf,
  playableEntries,
  playableZoneIds,
  tokenZoneOf,
} from "./playable";
import { toDeckSnapshot, type SnapshotEntry } from "./validation";
import { splitLeaderEntries } from "./view-model";

const OP_STANDARD = optcgAdapter.formats[0];

describe("the playable list (DECK-TOKENS)", () => {
  it("Magic plays from the command zone and main, never from Tokens", () => {
    expect(playableZoneIds(COMMANDER)).toEqual(["commander", "main"]);
    expect(isPlayableZone(COMMANDER, "tokens")).toBe(false);
    expect(tokenZoneOf(COMMANDER)?.id).toBe("tokens");
  });

  it("One Piece's Leader is played though it counts toward no size; the game has no token zone", () => {
    const leader = OP_STANDARD.zones.find((z) => z.isLeaderZone)!;
    expect(leader.countsTowardSize).toBe(false);
    expect(isPlayableZone(OP_STANDARD, leader.id)).toBe(true);
    expect(playableZoneIds(OP_STANDARD)).toEqual(OP_STANDARD.zones.map((z) => z.id));
    expect(tokenZoneOf(OP_STANDARD)).toBeUndefined();
  });

  it("a zone the format doesn't define stays playable, so ZONE_UNKNOWN still sees it", () => {
    expect(isPlayableZone(COMMANDER, "sideboard")).toBe(true);
    const snapshot = toDeckSnapshot("mtg", COMMANDER, [
      { cardId: "x", zone: "sideboard", qty: 1, tags: [] },
    ]);
    expect(Object.keys(snapshot.zones)).toEqual(["commander", "main", "sideboard"]);
  });

  it("playableEntries keeps order and drops only the tokens", () => {
    const entries = [
      { cardId: "t", zone: "tokens" },
      { cardId: "c", zone: "commander" },
      { cardId: "m", zone: "main" },
    ];
    expect(playableEntries(entries, COMMANDER).map((e) => e.cardId)).toEqual(["c", "m"]);
  });

  it("a legal 100 with not-legal tokens beside it still validates clean, and analyze never counts them", () => {
    const { deck, cards } = legalDeck();
    const treasure = card({
      name: "Treasure",
      primaryType: "Artifact",
      costValue: 0,
      attrs: { type_line: "Token Artifact — Treasure", oracle_text: "", is_token: true },
      legality: [{ status: "not_legal" }],
    });
    const all = new Map([...cards, ...cardMap([treasure])]);
    const entries = [
      ...Object.entries(deck.zones).flatMap(([zone, list]) =>
        list.map((e) => ({ cardId: e.cardId, zone, qty: e.qty, tags: e.tags })),
      ),
      { cardId: treasure.id, zone: "tokens", qty: 7, tags: [] },
    ];
    const snapshot = toDeckSnapshot("mtg", COMMANDER, entries);
    expect(Object.keys(snapshot.zones)).toEqual(["commander", "main"]);
    expect(mtgAdapter.validate(snapshot, all)).toEqual([]);
    // Analytics with seven Treasures beside the 100 are exactly the analytics without them.
    const without = toDeckSnapshot(
      "mtg",
      COMMANDER,
      entries.filter((e) => e.zone !== "tokens"),
    );
    expect(mtgAdapter.analyze(snapshot, all)).toEqual(mtgAdapter.analyze(without, all));
    // The export is the playable list too: no Treasure line.
    expect(mtgAdapter.serializeDecklist(snapshot, all)).not.toContain("Treasure");
  });

  it("One Piece's leader stays in the snapshot (the trap): an empty-leader issue never appears for a full deck", () => {
    const snapshot = toDeckSnapshot("optcg", OP_STANDARD, [
      { cardId: "leader", zone: "leader", qty: 1, tags: [] },
    ]);
    expect(snapshot.zones.leader).toEqual([{ cardId: "leader", qty: 1, tags: [] }]);
  });

  it("splitLeaderEntries sets the tokens aside: the groups and the sample hand read `rest`", () => {
    const { leader, rest, aside } = splitLeaderEntries(
      [
        { cardId: "c", zone: "commander" },
        { cardId: "m", zone: "main" },
        { cardId: "t", zone: "tokens" },
      ],
      COMMANDER,
    );
    expect([leader, rest, aside].map((l) => l.map((e) => e.cardId))).toEqual([["c"], ["m"], ["t"]]);
    const op = splitLeaderEntries([{ cardId: "l", zone: "leader" }], OP_STANDARD);
    expect(op.leader.map((e) => e.cardId)).toEqual(["l"]);
    expect(op.aside).toEqual([]);
  });
});

describe("the Maybe zone (MAYBE-LIST)", () => {
  it("Commander declares it last: counts toward no size, no leader's, holds cards", () => {
    const zone = maybeZoneOf(COMMANDER);
    expect(zone).toEqual({
      id: "maybeboard",
      label: "Maybe",
      min: 0,
      max: null,
      countsTowardSize: false,
      defaultCopyLimit: null,
    });
    expect(COMMANDER.zones.map((z) => z.id)).toEqual(["commander", "main", "tokens", "maybeboard"]);
    // "The first non-leader zone is main" wherever the core looks one up.
    expect(COMMANDER.zones.find((z) => !z.isLeaderZone)?.id).toBe("main");
    expect(isPlayableZone(COMMANDER, "maybeboard")).toBe(false);
    expect(isMaybeZone(COMMANDER, "maybeboard")).toBe(true);
    expect(isMaybeZone(COMMANDER, "tokens")).toBe(false);
    expect(isMaybeZone(COMMANDER, "main")).toBe(false);
    expect(playableZoneIds(COMMANDER)).toEqual(["commander", "main"]);
  });

  it("at most one per format, every adapter's formats read; One Piece has none", () => {
    for (const adapter of [mtgAdapter, optcgAdapter]) {
      for (const format of adapter.formats) {
        const shaped = format.zones.filter(
          (z) => !z.countsTowardSize && !z.isLeaderZone && (z.holds ?? "cards") === "cards",
        );
        expect(shaped.length, `${adapter.id}/${format.code}`).toBeLessThanOrEqual(1);
        expect(maybeZoneOf(format)).toBe(shaped[0]);
      }
    }
    for (const format of optcgAdapter.formats) expect(maybeZoneOf(format)).toBeUndefined();
  });

  it("the token zone is no Maybe zone, and a leader zone that counts toward no size is none either", () => {
    expect(
      maybeZoneOf({ ...COMMANDER, zones: COMMANDER.zones.filter((z) => z.id !== "maybeboard") }),
    ).toBeUndefined();
    const leader = OP_STANDARD.zones.find((z) => z.isLeaderZone)!;
    expect(maybeZoneOf({ ...OP_STANDARD, zones: [leader] })).toBeUndefined();
  });

  it("splitLeaderEntries sets Maybe aside beside the tokens; playableEntries drops it", () => {
    const entries = [
      { cardId: "c", zone: "commander" },
      { cardId: "y", zone: "maybeboard" },
      { cardId: "m", zone: "main" },
      { cardId: "t", zone: "tokens" },
    ];
    const { rest, aside } = splitLeaderEntries(entries, COMMANDER);
    expect(rest.map((e) => e.cardId)).toEqual(["m"]);
    expect(aside.map((e) => e.cardId)).toEqual(["y", "t"]);
    expect(playableEntries(entries, COMMANDER).map((e) => e.cardId)).toEqual(["c", "m"]);
  });

  // THE RISK: a Maybe card counted, validated or read is a wrong deck. A
  // legal 100 plus a banned card, an off-color card, a Game Changer and a
  // 101st copy in Maybe reads exactly as the 100 alone everywhere the
  // deck is read as played.
  const banned = card({
    name: "Banned Thing",
    primaryType: "Artifact",
    costValue: 3,
    legality: [{ status: "banned" }],
  });
  const gameChanger = card({
    name: "Rhystic Study",
    primaryType: "Enchantment",
    costValue: 3,
    colorsMask: 2,
    ciMask: 2,
    attrs: { type_line: "Enchantment", oracle_text: "", game_changer: true },
  });
  const offColor = lightningBolt;
  const withMaybe = () => {
    const { deck, cards } = legalDeck();
    const entries: SnapshotEntry[] = Object.entries(deck.zones).flatMap(([zone, list]) =>
      list.map((e) => ({ cardId: e.cardId, zone, qty: e.qty, tags: e.tags })),
    );
    const all = new Map([...cards, ...cardMap([banned, gameChanger, offColor])]);
    const maybe: SnapshotEntry[] = [
      { cardId: banned.id, zone: "maybeboard", qty: 1, tags: [] },
      { cardId: offColor.id, zone: "maybeboard", qty: 1, tags: [] },
      { cardId: gameChanger.id, zone: "maybeboard", qty: 1, tags: [] },
      // A second copy of a singleton the deck already plays (Sol Ring is in the 100).
      {
        cardId: [...cards.values()].find((c) => c.name === "Sol Ring")!.id,
        zone: "maybeboard",
        qty: 1,
        tags: [],
      },
    ];
    return { entries, maybe, all };
  };
  const FRESH: BracketFreshness = {
    readAt: "2026-10-02T12:00:00.000Z",
    feeds: {
      gameChangers: { state: "ok", asOf: "2026-10-02T04:54:15.655Z" },
      landDenial: { state: "ok", asOf: "2026-10-02T04:54:15.655Z" },
      extraTurns: { state: "ok", asOf: "2026-10-02T04:54:15.655Z" },
      combos: { state: "ok", asOf: "2026-10-02T04:55:53.189Z" },
    },
  };

  it("a banned, an off-color and a duplicate card in Maybe raise no issue, and the size stays 100", () => {
    const { entries, maybe, all } = withMaybe();
    const snapshot = toDeckSnapshot("mtg", COMMANDER, [...entries, ...maybe]);
    expect(Object.keys(snapshot.zones)).toEqual(["commander", "main"]);
    expect(mtgAdapter.validate(snapshot, all)).toEqual([]);
    expect(deckSizeCount([...entries, ...maybe], COMMANDER)).toBe(100);
    expect(deckSizeCount(entries, COMMANDER)).toBe(100);
    // The commander is Atraxa (WUBG): the off-color card would be an issue in the deck.
    expect(atraxa.ciMask & offColor.ciMask).toBe(0);
    const inDeck = toDeckSnapshot("mtg", COMMANDER, [
      ...entries,
      { cardId: offColor.id, zone: "main", qty: 1, tags: [] },
    ]);
    expect(mtgAdapter.validate(inDeck, all).length).toBeGreaterThan(0);
  });

  it("analytics, the export and the bracket read ignore Maybe", () => {
    const { entries, maybe, all } = withMaybe();
    const snapshot = toDeckSnapshot("mtg", COMMANDER, [...entries, ...maybe]);
    const without = toDeckSnapshot("mtg", COMMANDER, entries);
    expect(mtgAdapter.analyze(snapshot, all)).toEqual(mtgAdapter.analyze(without, all));
    expect(mtgAdapter.serializeDecklist(snapshot, all)).toBe(
      mtgAdapter.serializeDecklist(without, all),
    );
    expect(mtgAdapter.serializeDecklist(snapshot, all)).not.toContain("Banned Thing");
    const read = (deck: typeof snapshot) =>
      mtgAdapter.brackets!.assess({ deck, cards: all, combos: [], freshness: FRESH });
    expect(read(snapshot)).toEqual(read(without));
    // The Game Changer would move the read if it took the last filler's slot in the deck.
    const withGc = toDeckSnapshot("mtg", COMMANDER, [
      ...entries.slice(0, -1),
      { cardId: gameChanger.id, zone: "main", qty: 1, tags: [] },
    ]);
    expect(read(withGc)).not.toEqual(read(without));
  });
});
