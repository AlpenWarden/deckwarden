/**
 * The card flip (CARD-FLIP, 2026-11-14; the second reference study's idea 1,
 * after React Bits' "Flip Card" for the one idea in it: a turn about the
 * vertical axis that settles without bounce, and not its drag, its glare or
 * its component). A double-faced card shows its other side by turning over,
 * the way the card does in a hand. Another printing of the same card still
 * cross-fades in place: two meanings, two motions, in the state as well as
 * the drawing.
 *
 * The state is two slots and a flag. A slot is a place a picture sits: the
 * near side of the turning element, or the far side, which is drawn half a
 * turn round, so the two are back to back. The flag says the far slot faces
 * the reader. `show` puts a picture in the slot facing the reader, over the
 * one it replaces: a printing change. `turn` puts a picture in the hidden
 * slot and flips the flag: the other face. Slots are not faces: after a
 * printing change with the back up, the slot facing the reader holds the
 * new front.
 *
 * One transition on one element reads the flag (globals.css, "The card
 * flip"), so the browser changes sides at exactly edge-on, and a second
 * press while the card is turning only flips the flag back: the hidden slot
 * already holds that picture, and the transition reverses from wherever the
 * card is. The other construction (half a turn, swap the picture, half a
 * turn) needs a timer matched to the curve and cannot reverse.
 *
 * Pure: no DOM and no clock. src/components/cards/card-flip.tsx draws it.
 */

/** A picture in a slot. */
export interface FlipPicture {
  /** The image's address; null draws the caller's fallback box. */
  src: string | null;
  /** The picture this one replaced in place, kept under its cross-fade; null when it came first or by a turn. */
  under: string | null;
  /** True when it replaced a picture in view, so it fades in over it; false when it arrives whole. */
  fade: boolean;
}

export interface FlipState {
  /** The slot that faces the reader until the first turn. Never empty. */
  near: FlipPicture;
  /** The slot behind it, empty until the first turn. */
  far: FlipPicture | null;
  /** True while the far slot faces the reader: the turning element is half a turn round. */
  turned: boolean;
}

/** Where a card starts: its first picture whole in the near slot, nothing behind it. */
export function flipOf(src: string | null): FlipState {
  return { near: { src, under: null, fade: false }, far: null, turned: false };
}

/** The picture in the slot facing the reader. */
export function facing(state: FlipState): FlipPicture {
  return (state.turned ? state.far : null) ?? state.near;
}

/**
 * A picture for the slot facing the reader: another printing of the card.
 * It fades in over the picture it replaces, which stays underneath, and the
 * flag is left alone, so with the far slot up the picture lands there. A
 * picture that already faces the reader is left as it is.
 */
export function show(state: FlipState, src: string | null): FlipState {
  const current = facing(state);
  if (current.src === src) return state;
  const picture: FlipPicture = { src, under: current.src, fade: true };
  return state.turned ? { ...state, far: picture } : { ...state, near: picture };
}

/**
 * The other side: the picture goes whole into the hidden slot (no fade and
 * nothing under it, so it is complete as it comes round) and the flag
 * flips. A hidden slot that already holds the picture keeps it as it is,
 * which is what a turn back finds, and a second turn asked mid-turn.
 */
export function turn(state: FlipState, src: string | null): FlipState {
  const hidden = state.turned ? state.near : state.far;
  const picture: FlipPicture = hidden?.src === src ? hidden : { src, under: null, fade: false };
  return state.turned
    ? { near: picture, far: state.far, turned: false }
    : { near: state.near, far: picture, turned: true };
}
