# TRIM-T2 session prompt: dead TypeScript: functions, fields, props and branches nothing reaches

*Status: **done and live: commit `2b907b4` on `main`, the one after `beb324d` (it adds this file), pushed 2026-11-23 00:32 Z on the owner's word and read on production on the owner's OK.** The ship note follows this paragraph, with the deploy, the production read and the audit session's check at its end; the prompt as the audit wrote it follows the note. Written 2026-11-22 by the TRIM audit (`TRIM-AUDIT-report.md`) from a read of `01af50d` (main). Every anchor below was checked against it by an auditor, by a verifier on a second model that re-ran the proof, and by the lead. Re-grep lines, trust the shapes. Add a dated ship note at the top of this file when the package ships.*

## Ship note (2026-11-22)

One commit on `main` after `beb324d` (TRIM-T1): `2b907b4`. This note was written before the push, and the push and the production read are at its end. In it: 26 source files and the stylesheet, 26 test files, two annotated rows and two new rows in `LATER.md`, and this file. No route, no migration, no dependency, no sentence a visitor reads, no caching change. Each finding's proof command was re-run at `beb324d` before its item was touched and gave the report's output, line for line; no item of the package's list was skipped.

**What went.**

- **F04, seven functions only their tests called, and one type nothing named**: `fetchScryfallArtMeta` (`cards/art.ts`), `hasPreconChanges` (`decks/precon-changes.ts`), `frozenToInputs` (`decks/versions.ts`), `mtgRole` (`games/mtg/roles.ts`), `hasCardList` (`games/mtg/topdeck-map.ts`), `setMatchClass` (`sets/lines.ts`; its description of the five classes moved onto the private function that does the matching), `loadAppearance` (`theme/appearance.ts`) and the type `TargetChangeKind` (`brackets/target-change.ts`).
- **F05, a stat block's tone**: the field in the adapter contract (`games/types.ts`), and in the renderer (`deck/analytics-blocks.tsx`) the two maps and the two branches. No adapter ever set one.
- **F06, three things set and never read**: `factor` on `BracketToward` and the one line that set it; `detail` on `FeedFreshness`, the second parameter of the helper that filled it, its two arguments and the read of the Spellbook run's version that fed one of them; the `delayMs` parameter of `useAutosave` (the 1,000 ms is a named constant in the file now).
- **F07, two leftovers of the browse features**: the re-export of the One Piece color bits from `optcg/punk-map.ts` (the note beside it that says why the bits live in `colors.ts` stays, as a plain comment, and the sentence in `colors.ts` that named the re-export is corrected); the `side` prop of `AppearanceMenu` and the attribute it fed (the menu primitive's own default is the same value).
- **F08, leftovers of the home restyles**: the rule in `src/app/globals.css` that set the hero cards' transition to none while the card entrance attribute is on the root (three lines; the comment above it now speaks of one rule); `GameCard`'s open-region shape with its `field` flag, so the form without a headline is the field, and the one attribute home passed for it; `loadAppearance` (counted under F04).
- **F09, the Tokens section's several-tokens path**: the branch of the editor's token add that looped over several tokens and applied them as one list swap. The optional step is done too: the add takes one card through all three hands (`TokensSection`, the list pane, the editor), since an array of which only the first entry is read would be a trap for the next caller.
- **F10, five small items**: (a) is F07's `side`. (c) `limit` on the ranker's input and the two arguments in the Autofill route that passed the pool's own length. (e) `emptyLabel` on `DeckDiffView` is required (all three call sites pass one; the default sentence was never on screen). (f) the collection parser's ternary with two identical arms. (g) the two clamp counts the import planner returned and nothing read (`foldRows` and `planImport`; the count the import page shows is the parser's own and is untouched).
- **The comment in `src/components/profile/user-avatar.tsx`** (the lead's extra item, comment only): its last paragraph described the Avatar wrapper's size variant, which TRIM-T1 deleted. It now says what is true: the pixel size is set by the classes in that file, and the wrapper has had no size option of its own since T1. No code changed there.

**Tests of deleted code, and nothing else** (3,945 → 3,941 tests, 327 files as before). Four cases are gone and every other change is a re-point or a fixture key:

- Deleted: `cards/art.test.ts`, two of the four cases of the deleted function (art without an artist and an artist without art; a non-OK answer and a thrown fetch): the lookup's own cases beside them assert the same answers with their reason. `deck/analytics-blocks.test.tsx`, the "stat tone" case. `home/game-card.test.tsx`, the open-region case.
- Re-pointed at the function production calls: `cards/art.test.ts`, the headers case and the front-face case (now on `lookupScryfallArtMeta`); `decks/versions.test.ts` (the restore guard's expected entries are written out; the frozen-shape case keeps its first half under a new title); `games/mtg/roles.test.ts` and `games/mtg/tagger.test.ts` (a local lookup over `MTG_ROLES`); `games/mtg/topdeck-map.test.ts` (four assertions, on `mainboardEntries` being null or not); `sets/lines.test.ts` (the classes case reads `matchSets`: one typed text against one set per class listed worst first, so the order that comes back is the classes', and the real-name examples after it); `theme/appearance.test.ts` (the stored string through `parseAppearance`); `games/optcg/punk-map.test.ts` (the identity assertion on the re-export is gone, the pin on the bits' insertion order stays and reads `./colors`); `recommend/rank.test.ts` (the helper and two calls drop the option; "honors the limit after ranking" became "ranks every candidate, the best first": ten in, ten out, the best first); `home/game-card.test.tsx` (the deleted case's assertions on live code moved into the two kept cases: the section's own classes, the blurb's ink, one default button and three ghosts, the title in the heading; the One Piece case drops the flag).
- An assertion or a key of deleted code removed inside a kept case: `decks/precon-changes.test.ts` (two lines), `collection/plan.test.ts` (one line, and the title's last words), `games/mtg/bracket-toward.test.ts` (one expected key), `editor/use-autosave.test.ts` (the argument), `deck/tokens-section.test.tsx` (the mock's type and one expectation: the card, not an array of one), and the `detail` key in the fixtures of ten files, 19 places: `brackets/page.test.tsx`, `api/combos/complete/route.test.ts`, `deck/bracket-sheet.test.tsx`, `deck/deck-share-view.test.tsx`, `brackets/table.test.ts`, `brackets/target-change.test.ts`, `games/mtg/speed.test.ts`, `games/mtg/brackets.test.ts`, `games/mtg/bracket-guide.test.ts`, `games/mtg/bracket-line.test.ts`.

**Decided, and disclosed.**

1. **`hasCardList` is gone, and one scratch script imported it.** The audit's proof leaves `scripts/.tmp/` out; this session grepped it too, as the prompt asks. `scripts/.tmp/measure-corpus.ts` (git-ignored; the P3.8 sizing script of September, which reads the local raw Topdeck archive) imports the name at its line 7 and calls it at line 57. That script is outside the typecheck and ESLint does not resolve imports, so `pnpm check` is unchanged (the same six warnings, one of them that script's own), but the script now fails when it is run, at its import. It was not edited (scratch work is other sessions'). If it is still wanted, the repair is one expression in it (`mainboardEntries(s) !== null`, which is exported), or say the word and the four-line helper comes back. A second scratch script, `scripts/.tmp/autofill-scale-check.ts`, passes the ranker's `limit` (lines 95 and 104, the pool's own length as the route did): at run time the extra key is ignored and its numbers are the same; under a typecheck it would now be an error.
2. **F08's third record is left alone, with a row.** The finding lists three auditors' records. Its change list (the one this prompt carries) names the items of the first two; the third (`A2-HIST-HOME-9`: a `finishes` field filled for every One Piece shelf card and read by nothing, and the `title` home passes to the Magic region, which the gallery form never renders) is in the finding's title and not in its change list. Dropping the field is a deletion; the prop needs a decision on the component's shape first. Neither was touched; both are LATER row 488, with the seams package (T21) as the trigger.
3. **The one markup difference: a space.** The stat's paragraph used to build its class attribute from a template with an empty tone, which left a trailing space; it is a plain attribute now. Same class tokens in the same order, same computed style, same pixels; the attribute is one character shorter on each of the three stat blocks, on the share page and in the editor. Everything else in the rendered pages is attribute for attribute what it was.
4. **F08's rule "never applied": true of the three cards, not of a child without the cards' own transition.** The hero's three direct children are images that carry their own transition in the utilities layer, which outranks the components layer the deleted rule sat in: their computed transition is the same before and after, at rest, while the entrance is pending and while it plays, at both widths (measured, below). A direct child with no transition of its own did take the deleted rule: its transition property computed to none while the attribute was set, and computes to the initial value (all) now, with a duration of 0 s both ways, so nothing can animate either way. The only such child the component can render is the placeholder for a card with no image address (a commander with no default printing); the fan's three cards were images in every read here.
5. **F09's optional step is taken** (above): one card through `onAdd`, `onAddTokens` and `handleAddTokens`, and the test's expectation moved with it. The names keep their plural: renaming is not a deletion.
6. **`topdeck-map.test.ts` is re-pointed at `mainboardEntries`**, not at the list count of `mapTournament` the audit suggested: the deleted helper was that function's result compared with null, so the four assertions keep their four inputs one for one. The case's second half already reads the count.
7. **One test line the audit's list did not have.** `games/mtg/bracket-toward.test.ts` expected the deleted `factor` key inside a partial match, which the type checker does not see; the suite caught it. The other tests that spell that key and value belong to the fixes, a different type that keeps it.
8. **`GameCard` keeps its small fragment.** Folding the heading and the blurb into their parent renders the same markup and makes home's server payload two characters shorter (one nesting level less); the first build of this package did that and the byte comparison caught it. The fragment is back, so home's server HTML is the same.
9. **The `limit` comment is not carried over.** The sentence on the ranker's input that explained the missing cut (the engine ranks everything, applies the goals, then cuts) left with the field: `recommend/goals.ts` says the same in its header.
10. **Comments that named a deleted thing say what is true now**: `GameCard`'s header (two shapes; a sentence records that the third left with this package), the prop notes in the three token files, the entrance rule's comment, the test files' headers. Nothing else was reworded.
11. **A second new row, for something the smokes showed.** `pnpm smoke:autofill` fails two of its 71 checks on the development branch, on the before build and on the after build alike (LATER row 489): one wants tournament evidence the branch's aggregate does not hold for Atraxa, the other a bracket read the branch's stale feeds cannot give. Not this package's to fix.

**Measured.** Sizes are from two clean worktrees outside the repository, tracked files only, which is what a deploy builds: `beb324d`, and `beb324d` plus this commit's files. The first one's main stylesheet is T1's to the byte (171,082 B) and its per-route JavaScript is T1's "after" column on all 21 routes.

| Line | Before | After | Change |
|---|---:|---:|---:|
| Main stylesheet, raw | 171,082 B | 171,028 B | -54 B |
| Main stylesheet, gzip-9 | 28,304 B | 28,298 B | -6 B |
| Second stylesheet | 5,721 B | 5,721 B | byte-identical |
| Client JavaScript on every route (the analyzer's floor) | 1,141,444 B | 1,141,421 B | -23 B |
| Client JavaScript, home | 1,233,536 B | 1,233,365 B | -171 B |
| Client JavaScript, the share page | 1,481,648 B | 1,481,171 B | -477 B |
| Client JavaScript, the editor (both editor routes) | 1,712,991 B | 1,712,319 B | -672 B |
| All client chunk files together | 2,274,425 B in 55 | 2,273,719 B in 55 | -706 B |
| Source lines, non-test (the audit's count) | 77,970 | 77,856 | -114 |
| `src/app/globals.css` | 1,452 lines, 55,306 B | 1,449 lines, 55,234 B | -3 lines |
| Test lines | 78,983 | 78,915 | -68 |
| Tests | 3,945 in 327 files | 3,941 in 327 files | -4 |
| Exported symbols (the audit's scan) | 2,167 | 2,157 | -10 |
| of which only tests mention | 279 | 271 | -8 |
| The combo facts answer for the fixture deck | 706 B | 664 B | -42 B |
| The share page's document, raw | 236,313 B | 236,260 B | -53 B |
| Home's document, raw | 197,982 B | 197,982 B | the same |
| Route table | 84 lines | 84 lines | identical |

- **The stylesheet, as sets of rules.** One declaration under one selector left and none arrived: the rule F08 names. The after sheet is the before sheet with that one 54-character rule taken out, byte for byte; the second sheet is the same file.
- **Source lines**: 191 lines out and 74 in across the 26 source files and the stylesheet (what came in is reworded comments and narrowed signatures). The audit expected about 130 out.
- **Test lines**: 194 out and 126 in across 26 test files. The audit expected about 135 out; the re-pointed cases keep their inputs, which is most of the 126.
- **Exports**: the ten that left are the seven functions, the type, the tone's word map (exported only for its test) and the re-export.
- **Client JavaScript is smaller by a few hundred bytes at most**, as the audit expected: 23 B on every route (the menu's prop, in the site header), 171 B on home and the index pages, 477 B on the share page, 672 B on the editor (the tone branches, the token path, the autosave option). The other routes are in the evidence folder's table.
- **The share page's document** is 53 B shorter: the two `detail` keys in its payload (50 B as escaped there) and the three spaces of decision 3.
- **A local stylesheet size is only comparable from a clean worktree** (T1's note): the shared checkout's build carries what the untracked root documents mint.

**Checks.**

- `pnpm check` in the shared checkout, run last, after the last file was written: exit 0, typecheck clean, 0 lint errors and the baseline's 6 warnings, format clean, 3,941 tests in 327 files. Before any edit, at `beb324d`, the same command: exit 0, 3,945 tests in 327 files, 0 errors, 6 warnings. In a clean worktree at the commit: exit 0 with 5 warnings (no `scripts/.tmp/` there).
- `pnpm build` in both clean worktrees: green, the route table identical to `.claude/trim-audit-evidence/build-route-table.txt` (84 lines). The after build was made again with this commit's exact files, this note and the LATER rows included: the same stylesheet to the byte.
- **Before and after, on two clean builds**, each served locally and each read twice in headless Chrome for Testing (four reads, 42 captures each): the audit's ten baseline pages at 1440 and at 390 with touch (the editor among them); T1's thirteen editor states (a Segmented control switched, the More menu, the History dialog, the right pane's tab strip, the phone's Group and Sort popover, its Search and Tools panes and its card sheet, a toast with Undo at both widths); and nine states for what this package touched: the Appearance menu opened at 1440, the share page's Why sheet, the editor's Why sheet with a real verdict, the editor's analytics opened with the three stat blocks on screen, and one token added through the Tokens section's search with its toast, at both widths.
  - **Across the four reads, nothing differs between the builds but the spelling of that one class attribute** (decision 3: 45 elements in 15 captures, the three stat blocks wherever they are in the document). Per read: 56,587 elements (the same tags in the same order, the same attributes, the same text, the same boxes, the same computed style on each element and on its two pseudo-elements, the same class tokens), 29,310 roles and accessible names, 138 pictures, the same writes (home's deck lookup, the editor's saves), the same end state of the deck.
  - Two values differ between two reads of the SAME build, so they are not the edit. On the Atraxa hub at 1440 the main element's side margins, which are automatic, are reported by the browser as 0 px in some reads and as 208 px in others (the value flips about 0.8 s into the load on both builds, measured; the box is the same in every read). And one picture of the editor's Why sheet differs in 7 of 1,296,000 pixels by one level in one of the two after reads; the other after read is the before reads' picture to the byte. The two before reads agree with each other on everything.
  - **The hero's three cards compute the same transition before and after**, at rest, with the entrance attribute pending and with it playing, at both widths (four properties, 0.25 s and three times 0.12 s). Decision 4 has the one child that differs.
  - **The Appearance menu opens below its trigger** on both builds: side bottom, aligned to the end, its top 4 px under the trigger's bottom edge.
  - **The token add behaves the same**: the search's first result picked, the toast "Added Soldier" with Undo, the section's count 6, then 7, then 6 again after the row's remove, the deck at 100 of 100, two saves.
  - The ten pages answer with the same status codes and cache headers from both builds.
  - **The comparison can see a change**: the same read of home with the deleted rule forced onto the cards comes out different on exactly those three elements at both widths.
- **Server HTML, byte for byte.** The ten baseline pages were fetched twice from each build and compared row by row after a build's own names are set aside (the hashed chunk file names, the build id, the per-request nonce, and the order in which a component's chunk files are listed, which follows their hashed names). Home: 197,982 B from both builds and no row differs. Eight other pages: no row differs. The share page: four rows, all expected: the freshness row (the read's time, and the two `detail` keys gone) and the three stat paragraphs of decision 3.
- **`GET /api/combos/complete`** for the fixture deck's 83 ids, from both builds: status 200 and the same cache header; the after answer is the before answer without the two `detail` keys (the read's time aside), key order included: 706 B, the audit's sample size, against 664 B.
- **Smokes, against the after build served locally on the development branch**: `pnpm smoke:decks` (58 checks) and `pnpm smoke:hubs` (64) on the production build, `pnpm smoke:seo` (97) on a dev server of the same tree, all passed. Run as well, because their routes hold code this package touched: `recommend` (69), `collection` (50), `alternatives` (44), `combos` (24), `sets` (31) and `versions` (48), all passed; `autofill` passes 69 of 71 on both builds, check for check (decision 11).
- The fixture deck was read back after every run that edits it and is the precon list (83 rows, 100 cards). Twice during the session a first form of the token step left a token in it; each time it was put back (the second time with the audit's restore script) and read back as the precon list before the next read, and the reads above were all taken after.

**Not covered.**

- **Production.** Nothing was read from or sent to deckwarden.gg or the production database when this was written, and the commit was not pushed then (the push and the production read are below). Everything above is two local production builds on the development branch.
- **Other browsers and widths.** Headless Chrome for Testing at 1440 and at 390 with touch. No Safari, no Firefox, no 820 px, no signed-in `/account` (this package changed a comment there and nothing else).
- **The share page's Why sheet with a real verdict.** The development branch's feeds are stale, so the share page there reads "Bracket read incomplete" and its Why sheet says so; that is what was compared. The sheet with a real verdict was compared in the editor, where the same shim on both builds reads the stale feeds as fresh. (Production's feeds are fresh: the read below opened the share page's sheet there with a real verdict.)
- **The toast's Undo for a token.** The token went back out by its row's remove (the Undo closes by itself before a scripted step reaches it). The add, its toast and both saves were compared.
- **The History dialog's three empty sentences.** `DeckDiffView` requires its `emptyLabel` now; the dialog was opened and compared, a version without changes was not. The dialog's tests assert one of the three sentences (the one under Compare); the two a fork shows have no test, before this package or after, and the typecheck is what shows that all three call sites still pass theirs. (Corrected 2026-11-23: this bullet first said the tests cover all three.)
- **The collection import and the ranker in a browser.** F10's (c), (f) and (g) are covered by their suites and by the smokes named above, not by a browser run. For (c) the suites are `recommend/rank.test.ts` and the Autofill route's own test, which runs the real ranker over mocked queries. (Corrected 2026-11-23: this bullet first named the fixed-seed golden, which is the planner's, in `recommend/autofill.test.ts`, and does not reach the ranker.)
- **The hero's placeholder child.** A card with no image address was not rendered; the reading in decision 4 is from a plain element appended for the measurement.
- **The scratch script.** `scripts/.tmp/measure-corpus.ts` was not run (it reads the database and the raw archive); that it no longer loads is from a typecheck of that one file.

**Deployed, and read on production (2026-11-23).**

- **The push.** The owner said "Push it" in this session's chat. First: local `main` one commit ahead of `origin/main`, the remote's `main` still at `beb324d` (T1, live since 22:26 Z the day before), and `pnpm check` in the shared checkout at `2b907b4`: exit 0, 0 errors, 6 warnings, 3,941 tests in 327 files. The push sent this one commit, alone, at 00:32:07 Z. Vercel's status on the commit: success at 00:32:46 Z. CI run 45089344108: green at 00:36:26 Z.
- **The read.** On the owner's OK ("Read it"), from the desktop app's browser pane, 2026-11-23 00:51 Z to 00:55 Z: signed out, the dark theme, at 1440 and at 390 (the pane's touch emulation, a coarse pointer). No script and no smoke ran against production; nothing was typed, no deck was made, nothing was signed in. Eight page loads: home and the share page of one public deck linked from home at both widths, the brackets page and the Atraxa hub at 1440, and a new-deck draft with a commander at both widths.
  - **The live main stylesheet is the measured one, byte for byte**: 171,028 B, SHA-256 `5b53c76101cabaf8345b02d2e38d9a1ea7ff7ca0a68eb813b1662afdedf67a96`, the clean after-build's file. The deleted rule is not in it and the rule beside it is. The second sheet is the file T1's read saw.
  - **Home**: 200 at both widths. The hero's three cards are images and compute the transition the local builds do (four properties, 0.25 s and three times 0.12 s) at rest, with the entrance attribute pending and with it playing. The Magic region is the gallery form and the One Piece region the field, each with its heading. The Appearance menu opens below its trigger at 1440 (side bottom, aligned to the end, its top 4 px under the trigger's bottom edge: the local numbers) and was closed without a choice; at 390 its trigger is not shown, as built.
  - **The share page**: 200 at both widths, no sideways scroll. Its three stat paragraphs carry the class attribute without the trailing space and hold nothing but their value. Its payload holds one freshness object with the four feeds, each with its state and its date and nothing else: the key `detail` is nowhere in the page. The bracket line gives a real verdict there, and the Why sheet opens with it and reads the list's date: the case the local read could not show.
  - **The brackets page**: 200; its last-check sentence reads the date; no `detail` in its payload.
  - **The draft**: 200 at both widths, one card of a hundred, marked as a draft throughout. Its combo facts answer is 319 B: the combos, and a freshness whose four feeds hold a state and a date each. Its three stat paragraphs carry the plain class attribute (in the opened Analytics panel at 1440; kept in the document inside the Tools pane at 390).
- **What the read cost.** The session told the owner before starting: eight page loads, "GET only", a few hundred requests with the static files and Next's link prefetches. The eight loads are right. "GET only" was not: a draft's own load sends one POST, to the card-resolve lookup that finds its commander (two in all; the route stores nothing). To the site's API the pages sent 8 session checks, those 2 lookups, 2 requests for the combo facts and 2 for the commander's art, and the probe re-read the facts answer once. No deck, account, like, bookmark or preference was made or changed.
- **What the production read did not cover.** The Tokens section's add (it would save a deck on production), the editor's Why sheet (a one-card draft shows no door for it), the History dialog, the collection import and Autofill (each needs a saved deck, an account or a write). The live scripts' bytes: the stylesheet is the one static file compared byte for byte. The light theme, WebKit, a real phone. And there is no "before" on production: equality was shown locally on two clean builds; this read shows that the deploy serves that build and that the touched places render.
- **Seen on the way.** The hub's main element reported its side margins as 208 px on production too: the two-valued read of the local captures, with the same box. While the pane was hidden a closed menu stayed in the document until a frame was drawn, as T1's note says of streamed pages.
- The record is `.claude/trim-t2-evidence/prod-read-2026-11-23.json` (gitignored, on this machine).

**After the audit session's check (2026-11-23).**

The audit session checked `2b907b4` after the push and sent this session its result: the whole diff read against every caller, eleven reviewers over eight briefs (184 checks, each finding above a nit put to three refuters), `pnpm check` in the shared checkout, and the commit rebuilt in a clean worktree (the route table the audit's, both stylesheets byte-identical to this session's after build). No page, status code or write differs. Five points came back. Each was checked here against the code and holds; none is a code change made in this session.

- **Two sentences of this note were untrue.** Both are in "Not covered" above and are corrected in place, each with a line saying so: the History dialog's tests assert one of its three empty sentences, not three; and what covers the ranker's F10 (c) is the ranker's own suite and the Autofill route's test, not the fixed-seed golden, which is the planner's.
- **F05's tone was the owner's call, and the owner has made it: it stays deleted.** The stat block's tone was spelled in the build plan's adapter contract (`deckwarden-build-plan.md`, Appendix B, the stat line of `AnalyticsBlock`), and `REDESIGN.md`'s record of R6 said that no adapter emits a tone, "so the renderer is ready rather than exercised". By the audit's own rule for contract fields that made it the owner's to decide, as the copy limit, the index hint and the `full_card` art kind were. The audit classed it Delete without searching those two documents, and this session re-ran the audit's proof and did not search them either. Asked on 2026-11-23 in the audit session's chat, the owner wrote "delete all that needs to be deleted" and, to the question about this field, chose "Keep it deleted": the deletion stands, and the two documents are corrected to match. They are, in the commit that adds this part: the contract's stat line has no tone and its notes say when and on whose word; R6's record gains a dated amendment and is otherwise as written.
- **Left as it is: the factor in `REDESIGN.md`.** That document also lists "the factor" among what `toward` declares, and F06 removed it. The owner's answer names the tone, so that record stands as written; it is the owner's to say.
- **Two comments this package left behind**, now LATER rows 490 and 491. The Spellbook ingest still calls the bulk's version and timestamp "the bracket read's Spellbook freshness" (`scripts/ingest/spellbook.ts`, outside this package's fence); since `2b907b4` nothing reads the version, and the ingest still writes and logs both. And the collection planner's header (`src/lib/collection/plan.ts`, a file this package did edit) still says every decision is a returned count, which the fold's clamp no longer is: decision 10 should have caught it.
- **For whoever merges `claude/curve-gap`** (`04c4016`, cut from `01af50d`): it conflicts with `2b907b4` in `src/lib/recommend/rank.ts` and in `LATER.md`, and its `rank.test.ts` still passes the `limit` this package removed (line 641 there), but in a case the branch did not touch (line 510 of `01af50d`), so the merge keeps this package's deletion: once `rank.ts` keeps the branch's `curveGap` and drops `limit`, the merged tree passes the typecheck (checked on a merge into `6c51a34`). The `LATER.md` conflict is the file's end: the branch numbered its eight new rows 487 to 494, which TRIM's rows now hold, so they take the next free numbers, and every cite of them moves with them, the ones that merge without a conflict included (its notes on rows 321 and 477, its two `REDESIGN.md` sections, and two comments in `src/lib/games/mtg/recommend.ts` and `src/lib/recommend/rank.ts`). (Corrected 2026-11-24: this bullet first said that `limit` merges without a conflict and then fails the typecheck, and did not say which rows collide in `LATER.md`.)

The evidence, the harness and how to run it again are in `.claude/trim-t2-evidence/` (gitignored, on this machine; `README.md` there names the traps this session met).


**What it is.** Delete what no production code reaches in the TypeScript tree outside the UI kit: seven functions only their tests call, a stat block option no adapter sets, four contract fields and options nothing reads, and four groups of leftover props, branches and rules from the browse, home and Tokens work. Class: **Delete**. Findings F04, F05, F06, F07, F08, F09, F10 of the audit.

**Found (2026-11-22).**

- **F04** (dead). Seven functions only their tests call, and one type nothing names. 47 lines in src and about 57 lines of tests; nothing ships.
- **F05** (dead). A stat block's "tone": in the contract and the renderer, set by no adapter. About 21 lines in src and 22 of test; the branch ships with the editor and the share page and never runs.
- **F06** (wasted). Three fields and options that are set and never read. About 8 lines; 42 B of every combo-facts answer and every Magic share payload.
- **F07** (dead). Two leftovers of the browse features: a re-export only a test imports, a menu prop nobody passes. 11 lines in src and about 11 of test; nothing ships.
- **F08** (dead). Leftovers of the home restyles: a component shape, a rule that never applied, a field and a prop nothing reads. 23 lines of source and 44 of tests; 54 B of built CSS on every page.
- **F09** (dead). The Tokens section's "several tokens" path after its button was removed. 9 lines the editor bundles and never runs.
- **F10** (dead). Five small props, branches and counts no production code reaches. Five of the auditor's seven items (about 35 lines for all seven); reading weight only.

For each finding, where it is (file and lines), the excerpt read, **the proof command to re-run first** and its output, what could break and the verifier's note are in `TRIM-AUDIT-report.md`, section 4, under the same id. The auditors' full records and the scripts the proofs call are in `.claude/trim-audit-evidence/` (gitignored; on this machine: `harness/README.md` there says how to run each).

**Size S. Deletions only: about 130 lines of source and about 135 of tests in some 20 files. No route, no migration, no dependency, no string a visitor reads.**

Pre-flight, in order.

1. **Main is green.** `pnpm check` = 3,945 tests / 327 files / 0 errors / 6 warnings at `beb324d` (main after T1) in the shared checkout; a clean worktree shows 5 warnings, because it has no `scripts/.tmp/`. The audit read `01af50d` (3,948 tests): re-run the check and record what it is today. `pnpm build`'s route table is `.claude/trim-audit-evidence/build-route-table.txt`; the diff at the end must be empty.
2. **Order.** This package runs after: T1 (both edit `src/components/theme/appearance-menu.tsx`'s neighbours in the kit; T1 first keeps the diffs apart). Other sessions share this checkout: stage explicit paths, and re-read `LATER.md` and `MEMORY.md` immediately before editing them.
3. **Re-run each item's proof command (report, section 4) before touching the item.** If a proof no longer holds (another session started using the thing), skip that item and report it; do not force it.
4. **Baseline before any edit**, with the audit's own scripts (`.claude/trim-audit-evidence/harness/`; each header says how to run it): the scoreboard lines named under Tests, and a capture of each page named there at 1440 and 390 (a screenshot, the accessible names, the status code and cache headers). T1 left a harness that compares two local builds element by element (tag, attributes, text, box, computed style), with roles and names, pictures, writes, status codes and cache headers: `.claude/trim-t1-evidence/` (its `README.md` says how to run it and names the traps it met). Build "before" and "after" in two clean detached worktrees (tracked files only, which is what a deploy builds): the shared checkout's main stylesheet is 602 B larger, because Tailwind reads the untracked audit report.
5. **Local only.** Servers and smokes run against `localhost` and the Neon development branch (`scripts/smoke/guard.ts`). Nothing is read from or sent to deckwarden.gg or the production database without the owner's OK in the chat, each time. Say at the start what will be measured.

## What this package is NOT (scope fence)

- NOT the UI kit (T1).
- NOT the copy limit on a zone and NOT the index hint on a search field: the build plan's contract names them, and they are the owner's (F91).
- NOT the loading skeleton's hub shape and NOT the two type-ladder classes: both are kept on purpose in writing and are the owner's (F92).
- NOT the 311 unneeded `export` keywords (F64, T21).
- NOT a migration (`drizzle/` is history), NOT a new dependency, NOT a change to a sentence a visitor reads, NOT a change to any route's caching.
- Anything else → `LATER.md` with a trigger. No "while I'm here".

## The package (decide and disclose the details)

1. **F04: Seven functions only their tests call, and one type nothing names.**

   The change: Delete the seven functions and the type. Tests: remove the assertions that exist only for them and re-point the rest at the function production calls (lookupScryfallArtMeta, preconChanges, resolveFrozenCards, MTG_ROLES, mapTournament's standingsWithLists, matchSets, parseAppearance). Optionally make precon-changes-line.tsx:43 the one spelling instead of keeping a helper.

   The test that it behaves the same: pnpm check green with the re-pointed tests; the same grep returns no line for any of the eight names; pnpm build route table identical (none is on a client or server path).

2. **F05: A stat block's "tone": in the contract and the renderer, set by no adapter.**

   The change: Remove `tone` from the stat block in types.ts, STAT_TONE and STAT_TONE_WORD and the two branches in Stat, and the 'stat tone' describe in analytics-blocks.test.tsx.

   The test that it behaves the same: pnpm check green; the share page and the editor's Stats tab on the fixture deck at 1440 and 390 pixel-identical (no stat has a tone today, so the same markup renders).

3. **F06: Three fields and options that are set and never read.**

   The change: Remove `factor` from BracketToward and the one place that sets it (brackets.ts:924). Remove `detail` from FeedFreshness and the two arguments that fill it; the `version` read that feeds one of them goes too (or lint fails), and ten test fixtures lose the key. The field leaves a JSON answer that no reader in the repository reads. Remove the `delayMs` parameter of `useAutosave` (only its test passes one) and keep the 1,000 ms constant. Leave a zone's `defaultCopyLimit`, a search field's `indexed` and the art kind `full_card`: the build plan and REDESIGN.md write them into the adapter contract, so they are the owner's (F91).

   The test that it behaves the same: `pnpm check` (use-autosave.test.ts drops the option only it passed; ten fixtures lose the `detail` key); the Why sheet, the bracket line and the brackets page render the same for the fixture deck (they read the state and the date only); `GET /api/combos/complete` differs only by the two absent `detail` keys.

4. **F07: Two leftovers of the browse features: a re-export only a test imports, a menu prop nobody passes.**

   The change: Delete the re-export of the One Piece color bits from punk-map.ts (lines 116-123) with the re-export assertions of punk-map.test.ts (its values case imports the constant from ./colors), and correct the comment at colors.ts:19-20 that names the re-export. Delete the `side` prop and the `side` attribute of AppearanceMenu (site-header.tsx:80 is the only renderer and passes none; DropdownMenuContent's own default is `bottom`).

   The test that it behaves the same: `pnpm check`: typecheck proves no caller passed the removed prop; punk-map.test.ts loses its re-export assertions (tests of deleted code) and its values case imports the constant from `./colors`; colors.test.ts and appearance-menu.test.tsx unchanged. The Appearance menu still opens below its trigger at 1440.

   The lead's note: Two of the auditor's four items left this finding after verification: the skeleton's hub shape is kept on purpose in writing (surface-skeleton.tsx:7, LATER row 395) and is the owner's (F92); the unreferenced image is F12.

5. **F08: Leftovers of the home restyles: a component shape, a rule that never applied, a field and a prop nothing reads.**

   The change: Delete globals.css:1248-1250, a rule that has never applied. Delete GameCard's open-region branch with its `field` flag (the non-headline shape becomes the field) and the test case at game-card.test.tsx:36-77. Delete `loadAppearance` and its import in the test. The record's other two items are counted elsewhere: the unreferenced image is F12, the menu's `side` prop is F07.

   The test that it behaves the same: `pnpm check`; the server HTML of `/` byte-identical before and after (the two GameCard callers render the same markup; page.test.tsx's heading and section pins); the built stylesheet differs only by the removed rule, and the computed transition of the three hero images while the card entrance is set is unchanged; `pnpm build` route table identical.

6. **F09: The Tokens section's "several tokens" path after its button was removed.**

   The change: Delete deck-editor.tsx:1846-1853 and make :1845 the return (`return handleAdd(tokens[0], zone.id, 1);`), drop applyListSwap from that callback's deps and the Add-all clause from its comment; delete target-change.ts:58. Optional in the same commit: narrow onAdd / onAddTokens / handleAddTokens to one card (three annotations, tokens-section.tsx:120 and :147, and the expectation at tokens-section.test.tsx:328).

   The test that it behaves the same: tokens-section.test.tsx (14 test blocks; the search's add reaches the pane's add with the token) and deck-editor.test.tsx's token cases green; the typecheck in `pnpm check` proves no caller passes several.

7. **F10: Five small props, branches and counts no production code reaches.**

   The change: (a) Drop AppearanceMenu's `side` prop (the same edit as F07). (c) Drop `limit` from RankInput and the two no-op arguments; the two tests that pass one (rank.test.ts:119 and :510) slice the result themselves. (e) Make `emptyLabel` required on the history dialog (all three call sites pass it). (f) `scryfallId: col('scryfall id')` in parse.ts:216, whose ternary has two identical arms. (g) Drop the two counts no caller reads, and their fields, from the collection import's return types (the plan's `quantityClamped` is one: the number the page shows is the parser's own).

   The test that it behaves the same: appearance-menu.test.tsx, rank.test.ts (with the slices moved into the two cases that passed a limit), history-dialog.test.tsx, parse.test.ts, plan.test.ts (the count assertions go with the fields) and the Autofill route's fixed-seed golden unchanged.

   The lead's note: Items (b) and (d) left this finding after verification: the skeleton's hub shape and the two type-ladder classes are pinned on purpose (surface-skeleton.tsx:7; tokens.test.ts:261, :280, :325) and are the owner's (F92). The verifier adds that (c) and (g) do run, with no reader of the result.

Files this package touches (from the findings; re-derive at the start): `src/lib/cards/art.ts`, `src/lib/cards/art.test.ts`, `src/lib/decks/precon-changes.ts`, `src/lib/decks/precon-changes.test.ts`, `src/lib/decks/versions.ts`, `src/lib/decks/versions.test.ts`, `src/lib/games/mtg/roles.ts`, `src/lib/games/mtg/roles.test.ts`, `src/lib/games/mtg/tagger.test.ts`, `src/lib/games/mtg/topdeck-map.ts`, `src/lib/games/mtg/topdeck-map.test.ts`, `src/lib/sets/lines.ts`, `src/lib/sets/lines.test.ts`, `src/lib/theme/appearance.ts`, `src/lib/theme/appearance.test.ts`, `src/lib/brackets/target-change.ts`, `src/lib/games/types.ts`, `src/components/deck/analytics-blocks.tsx`, `src/components/deck/analytics-blocks.test.tsx`, `src/lib/games/mtg/brackets.ts`, `the ten test files that carry the fixture key`, `src/components/surface-skeleton.tsx`, `src/components/surface-skeleton.test.tsx`, `src/lib/games/optcg/punk-map.ts`, `src/lib/games/optcg/punk-map.test.ts`, `src/components/theme/appearance-menu.tsx`, and 11 more.

## Tests and checks

- `pnpm check` green, with no test deleted or loosened except the tests of deleted code; name each deleted or changed test in the ship note.
- `pnpm build`: the route table identical to the baseline (the same routes with the same static, ISR and dynamic marks).
- Against a local server on the development branch: `pnpm smoke:decks`, `pnpm smoke:hubs`, `pnpm smoke:seo`.
- Before and after, `/`, `/commanders`, `/c/atraxa-praetors-voice`, `/cards`, the Sol Ring card page, a share page, `/sets`, `/brackets`, `/l/ace-newgate-st22-001` and the editor, at 1440 and 390: the same pixels, the same accessible names, the same URLs, status codes and cache headers, the same database writes. A JSON field may go only if every reader is in this repository and none reads it.
- The scoreboard lines this package should move (section 3 of the report; measure with the same scripts and record before and after):
  - Source lines (3.1): 78,255 down by about 130; test lines down by about 135.
  - Built stylesheet (3.1): down by 54 B (a rule that never applied).
  - Exports only tests mention (3.1): 279 down by the seven functions and one type.
  - Client JavaScript (3.3): unchanged to within a few hundred bytes (unused exports were never bundled). Route table identical.
- Deploy: every push to `main` deploys. Push only on the owner's word, then read the result as the deploy-verification note in `MEMORY.md` says.

## LATER rows this package touches or opens

- Rows the findings cite: 287, 395. Annotate each with what this package changed for it; every changed row keeps exactly two cells.
- Opens nothing expected. If a deleted name turns out to be read by a scratch script the owner still uses, restore it and say so.

## Session notes

- Each finding's proof command is a whole-word grep: re-run it first and stop on any new hit (another session may have started using a part since `01af50d`).
- `scripts/.tmp/` is linted: a scratch script there that imports a deleted name turns `pnpm check` red. Grep it too, and report rather than edit what you find.
- Tests of deleted code are deleted with it; no other test changes. Name each deleted test case in the ship note.
- Never `cd`; `pnpm` needs `export PATH="$HOME/.local/node22/bin:$PATH"`; the shell's `grep` is ugrep (use `/usr/bin/grep`); scratch scripts under `scripts/.tmp/` are linted; evidence goes under `.claude/trim-t2-evidence/` (gitignored). ESLint reads that folder too (every folder under `.claude/` except `worktrees/`, LATER row 487): keep scripts there as `.txt` and put no built JavaScript in it.
- Tailwind reads the Markdown files for class names until T6 ships (LATER row 217): quote no class strings in the ship note.
