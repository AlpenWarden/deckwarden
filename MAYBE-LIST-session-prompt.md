# MAYBE-LIST session prompt (2026-11-26): a Maybe section under the deck, and a Maybe button on Suggestions rows at any deck size

*Status: **built 2026-11-26** as `1144a85` on `claude/modest-turing-ca0875`, on top of `1b1cddc`, by the session that wrote this brief as its step 0, from the sketch in `OWNER-NOTES-2026-11-24-session-prompt.md` ("What follows the build", "MAYBE-LIST (idea 3), M") and the task the owner's planning session gave it. Live since 2026-11-26 06:42 Z (pushed at 06:41:19 Z with `1b1cddc`, `1144a85` and `f2d588a`) and read on production as a guest; the owner's signed-in try is open (LATER row 548). The record is REDESIGN.md, "A Maybe list under the deck", and "MAYBE-LIST, as built" in the OWNER-NOTES file, which lists where the build differs from this brief. Below this line the brief is as written at step 0, with the owner's answers added under THE DECISIONS (the default on each, 2026-11-26 05:28 Z). Anchors were verified at `1b1cddc` (local `main`, one docs-only commit ahead of GitHub's `b836689`): re-grep line numbers, trust the shapes. The sketch was written against `ea6aa27`; packages 0 to 4 have changed the editor since, and every place below was re-found in today's code.*

One Deckwarden work package, one session. Read CLAUDE.md and AGENTS.md first.
No migration (a deck card's zone is free text checked against the format's
declared zones, `src/db/schema.ts`), no new route, no new field in the game
contract.

THE CONTRACT
`OWNER-NOTES-2026-11-24-session-prompt.md`, the MAYBE-LIST sketch under "What
follows the build", with that file's "Idea 3: a maybe section, and Add past 100
goes to it" and items 1 and 2 of "Where the documents and the code disagree";
LATER.md rows 497 (this package) and 509 (One Piece, stays deferred). This
prompt adds what the sketch leaves to the builder: the places it names, found
again in today's code, the places it does not name, and the way each path a
card takes into a deck treats a card that sits in Maybe.

START STATE
- The tip of local `main`, `1b1cddc`: GitHub's `main` (`b836689`) plus the
  docs-only ship note of the fit fix. A push of `main` carries that note: name
  it to the owner at the ship question, with `git log --oneline
  origin/main..HEAD` read out after a `git fetch`.
- Branch `claude/modest-turing-ca0875`, worktree
  `.claude/worktrees/modest-turing-ca0875`. The worktree needs the `.env.local`
  symlink (done), `pnpm install --frozen-lockfile --prefer-offline` (done) and
  a launch entry of its own for the preview on a free port.
- LATER.md ends at row 537 (row numbers are line numbers). Re-read `git log`,
  the end of LATER.md and the project memory index right before writing the
  records: other sessions may land on `main` meanwhile.

THE ASK (the owner, 2026-11-24, as given)
"Add a maybe section for cards you are considering also have the button in
suggestion tabs still allow to add past 100 cards and it will add it to the
maybe list at the bottom of the deck"

THE SHAPE (the sketch's, kept)
- Magic's Commander format declares one more zone, last: id `maybeboard` (the
  word the importer already writes), label "Maybe", min 0, max null,
  `countsTowardSize: false`, no `isLeaderZone`, no `holds` (it holds cards).
  Shared code finds it as "counts toward no size, is no leader's, holds cards"
  (`maybeZoneOf` beside `tokenZoneOf` in `src/lib/decks/playable.ts`), and a
  test pins at most one such zone per format, every adapter's formats read.
  `playable()` already leaves it out (leader OR counted), so validation,
  analytics, the bracket read, Suggestions, Autofill, the Cut Coach, the sample
  hand, combos and the export never see it, by construction.
- The editor and the share page draw a "Maybe" section, closed by default,
  below Tokens. A Suggestions row gains a small "Maybe" button on its sources
  line, so the name keeps its width; "Add" or "Swap in…" stays on the first
  line. A Maybe row offers "Move to deck" (at the deck's maximum it opens the
  existing swap sheet) and Remove.
- The editor's rule: a card that enters the deck leaves Maybe. The database
  allows a card in both; no screen makes one.
- One Piece declares no such zone (row 509), so every Maybe surface is absent
  there.

STEP 0: THE PLACES THAT ASSUME TOKENS IS THE ONLY ZONE THAT DOES NOT COUNT
The sketch's eleven, each found again (anchors at `1b1cddc`), and what each
must do with a Maybe zone. Nothing outside the eleven needs a change; inside
them there is more than the sketch spelled out (three readers of the in-deck
count, seven add paths and their Undo, ten files of comments). By the plan's
rule ("if its brief finds more than the eleven places it becomes two
packages") this stays one package.

1. The link preview. `src/lib/og/data.ts:75`: the cards statement filters out
   tokens by `attrs.is_token` and reads every zone, so a Maybe card would be
   counted in "N cards", the curve and the price. Must read the format's
   playable zones only (`playableZoneIds` of the deck's format, bound in the
   statement). `src/lib/og/data.test.ts` runs the real builders over a fake
   client: a new case pins the zone list in the statement.
2. The editor's in-deck count. `src/components/editor/deck-editor.tsx:2216`
   (`inDeckQty`) sums every zone. It feeds the search row's ×N
   (`search-pane.tsx:293`), the Suggestions rows' "In deck ✓"
   (`recommendations-panel.tsx:375`, `:427`) and three Combo Radar reads
   (`combo-radar-panel.tsx:287`, the missing pieces "Add N pieces" adds; `:479`,
   a near-combo row's "In deck ✓"; `:641`, the missing count). With Maybe a
   parked card would read as in the deck, and "Add N pieces" would skip a piece
   that sits in Maybe while saying the pieces were added. Must count the
   playable list only; a second set (`inMaybe`) marks Maybe cards.
3. The list pane and the share page. `src/components/editor/deck-list-pane.tsx:303-309`
   and `src/components/deck/deck-share-view.tsx:419-424` split the entries
   (`splitLeaderEntries`) and draw only the token zone's rows out of `aside`;
   any other aside row is kept, saved and never drawn. Must draw the Maybe rows
   as their own section: no legality marks (a Maybe card is not validated), no
   steppers, the owned mark kept.
4. The phone card sheet and the tag editor. `deck-editor.tsx:2606-2636`
   (`sheetEntry`: the first non-leader entry, so a Maybe card would get the
   deck's Remove and no way into the deck) and `:2225-2237` (`tagging`: the
   same pick, so a Maybe card would get the tag editor). The sheet must offer
   "Move to deck" ("Swap in…" at the maximum) and "Remove from Maybe" for a
   card whose only entry is in Maybe; the tag editor must edit deck entries
   only.
5. The list hash. `src/lib/decks/list-hash.ts:23-27`: every zone is in the
   payload on purpose, so a Maybe edit would count as a change to the list for
   the game journal. The owner's decision 2. Callers: `versions.ts:275`
   (insertVersion stamps it), `src/lib/journal/games.ts:218` and `:234`,
   `src/app/api/decks/[id]/versions/route.ts:64`,
   `src/components/editor/history-dialog.tsx:311`.
6. Import's "Replace deck". `src/lib/decks/import.ts:132` keeps every row
   outside the playable list, so Replace would keep the old Maybe list and add
   the paste's Maybe lines to it. The decision under "Import" below.
7. The empty deck. `deck-list-pane.tsx:335` and `:533-538`: `listed` is the
   deck's rest, so a deck holding only Maybe cards reads "No cards yet / Add
   them from Search." with its Maybe section under it. The hint must name Maybe
   as a way in when Maybe holds a card.
8. The guest-deck purge. `scripts/purge-anon-decks.ts:71`: "empty" is "no
   deck_cards row", so a guest deck holding only Maybe cards is never empty.
   That is right (the player put cards in it); it still goes after 12 months
   untouched. No change; the comment says so.
9. The save route's 500-row limit. `src/app/api/decks/[id]/cards/route.ts:64`
   bounds the whole list, every zone. Maybe has no limit of its own, so a long
   Maybe list could push a deck past 500 rows, and the editor would then fail
   every save with nothing said. The editor must refuse a new row past 500 with
   a sentence (`addCard`, one constant beside `MAX_QTY`), and Import must skip
   the lines past it with one warning.
10. The add paths. No path takes a card out of Maybe: `handleAdd` (`:1507`),
    `handlePanelAdd` / `handleUndoableAdd` (`:1604`, `:1620`),
    `handleComboPiecesAdd` (`:1644`), `swapOne` (`:1680`, behind Swap in… and
    Swap Lab), `applyListSwap` (`:1882`, behind Import, Fit, Swap to fit,
    Upgrade toward and Autofill's Add) and `applyImport`. Each must, and each
    Undo must bring the Maybe row back. The next section lists them.
11. Comments that stop being true. `playable.ts:1-16` and `:42-45`, Magic's
    `formats.ts:11-14`, `src/lib/decks/cards.ts:50-55` ("the Tokens zone never
    becomes a maybeboard"), `src/lib/games/types.ts:40-46` (ZoneDef `holds`),
    `src/lib/decks/validation.ts:26-33`, `src/lib/decks/view-model.ts:47-52`
    (`aside` "is the token list"), `list-hash.ts:23-27`, `import.ts:108-116`,
    `deck-list-pane.tsx:71-77` and `src/lib/decks/versions.ts:130-134`.

Readers that are already right by construction (each gets a test that a Maybe
card changes nothing, per THE RISK): `toDeckSnapshot` (`validation.ts:35`:
validate, analyze, the bracket read, speed, the export, Copy list, "At the
table"); `deckSizeCount`, `deckProgress`, the completion ring and the over-limit
link; `deckOwnership` and `deckEstimate` (counted zones: "You own N/100", the
goals line, the Fit sheet); the buy menu; `precon-changes.ts` (counted zones);
`snapshotBody` (every draft Suggestions, Swap Lab, Fit, Swap to fit and Upgrade
toward request sends the playable list only); the Autofill sheet's kept list
and the route's refusal of an unplayable kept row (`autofill/route.ts:176`);
`loadDeckEntries` through `playableEntries` (Suggestions on a saved deck);
`loadDeckCardIds` with `playableZoneIds` (the combos route); `listVersions`'
"N cards" (counted zones); the sample hand and ambient art (`rest`, leader);
token fill (playable list); the panels' fetch keys (`deckStateKey` of the
playable list, so a Maybe edit never refetches Suggestions or the Radar).
Carried whole, by design: the wire, the editor's save, versions (frozen with
Maybe), restore (brings the frozen Maybe back), forks (copy it). One count reads
every zone and no screen shows it: a version's detail `cardCount`
(`versions.ts:197`); left as it is (a LATER row).

HOW A CARD ENTERS A DECK, AND WHAT MAYBE DOES TO EACH
- Search, the phone card sheet's Add, a leader pick: `handleAdd`. A card that
  sits in Maybe leaves it; the toast reads "Moved <name> from Maybe" and its
  Undo puts the deck's quantity back and the Maybe row back where it was.
- A Suggestions or Combo Radar row's Add: `handleUndoableAdd`. The same. At
  the maximum it opens Swap in… as today.
- A combo's pieces together: `handleComboPiecesAdd`. A piece in Maybe is a
  missing piece (the count of item 2), is added, and leaves Maybe; the one
  toast's Undo restores every piece's quantity and every Maybe row.
- Swap in… (search, a panel row, a Maybe row at the maximum) and Swap Lab:
  `swapOne`. The incoming card leaves Maybe; Undo restores the outgoing row,
  the incoming quantity and the Maybe row.
- Whole-list changes, Import, Fit, Swap to fit, Upgrade toward, Autofill's Add:
  `applyListSwap`. Every card whose copies in the playable list rose leaves
  Maybe; Undo restores the previous list whole, as it does today. Autofill's
  Add keeps Maybe rows (unplayable rows are kept, as Tokens are).
- Import: Maybeboard sections and Archidekt's out-of-deck categories land in
  Maybe with no parser change; Sideboard and Companion lines stay skipped. A
  Maybe line for a card the deck holds after the import is left out with one
  warning.
- The Maybe button: a card already in the deck is refused; a card already in
  Maybe reads "In Maybe". A Maybe add never counts toward the size, so it is
  offered at any size. Toast "Added <name> to Maybe", Undo takes it out.
- "Move to deck": below the maximum, the row's copies go to the main list with
  its chosen printing, the Maybe row leaves, toast "Moved <name> to the deck",
  Undo restores both. At the maximum: the swap sheet, then `swapOne` above.
- Remove from Maybe: `handleRemove`, its "Removed <name> from Maybe" and its
  Undo.
- Version restore and forks write the frozen or upstream list whole on the
  server; the editor reloads. Draft seeds start with no Maybe.

THE DECISIONS (the owner's; each default first)
The owner's answers, 2026-11-26 05:28 Z, in the build session's question
dialog: the default on all five ("Maybe beside Swap in…", "No, only the deck
counts", "Visitors see it closed; exports leave it out", "Replaced only if the
paste has Maybe lines"; decisions 3 and 4 were put as one question).
1. At 100 cards. Default: Maybe is on every Suggestions row at any size, and at
   100 Add still reads "Swap in…" and opens the swap sheet. Flip: at 100 the
   row's one button parks the card in Maybe and Swap in… leaves the
   Suggestions rows (Y7b's pins there rewritten; a full deck takes a
   suggestion in two steps).
2. The game journal. The sketch gave no default. This brief's: a Maybe edit
   is not a change to the list played. The list hash leaves the Maybe zone out,
   so a game logged after a Maybe-only edit reuses the latest version and
   History keeps "No card changes since vN"; versions still freeze the Maybe
   list and the compare view still lists Maybe changes. No stored hash moves
   (no stored list holds a Maybe row). Flip: like a token edit, no code
   change, and each game logged after a Maybe edit saves a played list of its
   own (the journal keeps 100 per deck).
3. Exports. Default: no; Export and Copy list carry the deck alone. Flip: a
   "Maybeboard" section in the export (the serializer is handed the Maybe
   cards: a contract change).
4. Visitors. Default: yes, under a closed "Maybe" heading, shown only when it
   holds a card. Flip: owner only (every non-owner wire strips Maybe rows; a
   visitor's fork starts with none).
Import, a decision step 0 turned up. Default: "Replace deck" replaces what the
paste brings: the Maybe list is replaced only when the paste has Maybe lines,
and otherwise stays, as Tokens do; Undo restores the old list either way. Flip:
Replace never touches Maybe and the paste's Maybe lines are added to it.

BUILD
0. Records first in the worktree only: this file. Nothing is committed before
   the build is green.
1. The zone and the finder. `formats.ts` gains the zone; `playable.ts` gains
   `maybeZoneOf`; the per-format test; the comments of item 11.
2. The pure edits (`src/lib/decks/editor-state.ts`): `MAX_ENTRIES` and its
   refusal in `addCard`; `leaveMaybe(entries, format, cardIds)` returning the
   list and the rows it took out with their indexes; `restoreLeft`; the rise
   check for whole-list changes. Unit tests with one-line mutations.
3. Import (`import.ts`): the Replace rule, the Maybe-line-for-a-deck-card
   rule, the cap. Tests in `import.test.ts` and a parse-to-zone round trip in
   `decklist.test.ts`.
4. The preview (`og/data.ts`) and the hash (`list-hash.ts` and its callers,
   per decision 2), each with its test.
5. The editor (`deck-editor.tsx`): the two counts, the Maybe add, Move to
   deck, the rule in every add path and its Undo, the sheet, the tag editor.
6. The drawing: a `MaybeSection` component (`src/components/deck/`) used by
   the list pane (with its open state in the view preferences, `maybeOpen`) and
   the share page (read-only); the empty deck's hint.
7. Suggestions: the Maybe button and "In Maybe" (`recommendations-panel.tsx`,
   with `use-resolved-add.ts` taking the callback per call so Add and Maybe
   share its cache); the search row's "In Maybe" mark.
8. Checks, smokes, the build, the pane, the records.

SCOPE FENCE (each a LATER row with its trigger)
- A Maybe button in search, on Combo Radar rows and in the card sheet for a
  card in neither list.
- Maybe tiles in the grid view (the section draws text rows in both views).
- Whether a Maybe card would be legal in the deck (a quiet line on its row).
- Autofill or Suggestions reading the Maybe list (preferring its cards).
- A version detail's `cardCount` counting every zone (unread on screen).
- One Piece's maybe list: row 509, unchanged.

ACCEPTANCE (what a person sees, then the check)
1. A guest adds a card to Maybe at 100 / 100 and reloads: the deck reads 100 /
   100, the card under Maybe. (Editor test; the pane on a guest deck.)
2. The share link shows it under a closed "Maybe" heading, and the link
   preview still says 100 cards. (Share view test; `og/data.test.ts`; the pane.)
3. A banned or off-colour card in Maybe raises no legality warning, and its
   row carries no mark. (Validation and pane tests.)
4. Moving a Maybe card into the deck takes it out of Maybe, and Undo restores
   both. (Editor tests, for each add path above.)
5. A pasted list with a Maybeboard section, and an Archidekt list with its
   out-of-deck categories, land in Maybe; Sideboard lines stay skipped.
   (`import.test.ts`, `decklist.test.ts`.)
6. One Piece decks are unchanged: no Maybe section, no Maybe button. (Editor
   and panel tests on a One Piece deck.)
7. A Game Changer, a combo piece or an extra card in Maybe changes nothing in
   the bracket read, the size, the curve, the export or Suggestions' body.
   (Tests on each reader named in step 0.)
8. At 100 cards a Suggestions row offers Swap in… and Maybe (decision 1's
   default). (Panel and editor tests.)

VERIFY
- `pnpm check`, with the existing checks the sketch names extended
  (`playable.test.ts`, `cards.test.ts`, `import.test.ts`, `decklist.test.ts`,
  the "Swap in…" cases in `deck-editor.test.tsx`), plus the panel, pane, share
  view, search pane, card pane, view-prefs, list-hash and og data tests.
- `pnpm smoke:decks` and `pnpm smoke:versions` against a local server on the
  dev branch, each gaining Maybe checks (a Maybe row saves and reads back, a
  token in Maybe is refused, a banned card in Maybe is no issue, the version's
  count and hash per decision 2).
- `pnpm build`: the route table is `1b1cddc`'s.
- A one-line mutation of each zone check turns a test red.
- The browser pane at 320, 390, 768 and 1280 px in both themes, on a guest
  deck; a WebKit read in the iOS Simulator if a phone layout changes.
- Smokes and scratch scripts go to a local server and the dev branch only
  (`scripts/smoke/guard.ts`, `guardDatabaseUrl`). Never retry a 429.

RECORD
A REDESIGN.md section; LATER rows after the current last row; a progress line
and a "MAYBE-LIST, as built" section in `OWNER-NOTES-2026-11-24-session-prompt.md`;
this file committed; a ship note once it is live.
