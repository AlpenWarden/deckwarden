/**
 * The Cut Coach and the Tokens zone (DECK-TOKENS): over the maximum, the
 * ranked cuts come from the playable list only — cutting a token never
 * brings the 100 down, so a deck holding tokens is never offered one. The
 * pure ranking runs with no deck id, so no request is involved.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EditorCard, EditorEntry } from "@/lib/decks/editor-state";
import { COMMANDER } from "@/lib/games/mtg/formats";
import { basicLands, card, fillers } from "@/lib/games/mtg/test-fixtures";
import { getAdapter } from "@/lib/games/registry";

import { CutCoachPanel } from "./cut-coach-panel";

const mtg = getAdapter("mtg");
const editorCard = (c: ReturnType<typeof card>): EditorCard => ({ ...c, image: null });

describe("CutCoachPanel — the Tokens zone (DECK-TOKENS)", () => {
  it("over by one, the ranked cuts never include a token", () => {
    const commander = editorCard(card({ name: "Brago, King Eternal", isLeaderCandidate: true }));
    const spells = fillers(63).map(editorCard);
    const lands = basicLands(37).map(editorCard);
    const treasure = editorCard(
      card({
        name: "Treasure",
        primaryType: "Artifact",
        costValue: 0,
        attrs: { type_line: "Token Artifact — Treasure", oracle_text: "", is_token: true },
      }),
    );
    const entries: EditorEntry[] = [
      { cardId: commander.id, zone: "commander", qty: 1, tags: [] },
      ...[...spells, ...lands].map((c) => ({ cardId: c.id, zone: "main", qty: 1, tags: [] })),
      { cardId: treasure.id, zone: "tokens", qty: 9, tags: [] },
    ];
    const cards = new Map([commander, ...spells, ...lands, treasure].map((c) => [c.id, c]));
    render(
      <CutCoachPanel
        adapter={mtg}
        format={COMMANDER}
        deckId={null}
        entries={entries}
        cards={cards}
        saveStatus="saved"
        active
        onSetQty={() => undefined}
      />,
    );
    // 101 cards: over by one, the nine Treasures beside them counting for nothing.
    const cuts = screen.getAllByRole("button", { name: /^Cut one copy of / });
    expect(cuts.length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Cut one copy of Treasure" })).toBeNull();
  });
});

describe("CutCoachPanel — the list's themes (COMMANDER-FIT)", () => {
  /** A deep-rank card: the Coach's strongest cut argument without a theme. */
  const fringe = (name: string, typeLine: string) =>
    editorCard(
      card({
        name,
        primaryType: "Creature",
        costValue: 3,
        popularity: 12000,
        attrs: { type_line: typeLine, oracle_text: "" },
      }),
    );

  function renderPanel(commanderRules: string) {
    const commander = editorCard(
      card({
        name: "Hive Tester",
        isLeaderCandidate: true,
        attrs: { type_line: "Legendary Creature — Sliver", oracle_text: commanderRules },
      }),
    );
    const slivers = Array.from({ length: 30 }, (_, i) =>
      fringe(`Test Sliver ${String(i + 1).padStart(2, "0")}`, "Creature — Sliver"),
    );
    // Twelve types, three cards of each at most: none of them a theme.
    const OTHER = "Beast Bird Cat Dog Elk Fox Goat Horse Insect Lizard Ox Rat".split(" ");
    const strays = Array.from({ length: 33 }, (_, i) =>
      fringe(
        `Test Stray ${String(i + 1).padStart(2, "0")}`,
        `Creature — ${OTHER[i % OTHER.length]}`,
      ),
    );
    const lands = basicLands(37).map(editorCard);
    const all = [...slivers, ...strays, ...lands];
    const entries: EditorEntry[] = [
      { cardId: commander.id, zone: "commander", qty: 1, tags: [] },
      ...all.map((c) => ({ cardId: c.id, zone: "main", qty: 1, tags: [] })),
    ];
    render(
      <CutCoachPanel
        adapter={mtg}
        format={COMMANDER}
        deckId={null}
        entries={entries}
        cards={new Map([commander, ...all].map((c) => [c.id, c]))}
        saveStatus="saved"
        active
        onSetQty={() => undefined}
      />,
    );
    return screen
      .getAllByRole("button", { name: /^Cut one copy of / })
      .map((b) => b.getAttribute("aria-label")!.replace("Cut one copy of ", ""));
  }

  it("ranks the cards that share the list's type after the ones that don't, on the same measured play", () => {
    // 30 Slivers and 33 creatures of other types at the same rank and cost, over by one.
    const order = renderPanel("Slivers you control have flying.");
    const firstSliver = order.findIndex((n) => n.startsWith("Test Sliver"));
    const lastStray = order.findLastIndex((n) => n.startsWith("Test Stray"));
    expect(firstSliver).toBeGreaterThan(lastStray);
    expect(order.filter((n) => n.startsWith("Test Sliver"))).toHaveLength(30);
  });

  it("says what cutting a theme's card takes from the list, as a cost after its cut signals", async () => {
    renderPanel("Slivers you control have flying.");
    const row = screen
      .getByRole("button", { name: "Expand tradeoffs for Test Sliver 01" })
      .closest("li")!;
    // Collapsed, the lead is still why the card ranks where it does.
    expect(row.textContent).toContain("Outside the widely-played tier of Commander cards");
    expect(row.textContent).toContain("Your list");
    expect(row.textContent).not.toContain("Has the Sliver type");
    screen.getByRole("button", { name: "Expand tradeoffs for Test Sliver 01" }).click();
    await screen.findByRole("button", { name: "Collapse tradeoffs for Test Sliver 01" });
    expect(row.textContent).toContain(
      "Has the Sliver type, which Hive Tester's rules text names. Cutting it leaves 30 in your list",
    );
    // A card outside the theme carries no such line.
    const stray = screen
      .getByRole("button", { name: "Expand tradeoffs for Test Stray 01" })
      .closest("li")!;
    expect(stray.textContent).not.toContain("Your list");
  });
});
