/**
 * CardDetailPane as the phone card sheet's body (U4b, WAVE5 D5): a header
 * row at every point (the name, the type line and the cost, the frame's
 * Close at its end); the actions at the peek, each only where the editor
 * hands one over; the card from the half; the text, the tags, the footer
 * line (44 px links on touch) and Printings at the full point. Without
 * `sheet` the pane keeps its own layout, image first, its footer links 44 px
 * on touch too (LATER row 245: the md drawer and the wide pane on a tablet).
 *
 * CARD-FLIP-EDITOR: the image draws through CardFlip at both sites, for
 * every card, and a card whose shown printing has a back gets Flip beside
 * it. RTL pins the state here (the slots, the flag, the pressed state, the
 * decode on intent and no back before it, a card change that never turns
 * and never remounts the image in view); the turn's frames, the name's top
 * and the boxes are read on a local production build and recorded in
 * REDESIGN.md.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GalleryPrinting } from "@/lib/cards/printings";
import type { EditorCard } from "@/lib/decks/editor-state";
import { card } from "@/lib/games/mtg/test-fixtures";
import { getAdapter } from "@/lib/games/registry";

import { CardDetailPane, type CardSheet, type SheetActions } from "./card-detail-pane";

const adapter = getAdapter("mtg");
const sol: EditorCard = {
  ...card({
    name: "Sol Ring",
    primaryType: "Artifact",
    costValue: 1,
    attrs: { type_line: "Artifact", oracle_text: "{T}: Add {C}{C}.", mana_cost: "{1}" },
  }),
  image: "https://cards.scryfall.io/normal/front/8/3/83f43730-1c1f-4150-8771-d901c54bedc4.jpg",
};

function sheetAt(point: CardSheet["point"], actions: SheetActions = {}): CardSheet {
  return {
    point,
    close: (
      <button type="button" aria-label="Close">
        ×
      </button>
    ),
    actions,
  };
}

const tagging = { tags: [], onSetTags: vi.fn() };

describe("CardDetailPane as the phone card sheet (U4b)", () => {
  it("the peek: the name, the type line with the cost, Close, and the actions it is given; no card yet", () => {
    const onRemove = vi.fn();
    const onSwap = vi.fn();
    render(
      <CardDetailPane
        adapter={adapter}
        card={sol}
        tagging={tagging}
        sheet={sheetAt("peek", { onRemove, onSwap })}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Sol Ring" })).toBeTruthy();
    expect(screen.getByText("Artifact")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    fireEvent.click(screen.getByRole("button", { name: "Swap…" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onSwap).toHaveBeenCalledTimes(1);
    // No Add was handed over (a card the deck holds), and nothing past the actions.
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByText("{T}: Add {C}{C}.")).toBeNull();
    expect(screen.queryByRole("link", { name: /Card page/ })).toBeNull();
    // 44 px on touch.
    expect(screen.getByRole("button", { name: "Remove" }).className).toContain(
      "pointer-coarse:h-11",
    );
  });

  it("MAYBE-LIST: the remove carries the editor's words for a Maybe card, and Add its Move to deck", () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(
      <CardDetailPane
        adapter={adapter}
        card={sol}
        sheet={sheetAt("peek", {
          add: { label: "Move to deck", onClick },
          onRemove,
          removeLabel: "Remove from Maybe",
        })}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to deck" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove from Maybe" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("the half adds the card, sized to fit under the header and the actions; Add carries the editor's label", () => {
    const onClick = vi.fn();
    render(
      <CardDetailPane
        adapter={adapter}
        card={sol}
        sheet={sheetAt("half", { add: { label: "Swap in…", onClick } })}
      />,
    );
    // The size is the box's (CARD-FLIP-EDITOR); the image fills it.
    const image = screen.getByRole("img", { name: "Sol Ring" });
    const box = document.querySelector<HTMLElement>('[data-flip="box"]')!;
    expect(box.className).toBe("w-[min(60%,calc((55dvh-7.75rem)*0.7176))] shrink-0");
    expect(box.contains(image)).toBe(true);
    expect(image.className).toContain("h-auto w-full rounded-[4.75%/3.5%] shadow-md");
    expect(box.parentElement?.getAttribute("data-slot")).toBe("sheet-card");
    expect(box.parentElement?.className).toBe("mt-3 flex items-center gap-3");
    // A card with one face: nothing beside it.
    expect(box.parentElement?.childElementCount).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Swap in…" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("{T}: Add {C}{C}.")).toBeNull();
    expect(screen.queryByRole("button", { name: /Printings/ })).toBeNull();
  });

  it("the full point adds the text, the tags, the footer line with 44 px links on touch, and Printings", () => {
    render(
      <CardDetailPane adapter={adapter} card={sol} tagging={tagging} sheet={sheetAt("full")} />,
    );
    expect(screen.getByText("{T}: Add {C}{C}.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Tags in this deck" })).toBeTruthy();
    const cardPage = screen.getByRole("link", { name: /Card page/ });
    expect(cardPage.className).toContain("pointer-coarse:min-h-11");
    expect(screen.getByRole("button", { name: /Printings/ })).toBeTruthy();
    // The column scrolls under the header row, which keeps the name and Close.
    const column = document.querySelector("[data-slot=sheet-column]")!;
    expect(column.className).toContain("overflow-y-auto");
    expect(column.contains(screen.getByRole("heading", { level: 2, name: "Sol Ring" }))).toBe(
      false,
    );
    expect(column.contains(screen.getByRole("button", { name: "Close" }))).toBe(false);
  });

  it("with no card it keeps the frame's Close beside the hint", () => {
    render(<CardDetailPane adapter={adapter} card={null} sheet={sheetAt("half")} />);
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.getByText("Search or click a card to see it here.")).toBeTruthy();
  });
});

describe("CardDetailPane without a sheet", () => {
  it("keeps its own layout: the image first, the name and cost under it, the footer's text links", () => {
    const { container } = render(<CardDetailPane adapter={adapter} card={sol} tagging={tagging} />);
    const root = container.firstElementChild!;
    expect(root.className).toBe("p-3");
    // The image first, in the box a card turns in (CARD-FLIP-EDITOR): the
    // box takes the image's old place and size, the near face holds it.
    const box = root.firstElementChild!;
    expect(box.getAttribute("data-flip")).toBe("box");
    expect(box.className).toBe("mx-auto w-full max-w-72");
    const image = screen.getByRole("img", { name: "Sol Ring" });
    expect(image.parentElement?.getAttribute("data-flip")).toBe("near");
    expect(image.className).toContain("h-auto w-full rounded-[4.75%/3.5%] shadow-md");
    // As the pane's image always was: lazy, with its load fade.
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("fetchpriority")).toBeNull();
    expect(document.querySelector('[data-flip="far"]')?.childElementCount).toBe(0);
    // The name's row is the box's next sibling, and a single-faced card has no Flip.
    const nameRow = box.nextElementSibling!;
    expect(nameRow.getAttribute("data-slot")).toBe("pane-name");
    expect(nameRow.className).toBe("mt-3 flex items-start gap-2");
    expect(nameRow.childElementCount).toBe(1);
    expect(screen.queryByRole("button", { name: "Flip" })).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Sol Ring" })).toBeTruthy();
    expect(screen.getByText("{T}: Add {C}{C}.")).toBeTruthy();
    expect(document.querySelector("[data-slot=sheet-actions]")).toBeNull();
  });

  it("the footer's Buy and Card page are 44 × 44 targets on touch, as the sheet's are; a mouse keeps the text links (LATER row 245)", () => {
    render(<CardDetailPane adapter={adapter} card={sol} tagging={tagging} />);
    const links = [
      screen.getByRole("link", { name: /^Buy/ }),
      screen.getByRole("link", { name: /Card page/ }),
    ];
    for (const link of links) {
      expect(link.className).toBe(
        "hover:underline pointer-coarse:inline-flex pointer-coarse:min-h-11 pointer-coarse:min-w-11 pointer-coarse:items-center pointer-coarse:justify-center",
      );
    }
  });
});

describe("the turn (CARD-FLIP-EDITOR)", () => {
  const ETALI_ID = "3e97c609-3932-4428-96d4-1c97e61f0abb";
  const BIRGI_ID = "0b0b3b6c-4a3f-4f0b-9a3d-1d6c2e4b5a60";
  const front = (id: string) =>
    `https://cards.scryfall.io/normal/front/${id[0]}/${id[1]}/${id}.jpg`;
  const back = (id: string) => `https://cards.scryfall.io/normal/back/${id[0]}/${id[1]}/${id}.jpg`;
  const etali: EditorCard = {
    ...card({
      name: "Etali, Primal Conqueror // Etali, Primal Sickness",
      primaryType: "Creature",
      costValue: 7,
      attrs: { type_line: "Legendary Creature — Elder Dinosaur", oracle_text: "Trample" },
    }),
    image: front(ETALI_ID),
    hasBack: true,
  };
  const birgi: EditorCard = {
    ...card({
      name: "Birgi, God of Storytelling // Harnfel, Horn of Bounty",
      primaryType: "Creature",
      costValue: 3,
      attrs: { type_line: "Legendary Creature — God", oracle_text: "" },
    }),
    image: front(BIRGI_ID),
    hasBack: true,
  };
  // A split card: "//" in the name, one image, no back.
  const nightDay: EditorCard = {
    ...card({
      name: "Night // Day",
      primaryType: "Instant",
      costValue: 3,
      attrs: { type_line: "Instant // Instant", oracle_text: "" },
    }),
    image: "https://cards.scryfall.io/normal/front/e/c/eccff9be-a18d-4fad-b23a-7f66ae9dbfed.jpg",
  };

  /** Every address asked to decode off screen, in order; `gate` holds a decode until the test opens it. */
  function stubDecodes(
    opts: { fails?: (src: string) => boolean; gate?: Promise<void> } = {},
  ): string[] {
    const asked: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        async decode() {
          asked.push(this.src);
          if (opts.gate) await opts.gate;
          if (opts.fails?.(this.src)) throw new Error("decode failed");
        }
      },
    );
    return asked;
  }
  afterEach(() => vi.unstubAllGlobals());

  const part = (name: string) => document.querySelector<HTMLElement>(`[data-flip="${name}"]`)!;
  const images = (el: Element) => [...el.querySelectorAll("img")];
  const flipButton = () => screen.getByRole("button", { name: "Flip" });
  const noFlip = () => expect(screen.queryByRole("button", { name: "Flip" })).toBeNull();
  const pane = (shown: EditorCard) => <CardDetailPane adapter={adapter} card={shown} />;
  async function press() {
    fireEvent.click(flipButton());
    await act(async () => {}); // the decode settles, the state follows
  }

  it("a double-faced card gets Flip at the end of the name's row, outside the name's own row; no back is asked for", () => {
    const asked = stubDecodes();
    render(pane(etali));
    const button = flipButton();
    expect(button.getAttribute("aria-pressed")).toBe("false");
    // The card page's control: the same label and icon.
    expect(button.textContent).toBe("Flip");
    expect(button.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    const nameRow = document.querySelector('[data-slot="pane-name"]')!;
    expect(button.parentElement).toBe(nameRow);
    const heading = screen.getByRole("heading", { level: 2, name: etali.name });
    // The name sits in its own baseline row, a sibling of the button: the button cannot move it.
    expect(heading.parentElement?.parentElement).toBe(nameRow);
    expect(heading.parentElement).not.toBe(nameRow);
    expect(heading.parentElement?.className).toBe(
      "flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2",
    );
    // Beside the card, never on it: the box holds no button.
    expect(part("box").querySelector("button")).toBeNull();
    // The back costs nothing until it is asked for.
    expect(asked).toEqual([]);
    expect(part("far").childElementCount).toBe(0);
    expect(document.querySelector('img[src*="/back/"]')).toBeNull();
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
  });

  it("no Flip without a back: a split card's name has // and one image; a flag with no derivable address offers nothing", () => {
    stubDecodes();
    const { rerender } = render(pane(nightDay));
    noFlip();
    // The One Piece mirror, and a card with no image at all: nothing behind a control.
    rerender(pane({ ...etali, image: "https://img.deckwarden.gg/optcg/images/OP15-058.png" }));
    noFlip();
    rerender(pane({ ...etali, image: null }));
    noFlip();
    expect(part("near").textContent).toBe(etali.name); // the fallback box, in the same slot
  });

  it("the pointer, focus or a touch reaching Flip starts the back's decode, once, and changes nothing on screen", async () => {
    const asked = stubDecodes();
    render(pane(etali));
    fireEvent.pointerEnter(flipButton());
    expect(asked).toEqual([back(ETALI_ID)]);
    fireEvent.focus(flipButton());
    fireEvent.touchStart(flipButton());
    await act(async () => {});
    fireEvent.pointerEnter(flipButton());
    expect(asked).toEqual([back(ETALI_ID)]);
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(part("far").childElementCount).toBe(0);
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
  });

  it("Flip turns: the back arrives whole in the far slot, the flag flips, the button says pressed; the press shares the pointer's decode", async () => {
    const asked = stubDecodes();
    render(pane(etali));
    const shown = images(part("near"))[0];
    fireEvent.pointerEnter(flipButton());
    await press();
    expect(asked).toEqual([back(ETALI_ID)]);
    expect(part("turn").getAttribute("data-turned")).toBe("");
    const arrived = images(part("far"));
    expect(arrived).toHaveLength(1);
    expect(arrived[0].getAttribute("src")).toBe(back(ETALI_ID));
    // Whole as it comes round: `priority`, so no load fade, and eager.
    expect(arrived[0].className).not.toContain("opacity-0");
    expect(arrived[0].getAttribute("loading")).toBe("eager");
    expect(arrived[0].getAttribute("fetchpriority")).toBe("high");
    // The shadow is on the image, so it turns with its face.
    expect(arrived[0].className).toContain("shadow-md");
    // The front never remounted, and a reader hears one image: the back.
    expect(images(part("near"))[0]).toBe(shown);
    expect(part("near").getAttribute("aria-hidden")).toBe("true");
    expect(part("far").hasAttribute("aria-hidden")).toBe(false);
    expect(screen.getAllByRole("img", { name: etali.name })).toEqual(arrived);
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
  });

  it("a turn back, and the turn after it, move the flag only: both images stay, nothing is decoded again", async () => {
    const asked = stubDecodes();
    render(pane(etali));
    const shown = images(part("near"))[0];
    await press();
    const arrived = images(part("far"))[0];
    // The pointer is still on Flip for the press back: the front is already there.
    fireEvent.pointerEnter(flipButton());
    await press();
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
    await press();
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(images(part("near"))).toEqual([shown]);
    expect(images(part("far"))).toEqual([arrived]);
    expect(asked).toEqual([back(ETALI_ID)]);
  });

  it("a new card never turns and never remounts the image in view: its front lands in the same element, the back of the last card unasked", () => {
    const asked = stubDecodes();
    const { rerender } = render(pane(sol));
    const shown = images(part("near"))[0];
    const turning = part("turn");
    // Single-faced, double-faced, a split card, double-faced, single-faced.
    for (const next of [etali, nightDay, birgi, sol]) {
      rerender(pane(next));
      expect(images(part("near"))).toEqual([shown]);
      expect(shown.getAttribute("src")).toBe(next.image);
      expect(shown.getAttribute("alt")).toBe(next.name);
      expect(part("turn")).toBe(turning);
      expect(turning.hasAttribute("data-turned")).toBe(false);
      expect(part("far").childElementCount).toBe(0);
      expect(screen.queryByRole("button", { name: "Flip" }) !== null).toBe(next.hasBack === true);
    }
    expect(asked).toEqual([]);
  });

  it("a new card with the back up lands on its front in the slot facing the reader, still without a turn; the next Flip brings its own back", async () => {
    const asked = stubDecodes();
    const { rerender } = render(pane(etali));
    const near = images(part("near"))[0];
    await press();
    const far = images(part("far"))[0];

    // The highlight moves on: the far slot is up, so the new front lands there, in place.
    rerender(pane(birgi));
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(images(part("far"))).toEqual([far]);
    expect(far.getAttribute("src")).toBe(front(BIRGI_ID));
    expect(far.getAttribute("alt")).toBe(birgi.name);
    expect(part("far").hasAttribute("aria-hidden")).toBe(false);
    // A new card is on its front, whichever slot shows it.
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
    expect(asked).toEqual([back(ETALI_ID)]);

    // Its Flip: the back arrives in the hidden near slot as a fresh image, whole.
    await press();
    expect(asked).toEqual([back(ETALI_ID), back(BIRGI_ID)]);
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    const [arrived] = images(part("near"));
    expect(arrived).not.toBe(near);
    expect(arrived.getAttribute("src")).toBe(back(BIRGI_ID));
    expect(arrived.getAttribute("loading")).toBe("eager");
    expect(arrived.className).not.toContain("opacity-0");
    expect(images(part("far"))).toEqual([far]);
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");

    // On to a single-faced card with a back up: no turn, no control.
    rerender(pane(sol));
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(images(part("near"))).toEqual([arrived]);
    expect(arrived.getAttribute("src")).toBe(sol.image);
    noFlip();
  });

  it("a press whose picture is still decoding when the highlight moves on turns nothing", async () => {
    let open!: () => void;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const asked = stubDecodes({ gate });
    const { rerender } = render(pane(etali));
    fireEvent.click(flipButton());
    expect(asked).toEqual([back(ETALI_ID)]);
    rerender(pane(sol));
    await act(async () => {
      open();
    });
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(part("far").childElementCount).toBe(0);
    expect(images(part("near"))[0].getAttribute("src")).toBe(sol.image);
  });

  it("a back that cannot load turns to the fallback box, and turns back", async () => {
    stubDecodes({ fails: (src) => src.includes("/back/") });
    render(pane(etali));
    await press();
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(images(part("far"))).toHaveLength(0);
    expect(part("far").textContent).toBe(etali.name);
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
    await press();
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(images(part("near"))[0].getAttribute("src")).toBe(front(ETALI_ID));
  });

  it("a previewed printing uses its own flag and its own back: a two-sided printing of a single-faced card turns, a plain one of a double-faced card does not", async () => {
    const asked = stubDecodes();
    const row = (
      id: string,
      setName: string,
      hasBack: boolean,
      isDefault = false,
    ): GalleryPrinting => ({
      id,
      setCode: "sld",
      setName,
      collectorNumber: "1512",
      rarity: "rare",
      year: 2024,
      isDefault,
      hasBack,
      usd: null,
      usdFoil: null,
    });
    const SIDED = "d74a72a2-d46a-41c2-a400-70571197b020";
    const PLAIN = "8ee443cc-e17a-493b-9c93-1f9e141a30e4";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          printings: [
            row(SIDED, "Secret Lair Drop", true),
            row(PLAIN, "Commander Masters", false, true),
          ],
          total: 2,
          truncated: false,
        }),
      })),
    );
    render(pane(sol));
    noFlip();
    fireEvent.click(screen.getByRole("button", { name: /^Printings/ }));
    await act(async () => {});
    const shown = images(part("near"))[0];

    fireEvent.click(screen.getByRole("button", { name: /Secret Lair Drop/ }));
    // The preview lands in place, on the front, and Flip appears for this printing.
    expect(images(part("near"))).toEqual([shown]);
    expect(shown.getAttribute("src")).toBe(front(SIDED));
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
    await press();
    expect(asked).toEqual([back(SIDED)]);
    expect(images(part("far"))[0].getAttribute("src")).toBe(back(SIDED));
    expect(part("turn").getAttribute("data-turned")).toBe("");

    // Another printing with the back up: its front lands in the far slot, no turn, no Flip.
    fireEvent.click(screen.getByRole("button", { name: /Commander Masters/ }));
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(images(part("far"))[0].getAttribute("src")).toBe(front(PLAIN));
    noFlip();
  });

  it("the sheet: Flip stands beside the card from the half, in the card's row; the peek shows neither", async () => {
    stubDecodes();
    const { rerender } = render(
      <CardDetailPane adapter={adapter} card={etali} sheet={sheetAt("half")} />,
    );
    const row = document.querySelector<HTMLElement>('[data-slot="sheet-card"]')!;
    expect([...row.children]).toEqual([part("box"), flipButton()]);
    // 44 px on touch, the Button primitive's rule for every text size.
    expect(flipButton().className).toContain("pointer-coarse:min-h-11");
    await press();
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(within(part("far")).getByRole("img").getAttribute("src")).toBe(back(ETALI_ID));

    // Down to the peek and back: the card is as it was left.
    rerender(<CardDetailPane adapter={adapter} card={etali} sheet={sheetAt("peek")} />);
    expect(document.querySelector("[data-flip]")).toBeNull();
    noFlip();
    rerender(<CardDetailPane adapter={adapter} card={etali} sheet={sheetAt("full")} />);
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
  });

  it("One Piece has no backs: the same box, no control", () => {
    const optcg = getAdapter("optcg");
    const leader: EditorCard = {
      ...card({
        name: "Ace & Newgate",
        primaryType: "Leader",
        attrs: { type_line: "Leader", oracle_text: "" },
      }),
      externalKey: "ST22-001",
      image: "https://img.deckwarden.gg/optcg/images/ST22-001.png",
    };
    render(<CardDetailPane adapter={optcg} card={leader} />);
    expect(part("box").className).toBe("mx-auto w-full max-w-72");
    expect(images(part("near"))[0].getAttribute("src")).toBe(leader.image);
    noFlip();
  });
});
