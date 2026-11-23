# TRIM-T3 session prompt: dead stylesheet items, one static file, config leftovers

*Status: **done and live: commit `2185442` on `main`, the one after `2d3f3e4` (it adds this file), pushed 2026-11-23 03:19 Z on the owner's word and read on production on the owner's OK.** The ship note follows this paragraph, with the push, the deploy, the production read and the audit session's check at its end; the prompt as the audit wrote it follows the note, with three theme-key names left out and marked where they stood (five places; the note's point 12 says why). Written 2026-11-22 by the TRIM audit (`TRIM-AUDIT-report.md`) from a read of `01af50d` (main). Every anchor below was checked against it by an auditor, by a verifier on a second model that re-ran the proof, and by the lead. Re-grep lines, trust the shapes. Add a dated ship note at the top of this file when the package ships.*

## Ship note (2026-11-23)

One commit on `main` after `2d3f3e4`: `2185442`. This note was written before the push; the push, the deploy and three corrections from the audit session's check are at its end, and each corrected sentence is marked where it stands. In it: the stylesheet, the token file, one kit file, one deleted image, `package.json`, `.gitignore`, two new rows in `LATER.md` and this file. No route, no migration, no dependency, no sentence a visitor reads, no caching change, and no test edited. Each finding's proof command was re-run before its item was touched and holds; no item of the package's list was skipped. `main` moved once under this session: another session's documents-only commit `2d3f3e4` landed while this one measured. So the two builds compared below are `b1073fb` (`2b907b4` plus T2's first note commit) and `b1073fb` plus this package, and the commit's own tree was built once more at the end (Checks).

**What went.**

- **F11, stylesheet items nothing references.** In `src/app/globals.css`: seven keys of the theme block (the five chart color keys, the card-foreground color key and the 3xl radius key; none of them put a byte in the built stylesheet) and the `--card-foreground` declaration of the light block and of the dark block. In `src/lib/theme/tokens.ts`: the same pair, because `tokens.test.ts` compares the two files key for key. In `src/components/ui/button-group.tsx`: the one class token that sized a Select trigger placed in a group; no element has carried that slot since S8 deleted the house Select. The chart variables themselves (`--chart-1` to `--chart-5`), the game accents and the brand stay: they are read.
- **F12, `public/home/stage-grain.svg`** (865 B, 15 lines). No page, stylesheet or script requests it, and no file of the build names it. REDESIGN.md's record of the home stage already says the repeated grain was replaced by the one stage picture; the file is what that left behind.
- **F13, two config leftovers.** The `db:studio` script in `package.json` (46 scripts, now 45), and the seven Yarn lines of `.gitignore` (`/node_modules` is alone in its group now).

**Tests.** None deleted, none changed, none added: 3,941 tests in 327 files before and after. `tokens.test.ts` passes untouched because both files lost the pair together.

**Decided, and disclosed.**

1. **The census finds a tenth unread theme key, and it stays.** Re-run today, the audit's theme-key census lists ten keys with no utility hit and no `var()` read, where it listed nine at `01af50d`. The tenth is the brand's color key: its three users (the Avatar's badge part, and the link variant of the Badge and of the Button) left with TRIM-T1. It is on no package's list, and `tokens.test.ts` names it in the same case that pins the two accent keys the audit left to the owner (F92, O13). So it was not touched: LATER row 492, with the owner's answer to O13 as its trigger. The built stylesheet carries 98 B for it, all of it minted by tracked documents: its variable (27 B, because one document spells the key's name; a scratch build with that one mention taken out is exactly 27 B smaller) and two utility rules (40 B and 31 B, because six documents spell the brand's background utility and its text utility). Deleting the key would take all three. *(Corrected 2026-11-23 after the audit session's check: this first said 27 B and counted the variable alone.)*
2. **The two comments the session notes name are left as they are.** The notes say the comments at `globals.css:40` and near `:655` name removed items. They name the brand's and the Magic accent's utilities, and the type ladder's display and body steps: the accent and the two steps left this finding after verification and are the owner's (F92), the brand is point 1, and all of them are still in the file. Nothing this package removes is named in either comment. Their wording follows the owner's answer to O13 (row 492 says so for the first; O13's own change list has the second).
3. **`tokens.test.ts` is on the prompt's file list and was not edited.** The list dates from the finding's first form, which also took the two type-ladder classes and the two accent keys that test pins. With those out of the package, no test needs an edit.
4. **The kit file's header records the cut**, as TRIM-T1's kit files do: one bullet in its list of deviations from the registry (a registry re-sync would bring the rule back). The sentence beside it said the house Select "is" Base UI's; there has been no house Select since S8, so it reads "was" now. Two words; nothing else in the header changed.
5. **A gap in the radius scale.** The theme block defined its own 3xl step (2.2 times the panel radius, 1.65 rem). With the key gone, Tailwind's own default for that step applies again (1.5 rem in 4.3.3). No file uses the step, so nothing on a page can tell; whoever first needs it should put the line back instead of taking the default.
6. **One script chunk is 56 B smaller, where the prompt expected the stylesheet alone to move.** The removed class token was a string in the chunk that holds the deck list (55 characters and a space). The minifier also swapped two one-letter local names in that chunk (178 of 41,177 tokens, the names `f` and `h`; nothing else differs once the removed text is set aside). The other 54 script files are the same files.
7. **The file's address answers 404 now** (200, 865 B, `image/svg+xml` before; the not-found page after). Nothing in the site requests it: no request in any of the reads below names it, on either build. An outside link to it cannot be ruled out by reading the repository; none is known.
8. **A stray `yarn` run would now show in `git status`.** With the seven lines gone, `.yarn/` and `.pnp.cjs` are ordinary untracked paths (checked with `git check-ignore` on seven sample paths). No such path exists, and the untracked and ignored sets of the checkout are the same before and after. Prettier reads `.gitignore` as well, so with such files present `prettier --check .` would read them and `pnpm check` would stay red until they are removed. *(This sentence was added 2026-11-23 after the audit session's check.)* The two Yarn debug-log lines stay, as the finding says; the verifier called that a little inconsistent, and it is.
9. **`db:studio` typed by hand now ends in pnpm's `Command "db:studio" not found`** (it suggests `db:seed`). `drizzle-kit` itself stays (the migration generator uses it) and still lists its studio command, so the studio is one `pnpm exec` away. It was not opened here.
10. **Source lines went up by one.** Two lines left `tokens.ts` and the kit file's header gained three (point 4).
11. **A second new row, for something the light-theme reads showed.** With the light theme stored, the card page and the share page are rendered on the client under their loading boundary instead of hydrated, on the before build and on the after build alike (Checks has the numbers). It is older than this package and not its to fix: LATER row 493.
12. **The prompt below is the audit's text with three theme-key names left out, in five places.** Tailwind reads this file (LATER row 217), and a theme key that a scanned file spells gets its variable into the built stylesheet whether or not anything uses it. The audit's text spells three: the two accent color keys the scope fence names, and the 3xl radius key this package deletes. The first build of this commit's tree carried 98 B for them, the radius at Tailwind's default now that the house key is gone, so committing the text as written would have put back more than half of what the package takes off the site. Each place now reads "(theme key omitted: …)" with the key said in words, and the build is the after build's to the byte (Checks). Two more key names stay in the prompt, the first chart color key's and the card-foreground color key's: their keys leave with this commit, so they mint nothing. The report still spells all of them; it is untracked. This note and the two new LATER rows spell no theme key. The audit's scrub covers class tokens, not theme-key names; a scan of the report's other ready-to-paste prompts finds no theme key spelled in any of them, so this was T3's alone. Building the commit's own tree before committing is what caught it.

**Measured.** Sizes are from two clean worktrees outside the repository, tracked files only, which is what a deploy builds. The before build's two stylesheets are T2's saved files to the byte, and its per-route JavaScript is T2's "after" column on all 21 routes.

| Line | Before | After | Change |
|---|---:|---:|---:|
| Main stylesheet, raw | 171,028 B | 170,840 B | -188 B |
| Main stylesheet, gzip-9 | 28,298 B | 28,248 B | -50 B |
| Second stylesheet | 5,721 B | 5,721 B | byte-identical |
| Client JavaScript on every route (the analyzer's floor) | 1,141,421 B | 1,141,421 B | none |
| Client JavaScript, the share page | 1,481,171 B | 1,481,115 B | -56 B |
| Client JavaScript, the editor (both editor routes) | 1,712,319 B | 1,712,263 B | -56 B |
| All client script files together | 2,273,719 B in 55 | 2,273,663 B in 55 | -56 B |
| `src/app/globals.css` | 1,449 lines, 55,234 B | 1,440 lines, 54,905 B | -9 lines |
| `src/lib/theme/tokens.ts` | 132 lines | 130 lines | -2 lines |
| Source lines, non-test (the audit's count) | 77,856 | 77,857 | +1 |
| Test lines | 78,915 | 78,915 | none |
| Tests | 3,941 in 327 files | 3,941 in 327 files | none |
| `public/` | 7 files, 583,304 B | 6 files, 582,439 B | -1 file, -865 B |
| Scripts in `package.json` | 46 | 45 | -1 |
| `.gitignore` | 55 lines | 48 lines | -7 lines |
| Route table | 84 lines | 84 lines | identical |

- **The stylesheet, as sets of rules.** Three declarations under three selectors left and none arrived: `--card-foreground` in the light block, the same in the dark block, and the one rule of the removed class token. Byte for byte, the after sheet is the before sheet with three pieces taken out: 136 B, 26 B and 26 B. The second sheet is the same file. The after sheet's SHA-256 starts `d5ddd8e6` and ends `2f5544`: a later read of the live site can compare with it.
- **The seven theme keys emitted nothing**, as the finding says: the built sheet named none of them before, and no utility made from one of them was in it.
- **Client JavaScript** is 56 B smaller on the three routes that load the deck list (the share page and the two editor routes) and the same on the other 18.
- **Static files.** Between the two builds the stylesheet and the one script chunk differ. Every other file under the static folder is the same file; the three manifests are the same bytes under each build's own id.
- **The audit's line counts.** The finding's summary says 16 source lines; the list it gives is 11 (nine in the stylesheet, two in the token file) and one class token, and that is what left. The stylesheet was at 1,449 lines, not 1,452 (T2 took three).
- **A local stylesheet size is only comparable from a clean worktree** (T1's note): the shared checkout's build carries what the untracked root documents mint.

**Checks.**

- `pnpm check` in the shared checkout, run last, after the last file was written: exit 0, typecheck clean, 0 lint errors and the baseline's 6 warnings, format clean, 3,941 tests in 327 files. Before any edit, at `b1073fb`, the same command: exit 0 with the same numbers. In a clean worktree holding the commit's exact tree: exit 0 with 5 warnings (no `scripts/.tmp/` there).
- `pnpm build` in both clean worktrees: green, the route table identical to `.claude/trim-audit-evidence/build-route-table.txt` (84 lines). The commit's exact tree (on `2d3f3e4`, this note and the LATER rows included) was then built on its own. A first build, with the prompt's text as the audit wrote it, had a main stylesheet 98 B larger than the after build's: three theme variables that the text named (point 12), and nothing else; every script file was the after build's. With the three names left out, the build of the tree as committed has the after build's two stylesheets to the byte, the same script files and the same route table.
- **Each proof, re-run before its item was touched.** F11: the census (ten rows today, point 1); no utility of the seven keys in `src`, `scripts` or `.github`; the pair named only at its five definitions; the slot named only in the kit file; in the built sheet the pair's two declarations and the one rule, and none of the seven key names. F12: the grep is empty and the file's history is the two commits the report names. F13: one line names the script; no Yarn path exists or was ever committed; 46 scripts. Beyond the report's commands: `scripts/.tmp/` names none of the deleted items; the build plan, REDESIGN.md and the WAVE files spell none of them as a decision; and the whole built output of the before build (both stylesheets, every client script, every server chunk) was searched. The grain file is named nowhere in it. The pair is in it only as its two declarations and as a key of the token object in six server chunks. The slot is in it only as the class string and its rule.
- **Before and after, on two clean builds**, each served locally and each read twice in the dark theme and twice in the light theme, in headless Chrome for Testing (eight reads, 26 captures each): the audit's ten baseline pages at 1440 and at 390 with touch (the editor among them, with its 82 steppers), and one editor row with its stepper at rest, hovered with a real mouse and focused from the keyboard, at both widths.
  - **In each theme, across the four reads, nothing differs between the builds beyond what the edit must change.** Per read: 26,682 elements (the same tags in the same order, the same attributes, the same text, the same boxes, the same computed style on each element and on its two pseudo-elements, the same class tokens once the removed one is set aside), 18,121 roles and accessible names in dark and 18,233 in light, 126 pictures, the same writes (home's deck lookup, and nothing that edits), the same failed and blocked requests.
  - **What the edit must change, and did, in every read.** The removed class token is on the 82 steppers before and on none after (170 elements over the eight captures that show them; the attribute is otherwise spelled the same). `--card-foreground` is among the root's custom properties before (`#f3f1ea` in dark, `#242c2f` in light) and not after. The stylesheet and the one script chunk are requested under each build's own names.
  - **The stepper measures the same.** At 1440: a group of 72 by 24 px in three 24 px parts, the two buttons hidden at rest and shown on hover and on focus, the focused one lifted over its neighbours with its keyboard ring. At 390: a group of 112 by 44 px (44, 24, 44), always shown. The outer corners are the group's (9.6 px) and the inner ones are square. No group has a Select trigger or an input as a child, and no element on the page carries a select slot.
  - **Requests.** A cold load of home in a browser with an empty cache sends 104 requests at each width in each theme on both builds; none names the grain file; under `/home/` it asks for the two tiles and the stage picture of its theme. The ten pages send the same requests from both builds, the two renamed built files aside.
  - **Status codes and cache headers** of the ten pages are the same from both builds, and so are the four other files under `/home/` (200, the same bytes). `/home/stage-grain.svg`: 200 before, 404 after (point 7).
  - **Values that differ between two reads of the SAME build, so they are not the edit.** The Atraxa hub's main element at 1440 (its automatic side margins read two ways: T2's note). The hub's and the leader page's cache header on a build's very first request (a miss, then hits). A link prefetch or a repeated lookup more or less in a page's request list (`/cards` at 390, the editor). And in the light theme the number the card page's client-made ids start at (below).
  - **The comparison can see a change**: the after build read once more with a rule forced onto the stepper's count and a value given to the deleted variable comes out different on every stepper (box, computed style, pictures, the measurements) and in the root's custom properties.
- **What the light-theme reads showed, on both builds alike** (point 11). React's generated ids say which markup was hydrated and which was made again in the browser. On the Sol Ring page all 107 are the server's in the dark theme and 101 are client-made in the light one; on the share page it is 2 client-made of 95 in dark and 89 in light. All sixteen reads agree, and the eight other pages keep the server's ids in both themes. The number the client-made ids start at changes from load to load on both builds (14 loads of the card page per build and width, nearly every one different), which is why two of the four after reads started elsewhere than the before reads did; the comparison files that under "differs between two reads of one build". The console reports nothing in either theme.
- **Server HTML, byte for byte.** The ten pages were fetched twice from each build and compared row by row after a build's own names are set aside. Nine pages: no row differs. The share page: one row, the time of its bracket read, which also differs between two requests to one build. Every document is the same size from both builds.
- **`pnpm smoke:seo`** against a dev server of the after tree on the development branch: all 97 checks passed.
- **The ignore file and the scripts table.** `git status --porcelain --ignored` lists the same untracked and ignored paths before and after. Every `pnpm` command in the workflows still resolves (three of the four workflow files run any): a script of the table, pnpm's own `install` and `audit`, or a dependency's binary (`tsx`). *(Corrected 2026-11-23 after the audit session's check: this first said "the three workflows" and "a script or pnpm itself".)*
- The fixture deck was never edited (no run here writes to it) and read back as the precon list (83 rows, 100 cards) after every round.

**Not covered.**

- **Production.** No page of deckwarden.gg and nothing of the production database was read, nothing was sent to either, and the commit is not pushed. One exception to "nothing from a deckwarden.gg host", outside the harness: the app's preview pane opens home when a local server starts (three starts in this session), and that page load, like any local preview of home, fetches home's One Piece card art from the site's image host and loads the analytics beacon, which reports the local page. The one load that was read back shows seven images and the beacon's two reports. The measuring browser blocks both hosts, and Sentry, in every run.
- **Other browsers and widths.** Headless Chrome for Testing at 1440 and at 390 with touch, in both themes. No Safari, no Firefox, no 820 px.
- **The editor's other states.** T1's thirteen scripted editor states and T2's nine (menus, dialogs, sheets, toasts, the analytics) were not read again, and nothing here edits a deck: a stepper was looked at, hovered and focused, not pressed. What stands in for them is the search of the built output: no file reads the pair, and the removed rule matched a slot no element carries.
- **Routes outside the ten**, the signed-in pages among them. They load the same stylesheet; they were not captured.
- **The studio and Yarn.** Neither was run, before or after.
- **An outside link to the deleted file.** Not checkable from here.
- **What the light theme's client render costs** (row 493): seen and counted, not timed and not traced. `/tournaments/[id]`, the third route with a loading file, was not read.

**Pushed, deployed and checked (2026-11-23).**

- **The push.** The owner said "Push it" in this session's chat. `git push origin main` sent `2b907b4..2185442` at 03:19:14 Z: three commits, T2's two documents commits (`b1073fb` and `2d3f3e4`, which the owner had chosen to send with this package) and `2185442`. Just before it, `origin/main` was at `2b907b4` with nothing ahead of local, `git log origin/main..main` listed those three and nothing else, and `pnpm check` in the shared checkout was exit 0 (0 errors, 6 warnings, 3,941 tests).
- **The deploy.** Vercel's commit status: success at 03:19:42 Z. CI run 45105276994: green at 03:23:46 Z.
- **A Dependabot job ran on the push and failed, and it is not this package's.** The commit touches `package.json`, so Dependabot tried its security update for `minimatch` again (run 45105293028) and ended with `security_update_not_possible`: the newest version that installs is 3.1.5 and the lowest one without the advisory is 11.0.1. That is the accepted item of LATER row 402. Expect the same on any push that changes `package.json`.
- **The audit session's check of `2185442`** (the whole diff read against every reader of what it deletes, `pnpm check` in the shared checkout, the commit rebuilt in a clean worktree with both stylesheets byte-identical to this session's after build, six reviewers over five briefs, 94 checks): no page, request or test differs. It corrected three sentences of this note, each marked above: what the brand's color key costs in the built stylesheet (point 1, and LATER row 492, which said the same), the Yarn lines' second job as Prettier's ignore rules (point 8), and the count and kinds of the workflows' commands (Checks). Each was verified here before it was taken: the two utility rules are in the built sheet at 40 B and 31 B, Prettier 3.9.10 reports a stray `.pnp.cjs` as ignored with the old ignore file and as read with the new one, and `.github/workflows` holds four files, one of which runs no `pnpm`.
- **Read on production on the owner's OK** ("Read it", 2026-11-23, 03:58 to 04:00 Z), in the desktop app's browser pane, signed out, in the dark theme with no stored theme, with no script or smoke: one request for `robots.txt` to give the tab a page it could size (a blank tab cannot be sized), then three page loads, home at 1440, the share page of the first public deck home links to (`/d/w4mv83fukqqe`) at 1440, and home at 390 with touch. **The live main stylesheet is the clean after build's file byte for byte**: 170,840 B, the same SHA-256, read inside each of the three pages. It holds no `--card-foreground` declaration and no rule for the removed slot, and the root computes no value for that variable while `--card` and `--chart-1` keep theirs. All three answered 200 to a guest. No element on them carries the removed class token or is a button group (the share page's 92 quantity cells are read-only text). **None of the share page's 33 same-origin scripts holds the removed token**: the one chunk that holds the ButtonGroup's class string holds it without the token, and it is the local after build's chunk byte for byte (74,158 B, the same SHA-256). `/home/stage-grain.svg` answered 404 (the not-found page) and no load requested it; under `/home/` each home load asked for the two tiles and the stage picture. The pane's log of the site's own requests lists 153, all GETs: the three documents and `robots.txt`, their static files, four session checks, eleven link prefetches from the share page (Next's, which the pane cannot block), the probes' re-reads of stylesheets and scripts from the browser's cache, and the one 404. Nothing was posted: the pane holds no saved deck, so home sent no deck lookup. The pages also loaded card images from Scryfall's CDN and the analytics beacon, as any visitor's load does, so the owner's analytics count three visits. Not read there: the editor and its stepper (a read would have to make a deck), the light theme, a signed-in page, other browsers. Record: `.claude/trim-t3-evidence/prod-read-2026-11-23.json`.

The evidence, the harness and how to run it again are in `.claude/trim-t3-evidence/` (gitignored, on this machine; `README.md` there names the traps this session met).

**What it is.** Delete seven theme keys and one token pair nothing references, the selector for a component S8 deleted, an image no page requests, one package script nothing runs and seven ignore lines for a package manager the project does not use. Class: **Delete**. Findings F11, F12, F13 of the audit.

**Found (2026-11-22).**

- **F11** (dead). Stylesheet items nothing references: seven theme keys, the card-foreground token pair, a selector for the deleted Select. 188 B of built CSS on every route (the token pair 2 x 26 B, the selector 136 B); seven theme keys that emit nothing; 16 source lines.
- **F12** (dead). public/home/stage-grain.svg: served, never requested. One 865 B file in every build and image; no page, stylesheet or script requests it.
- **F13** (dead). One package script nothing runs and seven Yarn ignore lines. 8 lines (1 in package.json, 7 in .gitignore); nothing at run time.

For each finding, where it is (file and lines), the excerpt read, **the proof command to re-run first** and its output, what could break and the verifier's note are in `TRIM-AUDIT-report.md`, section 4, under the same id. The auditors' full records and the scripts the proofs call are in `.claude/trim-audit-evidence/` (gitignored; on this machine: `harness/README.md` there says how to run each).

**Size S. About 16 lines of CSS and tokens, one 865 B file, 8 config lines.**

Pre-flight, in order.

1. **Main is green.** `pnpm check` = 3,941 tests / 327 files / 0 errors / 6 warnings at `2b907b4` (main after T1 and T2) in the shared checkout; a clean worktree shows 5 warnings, because it has no `scripts/.tmp/`. The audit read `01af50d` (3,948 tests): re-run the check and record what it is today. `pnpm build`'s route table is `.claude/trim-audit-evidence/build-route-table.txt`; the diff at the end must be empty.
2. **Order.** This package runs after: T1 (it edits `button-group.tsx`, a kit file). Other sessions share this checkout: stage explicit paths, and re-read `LATER.md` and `MEMORY.md` immediately before editing them.
3. **Re-run each item's proof command (report, section 4) before touching the item.** If a proof no longer holds (another session started using the thing), skip that item and report it; do not force it. Before deleting or narrowing a field of the adapter contract (`src/lib/games/types.ts`), grep `deckwarden-build-plan.md` and `REDESIGN.md` for it: a field either document spells is the owner's call, whatever section 8 says. T2 met one the audit had missed (the stat block's `tone`; the status block at the head of the report has it). And grep `scripts/.tmp/` for each name a deletion removes: the proofs leave that folder out, so report what imports it and edit nothing there.
4. **Baseline before any edit**, with the audit's own scripts (`.claude/trim-audit-evidence/harness/`; each header says how to run it): the scoreboard lines named under Tests, and a capture of each page named there at 1440 and 390 (a screenshot, the accessible names, the status code and cache headers). T1 and T2 left a harness that compares two local builds element by element (tag, attributes, text, box, computed style), with roles and names, pictures, writes, status codes and cache headers. The newer copy is in `.claude/trim-t2-evidence/harness/`: it reads each build twice, which tells a value the edit changed from one that moves between two reads of the same build, and it compares the server HTML row by row. The `README.md` beside it and the one in `.claude/trim-t1-evidence/` say how to run it and name the traps both sessions met. The one that cost most: after any run that edits the fixture deck, wait for the save the edit owes and read the deck back. Build "before" and "after" in two clean detached worktrees (tracked files only, which is what a deploy builds): the shared checkout's main stylesheet is 602 B larger, because Tailwind reads the untracked audit report.
5. **Local only.** Servers and smokes run against `localhost` and the Neon development branch (`scripts/smoke/guard.ts`). Nothing is read from or sent to deckwarden.gg or the production database without the owner's OK in the chat, each time. Say at the start what will be measured.

## What this package is NOT (scope fence)

- NOT `.type-display`, `.type-body`, (theme key omitted: the Magic accent's color key) or (theme key omitted: the One Piece accent's color key): tokens.test.ts pins them on purpose (F92, the owner's).
- NOT `--chart-1..5`, `--accent-mtg`, `--accent-optcg` themselves: they are read.
- NOT the Tailwind source scope (F17, T6) and NOT the shadcn stylesheet import (F90, the owner's).
- After the delete, `/home/stage-grain.svg` answers 404 where it answered 200. Nothing in the site requests it; say so in the ship note.
- NOT a migration (`drizzle/` is history), NOT a new dependency, NOT a change to a sentence a visitor reads, NOT a change to any route's caching.
- Anything else → `LATER.md` with a trigger. No "while I'm here".

## The package (decide and disclose the details)

1. **F11: Stylesheet items nothing references: seven theme keys, the card-foreground token pair, a selector for the deleted Select.**

   The change: Delete globals.css lines 19-23 (`--color-chart-1` to `-5`), 38 (`--color-card-foreground`), 64 ((theme key omitted: the 3xl radius)), 254 and 285 (`--card-foreground` in :root and .dark) and tokens.ts lines 31 and 62 (the same pair: the two files are compared key for key by tokens.test.ts:41-47, so they leave together). In button-group.tsx:37 drop the one token that selects a `select-trigger` slot (no element carries it since S8 deleted the Select). `--chart-1..5`, `--accent-mtg` and `--accent-optcg` themselves stay: they are read.

   The test that it behaves the same: `pnpm check` with tokens.ts and globals.css changed together (tokens.test.ts compares the two key for key; no test is edited); `pnpm build`: the token pair's two declarations and the one selector are gone from the stylesheet and no other rule differs; the editor's row stepper (deck-text-view.tsx:346, the one ButtonGroup) looks the same at 1440 and 390.

   The lead's note: The lead re-ran the grep for `type-display|type-body` and the theme-key census (audit/a1-css/theme-keys.py: nine keys with no utility hit, no var() read). Two groups left this finding after verification because a test pins them on purpose: `.type-display` and `.type-body` (tokens.test.ts:251-330; WAVE5.md:251 'exists for completeness') and the (theme key omitted: the Magic accent's color key) / (theme key omitted: the One Piece accent's color key) keys (tokens.test.ts:135-139). They are the owner's (F92).

2. **F12: public/home/stage-grain.svg: served, never requested.**

   The change: Delete public/home/stage-grain.svg.

   The test that it behaves the same: The proof grep stays empty; pnpm check and pnpm build green; home at 1440 and 390, both themes, pixel-identical (nothing references the file); the request list of a cold load of / is unchanged.

   Watch for (the verifier): An outside link to /home/stage-grain.svg would get a 404. None is known.

3. **F13: One package script nothing runs and seven Yarn ignore lines.**

   The change: Remove package.json line 18 and .gitignore lines 5-11 (with the now-empty part of the '# dependencies' group left as /node_modules alone).

   The test that it behaves the same: pnpm check green (src/lib/smoke/wiring.test.ts reads only the smoke:*, search:canned and nightly entries of the scripts table; no test names db:studio or counts the scripts); `git status --short` shows the same untracked set before and after (no path newly unignored); every workflow's `pnpm <script>` still resolves (`/usr/bin/grep -n 'pnpm ' .github/workflows/*.yml` against the scripts table).

   Watch for (the verifier): The Yarn lines guard against a stray `yarn` run creating .yarn/ or .pnp.cjs. That is the same reason the finding keeps the npm/yarn debug-log lines, so removing them is a little inconsistent. db:studio may still be typed by hand.

Files this package touches (from the findings; re-derive at the start): `src/app/globals.css`, `src/lib/theme/tokens.ts`, `src/lib/theme/tokens.test.ts`, `src/components/ui/button-group.tsx`, `public/home/stage-grain.svg`, `package.json`, `.gitignore`.

## Tests and checks

- `pnpm check` green, with no test deleted or loosened except the tests of deleted code; name each deleted or changed test in the ship note.
- `pnpm build`: the route table identical to the baseline (the same routes with the same static, ISR and dynamic marks).
- Against a local server on the development branch: `pnpm smoke:seo`.
- Before and after, `/`, `/commanders`, `/c/atraxa-praetors-voice`, `/cards`, the Sol Ring card page, a share page, `/sets`, `/brackets`, `/l/ace-newgate-st22-001` and the editor, at 1440 and 390, light and dark (a token pair leaves both themes): the same pixels, the same accessible names, the same URLs, status codes and cache headers, the same database writes. A JSON field may go only if every reader is in this repository and none reads it.
- The scoreboard lines this package should move (section 3 of the report; measure with the same scripts and record before and after):
  - Built stylesheet (3.1): down by 188 B (the token pair 52 B, the selector 136 B).
  - `src/app/globals.css`: 1,452 lines down by about 10.
  - `public/`: one file (865 B) fewer in every build and image.
  - Everything else unchanged. Route table identical.
- Deploy: every push to `main` deploys. Push only on the owner's word, then read the result as the deploy-verification note in `MEMORY.md` says.

## LATER rows this package touches or opens

- Opens nothing expected.

## Session notes

- tokens.test.ts compares `:root` and `.dark` with tokens.ts key for key: the token pair leaves both files in the same commit.
- The comments at globals.css:40 and near :655 name removed items and need their words corrected.
- Never `cd`; `pnpm` needs `export PATH="$HOME/.local/node22/bin:$PATH"`; the shell's `grep` is ugrep (use `/usr/bin/grep`); scratch scripts under `scripts/.tmp/` are linted; evidence goes under `.claude/trim-t3-evidence/` (gitignored). ESLint reads that folder too (every folder under `.claude/` except `worktrees/`, LATER row 487): keep scripts there as `.txt` and put no built JavaScript in it.
- Tailwind reads the Markdown files for class names until T6 ships (LATER row 217): quote no class strings in the ship note.
