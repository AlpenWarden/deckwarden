/**
 * PRECON-CHANGES' pure core: what a deck started from a precon changed from
 * the box, per identity over the counted zones; the row marks' input; the
 * cost of the cards to add; the copied text. And the two agreements the
 * feature is checked against: the ownership line's "missing" (one number by
 * two paths) and History's "Your changes since forking" (two engines).
 */
import { describe, expect, it } from "vitest";

import { deckOwnership } from "@/lib/collection/ownership";
import { diffDeckLists, type DeckDiff, type FrozenCard } from "@/lib/decks/diff";
import { COMMANDER } from "@/lib/games/mtg/formats";

import {
  beyondPrecon,
  hasPreconChanges,
  preconAddCost,
  preconChanges,
  preconChangesText,
  type PreconChanges,
} from "./precon-changes";
import { ownedPreconCopies, preconCards } from "./precon-owned";

type Row = { cardId: string; zone: string; qty: number };
const row = (cardId: string, qty = 1, zone = "main"): Row => ({ cardId, zone, qty });

/** A small precon: a commander, a second legend, three spells and twelve Forests. */
const BOX: Row[] = [
  row("cmdr", 1, "commander"),
  row("partner"),
  row("divination"),
  row("mind-stone"),
  row("cultivate"),
  row("forest", 12),
];
const PRECON = preconCards(BOX, COMMANDER);
const NONE: PreconChanges = { out: [], in: [], outQty: 0, inQty: 0 };

const swap = (list: Row[], outId: string, inId: string): Row[] =>
  list.map((r) => (r.cardId === outId ? { ...r, cardId: inId } : r));

describe("preconChanges — the difference from the box, per identity", () => {
  it("the precon's own list shows no changes, whatever order its rows are in", () => {
    expect(preconChanges(PRECON, BOX, COMMANDER)).toEqual(NONE);
    expect(preconChanges(PRECON, [...BOX].reverse(), COMMANDER)).toEqual(NONE);
    expect(hasPreconChanges(preconChanges(PRECON, BOX, COMMANDER))).toBe(false);
  });

  it("12 Forests to 14 is Forest × 2 in; to 10 is Forest × 2 out", () => {
    const more = BOX.map((r) => (r.cardId === "forest" ? { ...r, qty: 14 } : r));
    expect(preconChanges(PRECON, more, COMMANDER)).toEqual({
      out: [],
      in: [{ cardId: "forest", qty: 2 }],
      outQty: 0,
      inQty: 2,
    });
    const fewer = BOX.map((r) => (r.cardId === "forest" ? { ...r, qty: 10 } : r));
    expect(preconChanges(PRECON, fewer, COMMANDER)).toEqual({
      out: [{ cardId: "forest", qty: 2 }],
      in: [],
      outQty: 2,
      inQty: 0,
    });
  });

  it("a swap is one card out and one in, and both counts move", () => {
    const changes = preconChanges(PRECON, swap(BOX, "divination", "rhystic-study"), COMMANDER);
    expect(changes).toEqual({
      out: [{ cardId: "divination", qty: 1 }],
      in: [{ cardId: "rhystic-study", qty: 1 }],
      outQty: 1,
      inQty: 1,
    });
    expect(hasPreconChanges(changes)).toBe(true);
  });

  it("a card cut and added back is no change; the Undo of a swap is no change", () => {
    const cut = BOX.filter((r) => r.cardId !== "mind-stone");
    expect(preconChanges(PRECON, cut, COMMANDER).out).toEqual([{ cardId: "mind-stone", qty: 1 }]);
    expect(preconChanges(PRECON, [...cut, row("mind-stone")], COMMANDER)).toEqual(NONE);
    const swapped = swap(BOX, "divination", "rhystic-study");
    expect(preconChanges(PRECON, swap(swapped, "rhystic-study", "divination"), COMMANDER)).toEqual(
      NONE,
    );
  });

  it("the two partners trading places is no change: a move between counted zones", () => {
    const traded = BOX.map((r) =>
      r.cardId === "cmdr"
        ? { ...r, zone: "main" }
        : r.cardId === "partner"
          ? { ...r, zone: "commander" }
          : r,
    );
    expect(preconChanges(PRECON, traded, COMMANDER)).toEqual(NONE);
  });

  it("tokens are never read: the Tokens zone counts toward no size", () => {
    const withTokens = [...BOX, row("treasure", 3, "tokens"), row("forest", 2, "tokens")];
    expect(preconChanges(PRECON, withTokens, COMMANDER)).toEqual(NONE);
    // And a precon row in the token zone (the wire never carries one) is no card of the box.
    expect(
      preconChanges(
        preconCards([...BOX, row("saproling", 2, "tokens")], COMMANDER),
        BOX,
        COMMANDER,
      ),
    ).toEqual(NONE);
  });

  it("copies split over two counted zones are one identity", () => {
    // The commander zone holds one Forest-like copy and the main list the rest.
    const split = [
      ...BOX.filter((r) => r.cardId !== "forest"),
      row("forest", 5),
      row("forest", 7, "commander"),
    ];
    expect(preconChanges(PRECON, split, COMMANDER)).toEqual(NONE);
  });

  it("a new commander: the old one out, the new one in", () => {
    const next = BOX.map((r) => (r.cardId === "cmdr" ? { ...r, cardId: "atraxa" } : r));
    expect(preconChanges(PRECON, next, COMMANDER)).toEqual({
      out: [{ cardId: "cmdr", qty: 1 }],
      in: [{ cardId: "atraxa", qty: 1 }],
      outQty: 1,
      inQty: 1,
    });
  });

  it("an empty list takes the whole box out; an empty precon adds the whole list", () => {
    const all = preconChanges(PRECON, [], COMMANDER);
    expect(all.in).toEqual([]);
    expect(all.outQty).toBe(17);
    expect(all.out).toEqual(PRECON);
    const from = preconChanges([], BOX, COMMANDER);
    expect(from.out).toEqual([]);
    expect(from.in).toEqual(PRECON);
    expect(from.inQty).toBe(17);
  });

  it("both lists are sorted by id, and a duplicate precon row adds its copies", () => {
    const changes = preconChanges(
      [
        { cardId: "forest", qty: 6 },
        { cardId: "forest", qty: 6 },
        { cardId: "b", qty: 1 },
        { cardId: "a", qty: 1 },
      ],
      [row("forest", 12), row("z"), row("y")],
      COMMANDER,
    );
    expect(changes.out.map((c) => c.cardId)).toEqual(["a", "b"]);
    expect(changes.in.map((c) => c.cardId)).toEqual(["y", "z"]);
  });

  it("the counts need not match: a card cut with nothing in its place", () => {
    const changes = preconChanges(
      PRECON,
      BOX.filter((r) => r.cardId !== "cultivate"),
      COMMANDER,
    );
    expect([changes.outQty, changes.inQty]).toEqual([1, 0]);
  });
});

describe("beyondPrecon — the row marks' input", () => {
  it("identity to the copies the list holds beyond the precon's; null with nothing beyond", () => {
    expect(beyondPrecon(preconChanges(PRECON, BOX, COMMANDER))).toBeNull();
    const list = swap(BOX, "divination", "rhystic-study").map((r) =>
      r.cardId === "forest" ? { ...r, qty: 14 } : r,
    );
    expect(beyondPrecon(preconChanges(PRECON, list, COMMANDER))).toEqual(
      new Map([
        ["forest", 2],
        ["rhystic-study", 1],
      ]),
    );
  });
});

describe("preconAddCost — what the cards to add cost", () => {
  const prices = new Map<string, { cheapestUsd: number | null }>([
    ["rhystic-study", { cheapestUsd: 66.76 }],
    ["cyclonic-rift", { cheapestUsd: 29.57 }],
    ["smothering-tithe", { cheapestUsd: 52.77 }],
    ["forest", { cheapestUsd: 0.1 }],
    ["mystery", { cheapestUsd: null }],
  ]);
  const added = [
    { cardId: "cyclonic-rift", qty: 1 },
    { cardId: "forest", qty: 2 },
    { cardId: "mystery", qty: 1 },
    { cardId: "rhystic-study", qty: 1 },
    { cardId: "smothering-tithe", qty: 1 },
  ];

  it("copies × cheapest printing, to the cent; unpriced copies counted and left out", () => {
    expect(preconAddCost(added, prices, null)).toEqual({
      usd: 149.3,
      owned: 0,
      unpriced: 1,
      total: 6,
    });
  });

  it("a collection's identities cost nothing, every copy of them", () => {
    expect(preconAddCost(added, prices, new Set(["rhystic-study", "forest", "mystery"]))).toEqual({
      usd: 82.34,
      owned: 4,
      unpriced: 0,
      total: 6,
    });
  });

  it("a card the map has never seen is unpriced, never $0; nothing to add costs nothing", () => {
    expect(preconAddCost([{ cardId: "unseen", qty: 2 }], prices, null)).toEqual({
      usd: 0,
      owned: 0,
      unpriced: 2,
      total: 2,
    });
    expect(preconAddCost([], prices, null)).toEqual({ usd: 0, owned: 0, unpriced: 0, total: 0 });
  });

  it("sums in cents: thirty cards at $0.10 are $3.00, not $3.0000000000000004", () => {
    const dimes = Array.from({ length: 30 }, (_, i) => ({ cardId: `d${i}`, qty: 1 }));
    const map = new Map(dimes.map((d) => [d.cardId, { cheapestUsd: 0.1 }]));
    expect(preconAddCost(dimes, map, null).usd).toBe(3);
  });
});

describe("one number: the sheet's cost is the ownership line's missing, with the precon owned", () => {
  const cards = new Map<string, { cheapestUsd: number | null }>([
    ["cmdr", { cheapestUsd: 4.5 }],
    ["partner", { cheapestUsd: 1.25 }],
    ["divination", { cheapestUsd: 0.05 }],
    ["mind-stone", { cheapestUsd: 0.35 }],
    ["cultivate", { cheapestUsd: 0.6 }],
    ["forest", { cheapestUsd: 0.1 }],
    ["rhystic-study", { cheapestUsd: 66.76 }],
    ["cyclonic-rift", { cheapestUsd: 29.57 }],
    ["smothering-tithe", { cheapestUsd: 52.77 }],
    ["mystery", { cheapestUsd: null }],
    ["atraxa", { cheapestUsd: 12.34 }],
  ]);
  const copies = ownedPreconCopies({ owns: true, cards: PRECON })!;
  const upgraded = swap(
    swap(swap(BOX, "divination", "rhystic-study"), "mind-stone", "cyclonic-rift"),
    "cultivate",
    "smothering-tithe",
  );
  const LISTS: [string, Row[]][] = [
    ["the precon unchanged", BOX],
    ["three staples in (PRECON-OWNED's $149.10)", upgraded],
    ["14 Forests", BOX.map((r) => (r.cardId === "forest" ? { ...r, qty: 14 } : r))],
    ["10 Forests", BOX.map((r) => (r.cardId === "forest" ? { ...r, qty: 10 } : r))],
    ["an unpriced card in", swap(BOX, "divination", "mystery")],
    ["a new commander", BOX.map((r) => (r.cardId === "cmdr" ? { ...r, cardId: "atraxa" } : r))],
    ["a cut and nothing in", BOX.filter((r) => r.cardId !== "cultivate")],
    ["the partners trading places", [row("cmdr"), row("partner", 1, "commander"), ...BOX.slice(2)]],
    ["everything at once", [...upgraded, row("mystery"), row("forest", 3, "commander")]],
  ];

  it.each(LISTS)("no collection — %s", (_name, list) => {
    const line = deckOwnership(list, cards, new Set(), COMMANDER, copies);
    const cost = preconAddCost(preconChanges(PRECON, list, COMMANDER).in, cards, null);
    expect(cost.usd).toBe(line.missingUsd);
    expect(cost.total - cost.owned).toBe(line.totalQty - line.ownedQty);
  });

  it.each(LISTS)("a collection too — %s", (_name, list) => {
    const collection = new Set(["rhystic-study", "forest", "mystery"]);
    const line = deckOwnership(list, cards, collection, COMMANDER, copies);
    const cost = preconAddCost(preconChanges(PRECON, list, COMMANDER).in, cards, collection);
    expect(cost.usd).toBe(line.missingUsd);
    expect(cost.total - cost.owned).toBe(line.totalQty - line.ownedQty);
  });

  it("the fixture's figure: Rhystic Study, Cyclonic Rift and Smothering Tithe are $149.10", () => {
    expect(preconAddCost(preconChanges(PRECON, upgraded, COMMANDER).in, cards, null).usd).toBe(
      149.1,
    );
  });
});

describe("two engines: the lists equal History's 'Your changes since forking', folded per identity", () => {
  const frozen = (rows: Row[]): FrozenCard[] =>
    rows.map((r) => ({ ...r, tags: [], printingId: null }));
  /** History's diff as copies per identity over the counted zones: below zero is out, above is in. */
  function fold(diff: DeckDiff): PreconChanges {
    const counted = new Set(COMMANDER.zones.filter((z) => z.countsTowardSize).map((z) => z.id));
    const net = new Map<string, number>();
    const add = (cardId: string, zone: string, by: number) => {
      if (counted.has(zone)) net.set(cardId, (net.get(cardId) ?? 0) + by);
    };
    for (const e of diff.added) add(e.cardId, e.zone, e.qty);
    for (const e of diff.removed) add(e.cardId, e.zone, -e.qty);
    for (const e of diff.qtyChanged) add(e.cardId, e.zone, e.to - e.from);
    for (const m of diff.moved) {
      add(m.cardId, m.fromZone, -m.qty);
      add(m.cardId, m.toZone, m.qty);
    }
    const side = (sign: 1 | -1) =>
      [...net]
        .filter(([, n]) => n * sign > 0)
        .map(([cardId, n]) => ({ cardId, qty: n * sign }))
        .sort((a, b) => (a.cardId < b.cardId ? -1 : 1));
    const out = side(-1);
    const added = side(1);
    const qty = (list: { qty: number }[]) => list.reduce((n, c) => n + c.qty, 0);
    return { out, in: added, outQty: qty(out), inQty: qty(added) };
  }

  const LISTS: [string, Row[]][] = [
    ["unchanged", BOX],
    ["a swap", swap(BOX, "divination", "rhystic-study")],
    ["more and fewer copies", BOX.map((r) => (r.cardId === "forest" ? { ...r, qty: 15 } : r))],
    ["the partners trading places", [row("cmdr"), row("partner", 1, "commander"), ...BOX.slice(2)]],
    [
      "a commander moved to the main list beside a new one",
      [row("atraxa", 1, "commander"), row("cmdr"), ...BOX.slice(1)],
    ],
    ["tokens added", [...BOX, row("treasure", 3, "tokens")]],
    [
      "a split, a cut and three cards in",
      [
        row("cmdr", 1, "commander"),
        row("forest", 4, "commander"),
        row("forest", 6),
        row("rhystic-study"),
        row("cyclonic-rift"),
        row("smothering-tithe"),
      ],
    ],
  ];

  it.each(LISTS)("%s", (_name, list) => {
    expect(preconChanges(PRECON, list, COMMANDER)).toEqual(
      fold(diffDeckLists(frozen(BOX), frozen(list))),
    );
  });
});

describe("preconChangesText — Copy as text, the export's grammar", () => {
  const names = new Map([
    ["divination", "Divination"],
    ["mind-stone", "Mind Stone"],
    ["rhystic-study", "Rhystic Study"],
    ["arcane-signet", "Arcane Signet"],
    ["forest", "Forest"],
  ]);
  const nameOf = (id: string) => names.get(id);
  const HEADINGS = { out: "Take out", in: "Add" };

  it("two headed blocks of `1 Name` lines, A to Z, a blank line between, a final newline", () => {
    expect(
      preconChangesText(
        {
          out: [
            { cardId: "mind-stone", qty: 1 },
            { cardId: "divination", qty: 1 },
          ],
          in: [
            { cardId: "rhystic-study", qty: 1 },
            { cardId: "forest", qty: 2 },
            { cardId: "arcane-signet", qty: 1 },
          ],
        },
        nameOf,
        HEADINGS,
      ),
    ).toBe(
      "Take out\n1 Divination\n1 Mind Stone\n\nAdd\n1 Arcane Signet\n2 Forest\n1 Rhystic Study\n",
    );
  });

  it("a side with nothing in it has no block; no changes is no text", () => {
    expect(
      preconChangesText({ out: [], in: [{ cardId: "forest", qty: 2 }] }, nameOf, HEADINGS),
    ).toBe("Add\n2 Forest\n");
    expect(
      preconChangesText({ out: [{ cardId: "divination", qty: 1 }], in: [] }, nameOf, HEADINGS),
    ).toBe("Take out\n1 Divination\n");
    expect(preconChangesText({ out: [], in: [] }, nameOf, HEADINGS)).toBe("");
  });

  it("null while a card has no name yet: a half-named list is never copied", () => {
    expect(
      preconChangesText(
        { out: [{ cardId: "unseen", qty: 1 }], in: [{ cardId: "forest", qty: 2 }] },
        nameOf,
        HEADINGS,
      ),
    ).toBeNull();
  });
});
