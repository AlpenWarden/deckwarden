"use client";

/**
 * The commander hub's hero when its default printing has a back
 * (CARD-FLIP-HUB, 2026-11-15; build 3 of CARD-FLIP-session-prompt.md). The
 * card turns over with Flip, the turn the card page and the editor's Card
 * tab already make: the same `CardFlip`, the same two slots and a flag
 * (src/lib/motion/flip.ts), the same stylesheet recipe (globals.css, "The
 * card flip"). A hub shows one card a page, so /c/[slug] mounts this only
 * for a printing with a back; every other hub keeps its image alone.
 *
 * Three things meet on this card, each on its own element:
 * - **The morph.** The grid tile on /commanders and this hero are one
 *   boundary name (VIEW-TRANSITIONS), and here the boundary is around the
 *   box: React names a boundary's own elements, so the box is the one
 *   element that carries the name while a transition runs. A named element
 *   is flattened, which the box already is; on the turning element or a
 *   face the name would draw both faces in one plane. Flip stands outside
 *   the boundary: inside it React would name it too (`name_1`) and move it
 *   as a second card.
 * - **The tilt.** The tilt surface turns its first child (CARD-TILT), which
 *   is the box, so the box carries `data-tilt`, the transform, and the 120 ms
 *   `transform` transition the image carried alone. The turning element is
 *   never tilted: one transform on it is the turn. The shadows stay on the
 *   images and read the slide they inherit from the box. Flip is inside the
 *   surface and outside the box, so a pointer on its way to the button has
 *   left the card and the turn starts square.
 * - **The turn.** The first image is the page's LCP candidate on a phone and
 *   is in the server HTML, `priority`, exactly as the plain hero's; nothing
 *   about the back is in the document. Its address derives from the printing
 *   here, its decode starts when the pointer, focus or a touch reaches Flip,
 *   and it mounts whole, `priority` too, so no fade rides into the turn and
 *   no image changes `priority` while mounted.
 *
 * No line is announced (the hub has none, like the Card tab): the button's
 * pressed state says which side is up, and the hidden face leaves the
 * accessibility tree.
 */
import { RotateCcwIcon } from "lucide-react";
import { useRef, useState, ViewTransition } from "react";

import { CardFlip } from "@/components/cards/card-flip";
import { CardImage } from "@/components/cards/card-image";
import { useFaceDecode } from "@/components/cards/use-face-decode";
import { HERO_CARD_SHADOW } from "@/components/surface-header";
import { Button } from "@/components/ui/button";
import { embeddablePrintingImageUrl } from "@/lib/cards/images";
import { flipOf, turn, type FlipPicture } from "@/lib/motion/flip";

export function HubHeroFlip({
  name,
  printing,
  alt,
}: {
  /** The page's view-transition name, the grid tile's, so the two pair. */
  name: string;
  /** The default printing: both faces' addresses derive from its id and its override. */
  printing: { id: string; imageOverride?: unknown };
  /** The commander's name, which a double-faced card writes with both faces. */
  alt: string;
}) {
  const front = embeddablePrintingImageUrl(printing, "normal");
  const back = embeddablePrintingImageUrl(printing, "normal", "back");
  const [flip, setFlip] = useState(() => flipOf(front));
  const { decode, prepare } = useFaceDecode();

  // Flip's pointerenter, focus and touchstart: the back starts decoding, once.
  // No back's address is requested before.
  const prepareTurn = () => prepare(back);
  const turnToken = useRef(0);
  const turnOver = async () => {
    const token = ++turnToken.current;
    // Only a back that is not in its slot yet is fetched: the first turn, or
    // the turn after one that failed. A turn back fetches nothing.
    const arriving = !flip.turned && flip.far?.src !== back;
    const decoded = arriving && back !== null && (await decode(back));
    if (token !== turnToken.current) return; // a later press superseded this one
    setFlip((prev) => {
      // Each slot keeps what it holds: a turn moves the flag, and only an
      // arriving back puts a picture in. One that cannot load turns to the
      // fallback box.
      if (prev.turned) return turn(prev, prev.near.src);
      return turn(prev, arriving ? (decoded ? back : null) : (prev.far?.src ?? null));
    });
  };

  // One slot's picture: the hub hero's image, class for class. Always
  // `priority`: the near one is the server's, and the back mounts decoded.
  const picture = (shown: FlipPicture) => (
    <CardImage
      src={shown.src}
      alt={alt}
      width={488}
      height={680}
      priority
      className={`w-72 rounded-2xl ${HERO_CARD_SHADOW}`}
      fallback="No image"
    />
  );

  return (
    <>
      <ViewTransition name={name} share="morph" default="none">
        <CardFlip
          state={flip}
          className="w-72 motion-safe:[transition:transform_120ms_var(--ease-settle-120)]"
        >
          {picture}
        </CardFlip>
      </ViewTransition>
      {/* Under the card by the row's own gap: the card's near edge stands up
          to 23 px past its box as it comes round, and never reaches this. */}
      <div className="mt-6 flex">
        <Button
          variant="outline"
          size="sm"
          aria-pressed={flip.turned}
          onClick={() => void turnOver()}
          onPointerEnter={prepareTurn}
          onFocus={prepareTurn}
          onTouchStart={prepareTurn}
        >
          <RotateCcwIcon aria-hidden className="size-3.5" />
          Flip
        </Button>
      </div>
    </>
  );
}
