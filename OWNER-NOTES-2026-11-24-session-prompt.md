# OWNER-NOTES session prompt (2026-11-24): decks built from the collection, a collection page, a build button from search, a deck total in Autofill

*Status: **written into the repository on 2026-11-24** by the session that started package 1, from the plan the owner approved that day. The owner gave five feature ideas in chat and asked what belongs in the next build. A read-only planning session read the planning documents and the code behind each idea, put four questions to the owner, and wrote the plan against `ea6aa27` (`main` = `origin/main`); the owner approved it as a whole in the app's plan dialog, so its 17 defaults stand until the owner flips one. The plan's own file is outside the repository (`~/.claude/plans/act-as-a-senior-starry-kitten-of-a6a2aee5-039d-4689-96aa-0b84d703093d.md`). From "Context" down, this file is that plan's text as approved: its links are written as plain paths, the home folder as `~`, and one card name in an example is corrected (the plan wrote "Meren of Clan Nathreyi"; the card is Meren of Clan Nel Toth). Nothing else is changed there. It speaks to the owner, so "you" is the owner and "I" is the planning session. Above "Context" is what the building sessions added: this header, the owner's answers at package 1's gate, package 0, which that gate called for, and (2026-11-25) package 1's hand-over as built. Four packages in the plan and one added, each its own session, one package per session, deployed and `pnpm check`-green or not done (CLAUDE.md); then two follow-ups that are sketched, not specified. Anchors were verified at `ea6aa27`: re-grep line numbers, trust the shapes. The record was committed as `a430816` on the owner's word and fast-forwarded into local `main`, so a parallel session (package 3 can run beside the others) can start from there: it needed this file and the LATER.md rows it brought (new rows 497 to 512; rows 12, 66, 69, 165, 191, 349 and 481 annotated) committed, because LATER.md's row numbers are line numbers, so two sessions appending rows would number them differently, and a worktree session cannot see an untracked file.*

*Progress, 2026-11-24: **package 0 (OWNED-FILTER) is built and committed on its session's branch; it is not merged, pushed or read on production yet, each of which waits for the owner's word. (Since then: live. See "Shipped, 2026-11-25" below.) Package 1 (AUTOFILL-OWNED) ran its step 0, failed the speed rule as measured, and stopped there; on the owner's word ("Rewrite the filter first") the same session built package 0, and AUTOFILL-OWNED starts in the next session, from the rewritten filter.** Step 0, speed: with a collection at the 20,000-row cap, the id list added 4.5 s at the median (13,565 ids) to 6.6 s (19,995 ids) to Autofill's two candidate gathers, measured on the dev branch from the owner's machine, against the rule's 300 ms. Nearly all of it was the list travelling from that machine (about 0.9 MB a statement, five statements a request); the database's own share was 41 to 195 ms. Production's functions run in the database's region, so the cost there should have been a fraction of this, and that was not measured. Step 0, usefulness: sample collections of random Magic printings fill all 62 spell slots for all five test commanders from 1,000 printings up; at 100 printings the one- to three-colour commanders get 18 to 47 of 62, and the list would say so. Package 0: the owned filter is a probe keyed by the player, so no list of cards is read or sent. It returns the id list's rows in the id list's order (259 of 259 statement comparisons on the dev branch), and at the cap it adds 40 ms at the median to those two gathers (worst 377 ms). For an ordinary collection it does a little more work in the database than the list did (about a tenth of a second for Suggestions at 2,500 rows) and sends about half a megabyte less. In the minute after a large import an owned request is slower (about 1.3 s at the cap; LATER row 511). `pnpm check` is green (3,964 tests in 328 files); the collection, Suggestions and Autofill smokes pass against a local production build (52 of 52, 69 of 69, and the baseline's 69 of 71); the route table and both stylesheets are `ea6aa27`'s. The records are REDESIGN.md's "The owned filter sends no list of cards" and LATER rows 69 (closed) and 510 to 512. The figures, the scripts and their output are in `AUTOFILL-OWNED-step0.md` and `OWNED-FILTER.md`, each with an evidence folder, in the side-session notes of the session that started this one. Packages 2 to 4 and the two follow-ups have not started.*

*Progress, 2026-11-25: **package 1 (AUTOFILL-OWNED) is built and committed on its session's branch (`claude/reverent-bun-efdd12`), on top of package 0; it is not merged, pushed or read on production yet, each of which waits for the owner's word. (Since then: live. See "Shipped, 2026-11-25" below.)** Package 0's commit `5b0a038` was in local `main` when that session started (`origin/main` was still `ea6aa27`), so the line above is out of date on that point: a push of `main` now ships the record and package 0 together, and package 1 with them once it is merged. What a player gets: "Only cards I own" in the Autofill sheet, and a starter list made only of their own cards and the basic lands it needs, inside the bracket they pick, with any open slots counted. A signed-out ask or a player with no collection gets no list. A new, unsaved deck now learns that its signed-in player has a collection, so it marks owned cards and shows the "You own N/100" line before its first save. The privacy page carries the approved sentence. `pnpm check` is green (3,999 tests in 328 files, 35 new; 36 one-line mutations each caught). Against a local production build on the dev branch: the collection smoke passes 62 of 62 with ten new checks, the Autofill smoke its baseline 69 of 71, the route table is `5b0a038`'s, and an ask with the box unticked sends the same 12 statements and returns the same bytes as before. One line of the brief does not hold: the checkbox's touch target measures 42 px, not 44, as every checkbox on the site does (LATER row 513). The records are REDESIGN.md's "Only cards I own, in the Autofill sheet", the section "Package 1: AUTOFILL-OWNED, as built" below, and LATER rows 66, 165, 349 and 501 to 503 (amended) and 513 to 516 (new). Packages 2 to 4 and the two follow-ups have not started.*

*Shipped, 2026-11-25: **packages 0 and 1 are live.** The owner's "Push all three" put the record (`a430816`), OWNED-FILTER (`5b0a038`) and AUTOFILL-OWNED (`5d310c8`) on `origin/main` in one push at 19:37:32 Z. Vercel reported the production deploy at 19:38:19 Z, and CI run 45687054135 was green at 19:43:11 Z. Read on production as a guest, on the owner's OK (two page views and two signed-out requests, 19:51:58 to 19:53:19 Z): the privacy page carries the approved sentence (acceptance line 15); a new deck's Autofill sheet shows "Only cards I own" disabled with its hint, and its list loads as before; a signed-out owned ask is refused with 401 and no list; Suggestions with `owned=1` answers a guest the full list with its reason. **The owner's signed-in try:** both boxes ticked by a signed-in player who has a collection, which a session cannot be on production. Offered a read-only timing in the production database instead, the owner chose to try it themself, and reported the same day that both worked (their word, with no figure; LATER row 517 is done). The read is in REDESIGN.md, in the Production bullet of each of the two sections. Packages 2 to 4 and the two follow-ups have not started; package 2 (COLLECTION-PAGE) is next. (Since then: package 2 is built. See the next line.)*

*Progress, 2026-11-25, later: **package 2 (COLLECTION-PAGE) is built and committed on its session's branch (`claude/awesome-robinson-dc6377`), on top of `7431ec0`; it is not merged, pushed or read on production yet, each of which waits for the owner's word. (Since then: live. See "Shipped, 2026-11-25, 21:18 Z" below.)** A push of `main` with it would also carry the two docs commits that are in local `main` only, `f99c662` and `7431ec0`. What a player gets: `/collection`, opened from the account menu's "Collection" or from "View your collection" on Account. It opens on "Commanders you own", sixty a page, each with its colors, a count such as "412 of your cards are in its colors" and "Build from my collection", which opens a new deck with that commander, the Autofill sheet open and "Only cards I own" already ticked. A banned or not-legal commander is named in one quiet line and has no build button. "Your cards" lists the collection one row per card with its copies added up, with a name filter and two orders. Signed out, the page shows the sign-in buttons and nothing else. The measurement that came first: at the 20,000-row cap on the dev branch the page's three reads together take 316 to 418 ms of the database's own time, against the plan's 500 ms, so sixty a page stands. `pnpm check` is green (4,094 tests in 332 files, 95 new; 57 one-line mutations, 53 caught at first, three more after a test each, one equivalent). Against a local production build on the dev branch: the collection smoke passes 93 of 93 with 31 new checks, and the route table gains exactly one line, `/collection`, with `/decks/new` still static. All eight acceptance lines pass by the check each names. Two things differ from the plan: a build link opened by another signed-in collector opens ticked for that player's own cards (LATER row 520), and the commanders read sends every owned commander to the server, which made the page slow from the owner's machine at the cap and is unmeasured on production (LATER row 518). The records are REDESIGN.md's "The collection page", the section "Package 2: COLLECTION-PAGE, as built" below, and LATER rows 12 and 504 (amended) and 518 to 520 (new). Packages 3 and 4 and the two follow-ups have not started; package 4 (AUTOFILL-TOTAL) is next in the order, and package 3 (COMMANDER-DOOR) can run beside it.*

*Shipped, 2026-11-25, 21:18 Z: **package 2 is live.** The owner's "Merge and push" put COLLECTION-PAGE (`c08a9e9`) on `origin/main` at 21:18:28 Z, with the two docs commits that were in local `main` only (`f99c662`, `7431ec0`); the owner had been told the push carries the three. Vercel reported the production deploy at 21:19:18 Z, and CI run 45703130195 was green at 21:24:25 Z. Read on production as a guest, on the owner's OK (two signed-out requests and one page view, 21:19:57 to 21:20:17 Z): `/collection` answers a guest with the sign-in buttons and nothing else, never stored and not indexed; `robots.txt` disallows it; a guest's "Build from my collection" link opens a new deck with the commander, the sheet open and "Only cards I own" unticked with its hint, after one Autofill request with no flag, and both one-time flags leave the address. **The owner's signed-in walk-through:** the signed-in page, which a session cannot read on production. The owner chose to walk through it themself (Collection from the account menu, the commanders, "Build from my collection"), and reported the same day that it worked (their word, with no figure; LATER row 521 is done). No timing in the production database was approved. The read is in REDESIGN.md, in the section's Production bullet. Packages 3 and 4 and the two follow-ups have not started.*

*Progress, 2026-11-25, package 3: **package 3 (COMMANDER-DOOR) is built and committed on its session's branch (`claude/elated-swirles-2a1816`), on top of `23afe59`, as `ccc77ba` and `31e620f`; it is not merged, pushed or read on production yet, each of which waits for the owner's word.** It was built beside package 4's session, which had committed nothing when this was written. What a visitor gets: on a commander's card page, "Build with this commander" in a row of its own under the Legality chips; in the header's search, "Build with <card name>" as the entry under the top suggestion when that is a legal commander; under each legal commander's tile on `/cards`, the same sentence as a link. Each opens a new deck with the card in place, and nothing is saved until the first edit. One Piece leaders get the same, with the card number in the search words. A banned or not-legal commander, a removed card and Sol Ring get none. One rule decides all three places (`src/lib/decks/leader-build.ts`). Measured before the search flag was kept: at most 1.8 ms more on a suggestion (the bar was 5 ms), and the flag agrees with the rule for every leader candidate on the dev branch (4,174 of 4,174 for Magic, 142 of 142 for One Piece). `pnpm check` is green (4,179 tests in 334 files, 85 new; 51 one-line mutations, 50 caught by a test and one by the type checker). Against a local production build on the dev branch: the route table is the starting commit's, the four smokes pass as before (64, 97, 26 and 63 checks), and pages are about 1 KiB heavier. At the gate the owner kept all four points as built: no action for a banned commander, the button for a preview commander, the whole sentence under a tile, and the entry directly under the top result. The records are REDESIGN.md's "A build button where a commander is found", the section "Package 3: COMMANDER-DOOR, as built" below, the brief `COMMANDER-DOOR-session-prompt.md`, and LATER rows 506 to 508 (amended) and 522 to 529 (new). Package 4 and the two follow-ups are not built.*

*Order: package 0 (OWNED-FILTER), then 1 (AUTOFILL-OWNED), then 2 (COLLECTION-PAGE), then 4 (AUTOFILL-TOTAL): each of these edits the recommendation queries, the Autofill route, its sheet or the editor after the one before it, so they never run in parallel. Package 3 (COMMANDER-DOOR) edits none of those files and can run beside any of them in its own session, once this record is committed. Then MAYBE-LIST, then DECK-FACTS, each with its own brief. Every push to `main` deploys: each package pushes only on the owner's word and is read on production only on the owner's OK.*

The owner's ideas, as given (2026-11-24):

1. "A feature or list to input you whole collection to have the website build decks based on your inventory of cards and it try’s its best also on a bracket level you choose. And a separate page to view your collection of cards and have features to build off that. Basically You should have a feature where you can upload all the cards you have and it builds the best deck from them"
2. "Also it’s subjective but if you could find out a way to have a metric of how fun the deck is, cause i’d rather have a fun deck than a boring one even if it’s better"
3. "Add a maybe section for cards you are considering also have the button in suggestion tabs still allow to add past 100 cards and it will add it to the maybe list at the bottom of the deck"
4. "If you search for a commander in the normal search bar it should know if its a legendary creature and then have a small button from the search result to add commander and then take you to the build page also when you land on the card page there should be a button next to where is says “commander: legal” add commander"
5. "On the auto fill page when starting a new deck where bracket and next to budget have a spot to type your total budget to keep the deck in that range or have a drop down of price range people can choose from"

## The owner's answers at package 1's gate (2026-11-24, the build session's question dialog)

Each was put with step 0's figures beside it, and the owner picked the plan's default every time.

- **The speed gate: "Rewrite the filter first".** The session that ran step 0 becomes the filter-rewrite package (package 0 below); AUTOFILL-OWNED starts in the next session.
- **Decision 3: "Keep it strict".** With "Only cards I own" ticked, slots the collection cannot fill stay open and are counted. Nothing is topped up with cards to buy.
- **Decision 7: "Use this wording".** The privacy page's sentence becomes: "The collection is private. It is only ever shown to you, and used to mark the cards you own and to build lists for you, and you can wipe it from the account page at any time."
- **Decisions 4, 5, 6, 8 and 9: "Keep all five".** Basic lands are assumed (added as needed, not checked against the collection, and the sheet says so). Budget switches off while the box is ticked. The tick is not saved on the deck. Suggestions' own "Only cards I own" stays off on an unsaved deck until it is saved. Magic's notes gain their wording hooks in the game contract.
- Decision 2 (where this plan lives) is this file.

## Package 0: OWNED-FILTER (added 2026-11-24; the rewrite the speed gate called for; built, see Progress)

*Not in the approved plan's text. The plan foresaw it in a sentence ("If the speed measurement fails, rewriting the filter becomes its own small package first") and left its shape to the measurement. This section is the brief as the build left it: the shape changed twice on what was measured, and the record of that is REDESIGN.md, "The owned filter sends no list of cards".*

**Player outcome.** Nothing new on screen. "Only cards I own" in Suggestions answers the same cards as before. What changes is the cost: the site no longer reads a player's whole collection and sends it back to the database inside every statement. Package 1 builds on that.

**Why the shape matters.** Step 0 and the build measured four things (LATER row 69 and REDESIGN.md have every figure).

- The filter was a list of ids: read whole once per request, then sent again inside every statement. At the cap that is about 0.9 MB a statement. Autofill would have sent it five times: 4.5 to 6.6 s more from a machine far from the database.
- The database's own share of that was small (41 to 195 ms), so production, which runs beside its database, should have paid a fraction. Nobody measured it there.
- Building the owned set inside the condition is not safe. Postgres expects one row from some of these statements, and on that guess it rescanned the set for every row (8.8 s) or scanned the legality table for every row (2.6 s).
- A probe per row cannot do that, because every step of it is an index lookup. It was slow in one place, the popularity pool (0.35 s), where Postgres expects 144 cards to pass the colour check and about 24,000 do.

**What shipped.**

- The engine's owned hook takes the player, not a set of ids: `ownedBy` (a user id) on `CandidateFilter`, `GatherOptions` and `RecommendOptions`, in place of `ownedCardIds`. Undefined is still "hook off". A player with no collection row is still an empty pool, never an unfiltered one.
- The condition (`ownedCondition`) is one shape in every statement: a probe on `collections` through `card_printings` for the row at hand. It binds the player's id and nothing else.
- The popularity pool, and only it, spells its colour check as a list of the colour identities inside the deck's while the hook is on (`colorFitCondition`). Postgres can count a list, and then it picks a good plan by itself. With the hook off every statement is the text it was.
- Suggestions' route asks whether the player has a collection (one row) where it read the whole set, and passes the session's user. Its answer (`owned.applied`, `owned.reason`) does not change.
- `ownedIdentityIds` lost its whole-collection branch, which nothing calls now.

**Where it stops.**

- No migration, no index, no new route, and no change to what any request or answer looks like.
- Autofill's route is not touched: reading the collection there is package 1.
- Autofill, Swap Lab and Upgrade toward pass no owned hook, and send the statements they sent before.
- Keeping each card's identity on its collection row would make the probe a read of one index. That needs a migration: LATER row 510.
- The import is not touched. Analyzing the table when an import ends would close the slow minute after it: LATER row 511.
- The colour check keeps its bit test in every other statement: LATER row 512.

**Files changed.** `src/lib/recommend/queries.ts`, `src/lib/recommend/engine.ts`, `src/app/api/decks/[id]/recommendations/route.ts`, `src/lib/collection/owned.ts`, their tests (one new file, `src/lib/recommend/owned-filter.test.ts`), and `scripts/collection-smoke.ts`.

**Acceptance, and what each check found.**

1. With "Only cards I own" ticked, every suggestion is still a card the player owns, with its evidence, and never one already in the deck. (`pnpm smoke:collection`, its existing checks unedited: 52 of 52.)
2. The same holds for a collection at the cap. (`pnpm smoke:collection`, a new pair of checks with the cap test's player: 20,000 rows, 13,566 cards.)
3. The filter picks the rows the id list picked, in the same order, statement by statement. (A scratch script on the dev branch, for collections of 100, 1,000 and 20,000 printings and five commanders: 259 of 259.)
4. No statement carries a list of ids: each owned statement holds the player's id once. (Unit tests on the built SQL; a `DB_LOG=1` read: the statements are 1,100 to 2,100 characters each.)
5. At the cap, the filter adds at most 300 ms at the median and 1 s at worst to Autofill's two gathers from the owner's machine. (Step 0's run on the new code: 40 ms at the median; worst 377 ms and 210 ms for its two collections.)
6. A guest, and a player with no collection, still get the full list and the reason. (Route tests and the smoke.)
7. With the hook off nothing changes. (The condition pins; `pnpm smoke:recommend`, 69 of 69; `pnpm smoke:autofill` at its 69 of 71.)

**Verification.** `pnpm check`: 3,964 tests in 328 files. The three smokes against a local production build. `pnpm build`: the route table and both stylesheets identical to `ea6aa27`'s. Twelve one-line mutations, each caught by a test.

**What package 1's session needs to know.**

- Step 0 is done. Do not run it again. Its figures are in LATER row 69 and in `AUTOFILL-OWNED-step0.md`.
- The owner's answers above settle decisions 3 to 9.
- The prompt at the end of this file was written for the id list. Read it this way: the route hands both gathers the player's id (`ownedBy`, spread in only when set), never a set; the 409 is "no collection row" (`hasCollection`); nothing reads the whole collection; and the mutation "pass an empty set through" becomes "skip the collection check".
- The sheet's footer count and the smoke's check that every pick is owned are as the prompt says. The smoke reads the collection by SQL.
- `GET /api/collection` took 365 to 371 ms from the owner's machine for a collection at the cap, about 50 ms more than a yes-or-no read. Step 4 can use it as planned.
- A smoke that writes a large collection and asks for an owned list at once will see the slow minute after an import (LATER row 511): about 1.3 s more at the cap, 0.2 s at 2,500 rows. A small fixture does not show it.
- On the dev branch an owned Autofill request costs about 80 ms more than an unfiltered one at 2,500 rows and about 125 ms more at the cap, in the database's own time.

## Package 1: AUTOFILL-OWNED, as built (added 2026-11-25; the plan's own section and the prompt at the end of this file are unchanged)

*What follows is the build's hand-over, as "Package 0" above is. The full record is REDESIGN.md, "Only cards I own, in the Autofill sheet".*

**Where the build differs from the prompt.**

- Step 0 was not run again, and the filter is package 0's probe: the route hands both gathers the player (`ownedBy`), and "no collection" is one row asked for (`hasCollection`).
- The open-slots sentence reads "Filled 91 of 99. Your collection ran out of cards that fit, leaving 8 slots open in Mana value 1." The plan's example ended "; Mana value 1 was left short." The built one states the number of open slots and reads right for several groups.
- The still-short sentence reads "Autofill had no more to bring in from your collection". The collection may hold more Game Changers where the kept cards leave no pick to swap out, so the sentence stays about what Autofill could bring in.
- The basic-lands line is sent only when the list holds basic lands the template added, and it comes first.
- Add hands the editor the picks that came from the collection, so the ownership line is right in the same render as the list.
- A list with no counted card shows no ownership line. A new deck knows its player's collection now, and a collector's empty new deck would have opened on "You own 0/0".
- The checkbox's touch target is 42 px, not the 44 the prompt asks for. It is the shared Checkbox's, on every checkbox of the site (LATER row 513), and was not changed here.

**What package 2's session needs to know.**

- **The request.** `POST /api/decks/autofill` takes `ownedOnly: true`. Signed out is 401; no collection is 409 with `reason: "no-collection"`; a list built from the collection carries `owned: { applied: true }`. An owned ask also spends a limit keyed by the player (`deckAutofillOwned`, 20 a minute and 200 an hour).
- **The tick is the sheet's own state and starts unticked** (`ownedTicked` in `src/components/editor/autofill-sheet.tsx`). "Build from my collection" needs a way to open the sheet already ticked: a first value for that state, handed down by the editor from the link. On a new deck the editor is still checking the collection when the sheet opens, and the flag is sent only while the editor says `available` (a test pins it), so a tick set at open takes effect when the check answers and asks once more then.
- **What the editor knows** is `collectionState` in `src/components/editor/deck-editor.tsx`: `available`, `unavailable`, `checking` or `failed`. A new deck reads the sign-in state the header already holds and asks `GET /api/collection` once per mount; a saved deck is told by its own load.
- **The words are shared** in `src/components/editor/owned-copy.tsx` (the label, the hint with its Account link, the new-deck hint).
- **Tests that draw the editor** stand in for the client's sign-in state (`vi.mock("@/lib/auth-client", …)`); the four that exist do, and a new one must, or it depends on the auth client's own request.
- **`pnpm smoke:collection` spends three Autofill asks** now. The address limit is 20 a minute and `pnpm smoke:autofill` spends 18, so the two run a minute apart. `pnpm counters:reset` does not clear that limit (LATER row 516).
- **Signed-in screens in the browser pane.** The auth client keeps the request function it was created with, so a page that patches `window.fetch` cannot answer its sign-in request. A throwaway page can write a stand-in into the client's shared store instead (`authClient.$store.atoms.session`), and answer `/api/collection` and the owned Autofill ask through a patched `fetch`. Nothing of the kind is committed.
- **LATER.md ends at row 517** (516 at the build's commit; the ship note added one). Row numbers are line numbers: fetch and re-read before appending.

## Package 2: COLLECTION-PAGE, as built (added 2026-11-25; the plan's own section is unchanged)

*What follows is the build's hand-over, as the two sections above are. The full record is REDESIGN.md, "The collection page".*

**Where the build differs from the plan.**

- The count sentence reads "412 of your cards are in its colors": the site's spelling, where the plan's example wrote "colours".
- A build link opened by another signed-in player who has a collection opens ticked, for that player's own cards. The link names no player, so the page cannot tell them from its sender (LATER row 520). A guest and a player without a collection get the unticked sheet with its hint, as planned.
- The not-legal commanders are one sentence up to ten names. Past ten the sentence counts them and the names open under it: a random 19,995-row collection holds 126, which was a screen and a half on a phone.
- The card list reads only its own statement. The measurement's rule was written for three reads together, and they pass it together, but no view runs all three.
- A commander's name links to its card page, not its hub: shared code has no hub address to build.
- A tick in the Autofill sheet now lives only while the editor says there is a collection. A box the player ticked used to come back ticked if the collection became available again; it now comes back unticked.

**What package 4's session needs to know.**

- **The sheet has a third way to start.** `startOwned` (`src/components/editor/autofill-sheet.tsx`) is the first value of `ownedTicked`. While it is ticked and the editor says `checking`, the sheet's request effect returns early (`awaitingCollection`): the opening request waits, and the box reads ticked and disabled. A Deck total control that switches off with the box (decision 5) should read `ownedOnly`, as Budget does, not `ownedTicked`.
- **The editor's flag** is `draftOwned` beside `draftAutofill` (`src/components/editor/deck-editor.tsx`), from `?owned=1` on the new-deck link (`buildFromCollectionHref`, `src/lib/collection/page-query.ts`). The new-deck page latches and strips it with its other one-time flags.
- **`pnpm smoke:collection` spends four Autofill asks** now (the fourth is the list the build link leads to). The address limit is still 20 a minute and `pnpm smoke:autofill` spends 18: run them a minute apart.
- **Replaying a logged statement.** postgres.js rewrites the parameter array in place when it sends a statement, so a statement replayed from its debug hook binds a logged `true` as false. Copy the array in the hook, and compare the replay's row count with the call's. The first two runs of this package's measurement timed the wrong statement that way.
- **A signed-in page in the browser pane.** `/collection` is a server page keyed by the session, so it was read through a throwaway copy of itself that takes its player from the address, generated from the real file by a script and never committed. The editor's flow used package 1's stand-in sign-in; rewriting the session store's pending flags there makes the auth client ask for the session in a loop, so pass them through.
- **LATER.md ends at row 521** (520 at the build's commit; the ship note added one).

## Package 3: COMMANDER-DOOR, as built (added 2026-11-25; the plan's own section is unchanged)

*What follows is the build's hand-over, as the three sections above are. The full record is REDESIGN.md, "A build button where a commander is found". The package was built on its own brief, `COMMANDER-DOOR-session-prompt.md` at the repository's root, which names seven places where it departs from the plan's section on purpose; those stand as built.*

**Where the build differs from that brief.**

- The words under a results tile exist in one form, the whole sentence. The brief had both forms built so that the owner could choose; they chose the sentence, and the bare "Build" was taken out (`31e620f`). While it existed, its space stood before the hidden words, not inside them as the brief says: an accessible-name reader with no layout drops a hidden span's leading space and reads "Buildwith …".
- An answer that lands while the second position is highlighted puts the entry under the highlight (LATER row 527). Base UI gives no way to clear a highlight, so the behaviour is pinned as it is and went to the owner as a fourth gate point: the entry stays under the top result.
- The grid's touch target has 2 px above it, where the brief's recipe has none, so that its focus ring and the picture's never meet.
- The dropdown's column nests the card's id one level inside its statement (`buildBlockedSql`). Selected in a statement with no join, drizzle would otherwise write that id without its table, and the subquery would read the ruling's.
- The helper is two modules: the rule and the format (`src/lib/decks/leader-build.ts`), and the action's address and words (`src/lib/decks/leader-build-link.ts`), which has no import, so the header's scripts carry neither the seeded rows nor the adapters.
- Three more LATER rows than the brief lists: the highlight (527), the column's plan (528) and the button's place on a phone (529).

**What a later session needs to know.**

- **The rule** is `leaderCanBuild(isLeaderCandidate, status)` over `leaderFormat(game)` and `unconditionalStatus(legality)`, in `src/lib/decks/leader-build.ts`, with one table of cases in `leader-build-fixtures.ts` that the helper's, the card page's and the grid's tests all read. It has two older homes that were left alone: the commander hub's page and `src/lib/collection/leaders.ts` (LATER row 526). The One Piece leader hub still applies none (row 508).
- **The dropdown's flag** is `buildBlocked?: true` on a suggest row, from the exported column `buildBlockedSql(game)` in `src/lib/search/suggest.ts`, selected last by all three statements. The route's test feeds rows by position, so a new column goes after it, or the older cases move.
- **The entry** is `NameSuggest`'s opt-in prop `buildEntry`, a record by game of `{ withKey }`. Only `HeaderSearch` passes it, from `BUILD_ENTRY`; a third game needs a line there, and a test compares the constant with the adapters.
- **A pending commander pick has new readers** (`src/lib/decks/leader-pick-intent.ts`): the header's search and the `/cards` grid go quiet for that game, and the card page shows "Use for “<deck>”".
- **The grid asks with `format=<code>`**, last in its address, so its CDN keys are new. The strip's are not.
- **Page weight, as this package measured it**: every same-origin script named in a served page, each fetched once, gzipped and summed; `/privacy` is 405,550 bytes on this build. The script is in the build's evidence, not in the repository.
- **LATER.md ends at row 529.** Row numbers are line numbers: fetch and re-read before appending.

## Context

You gave five feature ideas and asked what belongs in the next build, how each fits the product, and what an engineer needs to ship it. I read the planning documents and the code behind every affected flow, then put four questions to you. Your answers: lead with building from the collection; the player picks the commander from the ones they own; "fun" means facts about the list, not a score; the existing ManaBox and Moxfield import is enough.

The main finding: four of the five ideas already have working parts in the product. The collection upload, the bracket choice in Autofill, a deck-total budget, the build buttons on commander pages and a deck section that does not count toward 100 all exist. What is missing is mostly the wiring between them. Only the fun metric starts from nothing.

How this plan was checked: three planners designed the packages against the code. Six reviewers then each tried to refute one part of the plan, and a seventh read it against your brief. 239 statements held, five were wrong and 36 were loose. After the rewrite, three more reviewers checked that every finding was dealt with and looked for contradictions. Everything they found is corrected here. Eight statements need the database or a browser to settle, and each of those is now a first step of its package.

## 1. What exists today

Words used below. **LATER.md** is the project's list of deferred work; each row says what would bring it back. **M5** is the build plan's fifth milestone. A **smoke** is a scripted check run against a local copy of the site. A **route** is the server address a screen calls. A **zone** is a section of a deck (commander, main deck, tokens). A **migration** is a change to the database's structure. The **game contract** is what each game declares to the shared site, so the shared code never names Magic's or One Piece's own terms.

### Idea 1: upload my collection, build the best deck from it at a bracket I choose, and a page to view it

**What a player can do now**

- **Upload a collection.** The account menu's "Collection" item opens Account's "Collection import", which takes a ManaBox or Moxfield CSV and merges it or replaces what is there. An account keeps up to 20,000 rows, one per printing and finish. A longer file is not refused: the extra rows are left out and counted. Evidence: `src/components/auth/account-slot.tsx:59`, `src/app/(site)/account/page.tsx:383`, `src/lib/collection/parse.ts:135`, `src/lib/collection/types.ts:15`.
- **See what they own inside a deck.** A saved deck marks owned cards and reads "You own 63/100 · missing ≈ $412". A share page shows its signed-in viewer a similar line. Evidence: `src/lib/collection/ownership.ts:100`.
- **Filter Suggestions.** The Suggestions tab has "Only cards I own" on a saved deck. Evidence: `src/components/editor/recommendations-panel.tsx:305`.
- **Pick a bracket for a starter list.** Autofill's "Your target" keeps the list inside the bracket and builds up to it. Evidence: `src/components/editor/autofill-sheet.tsx:510`, `src/lib/recommend/autofill.ts:378`.

**Where it falls short**

- Autofill never looks at the collection. Its route has no "owned" field and does not check who is signed in (`src/app/api/decks/autofill/route.ts:80`, `src/app/api/decks/autofill/route.ts:176`), although the engine's owned filter exists and Suggestions uses it (`src/lib/recommend/queries.ts:172`).
- A new, unsaved deck never learns the player has a collection. The editor learns it only when it loads a saved deck (`src/components/editor/deck-editor.tsx:803`), and a new deck's first save does not reload. So on `/decks/new` the Suggestions toggle is disabled and no owned marks show until the page is reloaded.
- No page shows the collection. Account shows counts, import and delete only, and there is no `/collection` page.

**What has to change.** Autofill has to accept "only cards I own" and read the signed-in player's collection. An unsaved deck has to learn that its player has a collection. A page has to list the collection and the commanders in it.

**Deferred before, and whether the condition is met**

| LATER row | What it holds, and why it waited | Revisit condition, as written | Met? |
| --- | --- | --- | --- |
| 12 | Full collection manager (browse, edit and sort grid, add buttons, public collections). A large surface, held until the builder proved people come back. | "Editor retention proven (post-M5)" | No. M5 has not started and nothing measures retention. |
| 66 | Collection Mode (build only from my collection, purchase budget, counting copies). As written it needs a mode that gates search, suggestions and validation. | "Real imported collections in prod (the owner has none yet) and a user asking for any one of these…" | Half. You are asking. The row notes you had no collection when it was written; production was not read for this plan. |
| 165 | "Only cards I own" in an unsaved deck: the toggle, the unsaved-deck Suggestions route, and the Fit sheet not counting owned copies there. | "A collector asks, or collections are imported at all (none at the last count)" | Yes. |
| 191 | The Fit sheet prices a suggested replacement in full even when the collection holds it. | The same words as row 165 | Yes, but no package here changes it; it stays deferred. |
| 69 | The owned filter as a database join, not a long list of ids. Fine at small sizes. | "A collection at the cap makes the recommendations route measurably slow" | Unknown. Nothing in the repository runs the filter at size; the smoke's collection has ten rows. |
| 67 | More import formats (Archidekt, Deckbox and others). | "Someone pastes a refused header into an issue" | No. You confirmed ManaBox and Moxfield are enough. |
| 68 | Owned marks in search, card pages and hub tables. A lookup on every keystroke. | "The Suggestions toggle sees real use, or a user asks 'does search know what I own?'" | No. Not asked for; stays deferred. |

Rows 12 and 66 are not met by their own conditions. You have already chosen to lead with the collection, which takes a slice of row 66. Taking a slice of row 12 as well is decision 1 in section 2.

### Idea 2: a metric of how fun the deck is

Nothing measures fun today. The nearest things are:

- **The theme reader** that Suggestions and the Cut Coach use (`src/lib/games/mtg/themes.ts:207`). It reads type words, from the list's type lines and from the commander's rules text. It cannot see a theme no type word carries, such as lifegain or sacrifice, and it finds no theme on 85 of the 182 precon rows (LATER row 480).
- **Per-card lines** that already state a count. A Suggestions row reads "Shares the Sliver type with 41 of your cards".
- **Two questions the player answers**, shown on the share page: "Theme first, over power?" and "Staples and high card quality?" (`src/lib/games/mtg/brackets.ts:301`).
- **The word "staple"**, which Suggestions and the Cut Coach already use for a card at EDHREC rank 2,000 or better (`src/lib/games/mtg/recommend.ts:42`).
- **The bracket read** (Game Changers, land denial, extra turns, combos).

No line about the whole deck says how on-theme or how generic it is. What has to change: the deck's statistics gain counted facts that the cards already support. The idea was never planned or deferred, so no LATER row holds it.

Recorded rules that bear on it:

- "never one authoritative number", written for the bracket read (`src/lib/games/types.ts:619`).
- "Evidence or nothing; no inference from card text", written for the bracket read's sources (`WAVE4.md:61`), and "roles are never inferred from card text" (`src/lib/games/types.ts:348`). Neither covers the whole site: the theme reader reads a commander's text for a type word, and the deck's statistics already read "Add …" text for mana colours (`src/lib/games/mtg/analyze.ts:28`). What matters here is that the two proposed facts read nothing new from card text.
- The game journal's "Never stored: … ratings" (`src/db/schema.ts:673`).

### Idea 3: a maybe section, and Add past 100 goes to it

Players have no maybe list. Most of the groundwork exists:

- A deck card's zone is free text in the database, checked against the game's declared zones when a deck is saved. A new zone needs no migration (`src/db/schema.ts:556`).
- The game contract already has zones that do not count toward the deck's size (`src/lib/games/types.ts:29`), and Tokens is a working example (`src/lib/games/mtg/formats.ts`).
- The importer already recognises "Maybeboard" headers and Archidekt's out-of-deck categories, then skips those lines and says Commander has no such zone (`src/lib/games/mtg/decklist.ts:25`, `src/lib/games/mtg/decklist.ts:68`, `src/lib/decks/import.ts:221`).

At 100 cards the Suggestions button reads "Swap in…" and opens a sheet where one card goes out. That was a deliberate choice ("a full deck never passes through 99 or 101"). Evidence: `src/components/editor/deck-editor.tsx:1534`, `src/components/editor/recommendations-panel.tsx:498`. So a full deck cannot take a suggestion without choosing a cut, and there is nowhere to park a card.

What has to change: the Commander format declares a second zone that does not count, the editor and the share page draw it, and Suggestions rows gain a button that adds to it.

### Idea 4: "Add commander" from the search bar and the card page

**Already there:** every commander's hub page (`/c/<name>`) has "Build with this commander" and "Start with a starter shell" (`src/components/hub/hub-build-cta.tsx:52`), hidden for banned and not-legal commanders (`src/app/(site)/c/[slug]/page.tsx:243`). To reach it today: search, open the card, follow "Commander hub", then press Build. That is three clicks.

**Missing:** a build action on the header's suggestion rows (`src/components/search/name-suggest.tsx:400`), on `/cards` result tiles (`src/components/cards/card-search.tsx:609`) and on the card page.

**What each place already knows.** The commander flag and the key the build link needs are on all three: suggestion rows (`src/lib/search/suggest.ts:45`), the results grid's answer (`src/app/api/cards/search/route.ts:198`) and the card page (`src/app/(site)/cards/[id]/page.tsx:93`). Whether the commander is legal is known on the card page only. The dropdown's data has no such field, and the grid does not ask for it.

One thing to know: "Commander: legal" shows on every legal card, Sol Ring included. It means "playable in Commander", not "can be a commander", so the button has to follow the commander flag.

What has to change: mostly what is drawn. The two search surfaces also need the legal status, so a banned commander gets no button there. This idea was never deferred: LATER row 65 asked for the hub button and was closed when it shipped in September.

### Idea 5: a total budget in the Autofill sheet

Autofill's Budget is per card: All, ≤ $5 a card, ≤ $1 a card (`src/lib/recommend/budget.ts:11`, `src/components/editor/autofill-sheet.tsx:532`).

A deck total exists elsewhere. More, then "Fit my budget…", has a "Deck total" field with $50, $100, $150 and $250 presets, kept in the deck's goals and shown to its owner only (`src/components/editor/fit-sheet.tsx:362`, `src/lib/recommend/budget.ts:22`, `src/lib/decks/goals.ts:39`). Today's route to a budget deck is two passes: Autofill and Add, then Fit my budget and review swaps.

Autofill's planner never reads a total. The sheet can show a saved total, read-only ("Your goals: est. $212 of your $150"), but its request leaves the total out, because every request shares one helper that drops it on purpose (`src/lib/decks/goals.ts:246`). What has to change: the sheet gains a control for the total, the request carries it, and the planner keeps to it.

| LATER row | What it holds | Revisit condition, as written | Met? |
| --- | --- | --- | --- |
| 83 | "Autofill's own total budget stays deferred", beside three other Autofill variants. You had chosen the evidence-based starter list, and Fit my budget covered deck totals. | "Someone asks twice / shell-quality feedback / Neon compute from rerolls shows up" | No. This is the first ask. Building it now is you overriding the trigger. |
| 195 | The deck total is set only in the Fit sheet. | "A user looks for the total in Suggestions or the Why sheet" | Not as written. You are asking for it in Autofill, a third place. |

### Where the documents and the code disagree

1. **What ignores a zone that does not count.** `src/lib/decks/playable.ts:7` says link-preview images and the list hash read only the playable list. (The list hash is the fingerprint that tells the game journal a list changed.) In code, the preview query filters out tokens but not zones (`src/lib/og/data.ts:66`), and the list hash covers every zone on purpose (`src/lib/decks/list-hash.ts:23`). Harmless today, because Tokens is the only such zone. A maybe list would leak into link previews until that is fixed.
2. **The maybe list fell through the plans.** `deck-building-website-feature-plan.md:298` lists "Maybeboard and considering sections". No build-plan package and no LATER row holds it. The Tokens brief only fenced it out of that package ("NOT a maybeboard or sideboard").
3. **Collections in the build plan.** `deckwarden-build-plan.md:350` still says the collection "schema is ready from M1". It was first written in P3.7 (September), as LATER row 12 records. Package 2 corrects the sentence.

One gap that is not a disagreement: the two collection routes and the import component have no unit test. Only `pnpm smoke:collection` covers them.

## 2. Product decisions

### Every idea, traced to a package

| Your idea | Becomes |
| --- | --- |
| 1. Upload my collection and build the best deck from it at a bracket I choose | Package 1 · AUTOFILL-OWNED |
| 1. A separate page to view my collection and build from it | Package 2 · COLLECTION-PAGE |
| 4. "Add commander" from the search bar and the card page | Package 3 · COMMANDER-DOOR |
| 5. A typed total budget, or price ranges, in the Autofill sheet | Package 4 · AUTOFILL-TOTAL |
| 3. A maybe section; Add past 100 goes to the maybe list | Follow-up · MAYBE-LIST |
| 2. A metric of how fun the deck is | Follow-up · DECK-FACTS |

Nothing was merged away. Idea 1 is split in two because its halves ship separately and the first is useful alone.

### The two vague requests, in plain words

**"Builds the best deck from them."** The goal: a player with a box of cards wants a playable Commander deck tonight without buying anything. Example, once packages 1 and 2 are live: Dana imports a 2,400-card ManaBox file and opens Collection. Under "Commanders you own" she presses "Build from my collection" beside Meren of Clan Nel Toth ("412 of your cards are in its colours"). The Autofill sheet opens with "Only cards I own" ticked. She picks Bracket 2. The list is 62 spells and 16 lands from her collection plus 21 basic lands, and the footer reads "78 of these 99 cards are from your collection." A small collection gets an honest short list instead, for example "Filled 91 of 99. Your collection ran out of cards that fit; Mana value 1 was left short."

**"A metric of how fun the deck is."** The goal: before sleeving a deck, see whether it is its own thing or the same staples as every other deck. Example: two tiles in the deck's statistics, "Vampire cards: 34 of 63" and "Commander staples: 28 of 63", each counting nonland cards and naming its source. No score. One limit to expect: the first tile shows only for a deck built around a card type, and nearly half of the precons are not.

### What I asked, and what you answered

| Question | Your answer | What it changes |
| --- | --- | --- |
| Which outcome leads the next build? | Build from my collection | AUTOFILL-OWNED is the first package |
| Who picks the commander for a collection deck? | I pick from ones I own | COLLECTION-PAGE gets a "Commanders you own" list; no automatic "best commander" |
| Which readings of "fun"? | Facts about the list | DECK-FACTS is two counted tiles. Deferred: a single score; a fun rating per game; and a "theme-first" setting, meaning an Autofill and Suggestions option that prefers cards of the commander's type over popular staples. |
| How are your cards recorded? | ManaBox or Moxfield | No new importer is needed |

### Decisions and defaults

Every choice for the four packages of the next build is here once. Each has a default I would build on; say so if you want one flipped. The two follow-ups bring their own choices, listed in their sketches.

| # | Decision | Default | Flipping it means | Needed before |
| --- | --- | --- | --- | --- |
| 1 | Build ahead of triggers that are not met: LATER row 12 for the collection page, row 83 for Autofill's total | Yes, as small slices. The rows are narrowed and annotated, not closed. | Packages 2 and 4 wait for their triggers | Package 2 |
| 2 | Where this plan lives in the repository | One file at the root, `OWNER-NOTES-2026-11-24-session-prompt.md`, holding the four packages and the two follow-ups, as the last round did. The first session writes it, and the deferred LATER rows, before it codes. | A wave document with a build-plan section and a CLAUDE.md line, the heavier form | Package 1 |
| 3 | "Only cards I own" is strict | Slots the collection cannot fill stay open and are counted. No topping up with cards to buy. The first session measures how full sample collections get, and yours if you import it on the development site, and shows you before it builds the sheet. | "Owned first, then buy" moves from deferred into the build: about one more package | Package 1, confirmed again after its measurement |
| 4 | Basic lands are assumed | Yes. They are added as needed, not checked against the collection, and the sheet says so. | Basics must be in the collection. Many collections do not list them, so lists come up short of lands. | Package 1 |
| 5 | With "Only cards I own" ticked, Budget (and later Deck total) switch off | Yes, with a line saying price limits do not apply to cards you own | Both limits apply together, and pricier owned cards drop out for no visible reason | Package 1 |
| 6 | The collection choice is not saved on the deck | A one-time choice, like Budget | Saved like the bracket target | Package 1 |
| 7 | The privacy page's sentence about the collection | "The collection is private. It is only ever shown to you, and used to mark the cards you own and to build lists for you, and you can wipe it from the account page at any time." Today it says the collection "only ever shows you which cards you own in decks you view". | Your own wording | Package 1 |
| 8 | Suggestions' "Only cards I own" on a deck that is not saved yet | Not in this build. It starts working once the deck is saved, which pressing Add does, and until then it says so. LATER row 165's own condition is met, so leaving this half is a scope choice that keeps package 1 to one session. | Package 1 grows by a second route, or a short package follows it | Package 1 |
| 9 | Three small additions to the game contract. For your information; an engineering default. | Yes. In package 1, Magic's note about building up to a bracket learns to say "from your collection", and Magic's Autofill declaration gains a line about basic lands. In package 4, that note learns to name the total. | The sentences are written in shared code without Magic's words, which reads worse | Package 1 (the third before package 4) |
| 10 | The collection page is read-only, in text rows | Yes. Editing, add buttons, public collections and card images stay deferred. | A larger package | Package 2 |
| 11 | The account menu's "Collection" item opens the new page | Yes. This changes a recorded Wave 2 choice, where it pointed at the import. | It keeps pointing at the import, and Account gains a link to the page | Package 2 |
| 12 | What "N of your cards are in its colours" counts, and the order | Every owned card inside the commander's colours, lands included, most first. Commanders with more colours therefore lead, and the page says so. | Count only cards Autofill can use, or order by most played | Package 2 |
| 13 | The button's words | On the card page, "Build with this commander", the hubs' words. In search, "Build with <card name>". | "Add commander" on every surface | Package 3 |
| 14 | One button on the card page | Yes. "Start with a starter shell" stays on the hub. A player who came from a deck's "Browse commanders" also sees "Use for <deck>", as the hub shows it. | The hub's pair of buttons | Package 3 |
| 15 | A banned or not-legal commander gets no build action | Yes, on every surface this build touches: the card page, the search dropdown and the search results. The search data gains one small flag for it. The One Piece leader hub keeps its button until its own LATER row. | Search offers the button anyway and the editor flags the commander. No data change. | Package 3 |
| 16 | Pressing Add saves the total on the deck | Yes. This reverses three October records for the total alone: the sheet being a one-time choice, the total being set only in the Fit sheet, and nothing on the server using the total. | The total is a one-time choice like Budget | Package 4 |
| 17 | When the total and the bracket target pull apart | The budget wins, and a note says the target was left short | The target wins and the list may go over | Package 4 |

Two rules I did not treat as open. Owned means any printing of the card, with copies not counted; the whole site already works that way. And the scope by game: ideas 1 and 5 are Magic only because One Piece has no Autofill and the import formats come from Magic apps. Idea 2's tiles read Magic's card types and EDHREC ranks. Idea 3 starts with Magic, with One Piece as a deferred row. Idea 4 covers both games.

## 3. What to build

Effort: S is a short session and M a full one. No package here is larger, so each is one session under the working agreement.

| Idea | Current support | Smallest useful release | Priority | Effort | Depends on | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Build the best deck from my collection at a bracket I choose | Upload, bracket choice and the engine's owned filter exist; Autofill uses none of the collection | **AUTOFILL-OWNED**: "Only cards I own" in the Autofill sheet, working on a new deck | Next build, first | M | Nothing | Your lead. Three of its four parts are built; the missing part is Autofill reading the collection. |
| 1. A page to view my collection and build from it | Counts and import on Account only | **COLLECTION-PAGE**: `/collection` with "Commanders you own", a read-only card list and "Build from my collection" | Next build, second | M | AUTOFILL-OWNED | Finishes the headline flow in the shape you chose |
| 4. "Add commander" from search and the card page | Hub pages only | **COMMANDER-DOOR**: the hub's build button on commander card pages, under the top suggestion in the header search when it is a legal commander, and under commander tiles in search results | Next build, third | M (S for the card page alone) | Nothing | Helps every visitor, guests included. Cuts search-to-building from three clicks to one or two. |
| 5. A total budget in the Autofill sheet | Per-card tiers in Autofill; a deck total only in "Fit my budget" | **AUTOFILL-TOTAL**: a "Deck total" field with presets; the list is planned at or under it, or says how close it got | Next build, fourth | M | AUTOFILL-OWNED (same files; the total switches off with its checkbox) | Removes the two-pass route to a budget deck. With a total set, building up to a bracket can no longer bring in a $99 card unnoticed (LATER row 474). |
| 3. A maybe section; Add past 100 goes to it | None visible; the zone groundwork and the importer's words exist | **MAYBE-LIST**: a Maybe section under the deck and a Maybe button on Suggestions rows | Follows, first | M | Nothing | Other builders' exports already carry a maybeboard (the importer reads them and drops the cards). No migration. It touches the editor broadly, so it follows the start-a-deck work. |
| 2. A metric of how fun the deck is | None; recorded rules rule out a score | **DECK-FACTS**: two counted tiles (cards of the deck's type, Commander staples) | Follows, second | S, or M with its measurement | A measurement to confirm the staples cut-off | Cheap and honest. It waits because it is the least certain to change what a player does. |

**What drives the uncertain estimates**

- **AUTOFILL-OWNED (M).** Two unknowns, both measured before any code. Speed: up to five database statements would each carry the whole list of owned cards, and nothing has tried that above ten cards. Usefulness: how many of the 62 spell slots a real collection fills. If the speed measurement fails, rewriting the filter becomes its own small package first.
- **COLLECTION-PAGE (M).** Three database reads over a collection of up to 20,000 rows, one of them sorted on every request with no index to help. Their measured times set the page size.
- **COMMANDER-DOOR (M).** The card page is S. The search half is larger: the header's suggestion list has strict keyboard and screen-reader rules and detailed tests, and both search surfaces need the legal status added.
- **AUTOFILL-TOTAL (M).** How low a total Autofill can honestly reach is unknown until it is measured across the test commanders. The new planner step also has to price basic lands, which the planner does not know today.
- **MAYBE-LIST (M).** Eleven places in the code assume Tokens is the only zone that does not count; they are listed in its sketch. A card enters a deck four ways (search, a Suggestions or Combo Radar row, a combo's pieces together, and whole-list changes such as Import and Autofill), and each needs to work with Maybe and with Undo. About fifteen test files gain cases. If its brief finds more than the eleven, it becomes two packages.
- **DECK-FACTS (S or M).** The code is S. Confirming the staples cut-off against real lists makes it M.

**What a mistake would cost, by package**

- **AUTOFILL-OWNED.** A card the player does not own inside an "owned" list breaks trust in the feature, and an owned request answered without a proven sign-in would expose a collection. Both are easy to check, so the smoke checks every card and a test pins the refusal.
- **COLLECTION-PAGE.** Showing one player's cards to another would be a privacy bug. The page is signed-in only, has no public address, and the smoke checks that the signed-out page holds no card names.
- **COMMANDER-DOOR.** Low. The worst case is a button on a commander that was banned within the last day, which the editor flags at once.
- **AUTOFILL-TOTAL.** A list said to be under its total that is not. The sheet's note and its footer read one figure, worked out one way.
- **MAYBE-LIST.** The highest. A maybe card counted in the 100, in validation or in a link preview is a wrong deck. That is why it follows and gets its own brief.
- **DECK-FACTS.** A misleading label. It ships as counts with sources and no judgement words.

**The shared change, and how the first package delivers it.** Ideas 1 and 5 both add a limit to what Autofill may pick. Each needs the request to carry the limit, an honest note where the list falls short, and a control in the sheet. AUTOFILL-OWNED builds that for the collection, and also teaches Autofill who is asking and a new deck that its player has a collection. It is useful alone. COLLECTION-PAGE's build button reuses all of it. AUTOFILL-TOTAL shares the request, the notes and the sheet, and adds a planner step of its own. The deferred "owned first, then buy within a total" needs both.

**Deferred, each with its place in LATER.md**

The first session writes the new rows and annotates the old ones (decision 2).

| Deferred | LATER row | Revisit when |
| --- | --- | --- |
| MAYBE-LIST, then DECK-FACTS, until their turn | New rows | Package 4 is live, or you call one forward |
| One Fun score out of 10 | New row | A named outside source for fun exists that the site may use, or you amend "never one authoritative number" |
| A fun rating per logged game | New row | Three accounts have logged ten or more games each, and you amend the journal's "Never stored: … ratings" |
| A theme-first setting for Autofill and Suggestions | Row 481, annotated; row 83 holds its neighbours | Row 481's trigger: your pick |
| "Owned first, then cards to buy within a total", and counting copies | Row 66, annotated | AUTOFILL-OWNED and AUTOFILL-TOTAL are both live and a player asks |
| Suggestions' owned filter on an unsaved deck | Row 165, second half kept | A collector asks for it on a deck they have not saved (decision 8) |
| The Fit sheet pricing an owned replacement in full | Row 191, annotated | A collector asks about the Fit sheet's prices |
| An owned precon counting as owned in Autofill | Row 349, annotated | Its own trigger |
| The owned filter as a database join | Row 69, annotated with the measurement | Its own trigger; it fires if package 1's measurement fails |
| Saving the collection choice on the deck | New row | A player ticks the box on the same deck twice |
| Assumed basic lands reading as "missing" in the ownership line | New row | A collector asks why basics are missing |
| Owned cards with no EDHREC rank and no tournament or combo evidence (Autofill never picks them) | New row | A collector's list comes up short although they own enough cards |
| Editing the collection, add buttons, public collections, card images on the page | Row 12, narrowed | Its own trigger, or a player asks to fix one card without re-importing |
| Collection page extras: value by printing, a colour filter, partner pairs | New row | A player cannot find a commander, or asks what the collection is worth |
| More import formats | Row 67, unchanged | Its own trigger: "Someone pastes a refused header into an issue" |
| Unit tests for the two collection routes and the import component | New row | The next change to either |
| A build action on every commander row of the search dropdown | New row | You ask for it after using the top one |
| Choosing both partner commanders from a build button | New row | A player asks |
| The One Piece leader hub showing its button for a banned leader | New row | The next change to that hub |
| A maybe list for One Piece decks | New row, with MAYBE-LIST | A One Piece player asks |

## 4. The next build, as work packages

Four packages, one session each. Order: 1, then 2, then 4. Package 3 edits no editor or Autofill file, so it can run beside any of the others in its own session, once the first session's record (the plan file and the LATER rows) is committed on your word. Until then two sessions would number LATER rows differently.

Rules every package follows:

- **Done means deployed.** A package ends with `pnpm check` green and a local `pnpm build` whose list of routes is compared with the build of the commit it started from. Then it is pushed on your word and read on production on your OK.
- **Measurements run on the development database only.** Scratch scripts live in `scripts/.tmp/`. One that opens the database calls the database guard first (`guardDatabaseUrl` in `scripts/smoke/db.ts`) and deletes what it wrote. One that calls the local server imports `scripts/smoke/guard.ts` first.
- **Signed-in screens.** The browser pane cannot hold a sign-in. So signed-in behaviour is pinned by unit tests and by the smokes, which sign a test player in inside the script. Layout is read on a throwaway local page that draws the real screen with stand-in data and is never committed. You walk the real flow on production after the deploy.

Each acceptance line below states what a person sees, then the check that proves it in brackets.

### Package 1: AUTOFILL-OWNED (idea 1, first half)

**Player outcome.** A signed-in player who imported a collection gets a starter list built only from cards they own, inside the bracket they pick.

**The flow.** Import on Account (exists). Open any commander's hub and press "Start with a starter shell", or use the empty deck's Autofill button, or More then Autofill…. The sheet opens with a list as it does today. Pick Your target and tick "Only cards I own". The list reloads from the collection, and Budget switches off. Lines under the list say what was assumed and what is open, for example "Basic lands are added as needed and aren't checked against your collection" and "Filled 91 of 99. Your collection ran out of cards that fit; Mana value 1 was left short." The footer reads "70 of these 91 cards are from your collection." Press Add. The deck is saved and its header shows the ownership line at once, for example "You own 71/92 · missing ≈ $2". The missing cards there are the assumed basic lands, unless the collection lists basics too, and the commander if you do not own it.

**What ships.**

- The checkbox in the sheet, in the Suggestions toggle's own words. It is enabled for a signed-in player with a collection and disabled with a hint otherwise. Ticked, it switches Budget off and says why (decision 5).
- One optional flag on the Autofill request. The route checks who is signed in only when the flag is set, loads the owned cards and filters its candidate reads with the engine's existing filter. It never answers such a request with an unfiltered list: a signed-out caller is refused, and so is a player with no collection.
- A per-player request limit for these asks, at the same numbers as today's per-address limit (20 a minute, 200 an hour).
- Notes under the list, sent with the list itself: the basic-lands line, the count of open slots, and a line for when the collection has too few Game Changers for the list to read as the chosen bracket.
- A footer that counts the picks that came from the collection, in place of the price estimate.
- A new, unsaved deck learns that its signed-in player has a collection: one read when the editor opens, none for a guest. From then on an unsaved deck shows owned marks and the "You own N/100" line, and its price estimate and Fit sheet count owned cards as $0, as a saved deck's already do.
- On an unsaved deck, Suggestions' own "Only cards I own" stays off and says it starts once the deck is saved (decision 8). After Add the deck is saved and the toggle works.
- The privacy page's reworded sentence (decision 7).

**Where it stops.**

- The filter is strict: no topping up with cards to buy. The choice is not saved on the deck. Copies are not counted.
- No collection page (package 2). No new import format.
- An owned precon does not count as owned here (LATER row 349, annotated). Search results and card pages show no owned marks (row 68 stays).
- An owned card with no EDHREC rank enters a list only when tournament results or a combo speak for it, because the main candidate read requires a rank (`src/lib/recommend/queries.ts:279`). That is true of every Autofill today and becomes a new LATER row.
- If the speed measurement says the owned filter must be rewritten, this package stops there. On your word the session becomes the rewrite package: it changes the filter Suggestions already ships, and is checked by `pnpm smoke:recommend` and `pnpm smoke:collection`. AUTOFILL-OWNED then starts in the next session.

**Reuse.**

- The owned filter and its option: `src/lib/recommend/queries.ts:172`, `GatherOptions.ownedCardIds` at `src/lib/recommend/engine.ts:186`.
- The owned set and the collection check: `src/lib/collection/owned.ts:25`, `src/lib/collection/owned.ts:78`.
- The toggle's words and hint: `src/components/editor/recommendations-panel.tsx:296`.
- The editor's owned lookups, which already work without a saved deck once it knows a collection exists: `src/components/editor/deck-editor.tsx:1105`.
- The client's sign-in state, already mounted by the header: `src/components/auth/account-slot.tsx:86`.
- Today's request limit for Autofill: `src/lib/rate-limit.ts:154`.

**Files likely to change.**

- The route and its limit: `src/app/api/decks/autofill/route.ts`, `src/lib/rate-limit.ts`.
- The words: `src/lib/recommend/autofill.ts` (the open-slots sentence), `src/lib/games/mtg/brackets.ts` (the build-up sentence), `src/lib/games/mtg/recommend.ts` (Magic's Autofill declaration, for the basic-lands line), and `src/lib/games/types.ts` for the two contract additions (decision 9).
- The screens: `src/components/editor/autofill-sheet.tsx`, `src/components/editor/deck-editor.tsx`, `src/components/editor/recommendations-panel.tsx` (the hint), `src/app/(site)/privacy/page.tsx`.
- The tests named under Verification, and `scripts/collection-smoke.ts`.
- `src/lib/recommend/queries.ts` only in the separate rewrite package, if the measurement calls for one.

**Data, API, migration.** No migration and no new table. One optional flag on `POST /api/decks/autofill`. The route stays dynamic and uncached; with the flag set the answer is per player.

**Deckwarden cases.**

- *Shared editor or adapter?* Shared. Owning a card is not game knowledge. Only Magic's sentences (Game Changers, basic lands) live in its adapter.
- *Guest with an existing deck.* The box is disabled with the sign-in hint. Nothing else changes, and no request about a collection goes out.
- *Signed-in player.* Enabled with a collection; disabled with the "import a collection" link without one.
- *Shared link.* Not involved. A visitor's share page keeps its own ownership line.

**Acceptance.**

1. Ticking the box reloads the list once. (Sheet test: exactly one more request, carrying the flag; the opening request carries none.)
2. Every card Autofill picks is one the player owns, except the basic lands it adds. (`pnpm smoke:collection`: every pick that is not a basic-land filler is in the collection.)
3. A line under the list says basic lands are added as needed and are not checked against the collection. The footer counts the picks that came from the collection. (Sheet test.)
4. With a target of 4 and no Game Changers in the collection, a note says the collection had no more to bring in. (Planner and adapter tests.)
5. With a collection too small for the deck, a note counts the open slots and names where they are, and Add adds exactly the cards shown. (Planner and sheet tests.)
6. With the box ticked, Budget is switched off and says why. (Sheet test: the request carries no per-card budget.)
7. On a new deck, after Add, the header shows what the player owns without a reload. (Editor test with a stand-in sign-in.)
8. A guest sees the box disabled with its hint, and Autofill behaves exactly as today. (Editor test: no request about a collection goes out; the sheet's existing request pins pass untouched.)
9. While the collection is being checked the box is disabled; if the check fails it says so. (Sheet test.)
10. A request with the flag from someone signed out, or from a player with no collection, gets no list. (Route test and smoke.)
11. If such a refusal arrives while the sheet is open, the sheet shows its sentence and does not ask again by itself. (Sheet test.)
12. A player who sends too many owned requests is refused until the limit resets. (Route test.)
13. On an unsaved deck, Suggestions' toggle is off and says it starts once the deck is saved. (Panel test.)
14. With the box unticked, Autofill behaves exactly as today. (Existing pins, untouched: the request, and the list a fixed starting number produces.)
15. The privacy page carries the approved sentence. (Read on production.)

**Verification.**

- **First, two measurements on the development database.**
  - *Speed.* Time Autofill's candidate reads with a 19,995-row test collection passed in (just under the cap), against the same reads without it, for five commanders at five runs each. The list of ids stays if it adds at most 300 ms at the median and 1 s at worst. Past that, the rewrite described under "Where it stops" comes first.
  - *Usefulness.* Build sample collections of 100, 1,000 and 20,000 Magic cards, drawn at random from Magic printings, which leans toward much-printed commons as real collections do. Add your own export if you import it on the development site; it is the best sample. For five commanders, record how many of the 62 spell slots each fills, how many of the commander's better-land slots are filled by owned lands before basics, and how many owned cards have no EDHREC rank. The session shows you these figures and waits for your word on decision 3 before it builds the sheet.
- **`pnpm check`.** Untouched: the planner's fixed-seed golden, the route's "no-goals plan exactly" test and the sheet's request pins. New cases in `src/app/api/decks/autofill/route.test.ts` (with stand-ins for the sign-in and the owned set), `src/lib/recommend/autofill.test.ts`, `src/lib/games/mtg/bracket-shell.test.ts`, `src/components/editor/autofill-sheet.test.tsx` and `src/components/editor/recommendations-panel.test.tsx`. The four test files that draw the editor each gain a stand-in for the client's sign-in state, so a guest's editor still asks nothing new.
- **`pnpm smoke:collection`** gains the owned checks, with a freshly signed-in test player whose rows are inserted directly, because the import allows 10 a user an hour. The new checks take three Autofill requests (an owned list and the two refusals). Autofill allows 20 a minute per address and `pnpm smoke:autofill` spends 18, so the two smokes run a minute apart. Never retry a refused request. `pnpm smoke:autofill` must still pass 69 of 71 on the development database; the two that fail there today are "topdeck evidence present for an aggregate-rich set" and "target 2: the shell's read stays inside it", both from stale development data.
- **`pnpm build`**: the list of routes is unchanged.
- **A statement log** of one fixed-seed request, before and after, shows the unticked path runs the same statements.
- **Layout** on the throwaway page at 320, 390, 768 and 1280 px, in both themes, with the new checkbox 44 px tall on touch.
- **Your walk-through on production after the deploy:** sign in, import your file, open a commander's hub, press "Start with a starter shell", tick the box, pick a bracket, press Add, and read the deck's header.
- **Edge case:** a collection with the commander, thirty ranked cards in its colours and no lands, at a target of 4. The list is those thirty cards plus basics. The notes say where the list is short and that the collection had no more Game Changers.

**Dependencies.** Nothing comes first. Decisions 2 to 9 are its inputs.

### Package 2: COLLECTION-PAGE (idea 1, second half)

**Player outcome.** A signed-in player opens one page, sees the commanders they own and the cards behind them, and starts a collection-built deck from a commander in one press.

**The flow.** Open the account menu and choose Collection, or follow "View your collection" beside the import on Account. The page opens on "Commanders you own", each row with its name, its colours and a count such as "412 of your cards are in its colours", most first. A line says commanders with more colours come first because more cards fit them. A second view, "Your cards", lists the collection with a name filter and pages. "Update or delete your collection" leads back to Account's import. Press "Build from my collection" on a commander. A new deck opens with that commander, the Autofill sheet open and "Only cards I own" already ticked.

**What ships.**

- The `/collection` page, in text rows. Signed out, it shows the sign-in buttons and comes back here once the player has signed in. With no collection, it says so and links to the import.
- "Commanders you own", sixty a page: the legal commanders in the collection, ordered by how many owned cards are in their colours, then by EDHREC rank. A banned or not-legal commander you own is named in one quiet line and has no build button.
- "Your cards": one row per card with its copies added up, sixty a page, filtered by name, sorted by name A to Z or by EDHREC rank.
- A one-time flag on the new-deck link that opens the sheet with the box ticked. The sheet waits for the collection check, so its one opening request already carries the flag. Opened by a guest, by a player with no collection, or by someone the link was sent to, the sheet opens unticked with its hint. It never shows an error.
- The account menu's existing "Collection" item now opens this page (decision 11).
- The build plan's stale sentence about the collection schema, corrected.

**Where it stops.** The page takes the browse and sort part of LATER row 12. Editing, add buttons, public collections and card images stay deferred there. The import stays on Account. Nothing is added to the header row. Value by printing, a colour filter and partner pairs are a new LATER row. Nothing shows which decks use a card (row 66).

**Reuse.**

- Account's sign-in gate and page settings: `src/app/(site)/account/page.tsx:79`, `:136`. The sign-in return path accepts `/collection` and refuses anything under `/account/` (`src/lib/auth/next-path.ts:51`).
- The summary: `src/lib/collection/owned.ts:55`.
- The hub's rule for a legal commander (the current ruling, and none means legal): `src/lib/hub/queries.ts:115`. The page needs its own read that applies that rule to a whole list.
- The commander index's name filter and paging: `src/lib/hub/queries.ts:334`.
- The new-deck link and its one-time flags: `src/app/decks/new/new-deck-chooser.tsx:56`, `src/components/editor/deck-editor.tsx:1881`.
- The colour test: `src/lib/games/types.ts:90`.

**Files likely to change.**

- New: `src/app/(site)/collection/page.tsx`, `src/lib/collection/leaders.ts`, `src/lib/collection/browse.ts`, list components under `src/components/collection/`, and their tests.
- The menu and its two pins: `src/components/auth/account-slot.tsx`, `src/components/site-header.test.tsx`.
- The link flag: `src/app/decks/new/new-deck-chooser.tsx`, `src/components/editor/deck-editor.tsx`, `src/components/editor/autofill-sheet.tsx`, and their tests.
- Crawlers: `src/app/robots.ts` and `src/app/robots.test.ts`, which pins the list exactly. The sitemap lists its pages by hand, so it needs no change.
- The Account page (the link), `deckwarden-build-plan.md` (the stale sentence) and `scripts/collection-smoke.ts`.

**Data, API, migration.** No migration, no new table, no new index and no new API route. Three reads: owned cards counted by colour identity (at most 32 rows for Magic), the owned commanders with their legal status, and one page of owned cards. The count beside each commander is then worked out in code from the first two, leaving the commander itself out. The page is dynamic, never cached, not indexed and disallowed for crawlers, like Account.

**Deckwarden cases.**

- *Shared or adapter?* Shared. The game's noun, its format for the legal check and the rank's label all come from the adapter, and the new read is named for the shared word (leaders). Collections hold Magic cards only today.
- *Guest with an existing deck.* Sees the sign-in buttons. Guest decks are untouched.
- *Signed-in player.* As above.
- *Shared link.* The page has no public address. A build link passed to someone else opens a normal new deck with the box unticked.

**Acceptance.** The smoke defines the test collection: one five-colour commander, two single-colour commanders, a partner, a double-faced commander, one banned commander picked from the development database, and forty other cards.

1. Signed out, the page shows the sign-in buttons and no card. (Smoke: the page's HTML holds no card name.)
2. Signed in with no collection, it says "No collection imported yet" and links to the import. (Page test.)
3. Each legal commander in the test collection is listed once, in the expected order. The five-colour commander's count is every other owned card. The banned commander is named and cannot be built. (Smoke and page test.)
4. "Build from my collection" opens a new deck with that commander, the sheet open and the box ticked. Reloading reopens nothing. (Editor and link tests: one Autofill request, carrying the flag.)
5. The same link opened by a guest opens the sheet with the box unticked and its hint. (Editor test: no request is refused.)
6. "Your cards" filters by name, sorts by name and by rank, and pages. (Page test and smoke.)
7. The page links to Account's import whether or not a collection exists. (Page test.)
8. Search engines are told to stay out. (`src/app/robots.test.ts`, updated; `src/app/sitemap.test.ts`, untouched.)

**Verification.**

- **A measurement first:** the three reads against a 19,995-row test collection on the development database, including the last page of the card list and a filtered one. If the page's reads together pass 500 ms there, the figures come to you with a smaller page size.
- **`pnpm check`**, including the tests above and `src/components/site-header.test.tsx`.
- **`pnpm smoke:collection`** with the new fixture and checks.
- **`pnpm build`**: the list of routes gains exactly one dynamic line, `/collection`, and `/decks/new` stays static.
- **Layout** on the throwaway page at 320, 390, 768 and 1280 px, in both themes.
- **Your walk-through on production:** open Collection from the account menu, read the commanders, press "Build from my collection".
- **Edge cases:** a collection with no commander in it (the page says so and points to the commander index); a partner commander (counted on its own colours); a double-faced commander (one row).

**Dependencies.** After package 1: the one-time flag ships here, in files package 1 changes first. Decisions 1 and 10 to 12 are its inputs.

### Package 3: COMMANDER-DOOR (idea 4)

**Player outcome.** A visitor who finds a commander through search, or lands on its card page, starts building with it in one press.

**The flow.** On a commander's card page, right after the legality chips, "Build with this commander" appears. In the header search, when the top suggestion is a legal commander, the row under it reads "Build with Atraxa, Praetors' Voice". On the search results page, every legal commander's tile has the same link under it. Each one opens a new deck with the commander in place.

**What ships.**

- The card-page button: the hub's own component, for a card that can lead a deck and is legal in its game's format. One Piece leader cards get "Build with this leader". A player who came from a deck's "Browse commanders" also sees "Use for <deck>", as on the hub.
- One extra entry in the header's suggestion list, directly under the top row and only when that row is a legal commander. It is its own entry in the list, so arrow keys, Enter and screen readers reach it. It is switched on for the header's box only, and not while a deck editor is open.
- A "Build with <name>" link under each legal commander tile on `/cards`.
- The legal status on both search surfaces (decision 15). The dropdown's data gains a flag that is present only for a commander that is not legal, so every other row stays exactly as it is. The results grid asks the search route for legality, which the route already supports.

**Where it stops.** The card page gets the one button you asked for; "Start with a starter shell" stays on the hub. Only the top suggestion gets an entry in the dropdown. A second (partner) commander is still added from the editor's search. The editor's own search is unchanged. The One Piece leader hub keeps its button for a banned leader until its LATER row.

**Reuse.**

- The button: `src/components/hub/hub-build-cta.tsx:19`. The hub's gate: `src/app/(site)/c/[slug]/page.tsx:243`.
- The card page's data, already loaded, including the game's one format and the card's status in it: `src/app/(site)/cards/[id]/page.tsx:93`, `:192`.
- The suggestion row's commander flag and key: `src/lib/search/suggest.ts:45`.
- The suggestion list's pattern for an entry that is a link: `src/components/search/name-suggest.tsx:369`.
- The results grid: `src/components/cards/card-search.tsx:609`. The search route's existing legality answer: `src/app/api/cards/search/route.ts:101`, `src/app/api/cards/search/route.ts:262`.

**Files likely to change.**

- The card page: `src/app/(site)/cards/[id]/page.tsx`, a small shared gate helper, and a new test beside the page.
- The dropdown: `src/components/search/name-suggest.tsx`, `src/components/search/header-search.tsx`, `src/lib/search/suggest.ts`, and their tests, including one new case in the pinned `src/app/api/cards/suggest/route.test.ts`.
- The grid: `src/components/cards/card-search.tsx` and its test, whose pinned request addresses change.

**Data, API, migration.** No migration. One optional field on the suggestion data, and one more statement per results page for legality. Both answers are kept by the CDN, so a new ban can take up to a day to remove a button; the editor flags a banned commander at once. The card page stays dynamic, kept by the CDN, and shows every visitor the same page, signed in or not.

**Deckwarden cases.**

- *Shared or adapter?* The card page is shared and takes its noun from the adapter, in lower case to match the hubs. The header search deliberately does not load the adapters, so its entry says "Build with <card name>" with no noun. The results grid does load them, and uses the same words so the two search surfaces match.
- *Guest with an existing deck.* The button starts a new deck and leaves the existing one untouched. Nothing is saved until the first edit. Only a player who came from a deck's "Browse commanders" is offered "Use for <deck>".
- *Signed-in player.* The same.
- *Shared link.* Not involved.
- *Two games.* One rule for both on the surfaces this package touches.

**Acceptance.** The first step picks the examples from the development database: one banned commander (Golos, Tireless Pilgrim is the expected one) and the count of banned or not-legal commanders per game.

1. On Atraxa, Praetors' Voice's card page, "Build with this commander" sits with the legality chips. It opens a new deck showing her as commander and "1 / 100", and no deck is saved until an edit. (Page test; your walk-through.)
2. On Sol Ring's page there is no build button, although "Commander: legal" shows. (Page test.)
3. A banned commander has no button on its card page, no build entry in the dropdown and no link in the results grid. (Page, suggestion and grid tests.)
4. In the header search, "atraxa" offers the build entry second in the list; arrow down twice and Enter opens the new deck. "sol ring" offers none. (Suggestion and header tests.)
5. From a Magic page, a search that only One Piece answers offers a One Piece build entry, and it opens a One Piece deck. (Suggestion test.)
6. On `/cards?q=atraxa`, each legal commander tile has its build link and other tiles have none. (Grid test.)
7. The card page looks the same to everyone, signed in or not. (The new page test, which pins for the first time that the page never checks who is signed in; `src/lib/next-config.test.ts`.)
8. A player who came from a deck's "Browse commanders" also sees "Use for <deck>" on the card page; nobody else does. (Page test.)

**Verification.**

- **`pnpm check`**, including `src/app/(site)/isr-budget.test.ts` (the card page's caching), `src/components/hub/hub-build-cta.test.tsx`, `src/components/search/header-search.test.tsx`, `src/components/search/name-suggest.test.tsx` and `src/components/cards/card-search.test.tsx`.
- **`pnpm smoke:hubs` and `pnpm smoke:seo`**: the hubs' pinned button markup must not move.
- **`pnpm build`**: the list of routes is unchanged.
- **The browser pane** at 320, 390, 768 and 1280 px with touch and a keyboard walk: the new targets are 44 px tall and nothing scrolls sideways. The phone header is also read in the iOS Simulator.
- **Edge cases:** a partner commander (one is placed; the second is added from the editor's search, as today), a double-faced commander, a card not yet released (it follows its hub), a Background and a token (neither is a commander, so neither gets a button), and a One Piece leader.

**Dependencies.** None come first. It can run beside any other package once the first session's record is committed. Decisions 13 to 15 are its inputs.

### Package 4: AUTOFILL-TOTAL (idea 5)

**Player outcome.** Set a budget for the whole deck in the Autofill sheet and get a starter list at or under it.

**The flow.** Open Autofill any of its three ways: a hub's "Start with a starter shell", the empty deck's Autofill button, or More then Autofill…. Beside Budget the sheet shows "Deck total": type whole dollars and press Enter, or press $50, $100, $150 or $250. The list reloads once. The footer reads "est. $97 of your $100" for the whole deck: the commander, the cards kept and the cards about to be added. Press Add; the deck keeps the total, so its goals line reads against it from then on.

**What ships.**

- The "Deck total" control, starting from the deck's saved total when it has one. It is switched off while "Only cards I own" is ticked (decision 5).
- One optional field on the Autofill request, separate from the deck's goals, so the helper every other request shares stays as it is.
- A "fit" step in the planner, run after the list is planned and after any build-up to the bracket. Its rules:
  - While the deck costs more than the total, the priciest card Autofill picked leaves, and the best-ranked cheaper card of the same mana-value group comes in. A land with no cheaper ranked land gives its slot to a basic.
  - The commander and the cards the player kept never leave. Anything Autofill picked may leave, including tournament staples, combo completions and Game Changers the build-up just added (decision 17).
  - A card coming in passes the same bracket check as every other pick, and must have a known price.
  - Nothing random is added, so the same request gives the same list.
  - Every card is priced at its cheapest printing, owned or not. Cards with no known price are counted beside the figure ("+3 unpriced"), as every budget line already does.
- Honest notes when the total cannot be reached: how far over the list is, and when the commander and kept cards alone are over. The build-up note is worked out again after the fit, so it never claims a Game Changer the list no longer holds. The notes about what a bracket target kept out still compare against a list planned with no total, so the budget's removals are never blamed on the target.
- Add saves the total on the deck (decision 16). Undo takes the cards back and leaves the total, and the toast says so, as it does for the target.
- The sheet's read-only goals line stops naming the total, since the control beside it now does.

**Where it stops.** The per-card Budget is unchanged and stays a one-time choice (LATER row 462). Suggestions, Swap Lab and the Fit sheet's own flow are untouched. Counting owned cards as $0 while planning belongs to the deferred "owned first, then buy" mode. After Add, the deck's own goals line counts owned cards as $0 as it does everywhere, so a collector's line can read lower than the sheet's figure.

**Reuse.**

- The presets and limit: `src/lib/recommend/budget.ts:22`.
- The Fit sheet's field, moved into one shared component: `src/components/editor/fit-sheet.tsx:362`.
- The words "est. $212 of your $150": `src/lib/recommend/fit.ts:72`.
- Saving a total: `withTotal`, `src/lib/decks/goals.ts:230`. Saving a goal on Add: the target's path, `src/components/editor/deck-editor.tsx:2020`.
- The build-up step's swap machinery as the model: `src/lib/recommend/autofill.ts:385`.
- Prices of the commander and kept cards, which the route already reads: `src/lib/recommend/queries.ts:557`. The planner has to be handed them, and the basic lands' prices have to be read before planning when a total is set.

**Files likely to change.** `src/lib/recommend/autofill.ts`, `src/app/api/decks/autofill/route.ts`, `src/components/editor/autofill-sheet.tsx`, `src/components/editor/fit-sheet.tsx`, `src/components/editor/deck-editor.tsx`, `src/lib/games/mtg/brackets.ts` and `src/lib/games/types.ts` (the third contract addition, decision 9), the comments in `src/lib/decks/goals.ts` that say nothing on the server uses the total, their tests, and `scripts/autofill-smoke.ts`.

**Data, API, migration.** One optional `totalUsd` on `POST /api/decks/autofill`. No migration: the deck's goals have held a total since October. No new statement; one existing read moves earlier when a total is set. The route stays dynamic and uncached.

**Deckwarden cases.**

- *Shared editor or adapter?* Shared. Price is not game-specific. Only the sentence about Game Changers stays in the Magic adapter.
- *Guest with an existing deck.* Works without signing in; the total saves on a guest deck like any other goal.
- *Signed-in player.* The same. With a collection, the sheet's figure prices owned cards in full; the deck's own line afterwards counts them as $0.
- *Shared link.* A visitor never sees the budget. That is pinned today and stays pinned.

**Acceptance.** The first step records two examples from the development database: one commander and starting number whose list lands at or under $100, and one that cannot.

1. For the first example, the list costs $100 or less and the footer says so. (Smoke: the answer's priced total, commander and kept cards included, is at or under 100. Sheet test: the footer's words.)
2. For the second, a note says how far over the list is and why, and names the commander and kept cards when they alone are over. (Planner test and smoke.)
3. Asking twice with the same total gives the same list. (Planner test, with the starting number fixed.)
4. On a deck with no total saved and none entered, Autofill behaves exactly as today. (Existing pins, untouched.)
5. A deck that already has a total opens the sheet on it, and the list is fitted to it. (Sheet test.)
6. After Add and a reload, the deck's goals line reads against the total, and "Fit my budget…" opens on it. After Undo the cards are gone and the total remains. (Editor test.)
7. A list holding cards with no known price says how many beside its figure. (Planner and sheet tests.)
8. A visitor's view of the deck shows no budget. (Existing pin.)

**Verification.**

- **A measurement first, on the development database:** the 57 commander sets recorded for AUTOFILL-TARGET's measurement (`REDESIGN.md:1758`), five fixed starting numbers each, at $50, $100, $150 and $250. Record how many of the 285 lists land at or under each total. A preset stays in the sheet only if at least half reach it; the figures come to you.
- **`pnpm check`**, including the planner's fixed-seed golden and the route's "no-goals plan exactly" test. Two sheet pins are rewritten on purpose: "a total … never rides the body", and the goals line naming the total.
- **`pnpm smoke:autofill`** with the two examples as checks. It has two requests to spare in its 20-a-minute allowance, so further checks run a minute later. Its two known failures on the development database stay the only ones.
- **`pnpm build`**: the list of routes is unchanged.
- **The browser pane** at 320, 390, 768 and 1280 px, in both themes.
- **Edge case:** a $40 commander, twelve kept cards worth $30 and a $50 total. The deck is over before the first pick. The note has to say so, and the picks have to be the cheapest that fit.

**Dependencies.** After package 1, because both edit the Autofill route, planner and sheet, and the total switches off with package 1's checkbox. Decisions 1, 9, 16 and 17 are its inputs. It annotates LATER row 83, whose total-budget item is built ahead of its trigger while the rest of the row stays, and row 195.

### What follows the build

These two are sketched, not specified. Each gets its own brief when its turn comes.

**MAYBE-LIST (idea 3), M.** Park cards under the deck, and add to that list from Suggestions at any deck size.

- *Shape.* The Commander format declares one more zone that does not count and has no size limit, placed last. Its id is `maybeboard`, the word the importer already uses, so a pasted Maybeboard section and Archidekt's custom out-of-deck categories land there with no parser change. Sideboard lines stay skipped. The editor and the share page draw a "Maybe" section, closed by default, below Tokens. A Suggestions row gains a small "Maybe" button on its second line, so the card's name keeps its width; "Add" or "Swap in…" stays above. A Maybe row offers "Move to deck" (at 100 cards it opens the existing swap sheet) and Remove. Putting a card in the deck takes it out of Maybe. That is the editor's rule; the database allows a card in both.
- *No migration, and no new field in the game contract.* The shared code can find the zone as "not counted, not the commander's, holds cards". A test pins one such zone per format. The format has to declare the zone before any screen writes to it.
- *The eleven places that assume Tokens is the only zone that does not count.*
  1. The link preview counts every non-token card whatever its zone (`src/lib/og/data.ts:66`).
  2. The editor's "in deck" count spans all zones. It feeds Suggestions, search and the Combo Radar (`src/components/editor/deck-editor.tsx:2092`).
  3. The editor's list and the share page both drop such rows from view, while the editor keeps saving them (`src/components/editor/deck-list-pane.tsx:306`).
  4. The phone card sheet and the tag editor treat any card outside the commander's zone as the deck's.
  5. The list hash covers every zone, so a game logged after a maybe edit records a new snapshot.
  6. "Replace deck" on import already keeps rows outside the playable list.
  7. A deck holding only Maybe cards reads "No cards yet".
  8. The clean-up of abandoned guest decks never calls such a deck empty.
  9. The save route's 500-row limit counts every zone.
  10. No add path takes a card out of Maybe.
  11. Comments in `playable.ts` and Magic's formats file that stop being true.
- *Decisions it will ask of you.* Whether Maybe is offered at any deck size with "Swap in…" kept at 100 (my default) or replaces "Swap in…" there. Whether a maybe edit counts as a change to the list for the game journal (today a token edit does). Whether exports include the Maybe section (default: no). Whether visitors see it (default: yes, closed).
- *Example checks.* A guest adds a card to Maybe at 100 / 100 and reloads: the deck still reads 100 / 100 with the card under Maybe. The share link shows it under a closed "Maybe" heading, and the link preview still says 100 cards. A banned or off-colour card in Maybe raises no legality warning.
- *Existing checks on this ground.* `src/lib/decks/playable.test.ts`, `src/lib/decks/cards.test.ts`, `src/lib/decks/import.test.ts`, `src/lib/games/mtg/decklist.test.ts`, the "Swap in…" cases in `src/components/editor/deck-editor.test.tsx`, `pnpm smoke:decks` and `pnpm smoke:versions`.

**DECK-FACTS (idea 2), S for the code and M with its measurement.** Two counted tiles in the deck's statistics, in the editor and on the share page.

- *Shape.* The first tile is named for the deck's type, for example "Vampire cards: 34 of 63". It comes from the theme reader Suggestions already uses and counts the same cards a Suggestions row counts. It says "type" because the reader cannot see themes such as lifegain. With no type found there is no tile. The second is "Commander staples: 28 of 63", the nonland cards at EDHREC rank 2,000 or better, the cut-off the site already calls a staple. Both are computed in the Magic adapter's analysis from data every card already carries. No route, no migration, no change to the game contract.
- *Beside the player's own answer.* The share page already shows the player's answer to "Staples and high card quality?". The tile is a count and the answer is the player's word. They can differ, and both stay.
- *A measurement first.* The share of each precon's nonland cards inside ranks 100, 300, 500, 1,000, 2,000 and 5,000. Rank 2,000 stays if it spreads the precons apart; otherwise the tile is named for the rank that does.
- *Rules kept.* Two counts, each with its denominator and source. No combined score and no adjective. Nothing new is read from card text. A test bans the words "fun", "boring", "generic" and "score" in the new strings. LATER row 480 is annotated with the tile's limit.
- *Example checks.* A Vampire precon's tile shows the same count a Suggestions row gives. The Atraxa precon shows no type tile. A One Piece deck's statistics are unchanged.
- *Existing checks on this ground.* `src/lib/games/mtg/analyze.test.ts`, `src/lib/games/mtg/themes.test.ts`.

## 5. Handoff

**Build AUTOFILL-OWNED first.** It earns the spot for five reasons:

1. You chose it as the lead.
2. Three of its four parts exist: the import, the bracket choice and the engine's owned filter. The missing part is Autofill reading the collection, which one session can finish.
3. It builds what package 2 needs: Autofill that knows who is asking, and a new deck that knows its player's collection. Package 4 then adds its own limit to the same request and sheet.
4. It closes most of a recorded gap (LATER row 165).
5. A wrong result is cheap to catch: the smoke compares every non-basic card in the list with the collection.

**When it ships you can** import your ManaBox or Moxfield file on Account, open any commander, press "Start with a starter shell", pick a bracket, tick "Only cards I own", and get a list made from your own cards plus basic lands, with any open slots counted. Press Add and the deck shows what you own straight away.

**Copy-ready prompt for the first package**

```text
AUTOFILL-OWNED: Autofill builds a starter list from the cards the player owns

One Deckwarden work package, one session. Read CLAUDE.md and AGENTS.md first.
Anchors were verified at ea6aa27 (main = origin/main, 2026-11-24): re-grep line
numbers, trust the shapes. Other sessions land on main, so fetch, then re-read
`git log origin/main..main`, LATER.md and the project memory index (MEMORY.md
in the Claude project memory folder, not in the repository) before committing.

Done means deployed: `pnpm check` green, a local `pnpm build` whose route table
matches the build of the commit you started from, then merge and push on the
owner's word and a production read on the owner's OK.

The approved plan for this build and its three siblings is at
~/.claude/plans/act-as-a-senior-starry-kitten-of-a6a2aee5-039d-4689-96aa-0b84d703093d.md

THE ASK (the owner, 2026-11-24, as given)
"A feature or list to input you whole collection to have the website build
decks based on your inventory of cards and it try's its best also on a bracket
level you choose."
Decided with the owner the same day: this leads the build, the player picks the
commander, and the ManaBox and Moxfield import is enough. The plan's decisions
2 to 9 are this package's inputs; confirm any the owner has not answered.

BEFORE ANY CODE: THE RECORD
Write the plan into the repository as OWNER-NOTES-2026-11-24-session-prompt.md:
its four packages, two follow-ups, decisions table and a progress line. The
example of the form is OWNER-NOTES-2026-11-15-session-prompt.md, which is
untracked and exists only in the main checkout. Add the plan's deferred rows to
LATER.md (new rows start at 497) and annotate the rows it names. Leave both
uncommitted until the owner says to commit. Tell the owner that a parallel
session (the plan's package 3) should start only after that commit, because
LATER row numbers are line numbers.

WHAT EXISTS
- Collection: table `collections` (src/db/schema.ts), import on /account,
  readers `ownedIdentityIds` and `hasCollection` (src/lib/collection/owned.ts).
  Owned means any printing of the card identity; copies are not counted.
- The engine's owned filter: `CandidateFilter.ownedCardIds` in
  `candidateConditions` (src/lib/recommend/queries.ts) and
  `GatherOptions.ownedCardIds` (src/lib/recommend/engine.ts). It is a list of
  ids (LATER row 69). Suggestions use it for saved decks:
  src/app/api/decks/[id]/recommendations/route.ts (`?owned=1`; it never
  refuses, it turns the filter off and reports `owned.reason`) and the
  "Only cards I own" checkbox in src/components/editor/recommendations-panel.tsx.
- Autofill: src/app/api/decks/autofill/route.ts reads no session. Its two
  `gatherSignals` calls set pool sizes and scope, and of the filter options
  pass only `maxPriceUsd`. The planner is src/lib/recommend/autofill.ts (pure).
  Magic's Autofill declaration is `mtgAutofill` in
  src/lib/games/mtg/recommend.ts. The sheet is
  src/components/editor/autofill-sheet.tsx (Your target, Budget, Keep my N
  cards, Reroll). Bracket target and build-up already work (AUTOFILL-TARGET
  and AUTOFILL-REACH in REDESIGN.md).
- A draft never learns `hasCollection`: src/components/editor/deck-editor.tsx
  sets it only when it loads a saved deck, and a draft's first save rewrites
  the address without reloading (LATER row 165). /decks/new is static, so the
  server cannot tell it.

BUILD
0. Measure before coding, on the dev branch only. Scratch scripts go in
   scripts/.tmp/. One that opens the database imports `guardDatabaseUrl` from
   scripts/smoke/db.ts and calls it right after the env load
   (scripts/reset-dev-counters.ts shows the shape), and deletes the rows it
   wrote. One that calls the local server imports ../smoke/guard first.
   a. Speed. Insert a throwaway user with 19,995 rows the way the cap test in
      scripts/collection-smoke.ts does. Up to five statements carry the list:
      the pool, the tournament candidates and the combo recheck of the curve
      gather, and the pool and the tournament candidates of the base gather.
      They are issued together and queue on the one default connection
      (DB_POOL_MAX unset; measure it that way). Time the two gathers with and
      without the owned set for five commanders, five runs each, and
      EXPLAIN ANALYZE the pool statement both ways. Keep the id list if the
      cap adds at most 300 ms at the median and 1 s at worst. Past that, stop
      this package and tell the owner: on their word this session becomes the
      rewrite package instead (a subquery condition on `collections` behind
      the same option; it changes the filter Suggestions ships, so
      `pnpm smoke:recommend` and `pnpm smoke:collection` check it), and
      AUTOFILL-OWNED starts next session. Also time GET /api/collection for
      that user (step 4 calls it).
   b. Usefulness. Build sample collections of 100, 1,000 and 20,000 cards from
      random Magic printings (not the cap test's rows, which span both games),
      plus the owner's own export if they import it on the dev site. For five
      commanders record how many of the 62 spell slots each fills, how many of
      the ranked land slots for the commander's colour count (6, 8, 16, 22,
      26, 28 for 0 to 5 colours) are filled by owned lands before basics, and
      how many owned cards have no popularity. Only the popularity pool
      requires one; tournament and combo candidates do not. Show the owner
      the figures and wait for their word on decision 3 (strict filter)
      before building the sheet.
1. Route: an optional `ownedOnly` boolean on POST /api/decks/autofill; only
   `true` acts. After the cheap 400s and before the facts read, read the
   session (`getSessionUserId`). Signed out is 401 with one plain sentence.
   An empty owned set is 409 with `reason: "no-collection"`. Never fall back
   to an unfiltered list. Pass the set to both gathers, spread in only when
   set, so the default options stay deep-equal to today's. With the flag set,
   ignore any per-card budget. Add `owned: { applied: true }` to the answer
   only when asked. Keep the per-address limit first as today, and add a
   per-user limit (20 a minute, 200 an hour) spent after the session is
   proven. Basic-land fillers stay as they are. Caching intent stays
   force-dynamic and no-store. Update the route's header comment and the
   limiter's comment, which both describe the route as sessionless.
2. Words, all sent in the answer's `notes`. The open-slots sentence is core
   (`shortfallNote`, autofill.ts; pass the new case through `finishShell`'s
   options). The Game Changer sentence is Magic's `mtgReachNotes`, the
   adapter's `BracketsMeta.reachNotes`: its input type in
   src/lib/games/types.ts gains one optional member so the note can say the
   collection had no more to bring in. The basic-lands line ("added as needed
   and not checked against your collection") names a Magic card type, so it
   is the adapter's: a new optional member of `AutofillMeta`, declared by
   `mtgAutofill`, which the route appends when the filter is applied. Both
   are contract additions (the plan's decision 9). Core names no game term.
3. Sheet. The sheet asks nothing new itself (a test pins that only the shell's
   POST and the facts GET are ever asked). The editor hands it the collection
   state: available, unavailable, checking or failed. A checkbox "Only cards
   I own" sits in the controls row. Unavailable: disabled, with the
   Suggestions toggle's hint. Checking: disabled, no hint. Failed: disabled,
   "Couldn't check your collection." Ticked, it switches Budget off with a
   line that price limits do not apply to owned cards, and the body gains
   `ownedOnly: true` and loses `budgetUsd`. 401 and 409 get their own
   sentences, keep Retry and never ask again by themselves. With the filter
   applied the footer reads "N of these M cards are from your collection.",
   where N counts every pick whose tier is not `filler`, in place of the
   price estimate.
4. The draft learns the collection. Drafts only: read `authClient.useSession()`
   (the header's account slot already mounts it; confirm a second subscriber
   adds no request). With a user, one GET /api/collection per editor mount;
   `summary.rows > 0` sets `hasCollection`. It is a full count with no
   limiter: if step 0 timed it slow at the cap, say so and propose a cheaper
   yes-or-no read. A guest makes no such request. The editor's existing owned
   lookups then mark cards before the first save, and the draft's estimate
   and Fit sheet count owned cards as $0 (the Y8 symptom on row 165).
5. Suggestions on a draft stay off (decision 8). Gate the panel's toggle on
   its `deckId`, and give a signed-in collector's draft a hint that the
   filter starts once the deck is saved. Without the gate the toggle would
   switch on and send a request that ignores it. POST /api/recommendations
   gets no flag here.
6. The privacy page (src/app/(site)/privacy/page.tsx, about line 71; the
   source has `<em>you</em>` inside the sentence, so grep for "which cards
   you own in decks you view"). Replace "It only ever shows you which cards
   you own in decks you view, and you can wipe it from the account page at
   any time." with the wording the owner approved under decision 7, which
   keeps the wipe clause.

SCOPE FENCE (each is a LATER.md row with its trigger)
- Topping up with cards to buy, and counting copies: annotate row 66. Trigger:
  this package and AUTOFILL-TOTAL are live and a player asks.
- An owned precon counting as owned: annotate row 349.
- Owned marks in search and on card pages: row 68, unchanged.
- The draft Suggestions route's owned filter: row 165, first half marked
  fired, second half kept. Trigger: a collector asks for it on a deck they
  have not saved.
- The Fit sheet pricing an owned replacement in full: annotate row 191.
- Saving the choice on the deck: new row. Trigger: a player ticks the box on
  the same deck twice.
- Assumed basic lands reading as "missing" in the ownership line: new row.
  Trigger: a collector asks why basics are missing.
- Owned cards with no popularity and no tournament or combo evidence never
  entering the pool: new row. Trigger: a collector's list comes up short
  although they own enough cards.
- Row 69: annotate with what step 0 measured.
- The collection page is the next package.

ACCEPTANCE (what a person sees, then the check that proves it)
1. Ticking the box reloads the list once. (Sheet test: exactly one more
   Autofill request; its body carries the flag and the opening request's
   does not.)
2. Every card Autofill picks is owned, except the basic lands it adds.
   (pnpm smoke:collection: every entry of `picks` whose `tier` is not
   `filler` is in the collection. The answer's `cards` also holds the
   commander and kept cards, which need not be owned.)
3. A note says basic lands are added as needed and are not checked against
   the collection, and the footer counts the picks from the collection.
   (Route test for the note; sheet test for both.)
4. A target of 4 with no Game Changers in the collection: a note says the
   collection had no more to bring in. (Planner and adapter tests.)
5. A collection too small for the deck: a note counts the open slots and names
   where they are, and Add adds exactly the cards shown. (Planner and sheet
   tests.)
6. With the box ticked, Budget is off and says why. (Sheet test: the body
   carries no `budgetUsd`.)
7. On a draft with a signed-in collector, the ownership line and owned marks
   show after Add without a reload. (Editor test with a mocked session.)
8. Guest: the box is disabled with its hint, and Autofill behaves as today.
   (Editor test: no /api/collection request; the sheet's existing byte pins.)
9. While the collection is being checked the box is disabled; a failed check
   says so. (Sheet test.)
10. A hand-made request with the flag gets 401 signed out and 409 with no
    collection, and no list either way. (Route test and smoke.)
11. A 401 or 409 while the sheet is open shows its sentence and no second
    request by itself. (Sheet test.)
12. Owned asks past the per-user limit are refused. (Route test.)
13. On a draft, Suggestions' toggle is off and says it starts once the deck is
    saved. (Panel test.)
14. Box unticked: the request body and a fixed-seed list are byte-identical to
    today's. (Existing pins, untouched.)
15. The privacy page carries the approved sentence. (Read on production.)

VERIFY
- `pnpm check`. Untouched: the fixed-seed golden in
  src/lib/recommend/autofill.test.ts, "the no-goals plan exactly" in
  src/app/api/decks/autofill/route.test.ts and the request-body pins in
  src/components/editor/autofill-sheet.test.tsx. New cases: the route test
  (add `vi.mock` entries for `@/lib/auth` and `@/lib/collection/owned`), the
  shortfall pins in autofill.test.ts, src/lib/games/mtg/bracket-shell.test.ts,
  the sheet test and src/components/editor/recommendations-panel.test.tsx.
  The four files that render DeckEditor (deck-editor.test.tsx and its
  precon-changes, target-fit and target-up siblings) each need a `vi.mock`
  block for `@/lib/auth-client` whose `useSession` returns no session; the
  precedent is src/components/site-header.test.tsx. Without it the fetch-count
  pins see an extra request.
- The owned checks live in `pnpm smoke:collection`, which mints sessions. Use
  a fresh minted user with rows inserted by SQL (imports are 10 an hour per
  user; deck creation is 10 an hour per address). They take three Autofill
  asks: an owned list, a 401 and a 409, and refusals spend the per-address
  limit too. Autofill is 20 a minute and 200 an hour per address and
  `pnpm smoke:autofill` spends 18, so run the two smokes a minute apart.
  `pnpm counters:reset` clears deck-create counters only. Never retry a 429.
  `pnpm smoke:autofill` must still pass 69 of 71 on the dev branch; the two
  failures there are "topdeck evidence present for an aggregate-rich set" and
  "target 2: the shell's read stays inside it" (stale dev data).
- `pnpm build`: the route table is unchanged.
- A `DB_LOG=1` statement log of one fixed-seed ask, before and after, shows
  the default path runs the same statements.
- Layout on a throwaway harness page that is never committed (the pane holds
  no session), at 320, 390, 768 and 1280 px, both themes, the checkbox 44 px
  on touch.
- One-line mutation checks: filter one gather only; always read the session;
  skip the 401; pass an empty set through; add `owned` when not asked; send
  `ownedOnly: false`; drop the panel's gate; keep `budgetUsd` when ticked.
- Edge case: a collection with the commander, thirty ranked cards in its
  colours and no lands, at a target of 4. The list is those thirty cards plus
  basics, the notes say where it is short, and they say the collection had no
  more Game Changers.
- After the deploy, the owner's walk-through on production: sign in, import,
  open a commander's hub, "Start with a starter shell", tick the box, pick a
  bracket, Add, and read the deck's header.

RECORD
A REDESIGN.md section for the build, the LATER rows above, a progress line in
OWNER-NOTES-2026-11-24-session-prompt.md, and a ship note once it is live.
```
