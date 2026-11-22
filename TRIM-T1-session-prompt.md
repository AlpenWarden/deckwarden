# TRIM-T1 session prompt: the UI kit: parts nothing renders, variants nothing sets

*Status: **done 2026-11-22: one commit on `main`, the one after `01af50d` (it adds this file), NOT pushed.** The ship note follows this paragraph; the prompt as the audit wrote it follows the note. Written 2026-11-22 by the TRIM audit (`TRIM-AUDIT-report.md`) from a read of `01af50d` (main). Every anchor below was checked against it by an auditor, by a verifier on a second model that re-ran the proof, and by the lead. Re-grep lines, trust the shapes. Add a dated ship note at the top of this file when the package ships.*

## Ship note (2026-11-22)

One commit on `main` after `01af50d`, **not pushed** (a push deploys; it waits for the owner's word): 14 kit files and 2 tests under `src/components/ui/`, three annotated rows and one new row in `LATER.md`, and this file. No route, no migration, no dependency, no sentence a visitor reads, no caching change. Each finding's proof command was re-run before its item was touched and gave the report's output; no item was skipped.

**What went.**

- **F01, the 21 parts nothing rendered** (with their names in the export lists and the imports only they used): `AlertDialogTrigger`, `AlertDialogMedia`; `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` (and avatar's `React` import); `DialogTrigger`, `DialogClose`, `DialogFooter`, `DialogDescription`; `DrawerTrigger`, `DrawerFooter`; `DropdownMenuPortal`; `FieldContent`; `PopoverHeader`, `PopoverTitle`, `PopoverDescription` (and popover's `React` import); `TableFooter`, `TableCaption`; the `Toggle` component (and its three imports; the file keeps the recipe ToggleGroup uses); the toast's `createToastManager` and `useToastManager` re-exports. The optional second step is done too: the five class fragments that tested for a slot only a deleted part set (four on the alert dialog's header and title, one on the horizontal Field).
- **F02, the Table's four tokens**: the row's two (a selected row, an expanded row) and the two on every head and body cell (a checkbox in a cell). The four call sites render text and plain links in their cells, in every state.
- **F03, variants and options no caller set**: TabsList `default` and `line`, and the Tabs vertical option; Badge `default`, `destructive`, `ghost`, `link`; the toggle's `outline` variant and its `default` and `lg` sizes; ToggleGroup's vertical option; Button `link` and `icon-lg`; the Drawer's `up` and `left` directions; AlertDialogContent's `sm` size; DialogContent's `showCloseButton`; Avatar's `sm` and `lg`; `inset` on six DropdownMenu parts; the toast's `info`, `warning` and `loading` icons (and their three icon imports).
- **Tests of deleted code, and nothing else** (3,948 → 3,945 tests, 327 files as before). `src/components/ui/button.test.tsx`, by its lines at `01af50d`: line 30 (the `icon-lg` row of the icon sizes' `it.each`, one case), **line 59** (`link` in the "has no hairline" `it.each`, one case), line 173 (the `link` line inside the aria-expanded parity case), lines 177 and 225 (`icon-lg` inside two loops over sizes), line 251 (the `link` row of the press table). `src/components/ui/control-edge.test.tsx:26-30`: the case for the Toggle's outline flavour, with its import and the sentence of the file's header that named it. Every other row and case is as it was.

**Decided, and disclosed.**

1. **ToggleGroup's twelve `spacing=0` tokens: six kept, six gone.** The brief said to keep all twelve because Segmented passes `spacing={0}`. Six of them can match and do style the Segmented control (the square corners, the 8 px side padding that beats the coarse-pointer 12 px, the two icon paddings, the first and last items' rounding): they are kept, in their order. The other six also need a vertical group (four) or the toggle's outline variant (two), which this package deletes, so they went with those options. The Segmented control measures the same before and after at 1440 and at 390 on a coarse pointer (below). Putting the six back is one line in `toggle-group.tsx` and 1,614 B of CSS.
2. **An option nobody set is gone from the API, and the attribute the page carried stays, written out.** `AlertDialogContent` and `Avatar` still render `data-size="default"`; `Tabs` and `ToggleGroup` still render `data-orientation="horizontal"`; kept rules select on three of the four. The rendered markup is the same, attribute for attribute. `Tabs` and `ToggleGroup` no longer accept `orientation` at all (both wrappers took it and never passed it to Base UI, so "vertical" only ever changed an attribute); `Drawer`'s `swipeDirection` is typed to the two directions that still have rules.
3. **Defaults.** Where one variant or size is left it is the default (TabsList `indicator`, the toggle's `sm`); every caller already named it. Badge has two left and no default: every Badge and every call of its recipe names one.
4. **One line at the top of each cut kit file** says the file was cut on purpose and that a registry re-sync would bring the parts back (in `table.tsx` and `field.tsx` it joins the header that names the registry commit).
5. **`button.test.tsx` line 59** was not on the brief's list of five lines; it names the deleted `link` variant the same way, so it went with them (six places, not five).
6. The LATER row the prompt offers "if the owner wants it" (the kit was cut; a part that is needed again comes from the registry) is **not opened**: the kit files' own header lines say it. Say the word and it is one row.

**Measured.** Sizes are from a clean worktree, tracked files only, which is what a deploy builds. Its build of `01af50d` is the audit's stylesheet byte for byte.

| Line | Before | After | Change |
|---|---:|---:|---:|
| Main stylesheet, raw | 185,630 B | 171,082 B | -14,548 B (7.8 %) |
| Main stylesheet, gzip-9 | 29,981 B | 28,304 B | -1,677 B |
| Second stylesheet | 5,721 B | 5,721 B | byte-identical |
| Client JavaScript on every route (the analyzer's floor) | 1,141,897 B | 1,141,444 B | -453 B |
| Client JavaScript, the editor (both editor routes) | 1,719,142 B | 1,712,991 B | -6,151 B |
| Client JavaScript, the share page | 1,486,739 B | 1,481,648 B | -5,091 B |
| Client JavaScript, the account page | 1,425,228 B | 1,419,832 B | -5,396 B |
| All client chunk files together | 2,286,738 B in 55 | 2,274,425 B in 55 | -12,313 B |
| Source lines, non-test (the audit's count) | 78,255 | 77,970 | -285 |
| The Atraxa hub's document, raw | 275,531 B | 227,969 B | -47,562 B |
| The Atraxa hub's document, gzip-9 | 34,561 B | 33,982 B | -579 B |
| The brackets page's document, raw | 188,726 B | 183,820 B | -4,906 B |
| Route table | 84 lines | 84 lines | identical |

- **The stylesheet, as sets of rules.** 143 declarations under 102 selectors left and none arrived. 136 of them belong to 87 class tokens this package deleted, each found in the file the diff took it from: tabs 3,648 B, avatar 2,916 B, drawer 2,914 B, toggle-group 1,781 B, alert-dialog 1,576 B, table 667 B, badge 574 B, field 187 B, toggle 88 B, dropdown-menu 68 B, button 57 B. The other 7 are two custom properties that no rule names any more (a registered property with its fallbacks, used only by the avatar group's overlap, and one line-height variable, used only by the Field's content part).
- **Against the brief's "about 12,100 B".** That figure was the static cut of F03 with all twelve ToggleGroup tokens kept. The measured 14,548 B is that, plus the six tokens of decision 1 (1,614 B), plus F02's four Table tokens (521 B), which the figure did not count, plus the orphaned custom properties and the selector lists the minifier could shorten.
- **Client JavaScript is smaller, not unchanged.** The brief expected "unchanged to within a few hundred bytes" because unused exports are already dropped. That holds for the floor every route pays (-453 B). The routes that load the Drawer, the Tabs, the toast and the menus lose more, because a deleted variant's class string inside a live component did ship as JavaScript.
- **Source lines**: about 337 lines of code out and 52 lines of header notes in. Files: 466 before and after (the toggle file keeps its recipe).
- **Still in the served CSS because a tracked document spells them** (row 217, package T6): five deleted tokens, 406 B together.
- **A local stylesheet size is only comparable from a clean worktree.** In the shared checkout the same cut reads 186,232 B → 171,684 B: the untracked audit report at the root mints three rules and nine theme variables into every local build there (602 B).

**Checks.**

- `pnpm check`, in a clean worktree holding only this commit's files: exit 0, 0 lint errors, 5 warnings, 3,945 tests in 327 files. In the shared checkout the literal command is red before and after this package, for a reason outside it (LATER row 487: ESLint reads the audit's analyzer snapshot under `.claude/`); its four steps there, with that folder left out of the lint step: typecheck clean, 0 errors and the same 6 warnings, format clean, 3,945 tests in 327 files (3,948 at `01af50d`, the same way).
- `pnpm build`, both in the shared checkout and in the clean worktree: green, the route table identical to `.claude/trim-audit-evidence/build-route-table.txt`.
- **Before and after, on two clean builds** (`01af50d`, and `01af50d` plus this commit's files), each served locally and each read twice, in headless Chrome for Testing: the audit's ten baseline pages at 1440 and at 390 (touch), and 19 scripted states: at 1440 a Segmented control switched, the editor's More menu, a Modal (Deck history), the right pane's tab strip on another tab, a toast with Undo, with the editor header's badge on screen throughout; at 390 the Group and Sort popover with its two Segmented controls, a Segmented control switched, the More menu, the Modal, the Search and Tools panes behind the bottom tab bar, the phone card sheet, a toast with Undo; at 820 the editor and its tools drawer; and `/account` signed in (a throwaway user on the development branch, with the header avatar) with the delete-account dialog open, at both widths (opened and closed, never armed).
  - Every pair of runs, before against after and each build against itself, gives the same answer: **no difference other than the removed class tokens.** Per pair: 39 captures, 50,700 elements (the same tags in the same order, the same attributes, the same text, the same boxes, the same computed style on each element and on its before and after pseudo-elements), 29,013 roles and accessible names, 136 pictures with the same pixels in every one of the four runs, the same writes (the home page's deck lookup, the editor's saves), the same end state of the deck.
  - 1,927 of the 50,700 elements carry a shorter class list. 57 distinct tokens left the rendered pages, every one a token this package deleted; none arrived and none moved.
  - **The Segmented control measures the same**: 8 px side padding on every item at both widths, and at 390 on the coarse pointer a 44 px minimum both ways.
  - The ten pages answer with the same status codes and cache headers from both builds.
  - **The comparison can see a change**: the same run with one rule injected (the Segmented items at 12 px side padding, the regression the brief warns about) comes out different in boxes, computed styles, pixels and the Segmented measurement.
  - F02's own test, on server HTML: the hub's and the brackets page's documents have the same tags, attributes, text and inline scripts before and after; class lists differ only by removed tokens (101 rows and 505 cells on the hub).
- Smokes, against the after tree on the development branch: `pnpm smoke:decks` (58 checks) and `pnpm smoke:hubs` (64 checks) on its production build, `pnpm smoke:seo` (97 checks) on its dev server, which that smoke's sitemap checks need. All pass.

**What the read did not cover.** The dark theme only (the site's default in that browser): a deleted rule that did not match in dark cannot match in light, since the only theme-bound deleted rules are dark ones, but no light page was drawn. No hover or focus state beyond the scripted ones. Chromium only; no WebKit, no real phone. Bitmap art (card images) is compared by source, box and computed style, not by pixels: Chrome scales a JPEG differently from run to run on the same build, so the compared pictures are taken with images hidden. One Piece art never loaded: the harness blocks every deckwarden.gg host, the analytics beacon and Sentry, so nothing was read from or sent to production. Nothing is deployed, so nothing was read on the live site.

**Found on the way, and left alone** (outside this package's fence).

- `pnpm check` is red in the shared checkout with no source change: `eslint .` reads the audit's analyzer snapshot under `.claude/trim-audit-evidence/`. LATER row 487 has the two ways to end it. Every package session will meet it in its pre-flight.
- The audit's report file mints CSS into local builds (above); LATER row 217 is annotated.
- The harness and everything it wrote are in `.claude/trim-t1-evidence/` (gitignored; its `README.md` says how to run each script). Three things it had to get right, each of which first produced a false difference: Chrome lists custom properties in a different order in every browser process (hash the standard properties, sorted); a picture clipped beyond the viewport comes out in more than one variant on the same build (take viewport pictures at scroll steps); and Next's link prefetches cost a server render per linked page (block them: a capture went from about 45 s to about 5 s).

**What it is.** The UI kit under `src/components/ui` carries 21 parts that nothing renders and a set of variants and options that no caller sets. Their JavaScript is already left out by the build; their class names are not, so the stylesheet every page loads holds rules for them. Delete the parts, the unset variants and options, and four class tokens on the Table that no table here can match. Class: **Delete**. Findings F01, F02, F03 of the audit.

**Found (2026-11-22).**

- **F01** (dead). Twenty-one parts of the UI kit that nothing renders. 216 lines in 10 files; 3,055 B of CSS on every page (no JavaScript: the bundler drops unused exports).
- **F02** (wasted). The Table primitive's four class tokens that no table here can match. 46,056 B of a 275,531 B hub document (472 B after gzip); five CSS rules nothing matches; about 195 B of client JavaScript.
- **F03** (wasted). Variants and options of the UI kit that no caller sets, and the stylesheet rules they mint on every page. About 220 lines in 14 kit files; 12,120 B raw (1,370 B gzip) of the stylesheet on every route, by a static cut of the built file.

For each finding, where it is (file and lines), the excerpt read, **the proof command to re-run first** and its output, what could break and the verifier's note are in `TRIM-AUDIT-report.md`, section 4, under the same id. The auditors' full records and the scripts the proofs call are in `.claude/trim-audit-evidence/` (gitignored; on this machine: `harness/README.md` there says how to run each).

**Size M. Deletions only, in about 13 kit files: about 220 lines. No route, no migration, no dependency. The kit's kept parts keep their markup and their `data-slot` names.**

Pre-flight, in order.

1. **Main is green.** `pnpm check` = 3,948 tests / 327 files / 0 errors / 6 warnings at `01af50d` (re-run and record what it is today). `pnpm build`'s route table is `.claude/trim-audit-evidence/build-route-table.txt`; the diff at the end must be empty.
2. **Order.** This package depends on no other. Other sessions share this checkout: stage explicit paths, and re-read `LATER.md` and `MEMORY.md` immediately before editing them.
3. **Re-run each item's proof command (report, section 4) before touching the item.** If a proof no longer holds (another session started using the thing), skip that item and report it; do not force it.
4. **Baseline before any edit**, with the audit's own scripts (`.claude/trim-audit-evidence/harness/`; each header says how to run it): the scoreboard lines named under Tests, and a capture of each page named there at 1440 and 390 (a screenshot, the accessible names, the status code and cache headers).
5. **Local only.** Servers and smokes run against `localhost` and the Neon development branch (`scripts/smoke/guard.ts`). Nothing is read from or sent to deckwarden.gg or the production database without the owner's OK in the chat, each time. Say at the start what will be measured.

## What this package is NOT (scope fence)

- NOT a re-sync of any kit file from the shadcn registry, and NOT the shadcn stylesheet import (F90, the owner's).
- NOT a kept part's markup, class order or `data-slot` name: CSS and tests select on them.
- NOT props of components outside the kit (`DeckTile`, `UserAvatar`, the color chips): those are F65, in T21.
- NOT folding `ui/dialog.tsx` into `ui/modal.tsx`: a follow-up the auditor names, for the next time the kit is touched.
- NOT a migration (`drizzle/` is history), NOT a new dependency, NOT a change to a sentence a visitor reads, NOT a change to any route's caching.
- Anything else → `LATER.md` with a trigger. No "while I'm here".

## The package (decide and disclose the details)

1. **F01: Twenty-one parts of the UI kit that nothing renders.**

   The change: Delete the 21 declarations and their names in the export lists, with the imports only they used. Optional second step in the same package: drop the five never-matching class fragments (has-data-[slot=alert-dialog-media] at alert-dialog.tsx:62 x3 and :104, (class token omitted) at field.tsx:41), 907 B more of CSS.

   The test that it behaves the same: pnpm check green (tsc names any missed importer). pnpm build: route table identical to build-route-table.txt; bundle-report.py per-route client JavaScript identical (avatar.tsx still 832 B). Diff of the built stylesheet: only the 25 rules dead-class-css.py lists are gone. Screenshots at 1440 and 390 of the baseline set plus one Modal (History in the editor), one AlertDialog (delete a deck on /account), the header avatar, a Popover and a toast: pixel-identical.

   Watch for (the verifier): The kit then differs from the shadcn registry, which matters only if someone later compares the two.

2. **F02: The Table primitive's four class tokens that no table here can match.**

   The change: Delete the four tokens from the three class strings in ui/table.tsx.

   The test that it behaves the same: pnpm check; the hub's server HTML before and after differs only by the removed tokens (text, attributes and row count identical); computed styles of a staples row and cell unchanged at 1440 and 390, since no element matched the removed selectors.

   Watch for (the verifier): A later re-sync from the shadcn registry would bring the tokens back. The file header names the registry commit, so add a note there.

3. **F03: Variants and options of the UI kit that no caller sets, and the stylesheet rules they mint on every page.**

   The change: Delete the Toggle component (no importer; `toggle-group.tsx` uses `toggleVariants` only) and the toast's two unused re-exports. Delete the variants and options no caller sets: TabsList `default` and `line` and the Tabs vertical tokens (both TabsLists pass `indicator`); Badge `default`, `destructive`, `ghost` and `link` (every Badge passes `outline` or `secondary`); the toggle's `outline` variant and its `default` and `lg` sizes (Segmented's items pass `sm`); ToggleGroup's vertical tokens; Button `link` and `icon-lg`; the Drawer's `up` and `left` directions (the one Drawer swipes right); AlertDialogContent `size="sm"` and the media tokens; DialogContent `showCloseButton`; Avatar `sm` and `lg`; the `inset` option on six DropdownMenu parts; the toast's `info`, `warning` and `loading` icons. KEEP ToggleGroup's `spacing=0` tokens: `segmented.tsx:90` passes `spacing={0}`, so they style the Segmented control today. The 18 unused parts this record also lists are F01's. Tests that name a deleted variant lose those rows and nothing else: `button.test.tsx` names the `link` variant and the `icon-lg` size in five places (lines 30, 173, 177, 225, 251) inside cases that run over every size and variant, and `control-edge.test.tsx:26` names the Toggle's outline flavour.

   The test that it behaves the same: pnpm check; a build before and after: the same route table, the built stylesheet smaller by about 14.9 KB raw; pixel comparison at 1440 and 390 of the baseline set plus one open AlertDialog (account delete), a Modal, the md tools drawer and the phone card sheet, the editor's tab strip, a Segmented control, a toast with Undo and the editor header's Badge.

Files this package touches (from the findings; re-derive at the start): `src/components/ui/alert-dialog.tsx`, `src/components/ui/avatar.tsx`, `src/components/ui/dialog.tsx`, `src/components/ui/drawer.tsx`, `src/components/ui/dropdown-menu.tsx`, `src/components/ui/field.tsx`, `src/components/ui/popover.tsx`, `src/components/ui/table.tsx`, `src/components/ui/toast.tsx`, `src/components/ui/toggle.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/badge.tsx`, `src/components/ui/button.tsx`, `src/components/ui/control-edge.test.tsx`.

## Tests and checks

- `pnpm check` green, with no test deleted or loosened except the tests of deleted code; name each deleted or changed test in the ship note.
- `pnpm build`: the route table identical to the baseline (the same routes with the same static, ISR and dynamic marks).
- Against a local server on the development branch: `pnpm smoke:decks`, `pnpm smoke:hubs`, `pnpm smoke:seo`.
- Before and after, `/`, `/commanders`, `/c/atraxa-praetors-voice`, `/cards`, the Sol Ring card page, a share page, `/sets`, `/brackets`, `/l/ace-newgate-st22-001` and the editor, plus one open AlertDialog (delete account), a Modal, the tools drawer at tablet width, the phone card sheet, the editor's tab strip, a Segmented control, a toast with Undo and the editor header's badge, at 1440 and 390: the same pixels, the same accessible names, the same URLs, status codes and cache headers, the same database writes. A JSON field may go only if every reader is in this repository and none reads it.
- The scoreboard lines this package should move (section 3 of the report; measure with the same scripts and record before and after):
  - Built stylesheet (3.1): 185,630 B down by about 12,100 B raw (6.5 %; gzip about 1,370 B) on every route. That is a static cut of the built file, re-run by the verifier, not a build: measure it. Classes that a document also names stay until T6 narrows what Tailwind reads.
  - Source lines (3.1): down by about 220.
  - The hub document (3.4): 275,531 B down by about 46,000 B of repeated class text in its table rows (472 B after gzip).
  - Client JavaScript (3.3): unchanged to within a few hundred bytes. Route table identical.
- Deploy: every push to `main` deploys. Push only on the owner's word, then read the result as the deploy-verification note in `MEMORY.md` says.

## LATER rows this package touches or opens

- Rows the findings cite: 134, 217, 263. Annotate each with what this package changed for it; every changed row keeps exactly two cells.
- Opens one row if the owner wants it: 'the kit was cut to what the site uses on 2026-11; a part or variant that is needed again comes from the shadcn registry', with the trigger 'a feature needs one'.

## Session notes

- Each proof is a whole-word grep for a part's or variant's name: re-run it first and stop on any new hit.
- Tests that name a deleted variant lose those rows only (tests of deleted code), and the ship note names each: `control-edge.test.tsx:26` (the Toggle's outline flavour) and `button.test.tsx` lines 30, 173, 177, 225 and 251 (the `link` variant and the `icon-lg` size, inside cases that run over every size and variant). Every other row of those cases stays as it is. If the owner would rather keep the Button whole, leave those two and take the rest.
- A later `shadcn add` or registry update brings deleted tokens back: add one line to the kit files' header note saying the file was cut down on purpose.
- Compare the built stylesheet before and after as sets of rules: every rule that leaves must belong to a deleted part or variant.
- ToggleGroup's `spacing=0` tokens are LIVE (`segmented.tsx:90` passes `spacing={0}`): the auditor's first list had them as dead and the verifier caught it. Deleting them would change the Segmented control's touch padding at 390.
- Never `cd`; `pnpm` needs `export PATH="$HOME/.local/node22/bin:$PATH"`; the shell's `grep` is ugrep (use `/usr/bin/grep`); scratch scripts under `scripts/.tmp/` are linted; evidence goes under `.claude/trim-t1-evidence/` (gitignored).
- Tailwind reads the Markdown files for class names until T6 ships (LATER row 217): quote no class strings in the ship note.
