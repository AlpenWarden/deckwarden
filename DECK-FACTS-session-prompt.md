# DECK-FACTS session prompt (2026-11-26): two counted facts about the whole list in the deck's statistics

*Status: **built 2026-11-26** as `6bbc729` on `claude/magical-noether-d85adb`, by the session that wrote this brief as its step 0, from the sketch in `OWNER-NOTES-2026-11-24-session-prompt.md` ("What follows the build", "DECK-FACTS (idea 2), S for the code and M with its measurement") and the task the owner's planning session gave it. The branch was moved onto `35511d0` before the commit (a docs commit another session put in local `main`: the owner's signed-in tries of the deck total and the Maybe list), and after the build and the pane reads it was rebased onto `a8b65ec` (FIRST-LIST, another session's package, in local `main`); the feature was `605ac8b` before that rebase. The record is REDESIGN.md, "Two counted facts about the list in the deck's statistics", and "DECK-FACTS, as built" in the OWNER-NOTES file, which lists where the build differs from this brief. Below this line the brief is as written at step 0 (run 2026-11-26 about 15:56 Z), with the owner's answers added under THE DECISIONS (the default on both, 16:03 Z). Anchors were verified at `4deaf70` (`main` = `origin/main` then): re-grep line numbers, trust the shapes.*

One Deckwarden work package, one session. Read CLAUDE.md and AGENTS.md first.
No route, no migration, no new field in the game contract: both facts are two
more `stat` blocks from Magic's `analyze`, drawn by the renderer that already
draws every block.

THE CONTRACT
`OWNER-NOTES-2026-11-24-session-prompt.md`: the DECK-FACTS sketch under "What
follows the build", that file's "Idea 2: a metric of how fun the deck is" and
its line on DECK-FACTS under "MAYBE-LIST, as built"; LATER.md row 498 (this
package), row 480 (the reader's blind spots; annotate it with the type tile's
limit), and rows 499 and 500 (a score and a per-game rating, which stay
deferred). This prompt adds what the sketch leaves to the builder: the anchors
found again in today's code, step 0's figures, and what the tiles do at their
edges.

START STATE
- `main` = `origin/main` = `4deaf70` (2026-11-26, after MAYBE-LIST's
  amendment and its ship note). Nothing waits to be pushed.
- Branch `claude/magical-noether-d85adb`, worktree
  `.claude/worktrees/magical-noether-d85adb`, with the `.env.local` symlink
  (the dev branch).
- LATER.md ends at row 551 (row numbers are line numbers). Re-read `git log
  origin/main..main`, the end of LATER.md and the project memory index right
  before writing the records: other sessions may land on `main` meanwhile.

THE ASK (the owner, 2026-11-24, as given)
"Also it's subjective but if you could find out a way to have a metric of how
fun the deck is, cause i'd rather have a fun deck than a boring one even if
it's better"
Their answer the same day: fun means facts about the list. Not a score, not a
rating per game, not a theme-first setting (rows 499, 500 and 481).

WHAT EXISTS (anchors at `4deaf70`)
- Magic's analysis: `analyzeMtg` (`src/lib/games/mtg/analyze.ts:44`), pure,
  run by the editor on every edit (`deck-editor.tsx:2542`) and by the share
  page (`deck-share-view.tsx:358`). It gets `toDeckSnapshot`'s playable list
  (`src/lib/decks/validation.ts:35`): Tokens and Maybe are left out there, so
  a Maybe card is out of both facts by construction. It already counts
  nonland cards (`primaryType !== "Land"`) for the curve and "Avg. mana
  value" ("Nonland cards"), the commander included.
- The rank: every `CardData` carries `popularity`, which for Magic is
  Scryfall's EDHREC rank (`src/db/schema.ts:137`), on every wire the editor
  and the share page load (`src/lib/cards/wire.ts:38`,
  `src/lib/decks/deck-cards-wire.ts:56`, the search route). The site calls a
  card at rank 2,000 or better "A Commander staple in EDHREC decklists"
  (`STAPLE_RANK`, `src/lib/games/mtg/recommend.ts:42` and `:162`).
- The theme reader: `mtgThemes.read` (`src/lib/games/mtg/themes.ts:213`),
  strongest first. Suggestions read it on the server through `readThemes`
  (`src/lib/recommend/engine.ts:417`, `snapshotThemes`: copies summed per
  card, each commander read once as a leader, over the playable list since
  DECK-TOKENS, `engine.ts:530`), and the Cut Coach in the browser through
  `themesOfList`. A Suggestions row's number is the theme's `count`
  (`themes.ts:292`: "Shares the Vampire type with 27 of your cards", or for a
  type the commander names, "27 of your cards share it"). It reads type words
  only, so it finds no type on 85 of the 182 precon rows (row 480).
- The drawing: `AnalyticsBlocks` (`src/components/deck/analytics-blocks.tsx`)
  gathers every `stat` block into one wrapping row (title, value, a quiet
  hint) and needs no change. It draws in the editor's closed "Analytics"
  collapsible (`deck-list-pane.tsx:723`), the phone's Analytics tab
  (`deck-editor.tsx:2966`) and the share page's Analytics section
  (`deck-share-view.tsx:831`). The stat row today: Avg. mana value, Lands,
  Est. price.
- The player's own answer to "Staples and high card quality?"
  (`MTG_BRACKET_QUESTIONS`, `src/lib/games/mtg/brackets.ts:306`) shows in the
  share page's Why sheet. It stays as it is; the count and the answer may
  differ, and both stay.
- One Piece's `analyze` is its own (`src/lib/games/optcg/adapter.ts:122`), and
  its popularity is NULL everywhere: nothing here touches it.

STEP 0: THE MEASUREMENT (dev branch, 2026-11-26)
Script `scripts/.tmp/deck-facts-step0.ts` (guarded with `guardDatabaseUrl`),
read-only. 182 precon rows, all Commander, 100 cards each in the commander and
main zones, 174 distinct lists (the reprints share one). Nonland cards per
list: 56 to 71, median 62. Unranked nonland cards: none in 172 lists, one in
two. The share of each distinct list's nonland cards at each rank or better:

| Rank or better | Median | 10th to 90th percentile | Cards, of about 62 (10th to 90th) | Spread against chance |
| --- | --- | --- | --- | --- |
| 100 | 9.5 % | 4.9 to 13.3 % | 3 to 8 | 0.87 |
| 300 | 15.1 % | 9.6 to 21.2 % | 6 to 13 | 1.12 |
| 500 | 18.4 % | 11.5 to 26.6 % | 7 to 16 | 1.23 |
| 1,000 | 26.6 % | 17.7 to 37.1 % | 11 to 23 | 1.47 |
| **2,000** | **38.2 %** | **23.8 to 53.3 %** (all: 11.5 to 70.8 %) | **15 to 34** | **1.82** |
| 5,000 | 61.9 % | 39.3 to 79.0 % | 24 to 50 | 2.52 |

"Spread against chance" is the shares' standard deviation over the one a
list would show if every list drew its nonland cards at the same rate (a
binomial at the mean share, 62 cards): 1 means the cut-off tells the lists
apart no better than chance. Ranks 100 to 500 put every precon under 40 %
and barely beyond chance; 2,000 spreads them across seven ten-point bins with
no pile at either end. **By the sketch's rule, rank 2,000 stays.** Rank
5,000 spreads the precons further, but crowds staple-heavy lists at the top:
on the dev branch's 50 full user Commander decks (mixed origin, test and
Autofill-built decks among them; aggregate figures only) a tenth sit at 97 %
or more at 5,000, where 2,000 runs 12 to 100 % (median 41 %). Newer precons
read higher (median 27 % for 2011 to 2014, 44 % for 2024 to 2026): the rank
counts EDHREC decklists, and a new precon's own cards ride its buyers' lists.

The type tile on the precons, through the same reader: a type on 93 of the
174 distinct lists (97 of the 182 rows); no type on 81 (85 rows, row 480's
figure). Two or more types on 21 of the 93 (Kaalia of the Vast: Angel 11,
Dragon 6, Demon 5, all named by Kaalia). No list's type count exceeds its
nonland count. Examples, as the tiles would read:

| Precon | Type tile | Staples tile |
| --- | --- | --- |
| Vampiric Bloodline (VOC), Strefan | Vampire cards: 34 of 63 | 16 of 63 |
| Vampiric Bloodlust (C17), Edgar Markov | Vampire cards: 27 of 63 | 24 of 63 |
| Blood Rites (LCC), Clavileño | Vampire cards: 36 of 63 | 30 of 63 |
| Breed Lethality (C16, CM2), Atraxa | none | 25 of 61 |
| Sliver Swarm (CMM), Sliver Gravemother | Sliver cards: 41 of 63 | 14 of 63 |
| Heavenly Inferno (CMD, CMA), Kaalia | Angel cards: 11 of 62 | 14 of 62 |

An edge, measured: 16 of the 182 rows hold an artifact land (Darksteel
Citadel, the Bridges, Seat of the Synod). Its primary type is Artifact, so the
analytics already count it as a nonland card (the curve, "Lands"), while the
theme reader skips every card whose front face is a land. Both facts keep the
analytics' own nonland count as their denominator, so "Lands" and "of N" add
up to the deck; an artifact land is in the "of N" and never in a type count.
Recorded as a LATER row, not changed (it is the analytics' existing land test).
The figures, the scripts and their output are in the side-session notes folder
`local_2dbb02ac-…`, `DECK-FACTS-evidence/`.

THE SHAPE (the sketch's, kept)
Two more `stat` blocks at the end of `analyzeMtg`'s list, after Est. price:
1. The type tile, id `deck-type`: title the type's word and "cards" ("Vampire
   cards"), value the count "of" the nonland count ("34 of 63"), hint "Nonland cards, by type
   line". The count is the first theme of `mtgThemes.read` over the snapshot
   (every playable card with its type line and copies; each card in the
   commander zone also as a leader with its name and rules text), the same
   read and the same input Suggestions makes on the server, so the tile's
   number is the number a Suggestions row of that type prints. No theme, or a
   count of 0, means no tile.
2. The staples tile, id `staples`: title "Commander staples", value "n of
   the nonland count", hint "Nonland cards in EDHREC's top 2,000". n counts the
   nonland cards (with copies) whose `popularity` is at `STAPLE_RANK` or
   better; a card with no rank is not counted. No nonland card means no tile.
Both denominators are the analytics' own nonland count (the commander
included), so "Lands" plus "of N" is the deck. The words live in one place in
the adapter, and a test bans "fun", "boring", "generic" and "score" in them.
No combined figure, no adjective, nothing new read from card text (the reader
already reads type lines and, for a type word only, the commander's text).

THE DECISIONS (put to the owner at the gate, with the figures)
The owner's answers, 2026-11-26 16:03 Z, in the build session's question
dialog: the default on both ("Keep 2,000", "Strongest type only").
1. The cut-off. Default: rank 2,000, as measured above, named "Commander
   staples". Flip: rank 5,000, named for its rank ("In EDHREC's top 5,000"),
   since the site's "staple" ends at 2,000.
2. A list with two or more types (21 of the 93 typed precon lists). Default:
   the tile names the strongest type only (the reader's first; Kaalia reads
   "Angel cards: 11 of 62"). Flip: the hint names the others with their counts
   ("Also Dragon 6, Demon 5"); overlapping types (Aura inside Enchantment)
   then read side by side.

BUILD
0. This file, uncommitted until the build is green.
1. `analyze.ts`: the two blocks and their words; the leader rows from the
   commander zone. Tests in `analyze.test.ts`: the counts on a typed list and
   on a list with no type; the Suggestions equality (the core's `readThemes`
   over the same rows gives the tile's count, and the row's evidence prints
   it); copies counted; lands, unranked cards and rank 2,001 left out; a Maybe
   card and a token change neither tile (through `toDeckSnapshot`); an empty
   list shows neither; the banned words; One Piece's blocks unchanged.
2. The share view and the editor need no code: one test each that the two
   tiles draw in their Analytics (the share page's, and the phone's tab).
3. Checks, the corpus check, the build, the pane, the records.

SCOPE FENCE (each a LATER row with its trigger)
- The artifact-land edge above.
- Any type past the first, if decision 2 keeps its default.
- A staples count that allows for a precon's own cards riding EDHREC's
  decklists (newer precons read higher).

ACCEPTANCE (what a person sees, then the check)
1. A Vampire precon's tile shows the same count a Suggestions row of that type
   gives. (Unit test against `readThemes`; read in the pane on a copy of
   Vampiric Bloodline on the dev branch: the tile and a Vampire row.)
2. The Atraxa precon shows no type tile and its staples tile. (Corpus check.)
3. A One Piece deck's statistics are unchanged. (Test of the OP adapter's
   blocks.)
4. A Maybe card changes neither tile. (Unit test through `toDeckSnapshot`.)
5. No tile carries a judgement word. (The banned-words test.)
6. Every precon's tiles equal step 0's figures. (A scratch script that runs the
   shipped `analyzeMtg` over the 182 precons on the dev branch.)

VERIFY
- `pnpm check`.
- A one-line mutation of each new condition turns a test red.
- `pnpm build`: the route table is `4deaf70`'s.
- The browser pane at 320, 390, 768 and 1280 px in both themes: the editor's
  Analytics (the collapsible, and the phone's tab) and the share page, on a
  copy of a typed precon and of Atraxa's.
- Smokes and scratch scripts go to a local server and the dev branch only.

RECORD
A REDESIGN.md section; LATER rows 498 (done) and 480 (annotated) and new rows
after the current last; a progress line and a "DECK-FACTS, as built" section
in `OWNER-NOTES-2026-11-24-session-prompt.md`; this file; a ship note once it
is live.
