// @vitest-environment node
/**
 * The card wire by identity id (W9a) and its back flag (CARD-FLIP-EDITOR):
 * `hasBack: true` rides only on a card whose default printing has a back
 * face, after `image`; every other card's wire is, byte for byte, the wire
 * it always was. Through the real drizzle builders over a fake postgres.js
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

const { loadCardWires, toWire } = await import("./wire");
type WireRow = Parameters<typeof toWire>[0];

const PRINTING = "3e97c609-3932-4428-96d4-1c97e61f0abb";
const ETALI = "131662c3-2d6b-46fb-b507-fe2f80485a33";
const SIGNET = "eeefb0f4-69e3-4cc5-a66b-4da36d0be35c";

/** A wireSelect row in its select order; `hasBack` is the last column. */
function row(
  id: string,
  name: string,
  printingId: string | null,
  hasBack: boolean | null,
): unknown[] {
  return [
    id,
    name,
    name.toLowerCase(),
    `key-${id}`,
    "Creature",
    7,
    8,
    8,
    "1.50",
    812,
    true,
    false,
    { type_line: "Legendary Creature" },
    printingId,
    null,
    hasBack,
  ];
}

const plainRow: WireRow = {
  id: SIGNET,
  name: "Arcane Signet",
  nameNorm: "arcane signet",
  externalKey: "key-signet",
  primaryType: "Artifact",
  costValue: 2,
  colorsMask: 0,
  ciMask: 0,
  cheapestUsd: "0.79",
  popularity: 2,
  isLeaderCandidate: false,
  isPreview: false,
  attrs: { type_line: "Artifact" },
  printingId: PRINTING,
  imageOverride: null,
  hasBack: false,
};

beforeEach(() => {
  statements = [];
  answers = [];
});

describe("toWire", () => {
  it("a single-faced card's wire is the wire it always was: no hasBack key, image last", () => {
    const wire = toWire(plainRow, new Map());
    expect(JSON.stringify(wire)).toBe(
      JSON.stringify({
        id: SIGNET,
        name: "Arcane Signet",
        externalKey: "key-signet",
        primaryType: "Artifact",
        costValue: 2,
        colorsMask: 0,
        ciMask: 0,
        popularity: 2,
        isLeaderCandidate: false,
        isPreview: false,
        attrs: { type_line: "Artifact" },
        cheapestUsd: 0.79,
        legality: [],
        image: `https://cards.scryfall.io/normal/front/3/e/${PRINTING}.jpg`,
      }),
    );
  });

  it("a printing with a back adds hasBack: true after image, and nothing else", () => {
    const sided = toWire({ ...plainRow, hasBack: true }, new Map());
    expect(Object.keys(sided).slice(-2)).toEqual(["image", "hasBack"]);
    expect(sided.hasBack).toBe(true);
    // JSON drops an undefined key: without the flag it is the plain wire.
    expect(JSON.stringify({ ...sided, hasBack: undefined })).toBe(
      JSON.stringify(toWire(plainRow, new Map())),
    );
  });

  it("no printing (the LEFT JOIN's null) is no image and no flag", () => {
    const bare = toWire({ ...plainRow, printingId: null, hasBack: null }, new Map());
    expect(bare.image).toBeNull();
    expect(bare).not.toHaveProperty("hasBack");
  });
});

describe("loadCardWires", () => {
  it("reads the default printing's has_back in the statement it already ran, and flags only that card", async () => {
    answers = [
      [
        row(ETALI, "Etali, Primal Conqueror", PRINTING, true),
        row(SIGNET, "Arcane Signet", PRINTING, false),
      ],
      [],
    ];
    const wires = await loadCardWires([ETALI, SIGNET], 1);
    expect(statements).toHaveLength(2);
    expect(statements[0].sql).toContain(
      `"card_printings"."id", "card_printings"."image_override", "card_printings"."has_back" from "card_identities" left join "card_printings" on ("card_printings"."card_identity_id" = "card_identities"."id" and "card_printings"."is_default" = $1)`,
    );
    expect(wires.map((w) => [w.name, w.hasBack])).toEqual([
      ["Etali, Primal Conqueror", true],
      ["Arcane Signet", undefined],
    ]);
    expect(wires[1]).not.toHaveProperty("hasBack");
  });
});
