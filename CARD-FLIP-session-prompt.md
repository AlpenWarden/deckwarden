# CARD-FLIP session prompt: a double-faced card turns over

*Status: **written 2026-11-14**, on the owner's pick ("The flip (idea 1)") from the second reference study (Prompt Motion, Eyecandy, React Bits, MotionSites, Savee), which was given in chat and has no write-up file. Three builds, each its own session, in the order below; one package per session, deployed and `pnpm check`-green or not done (CLAUDE.md). Nothing is built: no file under `src/` changed. Anchors verified against `9e8d326`; re-grep lines, trust the shapes. This file is untracked until build 1's commit adds it (as `952af16` did for the last prompt), so a worktree subagent needs it committed first. Build 3 and build 4 of `DESIGN-REFERENCES-session-prompt.md` (HUB-TO-EDITOR) both rewrap the hub hero: never in parallel, and the second one reads the first one's record.*

*Progress: **build 1 (CARD-FLIP, the card page) is built**, 2026-11-14, the commit after `9e8d326` (REDESIGN.md "A double-faced card turns over"; LATER rows 416 to 423). It was not pushed when this line was written: the push and any production read wait for the owner's word. Builds 2 and 3 are not started. **What build 1 corrects here, for the builds after it.** (1) `/cards/[id]` is `ƒ`, not ●, and has been since 2026-10-18 (dynamic behind the CDN header); the route table is `ƒ` before and after, so "stay ISR" under Must hold means `/c/` only. (2) On Etali at 1440 the LCP element is the rules text (672 by 222 px), not the hero image, on both builds; at 390, and on Arcane Signet, it is the hero. Hold a build to the baseline's element, whatever it is. (3) Putting the transition inside the no-preference query is not enough for "no animation" under reduced motion: the backstop's 0.01 ms on the default `transition-property: all` still starts a transition object, so the turning element says `transition: none` outside the query. (4) `CardFlip` takes the box's class and a function that draws one slot's picture; `flip.ts` is `flipOf`, `facing`, `show` and `turn` over `{ near, far, turned }`. A turn needs the wrappers already on screen (an element that mounts turned has nothing to turn from), so the swap that mounts them shows instead. (5) The perspective is 1,400 px; row 421 holds the 2,550 px alternative and its trigger. (6) WebKit's `elementFromPoint` at the card's centre lags the pixels just past edge-on (the front at 93°, the back by 102°): judge a WebKit frame by its pixels. (7) The DevTools MCP's browser was held by another session all day. `.claude/card-flip-evidence/harness/` (git-ignored) drives its own Chrome for Testing over CDP, runs Lighthouse through an isolated instance of the MCP server, reads Safari over safaridriver and the Simulator through a probe proxy; its `turn.mjs` and `behave.mjs` are the recipe below, ready to point at another surface.*

## The ask, deepened

A double-faced card shows its other side by turning over, the way the card does in a hand. Today the card page's Flip draws exactly what choosing another printing draws, a 250 ms cross-fade, so "another printing" and "the other side" look the same. And the card page is the only place a back face can be seen at all.

Deeper, not bigger:

- **Two meanings, two motions, in the state as well as the drawing.** Another printing cross-fades in place. The other face turns. Nothing else changes: a printing change still lands on the front, the polite line and every string stay.
- **One transition on one element.** Two faces back to back, so the browser changes faces at exactly edge-on and a second press reverses the turn from wherever it is. The other construction (half a turn, swap the picture, half a turn) needs a timer matched to the curve and cannot reverse; LATER row 413 is that kind of snap.
- **The back costs nothing until it is asked for.** A back is about 100 to 125 KB, and the hero is the page's LCP image.
- **A card with one face is untouched.** On the dev branch 554 of 36,502 Magic cards open on a printing with a back (1.5 %). Every other page keeps its hero markup, element for element.
- **It says which side is up** to a reader who cannot see it, and under reduced motion the side changes with no motion at all.
- **Proved by something outside the session:** frozen frames of the turn, the network list, LCP and layout shifts against a baseline taken first, the server markup, real Safari, the Simulator, and the owner's own hand.

Reference: React Bits, "Flip Card", https://www.reactbits.dev/micro/flip-card (read 2026-11-14; its robots.txt allows it and points agents at `/llms.txt`). Borrow only the turn about the vertical axis that settles without bounce. Not the drag to turn (a press rests the tilt, and a drag on touch is a scroll), not the glare (it reads as foil on a printing that isn't), not the component (it builds on `motion`; F19). Nothing from the site enters the repo.

## What exists (verified at `9e8d326`)

- **The one Flip.** `src/app/(site)/cards/[id]/printings-gallery.tsx` (W5; WAVE2.md D4: Flip only when `has_back`). `PrintingsHero` shows the button only for a pinned printing with a back (`pinnedRow.hasBack`; a `RotateCcwIcon` and "Flip"). `flip()` calls `showPrinting(pinnedRow, <the other face>)`, the function a printing change calls with `"front"`: it decodes the image off screen (`preloadImage`), drops a superseded swap (`swapToken`), then sets `displayed` (`id`, `face`, `src`, `underSrc`, `initial`) and the polite line ("Showing Innistrad #300, back face"). The hero draws every swap one way: the outgoing picture as an absolutely placed underlay `<img>`, the incoming `CardImage` keyed by id, face and src with `motion-safe:animate-dw-in`. So every swap already remounts both images. `initial` keeps the server-rendered image (the LCP element, `priority`) untouched until the first swap. The hero column is `md:sticky`; below md a tapped row opens `PrintingDrawer`, the printing large, with no Flip.
- **Its one pin.** `printings-gallery.test.tsx`, "Flip renders only with a back face and announces it" (the button by `/Flip/`, the line above). No other test and no smoke names Flip, and the cross-fade's class is not pinned.
- **The flag.** `card_printings.has_back` (`src/db/schema.ts`), written by `hasBack(card)` in `src/lib/games/mtg/scryfall-map.ts`: no top-level image and a face that has one, which is transform, modal double-faced and reversible printings. Split, adventure and Kamigawa flip cards have one image and no back. Always false for One Piece (`punk-map.ts`). Two readers: the card page's loader (`cards/[id]/card.ts`) and `/api/cards/[id]/printings`, both into `GalleryPrinting.hasBack`. Nothing else reads it.
- **The back's address.** `embeddablePrintingImageUrl(printing, "normal", "back")` (`src/lib/cards/images.ts`): derived from the printing id, or `image_override.back`. No URL is stored.
- **`CardImage`** (`src/components/cards/card-image.tsx`) renders no wrapper (R1b, REDESIGN.md: the DOM shape at every site is the `<img>`). Without `priority` it fades in from `opacity-0` over 250 ms once loaded. Its transition list carries `transform` on 120 ms for the tilt.
- **The tilt** (`src/lib/motion/tilt.ts`, `src/components/cards/tilt-surface.tsx`, globals.css "The card tilt"): `attachTilt` puts `data-tilt` and four custom properties on the surface's first element child; `[data-tilt]` is `transform: perspective(1000px) var(--tilt)`; `.shadow-lg[data-tilt]` slides the shadow by `--tilt-dx` and `--tilt-dy`; a press, a leave and a running view transition rest it.
- **The hub hero** (`src/app/(site)/c/[slug]/page.tsx`): `TiltSurface`, then ``ViewTransition name={`hub-card-${slug}`}``, then `CardImage` (`priority`, `w-72 rounded-2xl`, `HERO_CARD_SHADOW`). `loadDefaultPrinting` (`src/lib/hub/queries.ts`) selects `id` and `imageOverride` only. `src/components/hub/view-transitions.test.ts` pins both hub pages' source text (the `ViewTransition` line followed by `<CardImage`, and the `TiltSurface` line). `/l/` has the same markup, and One Piece has no backs.
- **The editor.** The leader card is a button, "Show {name}", that opens the Card tab (`src/components/deck/leader-zone.tsx`), so the editor's home for a turn is the Card tab, not the leader card. The Card tab (`src/components/editor/card-detail-pane.tsx`): `paneImage` is a previewed printing row's image or `card.image`, drawn at two sites (the pane, `mx-auto w-full max-w-72`; the phone sheet from its half point, `w-[min(60%,…)]`), neither keyed, so a new card swaps the picture in place. Its docblock says the image is not interactive. `EditorCard` is `CardData` plus `image`: no printing id, no back flag. A previewed row is a `GalleryPrinting`, which has both.
- **The card wire** (`CardWire`, `src/lib/decks/editor-state.ts`) is built in three places for cards that reach the Card tab, each joined to the printing for `id` and `imageOverride`: `src/lib/cards/wire.ts` (`wireSelect`, `toWire`: resolve, autofill, alternatives, combos, the random leader, token fill), `src/app/api/cards/search/route.ts`, and `src/lib/decks/deck-cards-wire.ts` (a deck's entries, the chosen printing first; the deck and precon routes). The recommendations route sends no image; its adds resolve through the first. The search route shows the idiom for an optional field: `...(scope ? { printingId } : {})`, so an unscoped response stays byte for byte (X4a). `toSmallImage(url)` in `images.ts` is the precedent for deriving a rendition from the wire's `image` when no printing id is at hand.
- **The contract.** U2: four curves, 120 for controls, 250 for cross-fades, 400 for one-off moments, `motion-safe:` on everything decorative, the reduced-motion backstop (durations to 0.01 ms). `src/lib/theme/tokens.test.ts` allows no other curve word in the stylesheet (`cubic-bezier`, `ease-out`, `ease-in-out`), no `drop-shadow`, and pins the morph's 400 ms on settle-400. No 3D utility is used in `src` today; Tailwind 4.3.3 has `perspective-*`, `transform-3d`, `backface-hidden` and `rotate-y-*`, and the stage and the tilt are hand-written rules in globals.css. Next's floor is Safari 16.4 (`node_modules/next/dist/docs/03-architecture/supported-browsers.md`).

## Measured before writing (2026-11-14)

- **Who it reaches** (the Neon dev branch, one read-only transaction each; `scripts/.tmp/card-flip-census.ts` and `card-flip-census-2.ts`, gitignored). Magic: 113,606 printings, 1,540 with a back. Of 36,502 cards, 618 have a back on some printing, 554 on the default printing, 72 are mixed (a two-sided printing among single-faced ones: Sol Ring 1 of 138, Command Tower 2 of 121) and 64 have a back only off the default. Six single-faced cards open on a two-sided printing, so their Flip shows other art of the same card: Hallowed Fountain, Blood Crypt and Overgrown Tomb (Lorwyn Eclipsed), Ugin, Eye of the Storms, Clarion Conqueror and Magmatic Hellkite (Tarkir: Dragonstorm). Commander hubs: 119 of 4,144 have a back (2.9 %); by EDHREC rank the first are Birgi (501), Etali (812), Ojer Taq (928), Sephiroth (1,230), Ojer Axonil (1,540) and Tergrid (1,589). No Magic printing carries an image override (all 4,843 are One Piece's), and One Piece has no back.
- **Addresses to test with** (dev branch ids; the census finds them again if one misses):
  - Etali, transform, three printings, all with a back: `/cards/131662c3-2d6b-46fb-b507-fe2f80485a33` and `/c/etali-primal-conqueror`.
  - Birgi, modal: `/cards/2e2c8398-3897-42f5-8420-c33fa81bcdad` and `/c/birgi-god-of-storytelling`.
  - Sol Ring, the mixed case (the default has one face, SLD 1512 has two): `/cards/459562ce-8045-4d49-98d6-943034aa44af?printing=d74a72a2-d46a-41c2-a400-70571197b020`. Sol Ring is not a control.
  - Hallowed Fountain, one face and a two-sided default: `/cards/f79602b7-7667-495a-833a-afc4782e0591`.
  - The control, no back on any of 94 printings: Arcane Signet, `/cards/eeefb0f4-69e3-4cc5-a66b-4da36d0be35c`.
- **The image host** (HEAD requests as `Deckwarden/1.0`): front and back `normal` answer 200 with a year's `max-age` for Etali's default printing (121 and 125 KB), Sol Ring SLD 1512 (111 and 103 KB) and Hallowed Fountain ECL 347 (79 and 97 KB). A single-faced printing's `/back/` is a 404.
- **The turn itself** (headless Chrome on a probe page, `scripts/.tmp/card-flip-probe.html`: a 288 px card, `perspective: 1400px`, one `transform` transition of 400 ms on settle-400, frozen through the Web Animations API):

  | At | Angle | Card's width | Past the box, top and bottom | Facing |
  | --- | --- | --- | --- | --- |
  | 0 ms | 0° | 288 px | 0 | front |
  | 40 ms | 23.9° | 263.7 px | 8.7 px | front |
  | 80 ms | 64.8° | 123.7 px | 20.6 px | front |
  | 106 ms | 89.7° | 1.7 px | 23.0 px | front |
  | 110 ms | 93.2° | 16.0 px | 23.0 px | back |
  | 160 ms | 129.8° | 185.4 px | 17.2 px | back |
  | 240 ms | 161.6° | 273.6 px | 6.7 px | back |
  | 320 ms | 174.8° | 286.8 px | 1.9 px | back |
  | 400 ms | 180° | 288 px | 0 | back |

  The faces change at about 106 ms, a quarter of the way in: the front leaves fast and the back settles for the other 290 ms. At the stage's 1,400 px the near edge passes the box by up to 23 px (half the height times half the width, over the perspective less half the width). That crosses the 12 px between the hero and its caption from about 50 to 200 ms; in the frame frozen at 80 ms the near lower corner reaches the caption's first line. About 2,550 px keeps the edge inside the gap and flattens the turn.
- **Three things the probe settled.** A shadow on a face narrows and leaves with it. A child's opacity inside a face (the cross-fade) does not disturb the turn. An opacity under 1 on the turning element flattens it: the reader sees the front mirrored where the back should be, `elementFromPoint` still names the front, and `getComputedStyle(…).transformStyle` still answers `preserve-3d`.

## Build 1: CARD-FLIP (the card page)

1. **The baseline, before the first edit.** On a local production build (`rm -rf .next`, `pnpm build`, `preview_start` "start"; never dev), for Etali and Arcane Signet at 1440 and 390: the `largest-contentful-paint` entry (its element and time), the layout shifts, the hero's server markup from `curl` (the `<img>` and its parents), the resource list (no `/back/` address), and Lighthouse accessibility. The record holds no LCP for this page, so this is the number the build is held to.
2. **The state, pure**, e.g. `src/lib/motion/flip.ts` with tests: two slots and a flag. `show(state, src)` puts a picture in the slot facing the reader (a printing change; in build 2, a card change). `turn(state, src)` puts it in the hidden slot and flips the flag. Slots are not faces: after a printing change with the back up, the slot facing the reader holds the new front, which is what today's rule already draws. Tests: a turn and a turn back reuse both slots; a printing change while turned leaves the flag alone; a second turn asked mid-turn only flips the flag back, since the hidden slot already holds the picture.
3. **`CardFlip`**, e.g. `src/components/cards/card-flip.tsx`: the box (the card's width and aspect, the perspective), the turning element, and two faces back to back, each holding what the hero draws today (the underlay and the keyed `CardImage`). `CardImage` is not changed. Three rules:
   - The arriving face is whole before the turn starts: decoded (`preloadImage`, as today), `priority` (so `CardImage` adds no load fade) and without `animate-dw-in`. Either fade would show the back half transparent as it comes round. A printing change keeps its cross-fade, in the facing slot.
   - The shadow stays on the images (`HERO_CARD_SHADOW`), so it turns with the card. Nothing on the box.
   - Nothing that flattens goes on the turning element or between it and the faces: no opacity under 1, no overflow, filter, mask or clip.
4. **The CSS**, a recipe in globals.css's components layer keyed on data attributes, as the tilt's is: `transition: transform 400ms var(--ease-settle-400)` inside `@media (prefers-reduced-motion: no-preference)`, so reduced motion has no transition to collapse. Transform only. `tokens.test.ts` pins the duration, the curve and the media query in the same commit. The perspective is the build's one judgment: look at 1,400 px and at about 2,550 px with the frozen frames, and record which and why.
5. **The card page.** `PrintingsHero` draws through `CardFlip`. Flip turns. A printing change shows, and lands on the front as today.
   - The wrappers are in the server HTML when the default printing has a back. Otherwise they mount inside a swap to a printing with one (a swap already remounts both images), never under a still image. A card that opens on a single-faced printing keeps today's hero markup.
   - Flip's `pointerenter`, `focus` and `touchstart` start the other face's decode, once per printing. Before that no `/back/` address is requested.
   - The button keeps its label and icon and gains `aria-pressed`, true while the back is up. The polite line is unchanged.
   - A back that fails to decode turns to the fallback box, as a failed swap shows it today.
6. **Done when:**
   - the frozen frames on a local production build read as the probe's: identity at rest, edge-on near 106 ms, `matrix3d(-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1)` at the end, the back upright and unmirrored in the screenshot, and `elementFromPoint` at the card's centre naming the facing image at rest on both sides;
   - a second press at 150 ms reverses from where the card is, with one transition and no jump;
   - a printing change with the back up cross-fades to the new front without a turn, and the next Flip turns to the new back;
   - the resource list holds no `/back/` address until the pointer or focus reaches Flip;
   - the LCP element, its time and the layout shifts equal the baseline within noise on Etali and on Arcane Signet; Arcane Signet's hero markup is the baseline's, element for element, and so is Sol Ring's until SLD 1512 is pinned;
   - under emulated reduced motion the side changes with no animation (`getAnimations()` on the turning element is empty);
   - the accessibility tree shows one image named by the card, the button's pressed state and the polite line;
   - real Safari (REDESIGN.md's DESKTOP-SAFARI recipe) and the iOS Simulator draw the turn as Chromium does: no mirrored face, no flicker, the shadow leaving with the face. Firefox is read, or its LATER row is written;
   - RTL pins the state (slots, flag, `aria-pressed`, the line, the decode on intent, no back before it); `pnpm check` is green; the route table is unchanged (`/cards/[id]` still ●); REDESIGN.md and LATER are written.

## Build 2: CARD-FLIP-EDITOR (the Card tab)

1. **The flag on the wire.** `hasBack: true` rides only on a card whose shown printing has a back (the search route's idiom, so every other response stays byte for byte). The three builders are each already joined to the printing; `deck-cards-wire.ts` reads the chosen printing's flag when an entry has one. The client derives the address: `toBackImage(url)` in `images.ts` beside `toSmallImage`, for the documented cards.scryfall.io pattern only and null for anything else, so there is never a control with nothing behind it. Tests for both. `smoke:decks`, `smoke:alternatives`, `smoke:autofill` and `smoke:combos` stay green on dev.
2. **The pane image through `CardFlip`**, at both sites. A card change never turns: the new card's front lands in the facing slot at once, as the picture swaps today. A previewed printing row uses its own `hasBack` and `embeddablePrintingImageUrl(row, "normal", "back")`.
3. **Where the control sits is this build's first decision**, made in the pane with Arcane Signet and Etali highlighted in turn. It must not move the name when the highlight passes a double-faced card (read the name's top for both), must not cover a pixel of the card (the artist and © line), and is 44 px on touch. First candidates: the end of the name row in the pane, and beside the image in the phone sheet, where the image leaves at least 40 % of the row free. It shows only when there is a back.
4. **Done when:** the frozen frames read right in the pane and in the sheet; arrowing through ten search results, two of them double-faced, never starts a turn (`getAnimations()` on the turning element stays empty) and requests no `/back/` address; the name's top is equal for a single-faced and a double-faced result; a response without a double-faced card is byte for byte the baseline's; the editor's fixed slots (U3a) are unmoved at 390 and 1440; `pnpm check` is green; REDESIGN.md and LATER are written.

## Build 3: CARD-FLIP-HUB (the commander hub)

1. `loadDefaultPrinting` also selects `hasBack`. When it is true the `/c/` hero draws through `CardFlip` inside the `ViewTransition`, with Flip under the card. When it is false the page's markup is today's. `/l/` does not change.
2. **The tilt moves to the box.** With a flipper the surface's first child is the box, so `data-tilt` and its transform land there. The box then needs the 120 ms `transform` transition `CardImage` gave the image. The shadow stays on the faces and reads the inherited `--tilt-dx` and `--tilt-dy` (today's rule matches a shadow on `[data-tilt]`, not under it). The far slot is mirrored in x, so its slide is negated. Flip sits inside the tilt surface and outside the card's box, so the pointer leaving the card for the button rests the tilt and every turn starts square.
3. **The morph.** `view-transitions.test.ts` pins both hub pages' source text; the `/c/` pins move in the same commit and the record says so. The grid to hub morph and its return still pair on a local production build, read with the `startViewTransition` wrapper. A hub left with the back up morphs from the back's snapshot: record what that looks like before deciding it needs anything.
4. **Done when:** the frozen frames read right; the tilt's angles and the shadow's slide at the edges are CARD-TILT's recorded values, on both slots; the morph pairs both ways; a hub without a back (`/c/atraxa-praetors-voice`) keeps its markup and `/l/` its bytes; `/c/[slug]` is still ●; on a phone the title's top on Etali's hub is recorded beside Atraxa's; `pnpm check` is green; REDESIGN.md and LATER are written.

## Reading the turn (the recipe the table came from)

```js
// In the page, right after the click that starts the turn.
const t = turning.getAnimations()[0]; // one CSSTransition on transform, 400 ms
t.pause();
for (const ms of [0, 40, 80, 106, 160, 240, 400]) {
  t.currentTime = ms;
  const m = new DOMMatrixReadOnly(getComputedStyle(turning).transform);
  const deg = (Math.atan2(m.m31, m.m11) * 180) / Math.PI; // 0, 23.9, 64.8, 89.7, 129.8, 161.6, 180
  // Screenshot here; document.elementFromPoint(cx, cy) names the facing image.
}
t.finish();
```

Headless Chrome through the chrome-devtools MCP (`new_page`, `resize_page`, `evaluate_script`, `take_screenshot`), on a local production build. The in-app pane pauses frame-driven work while it is hidden.

## Must hold (every build)

- The motion contract: the four curves, 400 on settle-400 for the turn, transform only, no filter, no glow, no entry fade, no dependency. A printing change stays a 250 ms cross-fade.
- No pinned string moves: "Flip", "Reset to default", "Default", "Card image coming soon", "No image", the polite line's words, "Show {name}".
- `CardImage` renders no wrapper and does not change.
- The card page and `/c/` stay ISR. The hero image stays the LCP element with `priority`. No back is requested before intent. No layout shifts.
- Both faces show whole at rest, and no control sits over a card's pixels (the artist and © line).
- One Piece pages do not change: zero diff on `/l/` and on a One Piece card page.
- Scratch scripts and smokes never target production; a production read waits for the owner's OK.

## Traps

- **Flattening is silent** (measured above): the symptom is a mirrored front, and the computed `transform-style` still says `preserve-3d`. Read pixels or `elementFromPoint`.
- **Two fades can ride into the turn**: `animate-dw-in` on the keyed hero image, and `CardImage`'s load fade on an image without `priority`.
- **jsdom has no layout and no 3D.** Pin state and attributes in RTL; read geometry in the browser.
- **Sol Ring looks like a control and is not** (one two-sided printing of 138).
- Headless Chrome fires no focus event from a script focus without CDP's focus emulation (`Emulation.setFocusEmulationEnabled`), and the decode on focus is one of the checks.
- `rm -rf .next` before a build that follows dev; a dev reload loop is a stale `.next/dev`.
- `pollFor` and `findByText` are tight under load (LATER row 397): run the suite on an idle machine, or with `--maxWorkers=4 --testTimeout=60000` and say so.
- A `view-transition-name` must be unique on the page at transition time (build 3).
- Prettier does not format Markdown. LATER row numbers are line numbers (415 today): append, never insert.

## Out of scope (LATER rows with triggers, written by the build that would have touched them)

- The card page's phone printing drawer has no Flip, today and after build 1.
- Deck grid tiles, the search grid, name previews and the share page show a double-faced card's front only.
- A key for the turn in the editor (its hotkeys are `/` and `?`).
- A drag to turn, a glare or foil sheen, and a card that lifts as it turns.
- A busy state for a Flip whose back is still decoding on a slow connection: time it, and write the row if it reads as a dead click.
- Six single-faced cards open on a two-sided printing (the census above): a question about how `is_default` is chosen, not about the turn.

## Done

Each build ends with its own commit, `pnpm check` green, the deploy's Vercel status on the full sha and the CI run, a REDESIGN.md addendum in the house shape (Amends, Build, Pins moved, Read on a local production build, Production, Left for later), its LATER rows, and this file's Progress line. Left for the owner after build 1: turn a card on your own phone and say whether it reads as a card or as an effect.
