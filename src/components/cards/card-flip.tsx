/**
 * CardFlip (CARD-FLIP, 2026-11-14): the box a double-faced card turns over
 * in. Three elements and nothing else: the box (the card's width, given by
 * the caller, and the perspective), one turning element, and two faces back
 * to back, the far one drawn half a turn round so it reads true once the
 * element has turned. `state` (src/lib/motion/flip.ts) says which picture
 * sits in which slot and which slot faces the reader; the caller draws each
 * picture, so a face holds exactly what that surface drew before it could
 * turn. globals.css's "The card flip" is the other half: one 400 ms
 * `transform` transition on the turning element, on settle-400, only
 * without reduced motion.
 *
 * The near face is in flow and gives the box its height, so a card at rest
 * takes the room its image took alone; the far face fills the same box. The
 * hidden face leaves the accessibility tree, so a reader hears one image.
 *
 * Three rules for what goes inside (the prompt's probe measured each):
 * - A picture that arrives by a turn is whole before the turn starts:
 *   decoded, and with no fade of its own, which would show it half
 *   transparent as it comes round.
 * - The shadow stays on the images, so it narrows and leaves with its face.
 *   Nothing is drawn on the box. A caller may move the box as a whole: the
 *   hub hero tilts it toward the pointer (CARD-FLIP-HUB), which is safe
 *   because the box is already the plane the turn is drawn into.
 * - Nothing that flattens sits on the turning element or between it and the
 *   faces: no opacity under 1, no overflow, filter, mask or clip. Flattening
 *   is silent (the front shows mirrored where the back should be), so this
 *   component takes no class for those elements.
 */
import type { ReactNode } from "react";

import type { FlipPicture, FlipState } from "@/lib/motion/flip";

export function CardFlip({
  state,
  className,
  children,
}: {
  state: FlipState;
  /** The box: the card's width (and a tilting box's own transition). Its height is the near picture's. */
  className?: string;
  /** Draws one slot's picture: the near slot's, and the far slot's once it holds one. */
  children: (picture: FlipPicture) => ReactNode;
}) {
  return (
    <div data-flip="box" className={className}>
      <div data-flip="turn" data-turned={state.turned ? "" : undefined}>
        <div data-flip="near" aria-hidden={state.turned ? true : undefined}>
          {children(state.near)}
        </div>
        <div data-flip="far" aria-hidden={state.turned ? undefined : true}>
          {state.far && children(state.far)}
        </div>
      </div>
    </div>
  );
}
