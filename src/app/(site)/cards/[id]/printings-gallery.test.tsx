/**
 * The printings gallery (W5, WAVE2.md D4): the default renders pinned with
 * the LCP attributes intact; a click pins on md+ (URL + hero caption +
 * aria-live) and opens the drawer below md; One Piece rows carry no price
 * cells; Flip exists only with a back face; "Show all" fetches the capped
 * tail honestly; deep links restore (and unknown ones change nothing).
 * CARD-FLIP: Flip turns the card over through CardFlip (two slots and a
 * flag, the button's pressed state, the line, the decode on intent and no
 * back before it), and a card with one face keeps the plain hero markup.
 * jsdom has no layout and no 3D: the turn itself is read in a browser.
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MD_QUERY } from "@/components/editor/use-tier";
import type { GalleryPrinting } from "@/lib/cards/printings";
import { PrintingsGallery, PrintingsHero, PrintingsTable } from "./printings-gallery";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function printing(n: number, over: Partial<GalleryPrinting> = {}): GalleryPrinting {
  return {
    id: uuid(n),
    setCode: `s${n}`,
    setName: `Set ${n}`,
    collectorNumber: String(n * 100),
    rarity: "rare",
    year: 2020,
    isDefault: false,
    hasBack: false,
    usd: null,
    usdFoil: null,
    ...over,
  };
}

const cmm = printing(1, {
  setCode: "cmm",
  setName: "Commander Masters",
  collectorNumber: "410",
  rarity: "uncommon",
  year: 2023,
  isDefault: true,
  usd: "2.89",
  usdFoil: "4.69",
});
const sld = printing(2, {
  setCode: "sld",
  setName: "Secret Lair Drop",
  collectorNumber: "2783",
  usdFoil: "129.95",
});
const dfc = printing(3, { setName: "Innistrad", hasBack: true });
const ROWS = [cmm, sld, dfc];

function stubWidth(px: number) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: query === MD_QUERY ? px >= 768 : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    })),
  );
}

function renderGallery(over: Partial<Parameters<typeof PrintingsGallery>[0]> = {}) {
  return render(
    <PrintingsGallery
      cardId={uuid(99)}
      cardName="Sol Ring"
      gameCode="mtg"
      printings={ROWS}
      total={ROWS.length}
      {...over}
    >
      <PrintingsHero />
      <PrintingsTable />
    </PrintingsGallery>,
  );
}

const rowButton = (name: RegExp) => screen.getByRole("button", { name });

beforeEach(() => {
  window.history.replaceState(null, "", "/cards/abc");
  stubWidth(1200);
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("initial render", () => {
  it("pins the default: pressed row, Shown marker, Default badge, LCP attributes", () => {
    renderGallery();
    const pressed = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain("Commander Masters");
    expect(pressed[0].textContent).toContain("Shown");
    // Hero caption: set line, D4 caption with year, Default badge, no Reset.
    expect(screen.getByText("CMM #410 · Unc. (2023)")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reset to default" })).toBeNull();
    // The hero stays the LCP element: eager + fetchpriority, scryfall-derived src.
    const hero = document.querySelector('img[fetchpriority="high"]')!;
    expect(hero.getAttribute("loading")).toBe("eager");
    expect(hero.getAttribute("src")).toContain(`/normal/front/0/0/${cmm.id}.jpg`);
  });

  it("suppresses price columns for One Piece (P4.4 rule)", () => {
    renderGallery({ gameCode: "optcg" });
    expect(screen.queryByText("USD")).toBeNull();
    expect(screen.queryByText("Foil")).toBeNull();
    const firstRow = screen.getAllByRole("row")[1];
    expect(within(firstRow).getAllByRole("cell")).toHaveLength(3);
  });
});

describe("pinning on md+", () => {
  it("click → ?printing=, pressed row, hero caption, Reset, announcement; no history entry", async () => {
    renderGallery();
    const depth = window.history.length;
    fireEvent.click(rowButton(/Secret Lair Drop/));

    expect(window.location.search).toBe(`?printing=${sld.id}`);
    expect(window.history.length).toBe(depth);
    expect(rowButton(/Secret Lair Drop/).getAttribute("aria-pressed")).toBe("true");
    expect(rowButton(/Commander Masters/).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("SLD #2783 · Rare (2020)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset to default" })).toBeTruthy();
    // The hero swap is async (decode off-screen) — the polite line follows it.
    await screen.findByText("Showing Secret Lair Drop #2783");
  });

  it("Reset to default clears the param and re-pins the default", async () => {
    renderGallery();
    fireEvent.click(rowButton(/Secret Lair Drop/));
    fireEvent.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(window.location.search).toBe("");
    expect(rowButton(/Commander Masters/).getAttribute("aria-pressed")).toBe("true");
    await screen.findByText("Showing Commander Masters #410");
  });

  it("Flip renders only with a back face and announces it", async () => {
    renderGallery();
    expect(screen.queryByRole("button", { name: /Flip/ })).toBeNull();
    fireEvent.click(rowButton(/Innistrad/));
    fireEvent.click(await screen.findByRole("button", { name: /Flip/ }));
    await screen.findByText("Showing Innistrad #300, back face");
  });
});

describe("the flip (CARD-FLIP)", () => {
  // A card whose default printing has a back, and a second printing that has one too.
  const mom = printing(7, {
    setCode: "mom",
    setName: "March of the Machine",
    collectorNumber: "298",
    isDefault: true,
    hasBack: true,
  });
  const TWO_SIDED = [mom, dfc];
  const front = (p: GalleryPrinting) => `https://cards.scryfall.io/normal/front/0/0/${p.id}.jpg`;
  const back = (p: GalleryPrinting) => `https://cards.scryfall.io/normal/back/0/0/${p.id}.jpg`;

  /** Every address asked to decode off screen, in order; `fails` makes an address reject. */
  function stubDecodes(fails: (src: string) => boolean = () => false) {
    const asked: string[] = [];
    vi.stubGlobal(
      "Image",
      class {
        src = "";
        decode() {
          asked.push(this.src);
          return fails(this.src) ? Promise.reject(new Error("decode failed")) : Promise.resolve();
        }
      },
    );
    return asked;
  }

  const part = (name: string) => document.querySelector<HTMLElement>(`[data-flip="${name}"]`)!;
  const images = (el: Element) => [...el.querySelectorAll("img")];
  const flipButton = () => screen.getByRole("button", { name: /Flip/ });
  const heroColumn = () => document.querySelector('[aria-live="polite"]')!.parentElement!;

  it("a card that opens on a single-faced printing keeps the plain hero, through a swap too", async () => {
    stubDecodes();
    renderGallery();
    const plain = heroColumn().firstElementChild!;
    expect(plain.outerHTML).toMatch(/^<div class="relative"><img [^>]*><\/div>$/);
    expect(document.querySelector("[data-flip]")).toBeNull();
    fireEvent.click(rowButton(/Secret Lair Drop/));
    await screen.findByText("Showing Secret Lair Drop #2783");
    // The crossfade as it has always been: the outgoing picture under the incoming one.
    expect(document.querySelector("[data-flip]")).toBeNull();
    const [under, shown] = images(heroColumn().firstElementChild!);
    expect(under.getAttribute("src")).toBe(front(cmm));
    expect(under.className).toBe("absolute inset-0 w-72 rounded-2xl");
    expect(shown.getAttribute("src")).toBe(front(sld));
    expect(shown.className).toContain("motion-safe:animate-dw-in");
  });

  it("the wrappers mount inside the swap to a printing with a back, around its crossfade", async () => {
    const asked = stubDecodes();
    renderGallery();
    fireEvent.click(rowButton(/Innistrad/));
    await screen.findByText("Showing Innistrad #300");
    expect(part("box").className).toBe("w-72");
    expect(part("box").parentElement).toBe(heroColumn());
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    const [under, shown] = images(part("near"));
    expect(under.getAttribute("src")).toBe(front(cmm));
    expect(shown.getAttribute("src")).toBe(front(dfc));
    expect(shown.className).toContain("motion-safe:animate-dw-in");
    expect(part("far").childElementCount).toBe(0);
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
    // Only the front was asked for.
    expect(asked).toEqual([front(dfc)]);
  });

  it("a default printing with a back renders the wrappers at once: the LCP image untouched in the near face, no back asked for", () => {
    const asked = stubDecodes();
    renderGallery({ printings: TWO_SIDED, total: 2 });
    const [hero, ...rest] = images(part("near"));
    expect(rest).toHaveLength(0);
    expect(hero.getAttribute("fetchpriority")).toBe("high");
    expect(hero.getAttribute("loading")).toBe("eager");
    expect(hero.getAttribute("src")).toBe(front(mom));
    expect(hero.className).not.toContain("animate-dw-in");
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(part("far").childElementCount).toBe(0);
    expect(part("far").getAttribute("aria-hidden")).toBe("true");
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
    // The back costs nothing until it is asked for.
    expect(asked).toEqual([]);
    expect(document.querySelector('img[src*="/back/"]')).toBeNull();
  });

  it("the pointer, focus or a touch reaching Flip starts the back's decode, once, and changes nothing on screen", async () => {
    const asked = stubDecodes();
    renderGallery({ printings: TWO_SIDED, total: 2 });
    fireEvent.pointerEnter(flipButton());
    expect(asked).toEqual([back(mom)]);
    fireEvent.focus(flipButton());
    fireEvent.touchStart(flipButton());
    fireEvent.pointerEnter(flipButton());
    await act(async () => {}); // the decode settles
    fireEvent.pointerEnter(flipButton());
    expect(asked).toEqual([back(mom)]);
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(part("far").childElementCount).toBe(0);
    expect(document.querySelector('img[src*="/back/"]')).toBeNull();
    expect(document.querySelector('[aria-live="polite"]')!.textContent).toBe("");
  });

  it("a press shares the decode the pointer started", async () => {
    const asked = stubDecodes();
    renderGallery({ printings: TWO_SIDED, total: 2 });
    fireEvent.pointerEnter(flipButton());
    fireEvent.click(flipButton());
    await screen.findByText("Showing March of the Machine #298, back face");
    expect(asked).toEqual([back(mom)]);
  });

  it("Flip turns: the back goes whole into the far slot, the flag flips, the button says pressed", async () => {
    stubDecodes();
    renderGallery({ printings: TWO_SIDED, total: 2 });
    const hero = images(part("near"))[0];
    fireEvent.click(flipButton());
    await screen.findByText("Showing March of the Machine #298, back face");
    expect(part("turn").getAttribute("data-turned")).toBe("");
    const arrived = images(part("far"));
    expect(arrived).toHaveLength(1); // nothing under it
    expect(arrived[0].getAttribute("src")).toBe(back(mom));
    // Whole as it comes round: no crossfade, and `priority`, so no load fade.
    expect(arrived[0].className).not.toContain("animate-dw-in");
    expect(arrived[0].className).not.toContain("opacity-0");
    expect(arrived[0].getAttribute("loading")).toBe("eager");
    // The shadow is on the image, so it turns with its face.
    expect(arrived[0].className).toContain("shadow-lg");
    // The front never remounted, and a reader hears one image: the back.
    expect(images(part("near"))[0]).toBe(hero);
    expect(part("near").getAttribute("aria-hidden")).toBe("true");
    expect(part("far").hasAttribute("aria-hidden")).toBe(false);
    expect(screen.getAllByRole("img", { name: "Sol Ring" })).toEqual(arrived);
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
  });

  it("a second Flip turns back and reuses both slots: only the flag moves", async () => {
    stubDecodes();
    renderGallery({ printings: TWO_SIDED, total: 2 });
    const hero = images(part("near"))[0];
    fireEvent.click(flipButton());
    await screen.findByText("Showing March of the Machine #298, back face");
    const arrived = images(part("far"))[0];
    fireEvent.click(flipButton());
    await screen.findByText("Showing March of the Machine #298");
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    expect(images(part("near"))).toEqual([hero]);
    expect(images(part("far"))).toEqual([arrived]);
    expect(part("far").getAttribute("aria-hidden")).toBe("true");
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");
  });

  it("a printing change with the back up crossfades to the new front without a turn; the next Flip turns to the new back", async () => {
    stubDecodes();
    renderGallery({ printings: TWO_SIDED, total: 2 });
    const hero = images(part("near"))[0];
    fireEvent.click(flipButton());
    await screen.findByText("Showing March of the Machine #298, back face");
    fireEvent.click(rowButton(/Innistrad/));
    await screen.findByText("Showing Innistrad #300");
    // The flag is left alone: the new front lands in the slot facing the
    // reader, over the old back, as any printing change lands.
    expect(part("turn").getAttribute("data-turned")).toBe("");
    const [under, shown] = images(part("far"));
    expect(under.getAttribute("src")).toBe(back(mom));
    expect(shown.getAttribute("src")).toBe(front(dfc));
    expect(shown.className).toContain("motion-safe:animate-dw-in");
    expect(images(part("near"))).toEqual([hero]);
    expect(flipButton().getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(flipButton());
    await screen.findByText("Showing Innistrad #300, back face");
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    const arrived = images(part("near"));
    expect(arrived).toHaveLength(1);
    expect(arrived[0].getAttribute("src")).toBe(back(dfc));
    expect(arrived[0].className).not.toContain("animate-dw-in");
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
  });

  it("a back that fails to decode turns to the fallback box", async () => {
    stubDecodes((src) => src.includes("/back/"));
    renderGallery({ printings: TWO_SIDED, total: 2 });
    fireEvent.click(flipButton());
    await screen.findByText("Showing March of the Machine #298, back face");
    expect(part("turn").getAttribute("data-turned")).toBe("");
    expect(images(part("far"))).toHaveLength(0);
    expect(within(part("far")).getByText("Card image coming soon")).toBeTruthy();
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
  });

  it("a press before the wrappers are on screen shows the back in place: nothing mounts already turned", async () => {
    stubDecodes();
    renderGallery();
    // Flip appears with the pin, before the swap that mounts the wrappers lands.
    fireEvent.click(rowButton(/Innistrad/));
    fireEvent.click(flipButton());
    await screen.findByText("Showing Innistrad #300, back face");
    expect(part("turn").hasAttribute("data-turned")).toBe(false);
    const [under, shown] = images(part("near"));
    expect(under.getAttribute("src")).toBe(front(cmm));
    expect(shown.getAttribute("src")).toBe(back(dfc));
    expect(shown.className).toContain("motion-safe:animate-dw-in");
    expect(flipButton().getAttribute("aria-pressed")).toBe("true");
  });
});

describe("phone", () => {
  it("tap opens the drawer with the printing large; the URL is untouched", async () => {
    stubWidth(375);
    renderGallery();
    fireEvent.click(rowButton(/Secret Lair Drop/));
    expect(window.location.search).toBe("");
    // Drawer content: title, caption line, honest price line (no USD → dash).
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Secret Lair Drop")).toBeTruthy();
    expect(within(dialog).getByText("SLD #2783 · Rare (2020)")).toBeTruthy();
    expect(within(dialog).getByText("— · foil $129.95")).toBeTruthy();
    // The pinned row did not move (queried raw — the modal drawer makes the
    // page behind it inert, so role queries can't see the table).
    const pressed = document.querySelector('button[aria-pressed="true"]');
    expect(pressed?.textContent).toContain("Commander Masters");
  });
});

describe("the tail", () => {
  it("Show all fetches once, appends unseen rows, and the button goes away", async () => {
    const tail = [printing(4), printing(5), cmm];
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ printings: tail, total: 5, truncated: false }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    renderGallery({ total: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Show all 5 printings" }));
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(6)); // header + 5
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`/api/cards/${uuid(99)}/printings`);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("a truncated tail shows the honest cap note", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ printings: [printing(4)], total: 300, truncated: true }),
      })),
    );
    renderGallery({ total: 300 });
    fireEvent.click(screen.getByRole("button", { name: "Show all 300 printings" }));
    await screen.findByText("Showing 4 of 300 printings, newest first");
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("a failed fetch keeps the button usable and says so", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({}) })),
    );
    renderGallery({ total: 5 });
    fireEvent.click(screen.getByRole("button", { name: "Show all 5 printings" }));
    await screen.findByText("Couldn’t load. Try again");
    expect(
      screen.getByRole("button", { name: "Show all 5 printings" }).hasAttribute("disabled"),
    ).toBe(false);
  });
});

describe("the fold (U7b, WAVE5 D8)", () => {
  const thirty = Array.from({ length: 30 }, (_, i) =>
    printing(i + 10, i === 0 ? { isDefault: true } : {}),
  );
  const bodyRows = (container: HTMLElement) => [
    ...container.querySelectorAll<HTMLTableRowElement>("tbody tr"),
  ];
  const hiddenRows = (container: HTMLElement) => bodyRows(container).filter((r) => r.hidden);

  it("shows 24 rows, keeps the rest in the markup hidden, and one click opens them with no fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderGallery({ printings: thirty, total: 30 });
    expect(bodyRows(container)).toHaveLength(30);
    expect(hiddenRows(container)).toHaveLength(6);
    expect(screen.getAllByRole("row")).toHaveLength(25); // header + 24
    fireEvent.click(screen.getByRole("button", { name: "Show all 30 printings" }));
    expect(hiddenRows(container)).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("past the inline rows the same click opens the fold and fetches the tail once", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ printings: [printing(99)], total: 31, truncated: false }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderGallery({ printings: thirty, total: 31 });
    expect(hiddenRows(container)).toHaveLength(6);
    fireEvent.click(screen.getByRole("button", { name: "Show all 31 printings" }));
    await waitFor(() => expect(bodyRows(container)).toHaveLength(31));
    expect(hiddenRows(container)).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("a set filter shows its matches whole; a deep link past the fold opens it", () => {
    const first = renderGallery({ printings: thirty, total: 30 });
    fireEvent.change(screen.getByPlaceholderText("Filter sets…"), { target: { value: "set 3" } });
    // "Set 30" to "Set 39": ten rows, none hidden, no button.
    expect(bodyRows(first.container).filter((r) => !r.hidden)).toHaveLength(10);
    expect(hiddenRows(first.container)).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
    first.unmount();

    window.history.replaceState(null, "", `/cards/abc?printing=${thirty[28].id}`);
    const second = renderGallery({ printings: thirty, total: 30 });
    expect(hiddenRows(second.container)).toHaveLength(0);
    expect(rowButton(/Set 38/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });
});

describe("filter", () => {
  it("appears only above 12 printings and filters by set name or code", () => {
    const { unmount } = renderGallery();
    expect(screen.queryByPlaceholderText("Filter sets…")).toBeNull();
    unmount();

    const many = [cmm, sld, ...Array.from({ length: 12 }, (_, i) => printing(i + 10))];
    renderGallery({ printings: many, total: many.length });
    const input = screen.getByPlaceholderText("Filter sets…");
    fireEvent.change(input, { target: { value: "secret" } });
    expect(screen.getAllByRole("row")).toHaveLength(2); // header + the SLD row
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.getByText(/No loaded sets match/)).toBeTruthy();
  });
});

describe("deep links", () => {
  it("?printing= present before mount pins that row", async () => {
    window.history.replaceState(null, "", `/cards/abc?printing=${sld.id}`);
    renderGallery();
    expect(rowButton(/Secret Lair Drop/).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Reset to default" })).toBeTruthy();
    await screen.findByText("Showing Secret Lair Drop #2783");
  });

  it("an id the card doesn't own fetches the tail once, then changes nothing", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ printings: ROWS, total: 3, truncated: false }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", `/cards/abc?printing=${uuid(77)}`);
    renderGallery();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Crafted-link stance: the default stays pinned, nothing swaps.
    expect(rowButton(/Commander Masters/).getAttribute("aria-pressed")).toBe("true");
    await act(async () => {}); // drain the resolve → no late re-pin either
    expect(rowButton(/Commander Masters/).getAttribute("aria-pressed")).toBe("true");
  });
});
