/**
 * The /decks/new picker (P4.2) with Y2b's start doors (WAVE4 D2): each game
 * card carries the doors its adapter declares, in one order — Magic all
 * four, One Piece Pick a leader and Paste a list — and `?import=1` is a
 * one-shot latch like `?surprise=1`: the draft opens with the Import dialog
 * (the editor's `draftImport`, pinned in deck-editor.test.tsx), the param
 * leaves the URL and `?game=` stays, and a latch set on the picker itself
 * carries into the game picked next. The editor and the footer are
 * stand-ins here; the picker renders no header of its own since 2026-10-17
 * (decks/layout.tsx's site header is the page's).
 *
 * COLLECTION-PAGE: the collection page's "Build from my collection" link
 * (`buildFromCollectionHref`) lands here with `?autofill=1&owned=1`. Both
 * are one-shot latches handed to the editor and stripped from the URL, so a
 * reload reopens nothing; the game and the commander stay.
 */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/editor/deck-editor", () => ({
  DeckEditor: (props: {
    draftGame?: string;
    draftLeaderKey?: string;
    draftImport?: boolean;
    draftSurprise?: boolean;
    draftAutofill?: boolean;
    draftOwned?: boolean;
  }) => (
    <div
      data-testid="editor"
      data-game={props.draftGame}
      data-leader={props.draftLeaderKey ?? ""}
      data-import={String(props.draftImport ?? false)}
      data-surprise={String(props.draftSurprise ?? false)}
      data-autofill={String(props.draftAutofill ?? false)}
      data-owned={String(props.draftOwned ?? false)}
    />
  ),
}));

const { NewDeckChooser } = await import("./new-deck-chooser");
const { buildFromCollectionHref } = await import("@/lib/collection/page-query");

const doors = (label: string) =>
  within(screen.getByRole("list", { name: label }))
    .getAllByRole("link")
    .map((a) => `${a.textContent} → ${a.getAttribute("href")}`);

beforeEach(() => window.history.replaceState(null, "", "/decks/new"));
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

describe("NewDeckChooser — the picker's start doors (Y2b)", () => {
  it("each game card carries its adapter's doors, in one order", () => {
    render(<NewDeckChooser />);
    expect(screen.getByText("Pick your game.")).toBeTruthy();
    // No header of its own (2026-10-17): decks/layout.tsx renders the site header above it.
    expect(screen.queryByRole("banner")).toBeNull();
    expect(doors("Other ways to start a Magic: The Gathering deck")).toEqual([
      "Pick a commander → /commanders",
      "Paste a list → /decks/new?game=mtg&import=1",
      "Start from a precon → /precons",
      "Surprise me → /decks/new?game=mtg&surprise=1",
    ]);
    expect(doors("Other ways to start a One Piece Card Game deck")).toEqual([
      "Pick a leader → /leaders",
      "Paste a list → /decks/new?game=optcg&import=1",
    ]);
  });

  it("?game=mtg&import=1 opens the draft with the Import latch; the param leaves the URL, ?game= stays", () => {
    window.history.replaceState(null, "", "/decks/new?game=mtg&import=1");
    render(<NewDeckChooser />);
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.game).toBe("mtg");
    expect(editor.dataset.import).toBe("true");
    expect(window.location.search).toBe("?game=mtg");
  });

  it("a latch set on the picker carries into the game picked next — and a reload of what's left opens nothing", () => {
    window.history.replaceState(null, "", "/decks/new?import=1");
    const view = render(<NewDeckChooser />);
    expect(screen.queryByTestId("editor")).toBeNull();
    expect(window.location.search).toBe("");

    // The picker's card is a same-route link: no remount, the latch holds.
    window.history.replaceState(null, "", "/decks/new?game=optcg");
    view.rerender(<NewDeckChooser />);
    expect(screen.getByTestId("editor").dataset.import).toBe("true");
    view.unmount();

    render(<NewDeckChooser />);
    expect(screen.getByTestId("editor").dataset.import).toBe("false");
  });
});

describe("NewDeckChooser — Build from my collection (COLLECTION-PAGE)", () => {
  const KEY = "e56f9b46-4bd3-4f4b-8d57-3a4b7d0c7a11";

  it("the collection page's link opens the draft with the commander, the sheet latch and the owned latch; both flags leave the URL", () => {
    window.history.replaceState(null, "", buildFromCollectionHref("mtg", KEY));
    render(<NewDeckChooser />);
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.game).toBe("mtg");
    expect(editor.dataset.leader).toBe(KEY);
    expect(editor.dataset.autofill).toBe("true");
    expect(editor.dataset.owned).toBe("true");
    // The one-time flags are gone; what is left names the game and the commander.
    expect(window.location.search).toBe(`?game=mtg&leader=${KEY}`);
  });

  it("a reload of what is left reopens nothing: the commander seeds again, no sheet, no tick", () => {
    window.history.replaceState(null, "", buildFromCollectionHref("mtg", KEY));
    const view = render(<NewDeckChooser />);
    view.unmount();

    // The address the first visit left behind.
    expect(window.location.search).toBe(`?game=mtg&leader=${KEY}`);
    render(<NewDeckChooser />);
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.leader).toBe(KEY);
    expect(editor.dataset.autofill).toBe("false");
    expect(editor.dataset.owned).toBe("false");
  });

  it("the latches hold through the editor's own re-renders, once the params are gone", () => {
    window.history.replaceState(null, "", buildFromCollectionHref("mtg", KEY));
    const view = render(<NewDeckChooser />);
    view.rerender(<NewDeckChooser />);
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.autofill).toBe("true");
    expect(editor.dataset.owned).toBe("true");
  });

  it("the link followed while this page is already open (no remount): both latches still set", () => {
    window.history.replaceState(null, "", "/decks/new?game=mtg");
    const view = render(<NewDeckChooser />);
    expect(screen.getByTestId("editor").dataset.owned).toBe("false");

    window.history.replaceState(null, "", buildFromCollectionHref("mtg", KEY));
    view.rerender(<NewDeckChooser />);
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.autofill).toBe("true");
    expect(editor.dataset.owned).toBe("true");
    expect(window.location.search).toBe(`?game=mtg&leader=${KEY}`);
  });

  it("?owned=1 without ?autofill=1 is latched and stripped like any one-shot, and asks for no sheet", () => {
    window.history.replaceState(null, "", "/decks/new?game=mtg&owned=1");
    render(<NewDeckChooser />);
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.owned).toBe("true");
    expect(editor.dataset.autofill).toBe("false");
    expect(window.location.search).toBe("?game=mtg");
  });

  it("a plain starter-shell link (the hubs') carries no owned latch", () => {
    window.history.replaceState(null, "", `/decks/new?game=mtg&leader=${KEY}&autofill=1`);
    render(<NewDeckChooser />);
    const editor = screen.getByTestId("editor");
    expect(editor.dataset.autofill).toBe("true");
    expect(editor.dataset.owned).toBe("false");
  });
});
