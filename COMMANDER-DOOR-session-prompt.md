# COMMANDER-DOOR session prompt (2026-11-25): start a deck with a commander from search and from its card page

*Status: **built 2026-11-25** as `ccc77ba` and `31e620f` on `claude/elated-swirles-2a1816`, on top of `23afe59`, by the session this prompt started. The owner answered the gate's points the same day, each on what was built (and a fourth point the build raised: the entry's place). Not merged, pushed or read on production when this line was written. The record is REDESIGN.md, "A build button where a commander is found", and "Package 3: COMMANDER-DOOR, as built" in `OWNER-NOTES-2026-11-24-session-prompt.md`, which lists where the build differs from this prompt. Below this line the prompt is as it was given. It was written 2026-11-25 as package 3 of that file, the owner's idea 4, by that plan's planning session on the owner's "Start package 3, COMMANDER-DOOR, in its own session". Two rounds of read-only reviewers checked it against the code and the plan (93 findings, then 58, all applied), and package 2's arrival on `main` (`c08a9e9`) was folded in afterwards.*

One Deckwarden work package, one session. Read CLAUDE.md and AGENTS.md first.
Anchors were verified at `c08a9e9` (`main`, 2026-11-25): re-grep line numbers,
trust the shapes. Between `ea6aa27`, where the plan was written, and `c08a9e9`
only three of the files this package reads changed, all by package 2, and
START STATE names them. No migration and no new route. One route handler's
file changes, by its docblock alone (`/api/cards/suggest`). The card page's
code and docblock change. The search route's file is not opened.

THE CONTRACT
`OWNER-NOTES-2026-11-24-session-prompt.md` in the repository, section "Package
3: COMMANDER-DOOR (idea 4)", with decisions 13, 14 and 15 in its "Decisions and
defaults" table, the "Rules every package follows" above its package sections,
and LATER.md rows 506, 507 and 508. Read that section first. This prompt adds
what the section leaves to the builder. It departs from the section on purpose
in the places below, which are not a reason to stop.
1. A removed card gets no button on its card page. The section did not consider
   removed cards.
2. While a commander pick is pending, the two search surfaces offer no build
   action. The section was silent, and its entry would have opened a new deck
   on a page whose banner says the player is choosing for a saved one.
3. The set strip on `/cards` gets no links. The section says "each legal
   commander tile".
4. One Piece words carry the card number, because its leaders share names.
5. A ban reaches the grid within about an hour, not a day, and the card page's
   own button is a third surface with a stale window.
6. Checks differ in places: acceptance line 1 adds the pane's network log, line
   5 is checked in the header's test, line 8's "Use for" half is checked where
   the island can hydrate, the route test gains several cases where the section
   says one, and the Simulator read is recorded as not read if access goes
   unanswered.
7. The game picker (`/decks/new` with no game chosen) gets no entry either,
   because the header reads the path alone.
Anywhere else the two differ in what a player sees or in what the data holds,
stop and say so. A difference in a check or a file is a line in the hand-over
list.

START STATE
- Start from the tip of local `main`: `73baf81` when the session was started,
  which is `c08a9e9` (package 2) plus its docs-only ship note. If
  `git merge-base --is-ancestor main HEAD` fails, run
  `git merge --ff-only main` before anything else. The message that started
  the session was written an hour earlier and still says `c08a9e9` and row
  520: this file is the one to go by.
- GitHub's `main` is `73baf81` too: packages 0, 1 and 2 are pushed and live,
  with their ship notes. At the ship
  question, after a `git fetch`, read out
  `git log --oneline origin/main..HEAD` (every commit the push carries) and
  confirm that `git log HEAD..origin/main` is empty.
- A fresh worktree needs `pnpm install --frozen-lockfile --prefer-offline`, a
  `.env.local` symlink to the main checkout's, and its own entry in
  `.claude/launch.json` for the preview. The project memory has the recipes
  and the traps: `worktree-session-shell-limits`,
  `deckwarden-machine-toolchain`, `scratch-scripts-are-linted`,
  `exact-replace-after-prettier`, `parallel-sessions-same-worktree`,
  `dev-reload-loop-stale-cache`, and for the push
  `deckwarden-deploy-verification`.
- Package 2 (COLLECTION-PAGE, `c08a9e9`) changed three files this package
  reads: `src/app/decks/new/new-deck-chooser.tsx` (one more one-shot flag,
  `owned`; the leader latch below is as it was), `src/app/robots.ts` (it now
  also disallows `/collection`) and `src/components/site-header.test.tsx` (the
  account menu's Collection link). It also added a build link of its own on
  `/collection` and its own read of the rule below
  (`src/lib/collection/leaders.ts`). Its hand-over is in the OWNER-NOTES file,
  "Package 2: COLLECTION-PAGE, as built".
- Package 4 (AUTOFILL-TOTAL) may start in another session while you work. It
  edits the Autofill route, planner and sheet, the Fit sheet and the editor,
  none of which this package touches, and the same three record files you
  will (LATER.md, REDESIGN.md, the OWNER-NOTES file). LATER.md's row numbers
  are line numbers, and the file ends at row 521.

Done means deployed: `pnpm check` green, a local `pnpm build` whose route table
matches the build of the commit you started from, then merge and push on the
owner's word and a production read on the owner's OK.

THE ASK (the owner, 2026-11-24, as given)
"If you search for a commander in the normal search bar it should know if its a
legendary creature and then have a small button from the search result to add
commander and then take you to the build page also when you land on the card
page there should be a button next to where is says "commander: legal" add
commander"

Decided so far: the owner approved the plan as a whole on 2026-11-24, so its
defaults stand until the owner flips one: decision 13 (the words: "Build with
this commander" on the card page, "Build with <card name>" in search), 14 (one
button on the card page) and 15 (no build action for a banned or not-legal
commander). The owner has not answered these one at a time. "At the gate"
below says what goes to them and when.

THE RULE (one wording for all three surfaces)
A card gets a build action when it is a leader candidate and its status in the
format a new deck opens in is `legal`. Its status is that of its current,
unconditional row there (`effective_to IS NULL`, `condition IS NULL`), and
`legal` when it has no such row.
- This is the rule two shipped surfaces already apply, each in its own code:
  the commander hub's page (`status === "legal"` over `loadLeaderStatus`,
  `src/lib/hub/queries.ts` about line 114) and the collection page
  (`loadOwnedLeaders` and `rankOwnedLeaders`, `src/lib/collection/leaders.ts`).
  Leave both as they are and name them in the record as the rule's two other
  homes.
- A conditional row never blocks (One Piece's pair bans are conditional). A
  `banned`, `not_legal` or `restricted` row blocks. No card is expected to
  carry `restricted`; One Piece reads it as "one copy", which a leader would
  satisfy, so a restricted leader candidate is one of step 0's stops.
- Do not copy the status list of the two NOT EXISTS reads in
  `src/lib/hub/queries.ts` (about lines 166 and 425): they name `banned` and
  `not_legal` only, and would let `restricted` through.
- No surface reads a format's default. "No legality row" means legal, as
  `loadLeaderStatus` has it (`?? "legal"`), and that is true only while the
  seeded formats default to `legal`: the helper's test pins it (step 1).
- On the card page alone the identity must also not be removed
  (`identity.isRemoved`): that page renders removed cards, and the `?leader=`
  seed refuses them (`src/app/api/cards/resolve/route.ts` about line 79), so
  the button would open a deck with no commander. Both search answers already
  leave removed cards out.
- A preview card passes. The nightly ingest writes no legality row for a
  preview (`scripts/ingest/scryfall.ts` about line 578), so its hub shows the
  button today, and the build plan wants spoiler brewing caught
  (`deckwarden-build-plan.md` about line 141). The card page will then show the
  button under its own sentence "Preview card: not legal until release". The
  owner has not seen those two together: it goes to them at the gate.
- While a pick for the same game is pending (`usePickIntent`,
  `src/lib/decks/leader-pick-intent.ts`), the dropdown offers no entry and the
  grid no links. The card page offers both buttons, as the hub does.

WHAT EXISTS
- The hub's button: `src/components/hub/hub-build-cta.tsx`,
  `HubBuildCta({ game, leaderKey, label, autofill })`, a client island that
  returns a bare fragment of buttons (each hub wraps it in
  `flex flex-wrap items-center gap-3`). Without `autofill` its server render is
  one anchor to `/decks/new?game=<game>&leader=<leaderKey>`; `autofill` adds a
  second server-rendered anchor, "Start with a starter shell". Only "Use for
  “<deck>”" (to `/decks/<id>/edit?leader=<key>`) waits for hydration: the pick
  is read with a null server snapshot. `usePickIntent(game)` answers for one
  game. The pick is written when a saved deck presses "Browse commanders" (or
  leaders), lives 30 minutes in sessionStorage, and shows a banner on
  `/commanders` and `/leaders` ("Choosing a <noun> for “<deck>”",
  `src/components/hub/leader-pick-banner.tsx`). The island's docblock cites
  smoke lines that have moved: the pins are in `scripts/hubs-smoke.ts` (about
  lines 411 to 465) and `scripts/seo-smoke.ts` (about line 379).
- The commander hub gates it (`src/app/(site)/c/[slug]/page.tsx` about line
  243); the leader hub (`src/app/(site)/l/[slug]/page.tsx` about line 207) does
  not (LATER row 508).
- The new-deck address: `src/app/decks/new/new-deck-chooser.tsx` reads `?game=`
  and `?leader=` (an external key: Magic's oracle id, One Piece's card number)
  and opens a draft in `adapter.formats[0]`. Nothing is saved until the first
  edit. `leader` is latched once per mount (`useState(paramLeader)`, about
  line 47) and the editor seeds once, so a client-side move between two
  `/decks/new…` addresses never changes the commander; `game` re-latches, so a
  cross-game move changes half the editor; and from the picker (no `?game=`)
  the move opens an editor with no commander. `/decks/` is disallowed in
  `src/app/robots.ts` and `/decks/new` is noindex, and the hubs carry the same
  plain anchor: add no `rel` and leave robots alone.
- The collection page (package 2): `src/app/(site)/collection/page.tsx` picks
  the format a new deck opens in as `findFormat(game,
  adapter.formats[0].code)` (about line 169), and its commanders' names link
  to their card pages, so a collector lands on the page this package changes.
- The card page: `src/app/(site)/cards/[id]/page.tsx`. `force-dynamic`, kept by
  the CDN through `next.config.ts`'s `CDN-Cache-Control` on `/cards/:id` (fresh
  an hour, served stale for up to a day), pinned by
  `src/app/(site)/isr-budget.test.ts` (which imports the page module in node;
  the island is safe there) and `src/lib/next-config.test.ts`. It reads no
  session. `getCard` (`./card.ts`) loads `identity` (with `isLeaderCandidate`,
  `externalKey`, `isPreview`, `isRemoved`), `formatRows` (the game's `formats`
  rows, with `id` and `code`) and `legalityRows` (current, unconditional rows
  only: conditional rows are dropped in SQL, and a unique index allows one row
  per format and card). The Legality chips are the `<li>`s of one `<ul>` (about
  lines 192 to 205), with `<PrintingsTable />` right after it. There is no
  `page.test.tsx` beside the page.
- The header's search: `src/components/search/header-search.tsx` mounts
  `NameSuggest` (`scope="cards"`, rows link to `/cards/<id>`,
  `footerNoun="card"`, `fallback`, `onAnswer`, `examples`) inside a GET form to
  `/cards`. `isEditorPath(pathname)`, exported there and already read as
  `onEditor`, is true for `/decks` and everything under it, the picker
  included; the share page `/d/<id>` is not an editor path. The file must not
  import the adapter registry (its docblock says why) and keeps its per-game
  facts in constants (`OTHER_GAME`, `GAME_NAMES`). Its tests' `row()` defaults
  `isLeader: false`.
- `src/components/search/name-suggest.tsx`: `Entry` is `SuggestRow`, `FOOTER`
  or `ExampleEntry`; `entries` is the examples, or the rows plus the footer.
  Each entry is one `AutocompleteItem`. After the example and footer branches
  the render chain falls through to the row's branch, keyed by `entry.id`: with
  `onPick` set (the component's own "pick mode") a plain option, otherwise the
  row's `Link`. Rows and examples use `prefetch={false}`; `itemToStringValue`
  has a case per kind; `rowGame = answer?.game ?? game` is the game whose rows
  show (the other game's after a fallback); the status line counts rows only.
  The highlight is a position in the list: typing clears it, an answer landing
  does not. Its docblock and WAVE3.md (D0, about line 201) say the popup shows
  at most 8 rows. Its tests' `row()` defaults `isLeader: true`, and several
  cases walk a fixed number of arrow presses. Five other callers:
  `/commanders`, `/leaders`, the `/cards` Name box
  (`src/components/cards/card-search.tsx`),
  `src/components/editor/opponents-field.tsx` and
  `src/components/profile/change-picture.tsx`.
- The dropdown's data: `src/lib/search/suggest.ts`. `SuggestRow { id, name,
  slug, isLeader, typeLine, colorsMask, ciMask, externalKey, image }` (WAVE3.md
  D2 records this list). `slimSelect(db)` is the select list and one join, with
  no WHERE and no game; three statements are built on it in `suggestPlan` (the
  One Piece card-number pass, the name pass, the near misses). A request runs
  one of the first two, and after the name pass alone the third, on a short
  answer to a long enough text. Banned commanders stay in the answer.
  `toSuggestRow` spreads the row. The route,
  `src/app/api/cards/suggest/route.ts`, sends `Cache-Control: public,
  s-maxage=3600, stale-while-revalidate=86400` and spends the caller's
  `cardSuggest` bucket first (120 a minute, 2,000 an hour per address). Its
  test runs the real query builders over a fake client that answers with rows
  given BY POSITION in the select's order, and no test executes SQL. Two of its
  cases pin text the new column must avoid: no `is_leader_candidate" = ` in a
  cards-scope statement (about line 149) and no `CASE` in the card-number pass
  (about line 237). `suggest.ts` has no unit test of its own.
- The results grid: `src/components/cards/card-search.tsx`. `buildUrl` makes
  the grid's request and, with `mostPlayed`, the set strip's. A grid tile
  (about lines 608 to 619) is an image inside a link to the card page; nothing
  sits under a tile today. The strip's tiles (about lines 572 to 579) are the
  same shape, 4 to a row, 6 from `sm`, 12 from `lg`. The client type
  `SearchResult` declares `id`, `name`, `image`, `popularity` and `printingId`,
  though the route sends more. `GRID_CLASS` is 2 columns with `gap-3`, 3 from
  `sm`, 4 from `md`, 5 from `lg`; at 320 px a tile is about 138 px wide. A page
  is 60 cards. The file already imports `getAdapter`.
- The search route: `src/app/api/cards/search/route.ts`. Every row already
  carries `externalKey`, `isLeaderCandidate`, `isPreview` and `legality: []`.
  With `format=<code>` (`findFormat`; an unknown code is a 400) and a page that
  has rows, it runs one more statement (`fetchLegalityMap`,
  `src/lib/decks/legality.ts`) and fills `legality` with the card's current
  rows: `{ status }`, plus `condition` when the row has one. Nothing else in
  the answer changes. It sends `Cache-Control: public, s-maxage=300,
  stale-while-revalidate=3600` either way and spends the `cardSearch` bucket
  (120 a minute, 2,000 an hour). `src/components/cards/card-search.test.tsx`
  pins request addresses exactly (the grid's at about lines 94, 131, 152, 251,
  295, 314, 330, 339, 346 and 386; the strip's at 252 and 317) and finds
  requests by the prefix `/api/cards/search?game=mtg&limit=60`. Its shared
  `results()` builder emits no leader candidate, and several cases count
  links.
- Formats and nouns: two formats are seeded (`src/db/seed-data.ts`, a file with
  no imports), Magic's `commander` (`FORMAT_ID.commander`) and One Piece's
  `standard` (`FORMAT_ID.optcgStandard`), both defaulting to `legal`. The game
  ids and the format ids are the same two numbers. `leaderNoun` is "Commander"
  and "Leader". One Piece's adapter declares `display.idBadge` (the card
  number), which takes the whole card: its leaders share names (142 leaders
  across 77 names when P4.4 measured in 2026-09).
- The legalities table has a unique index, `leg_current_uncond`, on format and
  card for current unconditional rows (`src/db/schema.ts` about line 250). It
  serves the new column's probe.

ORDER OF WORK
Step 0, steps 1 and 2, the split point, steps 3 to 5, VERIFY, then the gate.
Build on the defaults. Nothing waits for an answer, because every open point is
small to change afterwards (the gate says what each change is). Before the gate,
stop only for one of step 0's stops, for step 3's cost bar, or for a difference
THE CONTRACT says to stop for.

BUILD
0. Before any code, on the dev branch only. Scratch scripts go in
   `scripts/.tmp/`; one that opens the database calls `guardDatabaseUrl`
   (`scripts/smoke/db.ts`) right after the env load; one that calls the local
   server imports `../smoke/guard` first. They are linted: keep them clean
   while they live and delete them before the last `pnpm check`.
   a. Counts and examples. Per game: the leader candidates; how many have a
      current, unconditional row in the game's format, by status (`restricted`
      among them); how many are previews; how many are removed; for One Piece,
      how many leaders share a name today. Record the ids of: Atraxa,
      Praetors' Voice; Golos, Tireless Pilgrim (expected banned); a partner;
      Esika, God of the Tree (double-faced, " // " in its name);
      Asmoranomardicadaistinaculdacar (one unbreakable word); a preview
      commander if the branch has one; a removed leader candidate if there is
      one; a Background; a token; Sol Ring; two One Piece leaders that share a
      name; OP03-040 and ST10-001 (leaders banned outright, per
      `data/optcg/legalities.json`); OP11-040 (a leader with a pair ban only).
   b. What the editor says when a preview commander is seeded
      (`src/lib/games/mtg/validate.ts` about line 95), for the gate.
   c. Baselines, from one production build of the starting commit, each saved
      to a file: `pnpm build`'s route table; the script weight of `/privacy`,
      `/cards` and Atraxa's card page (each page's `<script src>` files,
      gzipped and summed; REDESIGN.md's HEADER-SEARCH record has figures for
      `/privacy` and no method, so record yours); the pass counts of
      `pnpm smoke:hubs`, `pnpm smoke:seo`, `pnpm smoke:optcg` and
      `pnpm smoke:games`.
   Step 0's stops, each shown to the owner before any code: a restricted
   leader candidate in 0a; a file, export, prop, statement or test pin named in
   WHAT EXISTS that is not there. A count or a line number that has moved is
   not a stop: record the new figure.
1. The rule, written once. A pure helper with its own test, in a module that
   does not import `@/db`: the grid is a client component, and six tests
   replace `@/lib/hub/queries` with mocks that list their own functions, among
   them `src/app/(site)/isr-budget.test.ts`, which imports the card page.
   - It takes the leader flag and the card's unconditional status, or none.
   - The same module exports the format a game's new deck opens in (for
     example `leaderFormat(game)`, the game's first row of `FORMATS` in
     `src/db/seed-data.ts`). The card page, the grid and step 3 all take the
     format from it. The helper's test pins, for both games, that its code is
     `adapter.formats[0].code` and its `defaultLegality` is `legal`.
   - Use the shared word in every name: leader. "commander", "partner" and
     "Background" never enter core code or core strings; the one game noun
     comes from `adapter.display.leaderNoun`.
   - One fixture of cases pins the helper, the page and the grid: no row and
     `legal` (a build action); `banned`, `not_legal` and `restricted` (none);
     a card that is no leader candidate (none). It holds what each caller
     receives. The grid also gets a `banned` entry that has a `condition`,
     which must not block. The page never sees one, because `getCard` drops
     conditional rows in SQL.
2. The card page. When the rule passes and the identity is not removed, render
   `HubBuildCta` with no `autofill`, in a row of its own directly under the
   chips' list and above `<PrintingsTable />`, in the wrapper the hubs use,
   never inside the `<ul>`. `game` is the page's game code, `leaderKey` is
   `identity.externalKey`, and the label is
   `Build with this ${adapter.display.leaderNoun.toLowerCase()}`, which gives
   the two hubs' sentences. The status is `statusByFormat.get(row.id)` for the
   `formatRows` row of the helper's format. With no `formatRows` row for that
   format, no button. With that row found and no legality row for it, the rule
   passes. No session read, no new statement. The caching intent is unchanged:
   say so in the page's docblock. In `hub-build-cta.tsx` and
   `leader-pick-intent.ts` change the docblocks only (a second host and new
   readers, the moved smoke lines), no markup and no prop.
   The page's tests. `src/app/(site)/c/[slug]/page.test.tsx` is the precedent
   for the real page with its loaders mocked (here `./card`'s `getCard` and
   `@/lib/combos/queries`); it renders in node. The pick needs sessionStorage,
   so the "Use for" case renders the awaited page in jsdom, the default
   environment (`src/app/(site)/commanders/page.test.tsx` renders an awaited
   page there): a second file, or the whole page test in jsdom, where
   `renderToString` still reads the null server snapshot. Two traps in the
   HTML: adjacent text is split ("Commander<!-- -->: <!-- -->legal") and an
   href holds `&amp;`. Any test file that stores a pick clears sessionStorage
   before each case, as `hub-build-cta.test.tsx` does: the store also keeps its
   last value in the module.

THE SPLIT POINT
The card page is half of the owner's ask and ships alone. When step 2 is green
(its tests, its mutations, its pane read), write down what is left and decide.
Carry on unless the conversation has been summarized more than once by then, or
steps 0 to 2 took a detour that steps 3 to 5 will repeat. If you close here:
- Part A is step 0 and steps 1 and 2: acceptance 1, 2, 7 and 16 and the
  card-page halves of 3, 8 and 15; the card page's mutations; the route table,
  Atraxa's page weight, and the hubs, seo and optcg smokes; the card page's
  pane walk and the edge cases; gate point 2 and the card-page side of point 1.
  LATER row 508 is reworded for the card page alone, 506 and 507 stay
  "planned", and the as-built section names the helper's home.
- Part B is steps 3 to 5 with everything else, offered to the owner at part A's
  gate as the next session's package on this same prompt.
A second cut is possible after step 4: the dropdown without the grid.

3. The dropdown's data. First the cost, with the candidate column in a scratch
   script: EXPLAIN ANALYZE the suggest statement with and without it for five
   texts ("atraxa", "golos", "sol", a One Piece card number, one near-miss
   text), five runs each. If the column adds more than 5 ms at the median for
   any of them (this prompt's bar, not the plan's), stop before building it and
   show the owner: decision 15's other side needs no data change. Time
   `fetchLegalityMap` over a 60-id page for three searches; that figure is for
   the record only. Then:
   - `SuggestRow` gains one optional member, present only on a leader-candidate
     row that fails the rule, so every other row has exactly its nine keys.
   - It is one more selected COLUMN in `slimSelect`, never a WHERE condition: a
     banned commander's row stays in the answer and carries the member.
     `slimSelect` gains the game as a second parameter, passed at its three
     call sites, so all three statements carry the column.
   - Select it last, after `imageOverride`, because the route test feeds rows
     by position.
   - Write it as a bare `EXISTS` over `legalities` (the card, the format's id
     from step 1's function, `effective_to IS NULL`, `condition IS NULL`, a
     status other than `legal`), with no `CASE` and no
     `"is_leader_candidate" = `. Test the leader flag in `toSuggestRow`, which
     takes the raw column out and adds the member only when the row is a
     leader candidate and the column is true.
   - Export the column's builder from `suggest.ts`, as `suggestPlan` is
     exported for EXPLAIN.
   - No test executes SQL, so pin the statement twice. In the route test: the
     text holds `format_id = $n`, both IS NULLs and the status test against
     `legal`, and the parameter at that `$n` is `FORMAT_ID.commander` in a Magic case
     and `FORMAT_ID.optcgStandard` in a One Piece case (the game ids are the
     same numbers, so a `toContain` on the parameters proves nothing); a legal
     commander's row whose column is false, a non-leader's row whose column is
     true and Sol Ring's row each answer exactly the nine old keys; a banned
     commander's row answers ten; the existing cases stay untouched. On the dev
     database: a scratch script selects the card's id and the exported column
     for every leader candidate of each game, never a retyped copy, and
     compares it with the helper fed the same card's current rows. Record "N of
     N agree" and how many were true, per game; if One Piece has none, say its
     count proves nothing and why. Keep the script until the gate is answered.
   - Update `suggest.ts`'s header, the route's docblock and `NameSuggest`'s.
     `scope=leaders` answers gain the member on such rows too; the
     `/commanders` and `/leaders` boxes ignore it.
4. The dropdown's entry. `NameSuggest` gains one opt-in prop, off for its five
   other callers. With it on for the game whose rows show (`rowGame`), and the
   top row a leader candidate without the member, `entries` gains one entry
   directly after that row.
   - A shape that works for the prop:
     `buildEntry?: Partial<Record<SuggestGame, { withKey: boolean }>>`. A game
     is present when its top row may get the entry, and `withKey` puts the
     row's `externalKey` in the words. `NameSuggest` reads
     `buildEntry?.[rowGame]` and names no game. `HeaderSearch` builds it from a
     constant beside `GAME_NAMES` (Magic without the key, One Piece with it),
     leaves a game out while a pick is pending for it (two `usePickIntent`
     calls, one per game), memoises it, and passes nothing on an editor path.
     On editor paths the link would not work (the latch) and the picker cannot
     be told from a draft.
   - The entry is its own kind in the `Entry` union, with its own discriminant,
     a render branch ahead of the rows', a key of its own (not the row's id),
     an `itemToStringValue` case that returns the current text as the footer's
     does, and a stable identity: memoise it on the answer and the prop's value
     for `rowGame`.
   - It is an `AutocompleteItem` rendered as a `Link` (`prefetch={false}`) to
     `/decks/new?game=<rowGame>&leader=<externalKey>`. It reads "Build with
     <card name>", and with the key "Build with Monkey.D.Luffy (OP01-003)". A
     plain click closes the popup, as on a row.
   - It never shows among the examples, nor when `onPick` is set (the
     component's own pick mode, which has nothing to do with a pending
     commander pick). The status line still counts rows only, as it does with
     the footer.
   - The whole name is always readable: its words sit in a span with
     `min-w-0 wrap-break-word`, as the footer row's do, never cut off. Give it
     an icon in the thumbnail's column that is not the search glass
     (`ExampleBody` is the precedent) and name it in the record.
   - An answer that lands under a highlight. Write the case: highlight the
     second position, land an answer whose top row is a legal leader, and read
     which option is highlighted and where Enter goes. If Enter would follow
     the build entry, clear the highlight when an answer lands, if the wrapped
     component gives a way that keeps its other rules. If it gives none, pin
     the behaviour as it is, add a LATER row, and bring the entry's place to
     the owner as a fourth gate point (directly under the top row, or last
     above the footer).
   - Neither file imports the adapter registry. The header's server HTML does
     not change: the pick reads null on the server.
5. The results grid.
   - The grid's request, not the strip's, gains `format=<code>` from step 1's
     function, appended after the params it has, so the tests' prefix lookups
     keep working and only the exact pins change. State the fetch's caching
     intent in the file's docblock: the same header, a new CDN key that starts
     cold, one more statement on an uncached page that has rows.
   - Type the grid's rows as `CardWire` (a type-only import from
     `src/lib/decks/editor-state.ts`, as the editor's search pane does) plus
     `printingId`: `idBadge` takes the whole card. The helper gets the entry of
     `card.legality` that has no `condition`, or none.
   - Each grid tile whose card passes the rule gets one link under its image,
     inside the same `<li>`, to `/decks/new?game=<game>&leader=<externalKey>`,
     with `prefetch={false}` (`src/components/combos/combo-list.tsx` about line
     78 is the precedent: a page holds up to 60 of them).
   - Its words are one string, the header entry's: "Build with <card name>",
     with the card number in brackets where the adapter has `idBadge`. The
     accessible name is that string. The plan's form shows all of it, wrapped.
     The short form shows "Build" and keeps the rest for screen readers only,
     with the space inside the hidden span. Build both in a small exported
     link component that takes the form as a prop, with one constant in
     `card-search.tsx` choosing the plan's form. The grid test renders both and
     asserts for each that the link's name begins with its visible words, word
     for word. Measure the plan's form at 138 px for step 0a's names. After the
     owner answers gate point 3, delete the form that lost, its test and the
     constant.
   - The link is a block of its own under the image. On coarse pointers it is
     `pointer-coarse:flex pointer-coarse:min-h-11 pointer-coarse:items-center`
     with no negative margin (the start doors' recipe at
     `new-deck-chooser.tsx` about line 168, with `inline-flex` made `flex`),
     and its words sit in a span of their own, `min-w-0 wrap-break-word`:
     without the span the longest word sets the link's width on touch. The row
     grows by the link's height. `EXAMPLE_LINK_CLASS` in the same file is not
     the recipe: its negative margins would lay the link over the card's own
     link and the next row.
   - The strip's tiles get none. Without `format` every row answers
     `legality: []`, which the rule reads as legal, so do not draw the strip
     through the grid's tile.
   - No links while a pick is pending for the grid's game.
   - The tile's image stays unoptimized, as it is. "Load more" pages and
     set-scoped tiles behave the same. Tab order becomes image, build, next
     image: up to 120 stops on a page of 60 commanders, accepted and written
     into the record.
   - In `card-search.test.tsx`, rewrite the grid's exact pins, leave the
     strip's, and put the new cases' rows in a builder of their own: the shared
     one feeds cases that count links.

AT THE GATE (after VERIFY; one sitting, two asks, nothing pushed in between)
First ask. Show the three surfaces from the pane and the hand-over list. Name
decisions 13 and 14 as standing and what a flip costs (three strings; one
prop). Then put these points to the owner in one question, each with what is
built marked as recommended:
1. Decision 15, with step 0a's counts by status and game. Built: a banned or
   not-legal commander gets no build action. Its other side: search offers the
   action anyway and the editor flags the commander. That takes out step 3's
   column and the grid's `format=`, changes the grid's request pins back, and
   makes these lines false, to be corrected: acceptance 3's dropdown and grid
   halves, 11, and 15's "no link"; the member's mutations; the production
   read's "carries the member"; LATER row 508's wording; the record's
   stale-window note.
2. Preview commanders, with their count and step 0b's finding. Built: they get
   the build action on all three surfaces, as their hubs give it today. Its
   other side: `isPreview` joins the rule. That is a third input to the helper
   with its fixture case, `ci.is_preview` inside step 3's column with its text
   pin, acceptance 16's second sentence reversed, and a line in the record that
   the commander hub still offers the button for a preview.
3. The words under a results tile, with the measured line counts and both
   forms in screenshots. Built: the plan's form. Its other side: the short
   form.
Between the asks, in this order. Build any flip as its own commit with its
tests, and take out the words' form that lost (step 5). Run the route table,
the smokes and step 3's agreement script again. Write the record files
(RECORD). Delete the scratch scripts. Run `pnpm check` last, then commit the
records.
Second ask. The ship question, reading out every commit the push carries. A
commit made after the owner's word needs the word again.

SCOPE FENCE
- LATER rows 506, 507 and 508 hold this package's fence and stay open with
  their triggers. In 506 and 507 add ", built <date>, the commit after
  `<your start>`" after "planned 2026-11-24", as rows 501 to 503 read; the
  ship note writes the hash, as `f99c662` did. In 508 change "is planned to
  apply" to "applies".
- New rows, at the end of the file:
  - Search offers no build action while a pick is pending. A richer form would
    have the entry read "Use for “<deck>”", as the hub's first button does. A
    pick that was abandoned also hides the action for up to 30 minutes.
    Trigger: a player in the middle of a pick asks for the shortcut, or the
    owner asks.
  - The picker gets no entry. Trigger: a player on the picker searches for a
    commander in the header.
  - The set strip's tiles get no build links. Trigger: a player asks for one
    there, or the owner does.
  - "Use for “<deck>”" does not wrap, and a deck name may be 120 characters,
    so the button can run past a phone's column on the card page and on the
    hubs alike. Trigger: the next change to the island.
  - The rule has three homes: this package's helper, the commander hub's page
    and the collection page's read. Trigger: the next change to the rule, or a
    leader candidate that gets a `restricted` row.
- For the REDESIGN.md record, not rows: a ban reaches the card page's button
  and the dropdown up to about a day late (fresh an hour, served stale up to a
  day) and the grid up to about an hour late (five minutes fresh, an hour
  stale), because the CDN keeps all three, and the editor flags a banned
  commander at once; the header's popup now holds up to 8 rows, the entry and
  the footer, which amends WAVE3.md's D0, and the row's member amends D2.
- "Start with a starter shell" stays on the hub (decision 14). Only the top
  suggestion gets an entry (row 506). A second commander is still added from
  the editor's search (row 507).
- Not touched: the hub pages and their markup; `src/components/editor/**`; the
  Autofill route and sheet; `src/lib/recommend/**`;
  `src/components/auth/account-slot.tsx`; `src/app/robots.ts`; the search
  route's file; the `/commanders` and `/leaders` pages; the collection page
  and `src/lib/collection/**`; `src/app/decks/new/new-deck-chooser.tsx`. No
  pin in `src/components/site-header.test.tsx` should have to change: if one
  does, say so in the hand-over list.

ACCEPTANCE (what a person sees, then the check that proves it)
1. On Atraxa, Praetors' Voice's card page, "Build with this commander" sits in
   its own row under the Legality chips and above the printings. It opens a new
   deck showing her as commander and "1 / 100", and no deck is saved until an
   edit. (Page test: the server HTML holds exactly one anchor to `/decks/new`,
   with `game=mtg` and her key, after the chips' list and before the printings
   table, and holds neither "Start with a starter shell" nor `autofill=1`. The
   browser pane for the new deck, whose network log shows no POST to
   `/api/decks` before the first edit. The owner's walk-through after the
   deploy.)
2. Sol Ring's page has no build button, although "Commander: legal" shows.
   (Page test.)
3. A banned commander has no button on its card page, no build entry in the
   dropdown and no link in the grid. (Page and grid tests on the shared
   fixture; a `NameSuggest` case whose top row is a leader candidate carrying
   the member: no entry; step 3's route cases and agreement count; the pane,
   with the banned commander typed in the header.)
4. In the header's search, "atraxa" offers the build entry second in the list;
   arrow down twice and Enter opens the new deck, and the box keeps its text
   while the entry is highlighted. "sol ring" offers none. Enter with nothing
   highlighted still submits the form. A plain click on the entry closes the
   popup. The status line counts the rows, not the entry. (`NameSuggest` and
   header tests; a keyboard walk in a real browser.)
5. From a Magic page, a text that only One Piece answers offers a One Piece
   build entry whose words carry the card number, and it opens a One Piece
   deck. (Header test, both directions: from a Magic page, a One Piece answer's
   entry is the option named "Build with <name> (<card number>)" and links
   `/decks/new?game=optcg&leader=<card number>`; from a One Piece page, a Magic
   answer's entry has no number and links `game=mtg`.)
6. On `/cards?q=atraxa`, each legal commander's tile has its build link and no
   other tile has one. (Grid test.)
7. The card page is the same for everyone, signed in or not. (Page test:
   `@/lib/auth` and `next/headers` mocked with spies that throw; a commander's
   page and Sol Ring's both render, no spy was called, and the server HTML
   never holds "Use for". `src/app/(site)/isr-budget.test.ts` and
   `src/lib/next-config.test.ts` untouched.)
8. A player who came from a saved deck's "Browse commanders" also sees "Use for
   “<deck>”" on the card page, linking that deck's editor with the leader's
   key, and a pick for the other game adds nothing. While that pick is pending
   the dropdown offers no build entry and the grid no build links for that
   game. (The jsdom page test after `writePickIntent`. Header test, both
   directions: with a Magic pick on a Magic page, "atraxa" offers no entry and
   a text only One Piece answers still offers its entry; with a One Piece pick
   on a Magic page, that One Piece answer offers none. A grid case.
   `src/components/hub/hub-build-cta.test.tsx` untouched.)
9. On every `/decks…` path, the picker included, the header's search offers no
   build entry; on a share page `/d/<id>` it does. (Header test.)
10. The five other boxes are unchanged. (The existing cases of their tests pass
    untouched; in `card-search.test.tsx` only the grid's request addresses
    change; new `NameSuggest` cases: without the prop, a top row that is a
    legal leader adds no entry; with the prop and `onPick`, none either.)
11. A row keeps exactly its nine keys unless it is a leader candidate that
    fails the rule, and then it carries the member. (Step 3's route cases; the
    statement counts already pinned.)
12. The set strip asks what it asked before; its tiles keep their card links
    and get no build links. (Grid test: the strip's pins untouched, and one new
    case, a strip row that is a leader candidate has no build link.)
13. The hub pages are unchanged. (The four smokes at their baseline counts.)
14. The entry is an option in the listbox with its words as its name. Every
    build link's name begins with its visible words, and no two build links on
    a results page share a name, on a Magic search and on a One Piece one.
    (The browser's accessibility tree; the grid test for the names.)
15. A One Piece leader's card page says "Build with this leader" and links
    `game=optcg` with the card number as the key; OP03-040 has no button and
    no link; OP11-040, with a pair ban only, has both. (Page and grid tests.)
16. A removed commander's card page has no button, and neither has a card whose
    game has no row for the helper's format. A preview commander's has the
    button, unless the owner says otherwise at the gate. (Page test.)

VERIFY
- `pnpm check`, with the tests named above and new files for the helper and the
  page.
- One-line mutation checks, each caught by a test. The card page: drop the
  rule; drop the removed check; pass `autofill`. The data: drop the member in
  `toSuggestRow`; add the member to a non-leader; give One Piece Magic's
  format; test the status against `banned` alone; count a conditional row as a
  ban; let a `restricted` row pass. The entry: offer it for the second row; turn the
  prop on for an editor path; ignore the pending pick in the header; read the
  pick by the page's game; build the link from the page's game in place of
  `rowGame`; take the card number from the page's game. The grid: send `format`
  on the strip's request; draw a build link on a strip tile; ignore the pending
  pick; give a tile's link to a card that is no leader candidate.
- `pnpm build` (remove `.next` first if a dev server ran): the route table is
  the starting commit's. Report step 0c's three script weights before and
  after. A kibibyte or two on every page is this prompt's expectation, not a
  rule of the plan (the header now reads the pick): name what grew in the
  hand-over list. The adapter registry reaching the header's scripts, which
  would show as tens of kibibytes, fails this check: take the import out.
- `pnpm smoke:hubs`, `pnpm smoke:seo`, `pnpm smoke:optcg` and
  `pnpm smoke:games` against the local production build, at their baseline
  counts. `smoke:hubs` asks the suggest route six times and pins its cache
  header; `smoke:optcg` asks it for the card-number pass and asks the search
  route with `format=standard`; `smoke:games` asks it in both scopes. They read
  the answers by the keys they need, so the new member breaks none. Their
  requests count against the same 120 a minute per address as any scripted
  walk: never retry a 429.
- The browser pane, which needs no sign-in for these pages, at 320, 390, 768
  and 1280 px, with the dark theme read once at 390 px: the card page's row
  (with and without a stored pick whose deck name is 60 characters), the
  dropdown's entry, the grid's links. With touch, under 768 px: targets are
  44 px, no two targets in a tile or in neighbouring rows overlap, a tap on the
  bottom edge of a commander's image opens its card page, no focus ring is
  drawn over an image's artist line, and nothing scrolls sideways
  (Asmoranomardicadaistinaculdacar in the right-hand column and the
  double-faced name are the test). One accepted exception: "Use for “<deck>”"
  with a long deck name, which is the island's and is recorded, not fixed here.
  The traps for this harness are in the project memory:
  `browser-pane-hidden-input`, `w4-qa-gotchas`, `search-examples-live`,
  `header-search-live`, `pane-preview-other-commit`.
- A walk that types through a change of top row at phone width ("sol", then
  "solp"): record how far the rows move when the entry appears.
- The phone header in the iOS Simulator with the keyboard up and "atraxa" typed
  (iPhone 15, Mobile Safari, localhost; HEADER-SEARCH-session-prompt.md and
  REDESIGN.md's SEARCH-EXAMPLES record are the precedent, and HEADER-SEARCH
  read eight rows over the keyboard): the top row and the entry are in view and
  the footer is still reachable. Booting the Simulator asks the owner for
  access: ask once, and if it goes unanswered, record the read as not taken.
- Edge cases, each read in the pane: a partner (one commander is placed), the
  double-faced commander, the preview commander, a Background and a token (no
  button), a One Piece leader.
- After the deploy, on the owner's OK, a read of production: Atraxa's card page
  holds the anchor and the banned commander's does not; the suggest answer for
  the banned commander carries the member and OP03-040's does too; the three
  cache headers are what they were; the entry's words are in a script under
  `/_next/static/immutable/chunks/`. Then the owner's own walk-through: the
  header's search, the entry, the card page's button.

THE HAND-OVER LIST (shown at the gate's first ask)
Where the button sits on the card page (the owner said "next to"; it is in its
own row under the chips) and how far down a 390 px phone that is. Only the top
suggestion gets an entry. An entry and links stand where the owner said "a
small button". None on the set strip. One Piece words carry the card number,
which amends decision 13's words. No entry in an editor or on the game picker.
A removed card has no button. Search goes quiet while a pick is pending. The
entry's place and what it costs: the rows under it move, and what Enter does
when an answer lands under a highlight. The tab stops on a page of commanders.
The script weights. Any site-header pin that changed.

RECORD
Write the record files after the gate's first ask is answered and any flip is
built, before the ship question. `git fetch`; then read
`git log --oneline main..origin/main` (pushed by another session) and
`git log --oneline <your start>..main` (merged locally); rebase onto whichever
is newer and re-read LATER.md's last rows, so the row numbers you write are the
ones that land.
- REDESIGN.md: one section in the form of the three before it (OWNED-FILTER,
  AUTOFILL-OWNED, "The collection page"). It holds step 0's figures; step 3's costs, "N of N agree"
  and how many were true; the weights and how they were taken; the Simulator
  read, or that it was not taken; how far the rows move and the highlight case;
  the icon; the tab stops; which checks proved acceptance 8; and the notes
  listed in the fence.
- `OWNER-NOTES-2026-11-24-session-prompt.md`: a Progress line in the header,
  and above "Context" a section in the form of "Package 2: COLLECTION-PAGE, as
  built". It says where the build differs from this prompt, then what a later
  session needs to know (the helper's module and names, the exported column in
  `suggest.ts`, the per-game prop, the rule's three homes, LATER.md's last
  row).
- This file: commit it with the record as `COMMANDER-DOOR-session-prompt.md`
  at the repository's root, where the repository keeps each brief, with its
  status line brought up to date, so a later session can read what the build
  was measured against. Run the formatter on it and change nothing else in it.
- LATER.md: rows 506 to 508 amended, new rows appended.
- A ship note once it is live, which also updates the header's Shipped line
  (added by `f99c662`, amended by `7431ec0`).
