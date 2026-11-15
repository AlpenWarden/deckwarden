"use client";

/**
 * The card-page printings gallery (W5, WAVE2.md D4): click a printing → it
 * shows in the main spot. One provider owns `selectedPrintingId`; the hero
 * (left column, sticky on md+) and the printings table are its two client
 * leaves, and everything between them — the identity text block, legality,
 * combos — stays server-rendered, passed through as children.
 *
 * Selection IS the URL: `?printing=` through `printing-param.ts`
 * (replaceState, null server snapshot), so reload reproduces the view, the
 * canonical tag never carries it, and back/forward gain no entries. The
 * default printing renders server-side exactly as before the gallery —
 * `priority` on the hero image (the LCP element) and the smoke-pinned
 * fallback strings are load-bearing (optcg-smoke:167).
 *
 * Pin vs drawer is decided at click time with matchMedia (D4): md+ pins the
 * hero (decode off-screen → 250 ms motion-safe crossfade → aria-live
 * announcement); below md a bottom drawer shows the printing large instead
 * (the hero is scrolled away on phones). A failed image keeps the selection
 * and shows the fallback text.
 *
 * Flip turns the card over (CARD-FLIP, 2026-11-14; src/lib/motion/flip.ts):
 * "another printing" and "the other side" are two motions. A printing
 * change still cross-fades in place and lands on the front; Flip puts the
 * other face in the hidden slot of `CardFlip` and turns to it, 400 ms about
 * the vertical axis. The wrappers a turn needs are in the server HTML only
 * when the default printing has a back; otherwise they mount inside the
 * first swap to a printing that has one (a swap remounts both images
 * anyway), so a card with one face keeps the hero markup it always had.
 * The back costs nothing until it is asked for: its decode starts when the
 * pointer or focus reaches Flip, and no back's address is requested before.
 *
 * Payload: the page inlines ≤ INLINE_PRINTINGS_MAX slim rows; "Show all"
 * fetches the capped tail from /api/cards/[id]/printings, which also
 * resolves deep links to printings beyond the inline hundred. Deep links to
 * ids the card doesn't own resolve to nothing and change nothing (the W4
 * crafted-link stance).
 */
import { ArrowUpRightIcon, RotateCcwIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { CardFlip } from "@/components/cards/card-flip";
import { CardImage } from "@/components/cards/card-image";
import { useFaceDecode } from "@/components/cards/use-face-decode";
import { CardNamePreview } from "@/components/deck/card-name-preview";
import { MD_QUERY } from "@/components/editor/use-tier";
import { HERO_CARD_SHADOW } from "@/components/surface-header";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { embeddablePrintingImageUrl, thumbnailUrl, type ImageFace } from "@/lib/cards/images";
import { printingCaption, type GalleryPrinting } from "@/lib/cards/printings";
import { facing, flipOf, show, turn, type FlipPicture, type FlipState } from "@/lib/motion/flip";
import { cn } from "@/lib/utils";

import { usePrintingParam, writePrintingParam } from "./printing-param";

/** "Filter sets…" appears only above this many printings (D4). */
export const FILTER_MIN_PRINTINGS = 12;
/**
 * Rows shown before "Show all {total} printings" (U7b, WAVE5.md D8): the
 * rest of the inline rows render `hidden` (every one stays in the ISR HTML)
 * until the one button opens them — the same button that fetches the tail
 * past the inline 100, so one click shows everything the card has. A set
 * filter shows its matches whole, and a pinned row past the fold (a deep
 * link) opens it, so "Shown" is never a hidden row.
 */
export const PRINTINGS_FOLD = 24;

interface PrintingsResponse {
  printings: GalleryPrinting[];
  total: number;
  truncated: boolean;
}

/** What the hero currently renders; lags the selection by one image decode. */
interface Displayed {
  id: string | null;
  face: ImageFace;
  /**
   * The pictures in the hero's two slots and which slot faces the reader
   * (src/lib/motion/flip.ts). Until the first swap the near slot holds the
   * server-rendered LCP image, untouched; a swapped-in picture keeps the
   * outgoing one underneath its crossfade until the next swap.
   */
  flip: FlipState;
  /**
   * True once the hero draws through CardFlip's wrappers: from the server
   * when the default printing has a back, otherwise from the first swap to
   * a printing that has one. They never mount under a still image, and a
   * card that only shows single-faced printings never gets them.
   */
  sided: boolean;
}

type TailStatus = "idle" | "loading" | "done" | "error";

/**
 * W7: the card page's outbound buy link, built SERVER-SIDE by the page from
 * the adapter declaration + the build-time affiliate env (ISR-safe — the ●
 * route never reads env at request time) and passed through as data. `rel`
 * rides along so no "sponsored" literal ships in this client bundle.
 */
export interface CardBuyLink {
  href: string;
  vendor: string;
  rel: string;
}

interface GalleryContextValue {
  cardName: string;
  hasPrices: boolean;
  buy: CardBuyLink | null;
  rows: GalleryPrinting[];
  total: number;
  truncated: boolean;
  tailStatus: TailStatus;
  pinnedId: string | null;
  pinnedRow: GalleryPrinting | null;
  displayed: Displayed;
  announceText: string;
  pin: (id: string) => void;
  /** Back to the default printing — removes ?printing= outright. */
  reset: () => void;
  flip: () => void;
  /** Flip's pointerenter, focus and touchstart: the other face starts decoding. */
  prepareFlip: () => void;
  activateRow: (row: GalleryPrinting) => void;
  loadAll: () => void;
}

const GalleryContext = createContext<GalleryContextValue | null>(null);

function useGallery(): GalleryContextValue {
  const value = useContext(GalleryContext);
  if (!value) throw new Error("PrintingsGallery components need the PrintingsGallery provider.");
  return value;
}

export function PrintingsGallery({
  cardId,
  cardName,
  gameCode,
  printings,
  total,
  buy = null,
  children,
}: {
  cardId: string;
  cardName: string;
  gameCode: string;
  /** Slim rows, default first then newest first — the page's ≤ 100. */
  printings: GalleryPrinting[];
  total: number;
  /** Server-built outbound buy link (W7); null = the game declares no buy. */
  buy?: CardBuyLink | null;
  children: ReactNode;
}) {
  const hasPrices = gameCode !== "optcg";
  const defaultRow = useMemo(
    () => printings.find((p) => p.isDefault) ?? printings[0] ?? null,
    [printings],
  );

  const [extraRows, setExtraRows] = useState<GalleryPrinting[] | null>(null);
  const [apiMeta, setApiMeta] = useState<{ total: number; truncated: boolean } | null>(null);
  const [tailStatus, setTailStatus] = useState<TailStatus>("idle");
  const [drawerRow, setDrawerRow] = useState<GalleryPrinting | null>(null);
  const [announceText, setAnnounceText] = useState("");
  const [displayed, setDisplayed] = useState<Displayed>(() => ({
    id: defaultRow?.id ?? null,
    face: "front",
    flip: flipOf(defaultRow ? embeddablePrintingImageUrl(defaultRow, "normal") : null),
    sided: defaultRow?.hasBack ?? false,
  }));

  // The tail appended after the inline rows keeps "default first, then newest
  // first" intact — the API is newest-first and everything new is older than
  // the inline hundred.
  const rows = useMemo(() => {
    if (!extraRows) return printings;
    const seen = new Set(printings.map((p) => p.id));
    return [...printings, ...extraRows.filter((p) => !seen.has(p.id))];
  }, [printings, extraRows]);
  const rowsById = useMemo(() => new Map(rows.map((p) => [p.id, p])), [rows]);

  const urlId = usePrintingParam();
  const pinnedId = urlId && rowsById.has(urlId) ? urlId : (defaultRow?.id ?? null);
  const pinnedRow = pinnedId ? (rowsById.get(pinnedId) ?? null) : null;

  // The id the hero last STARTED a swap for — the sync effect's no-op guard
  // (the server-rendered default never re-decodes on plain loads).
  const shownIdRef = useRef<string | null>(defaultRow?.id ?? null);
  const swapToken = useRef(0);

  // Off-screen decodes, shared by address (use-face-decode.ts): a swap never
  // paints a half-loaded hero (D4), and Flip's press shares the decode its
  // hover started instead of asking a second time.
  const { decode, prepare } = useFaceDecode();

  const showPrinting = useCallback(
    async (row: GalleryPrinting, face: ImageFace, how: "show" | "turn" = "show") => {
      const token = ++swapToken.current;
      shownIdRef.current = row.id;
      const src = embeddablePrintingImageUrl(row, "normal", face);
      const ok = src ? await decode(src) : false;
      if (token !== swapToken.current) return; // a later swap superseded this one
      const picture = ok ? src : null;
      setDisplayed((prev) => ({
        id: row.id,
        face,
        // Flip turns; a printing change shows, in the slot facing the reader.
        // A turn needs the wrappers already on screen (an element that mounts
        // turned has nothing to turn from), so the swap that mounts them shows.
        flip: how === "turn" && prev.sided ? turn(prev.flip, picture) : show(prev.flip, picture),
        sided: prev.sided || row.hasBack,
      }));
      setAnnounceText(
        `Showing ${row.setName} #${row.collectorNumber}${face === "back" ? ", back face" : ""}`,
      );
    },
    [decode],
  );

  // Selection → hero. One path serves clicks, the deep-link restore after
  // hydration, and tail rows resolving a previously unknown ?printing=.
  useEffect(() => {
    if (!pinnedId || pinnedId === shownIdRef.current) return;
    const row = rowsById.get(pinnedId);
    if (row) void showPrinting(row, "front");
  }, [pinnedId, rowsById, showPrinting]);

  // The in-flight/done guard lives in a ref, not the status state: state
  // updaters must stay pure (StrictMode double-invokes them), and effects may
  // not set state synchronously.
  const tailStartedRef = useRef(false);
  const loadAll = useCallback(() => {
    if (tailStartedRef.current) return;
    tailStartedRef.current = true;
    setTailStatus("loading");
    void fetch(`/api/cards/${cardId}/printings`)
      .then((res) => {
        if (!res.ok) throw new Error(`printings API → ${res.status}`);
        return res.json() as Promise<PrintingsResponse>;
      })
      .then((data) => {
        setExtraRows(data.printings);
        setApiMeta({ total: data.total, truncated: data.truncated });
        setTailStatus("done");
      })
      .catch(() => {
        tailStartedRef.current = false; // "try again" is real
        setTailStatus("error");
      });
  }, [cardId]);

  // A deep link naming a printing beyond the inline rows: fetch the tail once
  // and let it resolve. Still unknown after that → not this card's → default.
  // Deferred a tick — the kickoff isn't render work (set-state-in-effect).
  useEffect(() => {
    if (!urlId || rowsById.has(urlId) || tailStatus !== "idle") return;
    const t = setTimeout(loadAll, 0);
    return () => clearTimeout(t);
  }, [urlId, rowsById, tailStatus, loadAll]);

  const pin = useCallback(
    (id: string) => {
      writePrintingParam(id === defaultRow?.id ? null : id);
    },
    [defaultRow],
  );

  const reset = useCallback(() => {
    writePrintingParam(null);
  }, []);

  const flip = useCallback(() => {
    if (!pinnedRow) return;
    void showPrinting(pinnedRow, displayed.face === "back" ? "front" : "back", "turn");
  }, [pinnedRow, displayed.face, showPrinting]);

  // The back costs nothing until it is asked for (about 100 to 125 KB, on a
  // page whose hero is the LCP image): the other face starts decoding when
  // the pointer or focus reaches Flip, once per picture, so the press finds
  // it ready or already on its way.
  const prepareFlip = useCallback(() => {
    if (!pinnedRow) return;
    const other = displayed.face === "back" ? "front" : "back";
    prepare(embeddablePrintingImageUrl(pinnedRow, "normal", other));
  }, [pinnedRow, displayed.face, prepare]);

  // Pin vs drawer, decided at click time (D4): md+ pins the sticky hero;
  // phones get the bottom drawer instead — the hero is scrolled away there.
  const activateRow = useCallback(
    (row: GalleryPrinting) => {
      const md =
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia(MD_QUERY).matches;
      if (md) pin(row.id);
      else setDrawerRow(row);
    },
    [pin],
  );

  const value = useMemo<GalleryContextValue>(
    () => ({
      cardName,
      hasPrices,
      buy,
      rows,
      total: apiMeta?.total ?? total,
      truncated: apiMeta?.truncated ?? false,
      tailStatus,
      pinnedId,
      pinnedRow,
      displayed,
      announceText,
      pin,
      reset,
      flip,
      prepareFlip,
      activateRow,
      loadAll,
    }),
    [
      cardName,
      hasPrices,
      buy,
      rows,
      apiMeta,
      total,
      tailStatus,
      pinnedId,
      pinnedRow,
      displayed,
      announceText,
      pin,
      reset,
      flip,
      prepareFlip,
      activateRow,
      loadAll,
    ],
  );

  return (
    <GalleryContext.Provider value={value}>
      {children}
      <PrintingDrawer
        row={drawerRow}
        cardName={cardName}
        hasPrices={hasPrices}
        buy={buy}
        onClose={() => setDrawerRow(null)}
      />
    </GalleryContext.Provider>
  );
}

/**
 * One picture as the hero has drawn it since W5: the picture it replaced as
 * an underlay, and over it the image, keyed by its address so a new picture
 * mounts and its crossfade starts. Always `priority`, so CardImage adds no
 * load fade of its own: a picture that arrives by a turn carries no fade at
 * all and is whole as it comes round. The shadow is on the image, so in a
 * turn it leaves with its face.
 */
function HeroPicture({
  picture,
  alt,
  fallback,
}: {
  picture: FlipPicture;
  alt: string;
  fallback: string;
}) {
  return (
    <>
      {picture.under && (
        // eslint-disable-next-line @next/next/no-img-element -- CDN hotlink by design (CardImage docblock); decoded underlay for the crossfade.
        <img
          src={picture.under}
          alt=""
          aria-hidden
          width={488}
          height={680}
          className="absolute inset-0 w-72 rounded-2xl"
        />
      )}
      <CardImage
        key={picture.src ?? "none"}
        src={picture.src}
        alt={alt}
        width={488}
        height={680}
        priority
        className={cn(
          "relative w-72 rounded-2xl",
          HERO_CARD_SHADOW,
          picture.fade && "motion-safe:animate-dw-in",
        )}
        fallback={fallback}
      />
    </>
  );
}

/**
 * The hero column: the pinned printing large, its caption, Flip (only with a
 * back face), Reset to default. Sticky from md so a long table scrolls under
 * a visible main image — what makes "click → shows in the main spot" legible.
 * A printing with a back draws through CardFlip, so Flip turns the card.
 */
export function PrintingsHero() {
  const { cardName, pinnedRow, displayed, announceText, reset, flip, prepareFlip, buy } =
    useGallery();
  const hasDefault = pinnedRow !== null || displayed.id !== null;
  const picture = (shown: FlipPicture) => (
    <HeroPicture
      picture={shown}
      alt={cardName}
      fallback={hasDefault ? "Card image coming soon" : "No image"}
    />
  );

  return (
    <div className="relative -mt-20 shrink-0 self-start md:sticky md:top-4 md:-mt-24">
      {displayed.sided ? (
        <CardFlip state={displayed.flip} className="w-72">
          {picture}
        </CardFlip>
      ) : (
        <div className="relative">{picture(facing(displayed.flip))}</div>
      )}
      {pinnedRow && (
        <div className="mt-3 w-72 text-sm">
          <p className="font-medium">{pinnedRow.setName}</p>
          <p className="text-muted-foreground">
            {printingCaption(pinnedRow)}
            {pinnedRow.year ? ` (${pinnedRow.year})` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {pinnedRow.isDefault ? (
              <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 text-xs">
                Default
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={reset}>
                Reset to default
              </Button>
            )}
            {pinnedRow.hasBack && (
              <Button
                variant="outline"
                size="sm"
                aria-pressed={displayed.face === "back"}
                onClick={flip}
                onPointerEnter={prepareFlip}
                onFocus={prepareFlip}
                onTouchStart={prepareFlip}
              >
                <RotateCcwIcon aria-hidden className="size-3.5" />
                Flip
              </Button>
            )}
          </div>
        </div>
      )}
      {/* W7 (D6): under the hero caption; renders only when the game sells. */}
      {buy && (
        <p className="mt-3 w-72 text-sm">
          <a href={buy.href} className="hover:underline" target="_blank" rel={buy.rel}>
            Buy on {buy.vendor}
            <ArrowUpRightIcon aria-hidden className="ml-1 inline size-3.5 align-[-0.15em]" />
          </a>
        </p>
      )}
      <p aria-live="polite" className="sr-only">
        {announceText}
      </p>
    </div>
  );
}

/**
 * The printings section: heading with count, "Filter sets…" above
 * FILTER_MIN_PRINTINGS, the aria-pressed rows, and the Show-all tail. Table
 * semantics stay (D4) — the Set cell's button stretches over the row with an
 * after:inset-0 overlay, so the row is the target and the cells stay cells.
 */
export function PrintingsTable() {
  const {
    cardName,
    hasPrices,
    rows,
    total,
    truncated,
    tailStatus,
    pinnedId,
    activateRow,
    loadAll,
  } = useGallery();
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState(false);

  const needle = filter.trim().toLowerCase();
  const visibleRows = needle
    ? rows.filter((p) => `${p.setName} ${p.setCode}`.toLowerCase().includes(needle))
    : rows;
  // The fold (U7b): derived, never stored — a filter or a pinned row past
  // the fold opens the rows without a click, and nothing runs in an effect.
  const pinnedIndex = pinnedId ? visibleRows.findIndex((p) => p.id === pinnedId) : -1;
  const open = expanded || needle !== "" || pinnedIndex >= PRINTINGS_FOLD;
  const folded = !open && visibleRows.length > PRINTINGS_FOLD;
  const showAll = () => {
    setExpanded(true);
    if (rows.length < total) loadAll();
  };

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-2">
        <h2 className="type-section">Printings · {total}</h2>
        {total > FILTER_MIN_PRINTINGS && (
          <label className="text-muted-foreground text-sm">
            <span className="sr-only">Filter sets</span>
            <Input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter sets…"
              className="h-8 w-44"
            />
          </label>
        )}
      </div>
      <div className="mt-2 overflow-x-auto">
        {/* No price columns for OP (P4.4): prices are 0/2,785 non-null —
            two all-dash columns would imply data we don't have. */}
        <table className={`w-full text-sm ${hasPrices ? "min-w-[28rem]" : ""}`}>
          <thead>
            <tr className="text-muted-foreground border-b text-left">
              <th className="py-1.5 pr-4 font-medium">Set</th>
              <th className="py-1.5 pr-4 font-medium">#</th>
              <th className="py-1.5 pr-4 font-medium">Rarity</th>
              {hasPrices && (
                <>
                  <th className="py-1.5 pr-4 font-medium">USD</th>
                  <th className="py-1.5 font-medium">Foil</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((p, i) => (
              <PrintingRow
                key={p.id}
                printing={p}
                cardName={cardName}
                hasPrices={hasPrices}
                pinned={p.id === pinnedId}
                hidden={folded && i >= PRINTINGS_FOLD}
                onActivate={activateRow}
              />
            ))}
          </tbody>
        </table>
        {needle && visibleRows.length === 0 && (
          <p className="text-muted-foreground mt-2 text-sm">
            No loaded sets match “{filter.trim()}”.
          </p>
        )}
      </div>
      {/* One button for the fold and the tail (U7b): while rows are folded it
          shows (even after a capped tail, so a reader can always open what
          is loaded); otherwise it stays only while the tail is still to come. */}
      {folded || (rows.length < total && !(tailStatus === "done" && truncated)) ? (
        <div className="mt-2 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={showAll}
            disabled={tailStatus === "loading"}
            aria-busy={tailStatus === "loading"}
          >
            {tailStatus === "loading" ? (
              <>
                <Spinner aria-hidden role={undefined} aria-label={undefined} className="size-3.5" />
                Loading…
              </>
            ) : (
              `Show all ${total} printings`
            )}
          </Button>
          {tailStatus === "error" && (
            <span className="text-destructive text-xs">Couldn’t load. Try again</span>
          )}
        </div>
      ) : tailStatus === "done" && truncated ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Showing {rows.length} of {total} printings, newest first
        </p>
      ) : null}
    </>
  );
}

function PrintingRow({
  printing,
  cardName,
  hasPrices,
  pinned,
  hidden,
  onActivate,
}: {
  printing: GalleryPrinting;
  cardName: string;
  hasPrices: boolean;
  pinned: boolean;
  /** Folded away (U7b): rendered, in the HTML, not shown. */
  hidden: boolean;
  onActivate: (row: GalleryPrinting) => void;
}) {
  const image = embeddablePrintingImageUrl(printing, "normal");
  // Same rule as search rows (R3 F6): the `small` rendition — Scryfall's, or
  // since P4.9 the One Piece mirror's WebP — and a blank spacer otherwise.
  const thumb = thumbnailUrl(image);

  return (
    <tr
      hidden={hidden}
      className={cn(
        "hover:bg-accent relative border-b transition-colors duration-[120ms] last:border-0",
        pinned && "bg-muted",
      )}
    >
      <td
        className={cn(
          "py-1.5 pr-4",
          // The 2 px game-accent rule on the pinned row — an inset shadow, so
          // no layout shift against its neighbors.
          pinned && "shadow-[inset_2px_0_0_var(--color-accent-game)]",
        )}
      >
        <CardNamePreview name={cardName} image={image} caption={printingCaption(printing)}>
          <button
            type="button"
            aria-pressed={pinned}
            onClick={() => onActivate(printing)}
            className="focus-visible:outline-accent-game flex items-center gap-2 text-left after:absolute after:inset-0 focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <span
              aria-hidden
              data-slot="thumb"
              className="h-9 w-[1.625rem] shrink-0 overflow-hidden rounded-[2px]"
            >
              {thumb && (
                <CardImage src={thumb} alt="" width={146} height={204} className="h-9 w-auto" />
              )}
            </span>
            <span className="min-w-0">
              {printing.setName}
              {pinned && <span className="text-muted-foreground text-xs"> · Shown</span>}
            </span>
          </button>
        </CardNamePreview>
      </td>
      <td className="py-1.5 pr-4 uppercase">
        {printing.setCode} {printing.collectorNumber}
      </td>
      <td className="py-1.5 pr-4 capitalize">{printing.rarity ?? "—"}</td>
      {hasPrices && (
        <>
          <td className="py-1.5 pr-4">{printing.usd ? `$${printing.usd}` : "—"}</td>
          <td className="py-1.5">{printing.usdFoil ? `$${printing.usdFoil}` : "—"}</td>
        </>
      )}
    </tr>
  );
}

/**
 * The phone path (D4): tap a row → this bottom drawer, reusing ui/drawer.tsx
 * as-is. Large image, set line, prices; the footer holds W7's [ Buy ↗ ]
 * (rendered only when the game declares buy — no dead controls).
 */
function PrintingDrawer({
  row,
  cardName,
  hasPrices,
  buy,
  onClose,
}: {
  row: GalleryPrinting | null;
  cardName: string;
  hasPrices: boolean;
  buy: CardBuyLink | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showSwipeHandle
    >
      <DrawerContent aria-label="Printing details">
        {row && (
          <div className="pb-6">
            <DrawerHeader>
              <DrawerTitle>{row.setName}</DrawerTitle>
              <DrawerDescription>
                {printingCaption(row)}
                {row.year ? ` (${row.year})` : ""}
              </DrawerDescription>
            </DrawerHeader>
            <div className="flex justify-center px-4 pt-3">
              <CardImage
                src={embeddablePrintingImageUrl(row, "normal")}
                alt={cardName}
                width={488}
                height={680}
                className="w-60 rounded-xl shadow-md"
                fallback="Card image coming soon"
              />
            </div>
            {hasPrices && (row.usd || row.usdFoil) && (
              <p className="mt-3 text-center text-sm">
                {row.usd ? `$${row.usd}` : "—"}
                {row.usdFoil ? ` · foil $${row.usdFoil}` : ""}
              </p>
            )}
            {/* D4's [ Buy ↗ ] (W7) — name search; exact printings are LATER. */}
            {buy && (
              <div className="mt-3 flex justify-center">
                <Button
                  nativeButton={false}
                  variant="outline"
                  size="sm"
                  render={<a href={buy.href} target="_blank" rel={buy.rel} />}
                >
                  Buy on {buy.vendor}
                  <ArrowUpRightIcon aria-hidden className="size-3.5" />
                </Button>
              </div>
            )}
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );
}
