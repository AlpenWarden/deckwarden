// @vitest-environment node
/**
 * A deck's entries on the wire (P1.7) and their back flag (CARD-FLIP-EDITOR):
 * `hasBack: true` rides only on a card whose SHOWN printing has a back face,
 * which is the chosen printing's flag when the entry has one and the default
 * printing's otherwise, after `image`. An entry without one has the keys it
 * always had. Through the real drizzle builders over a fake postgres.js
 * client (the route-test pattern).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as schema from "@/db/schema";

interface Statement {
  sql: string;
  params: unknown[];
}
let statements: Statement[] = [];
let answers: unknown[][][] = [];

const fakeClient = {
  options: { parsers: {}, serializers: {} },
  unsafe(sql: string, params: unknown[]) {
    statements.push({ sql, params });
    const rows = answers.shift() ?? [];
    return { values: async () => rows, then: undefined };
  },
};
const fakeDb = drizzle(fakeClient as never, { schema });

vi.mock("@/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/db")>()),
  getDb: () => fakeDb,
}));

const { fetchDeckCardsWire } = await import("./deck-cards-wire");

const DECK = { id: "11111111-1111-4111-8111-111111111111", formatId: 1 };
const SOL = "459562ce-8045-4d49-98d6-943034aa44af";
const ETALI = "131662c3-2d6b-46fb-b507-fe2f80485a33";
const SIGNET = "eeefb0f4-69e3-4cc5-a66b-4da36d0be35c";
const P = {
  sld1512: "d74a72a2-d46a-41c2-a400-70571197b020",
  plain: "8ee443cc-e17a-493b-9c93-1f9e141a30e4",
  etaliDefault: "3e97c609-3932-4428-96d4-1c97e61f0abb",
  signetDefault: "0f4a1bc1-0d2b-4d5c-8b56-6d0e58a1c7aa",
  solDefault: "83f43730-1c1f-4150-8771-d901c54bedc4",
};

/** An entry row in the select's order; the chosen printing's override and flag come last. */
function entry(
  cardId: string,
  name: string,
  zone: string,
  printingId: string | null,
  chosenHasBack: boolean | null,
): unknown[] {
  return [
    cardId,
    zone,
    1,
    [],
    printingId,
    name,
    `key-${cardId}`,
    "Artifact",
    1,
    0,
    0,
    false,
    false,
    "0.50",
    1,
    { type_line: "Artifact" },
    null,
    chosenHasBack,
  ];
}

beforeEach(() => {
  statements = [];
  answers = [];
});

describe("fetchDeckCardsWire", () => {
  it("the chosen printing's flag when an entry has one, the default printing's otherwise; no key without a back", async () => {
    answers = [
      [
        entry(ETALI, "Etali, Primal Conqueror", "commander", null, null),
        entry(SIGNET, "Arcane Signet", "main", null, null),
        // A single-faced card on a chosen two-sided printing (Sol Ring, SLD 1512).
        entry(SOL, "Sol Ring", "main", P.sld1512, true),
      ],
      // The format's legality exceptions (the async function reaches the client first).
      [],
      // The defaults, for the entries that chose none: Etali's has a back.
      [
        [ETALI, P.etaliDefault, null, true],
        [SIGNET, P.signetDefault, null, false],
        [SOL, P.solDefault, null, false],
      ],
    ];
    const cards = await fetchDeckCardsWire(DECK);
    expect(statements).toHaveLength(3);
    expect(statements[0].sql).toContain(
      `"card_printings"."image_override", "card_printings"."has_back" from "deck_cards"`,
    );
    expect(statements[1].sql).toContain(`from "legalities"`);
    expect(statements[2].sql).toContain(
      `select "card_printings"."card_identity_id", "card_printings"."id", "card_printings"."image_override", "card_printings"."has_back" from "card_printings"`,
    );

    const [etali, signet, sol] = cards.map((c) => c.card);
    expect(etali.image).toBe(`https://cards.scryfall.io/normal/front/3/e/${P.etaliDefault}.jpg`);
    expect(etali.hasBack).toBe(true);
    expect(Object.keys(etali).slice(-2)).toEqual(["image", "hasBack"]);

    expect(signet).not.toHaveProperty("hasBack");
    expect(Object.keys(signet)).toEqual([
      "id",
      "name",
      "externalKey",
      "primaryType",
      "costValue",
      "colorsMask",
      "ciMask",
      "isLeaderCandidate",
      "isPreview",
      "cheapestUsd",
      "popularity",
      "attrs",
      "legality",
      "image",
    ]);

    // The chosen printing decides, not the default: SLD 1512 has a back.
    expect(sol.image).toBe(`https://cards.scryfall.io/normal/front/d/7/${P.sld1512}.jpg`);
    expect(sol.hasBack).toBe(true);
  });

  it("a chosen single-faced printing of a card whose default has a back carries no flag", async () => {
    answers = [[entry(SOL, "Sol Ring", "main", P.plain, false)], []];
    const [only] = await fetchDeckCardsWire(DECK);
    // Every entry chose a printing: the defaults are never asked for.
    expect(statements).toHaveLength(2);
    expect(statements[1].sql).toContain(`from "legalities"`);
    expect(only.card.image).toBe(`https://cards.scryfall.io/normal/front/8/e/${P.plain}.jpg`);
    expect(only.card).not.toHaveProperty("hasBack");
    expect(only.printingId).toBe(P.plain);
  });
});
