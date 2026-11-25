// @vitest-environment node
/**
 * GET /api/decks/[id]/recommendations (Y6a, WAVE4 D7) over mocked IO: what
 * the ROUTE decides about goals. The deck's goals come off the row it
 * already loads — the owner's whole (target, budget, answers), a visitor's
 * public subset only (the target: the budget and the answers are the
 * owner's, so a visitor's list is never shaped by them) — and the answer
 * carries the engine's `hidden` and `combosTruncated` beside the list.
 *
 * `?owned=1` (P3.7, as OWNED-FILTER left it): the route asks only whether
 * the session's player has a collection and hands the engine the player —
 * never a set of card ids — and a guest or a player with none gets the hook
 * off and the reason, never an emptied list.
 */
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireReadableDeck: vi.fn(),
  recommendForDeck: vi.fn(),
  enforceRateLimit: vi.fn(),
  getSessionUserId: vi.fn(),
  hasCollection: vi.fn(),
}));

vi.mock("@/lib/decks/route-helpers", () => ({ requireReadableDeck: mocks.requireReadableDeck }));
vi.mock("@/lib/recommend/engine", () => ({
  MAX_LIMIT: 50,
  recommendForDeck: mocks.recommendForDeck,
}));
vi.mock("@/lib/auth", () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock("@/lib/collection/owned", () => ({ hasCollection: mocks.hasCollection }));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  enforceRateLimit: mocks.enforceRateLimit,
}));

const { GET } = await import("./route");

const GOALS = {
  v: 1,
  targetLevel: 2,
  budget: { perCardUsd: 5 },
  answers: { rulesetVersion: 1, play: { fast: "no" } },
  exceptions: "One Game Changer, ask me",
};
const DECK = { id: "deck-1", gameId: 1, formatId: 1, ciMask: 0, leaderIds: [], goals: GOALS };
const REC = { cardId: "c1", name: "Arcane Signet", conflicts: [] };
const HIDDEN = { cardId: "c2", name: "Rhystic Study", conflicts: [{ severity: "hide" }] };

async function get(query = "") {
  const res = await GET(
    new NextRequest(`http://localhost/api/decks/deck-1/recommendations${query}`),
    {
      params: Promise.resolve({ id: "deck-1" }),
    } as never,
  );
  return { res, body: await res.json() };
}

beforeEach(() => {
  for (const m of Object.values(mocks)) m.mockReset();
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.recommendForDeck.mockResolvedValue({
    recommendations: [REC],
    hidden: [HIDDEN],
    combosTruncated: true,
  });
});

describe("GET /api/decks/[id]/recommendations — goals (Y6a)", () => {
  it("the owner: every goal the check reads, off the row; the answer adds hidden and combosTruncated, no-store", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: DECK, isOwner: true });
    const { res, body } = await get("?budget=5");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(mocks.recommendForDeck).toHaveBeenCalledWith(DECK, {
      maxPriceUsd: 5,
      limit: undefined,
      ownedBy: undefined,
      goals: GOALS,
    });
    expect(body).toEqual({
      deckId: "deck-1",
      count: 1,
      owned: { requested: false, applied: false },
      recommendations: [REC],
      hidden: [HIDDEN],
      combosTruncated: true,
    });
  });

  it("a visitor: the public target only — never the owner's budget or answers", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: DECK, isOwner: false });
    await get();
    expect(mocks.recommendForDeck.mock.calls[0][1].goals).toEqual({
      v: 1,
      targetLevel: 2,
      exceptions: "One Game Changer, ask me",
    });
  });

  it("no goals on the row: none applied, for anyone", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: { ...DECK, goals: null }, isOwner: true });
    await get();
    expect(mocks.recommendForDeck.mock.calls[0][1].goals).toBeNull();
  });

  it("the read contract holds: a private deck's 404 (the unknown id's answer) comes before any engine work", async () => {
    mocks.requireReadableDeck.mockResolvedValue(
      NextResponse.json({ error: "Deck not found" }, { status: 404 }),
    );
    const { res } = await get();
    expect(res.status).toBe(404);
    expect(mocks.recommendForDeck).not.toHaveBeenCalled();
  });
});

describe("GET /api/decks/[id]/recommendations — ?owned=1 (P3.7, OWNED-FILTER)", () => {
  const PLAYER = "00000000-0000-4000-8000-0000000000aa";

  it("a player with a collection: the engine gets the player, the answer says applied", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: DECK, isOwner: true, userId: PLAYER });
    mocks.hasCollection.mockResolvedValue(true);
    const { body } = await get("?owned=1");
    expect(mocks.hasCollection).toHaveBeenCalledTimes(1);
    expect(mocks.hasCollection).toHaveBeenCalledWith(PLAYER);
    expect(mocks.recommendForDeck.mock.calls[0][1].ownedBy).toBe(PLAYER);
    expect(body.owned).toEqual({ requested: true, applied: true });
  });

  it("the collection is the session's, not the deck owner's: a visitor's own cards filter a deck they can read", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: DECK, isOwner: false, userId: PLAYER });
    mocks.hasCollection.mockResolvedValue(true);
    await get("?owned=true");
    expect(mocks.recommendForDeck.mock.calls[0][1].ownedBy).toBe(PLAYER);
  });

  it("a player with no collection: the hook stays off and the answer says why — never an emptied list", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: DECK, isOwner: true, userId: PLAYER });
    mocks.hasCollection.mockResolvedValue(false);
    const { body } = await get("?owned=1");
    expect(mocks.recommendForDeck.mock.calls[0][1].ownedBy).toBeUndefined();
    expect(body.owned).toEqual({ requested: true, applied: false, reason: "no-collection" });
    expect(body.recommendations).toEqual([REC]);
  });

  it("signed out: the hook stays off, the reason is signed-out, and the collection is never asked about", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: DECK, isOwner: false, userId: null });
    const { body } = await get("?owned=1");
    expect(mocks.hasCollection).not.toHaveBeenCalled();
    expect(mocks.recommendForDeck.mock.calls[0][1].ownedBy).toBeUndefined();
    expect(body.owned).toEqual({ requested: true, applied: false, reason: "signed-out" });
  });

  it("not asked for: no collection read at all, even for a player who has one", async () => {
    mocks.requireReadableDeck.mockResolvedValue({ deck: DECK, isOwner: true, userId: PLAYER });
    mocks.hasCollection.mockResolvedValue(true);
    for (const query of ["", "?owned=0", "?owned=false"]) {
      const { body } = await get(query);
      expect(body.owned).toEqual({ requested: false, applied: false });
    }
    expect(mocks.hasCollection).not.toHaveBeenCalled();
    expect(mocks.recommendForDeck.mock.calls.every(([, opts]) => opts.ownedBy === undefined)).toBe(
      true,
    );
  });
});
