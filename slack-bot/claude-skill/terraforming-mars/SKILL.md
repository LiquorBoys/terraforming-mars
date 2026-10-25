---
name: terraforming-mars
description: Play or advise on Terraforming Mars in the open-source browser app (terraforming-mars.herokuapp.com or any self-hosted github.com/terraforming-mars/terraforming-mars instance). Use when the user shares a TM game/player URL (…/player?id=p…, …/game?id=g…, …/spectator?id=s…), asks you to play a seat, play along, take a turn, or advise on Terraforming Mars moves/strategy.
version: 1.0.0
---

# Terraforming Mars — play along or play a seat

You drive the game through its JSON API with `scripts/tm.sh` (a Node CLI). The player id in the URL is the only
credential — no login, no cookies. The browser (claude-in-chrome) is for *showing* the game to the user and for
screenshots; don't play by clicking unless the API path is broken.

Why not the javascript tool: the Chrome extension truncates JS output at ~1000 chars and blocks any output containing
`=`. The CLI has neither problem. (`scripts/tm.js` still works pasted into the page as a fallback; it defines `window.TM`.)

## Invocation

`/terraforming-mars <url> [play|advise|watch]`

- **play** (default for a `/player?id=p…` URL the user says is yours to control): you make every decision for that
  seat and submit it. Narrate with detailed reasoning after each move (see "User preferences").
- **advise**: the URL is the user's own seat. Read state and recommend moves with reasons; submit **only** when the
  user says "do it". Never act on their seat unasked.
- **watch**: spectator (`s…`) or game (`g…`) URL — commentary/analysis only (`/api/spectator`, `/api/game`).
- Multiple player URLs = you control several seats (e.g. a test game against yourself). Switch per call with the
  bare player id as first arg.

If the mode is ambiguous, ask once.

## Cost rules (read first)

Measured on the 2026-10-04 session (3 games, one session, Opus main + 9 Opus subagents, ~$220 at list price):
78% of the cost was the main thread re-reading its own context. Cache hits were already ~99.8%; the cost is
**context size × number of model calls**, not cache misses. The context never compacted (1M window) and grew
linearly to 755k, so game 3 paid ~3× per call for games 1-2's leftovers.

1. **One game per session, Sonnet, 200k window.** Start the game in a fresh session with `claude --model sonnet`
   (plain `sonnet`, not `sonnet[1m]`: the 200k window auto-compacts, which caps the per-call re-read). `/clear`
   before the next game. Don't set `model:` in this skill's frontmatter: it switches models per turn, and every
   switch rewrites the whole context into a cold cache. If the session isn't on Sonnet, tell the user once.
2. **State lives in files, not in context.** Plan file, `analysis.md`, `passed.md`, `hunt.md` hold everything a
   compaction would lose. After a compaction, re-read the plan + analysis.md, not the references.
3. **Every wake-up is a full context re-read: budget ~3 wakes per gen.** The default loop is `autopilot` on a
   decision tree (next section): drafting, buying and routine turns run with no model call. Game 4 (2026-10-11) cost
   $33 at 390k average context because each draft pick, each turn and each finished watcher woke the model
   (~15-30 wakes per gen). Never `wait` during a draft (it returns at once while our pick is open); `waitturn`
   returns on ANY pending input. One background watcher at a time; no "check again" calls.
4. **Keep output small.** Use `--compact` on `brief`/`turn`. Read references once, by section (`Read` with
   offset/limit), never whole `strategy.md`/`lessons-log.md` mid-game. Never `Read` scripts during a game.
5. **Subagents: Haiku 5.5, fresh per run.** The subagent cache lives 5 minutes and Analyst runs are 10+ min apart, so
   a resumed agent pays a cold write of its whole history every run. Spawn a fresh `model: "haiku"` agent for each
   run (the Agent tool takes only the alias; it must resolve to `claude-haiku-5-5`, check with `/model` or set
   `ANTHROPIC_DEFAULT_HAIKU_MODEL`). Reports are re-read on every later call: cap them at ~40 lines and ask for the
   tree JSON + the numbers its guards test, not prose. Summarize into the plan/tree file, then never quote them again.
6. **Measure.** After each game run `node scripts/cost.js <session.jsonl>` and log $ per agent in the postmortem.

## Decision tree + autopilot (default loop)
The plan is executable AND self-checking. `cache/live/<dir>/tree.json` holds three layers; `tm.sh <pid> autopilot
<tree.json> 3000` (background) plays it with no model calls and re-tests the plan after EVERY game change (rivals'
turns included), so any turn that changes what we should do wakes us, and quiet turns cost nothing.
1. **goals** (long + short term): each a guard that must stay true, e.g. final-VP projection vs best rival, award
   lead > each rival's one-gen swing, "first city by ~40% of the game", "3 VP cards in hand by N-3". A goal turning
   false = `GOAL AT RISK` -> re-plan (change route, not just the next move).
2. **assume**: what the current route relies on (rival cash below X, a track still open, a contested space free,
   a pool card still unseen). Broken = `ASSUMPTION BROKEN`.
3. **rules / draft / buy**: this gen's moves in priority order, plus **watchCards**: the specific cards (rivals'
   likely hands from `rivals`, pool cards from `synergy`) that would flip a goal if played (`EVENT: red played X`).
Plan from all cards in play and acquirable, every time the tree is (re)written: `synergy` (our payoffs/unlocks,
each card in play / passed / unseen, chance an unseen card reaches our draft), `rivals` (each rival's VP mix, engines
in play incl. VP-per-resource accumulators, top tags, cards we passed them that fit their tags), `races`, `clock`,
`board`. Draft `want` = cards that serve a goal (hunt list from `synergy`); `deny` = cards that break one of
ours or feed a rival's engine shown by `rivals`. On a wake read `<tree>.snap.md` (exit reason, every goal's status,
rivals' log since the tree started), not the full log; fix the layer that failed and restart.
```json
{"until": 8,
 "draft": {"want": ["Lake Marineris", "Birds"], "deny": ["Magnetic Field Generators:promo"], "else": "first"},
 "buy":   {"cards": ["Lake Marineris"], "max": 2, "keep": 23},
 "rules": [
  {"id": "plants",  "when": "pl >= 8", "do": [["greenery", "44|35"]], "repeat": true},
  {"id": "lake",    "when": "temp >= 0 && oceans <= 8 && mc >= 18", "do": [["play", "Lake Marineris"], ["space", "13|37|53"]]},
  {"id": "unmi",    "when": "done('lake') || done('plants')", "do": [["action", "United Nations Mars Initiative"]]},
  {"id": "camps",   "when": "true", "do": [["action", "Refugee Camps"]]},
  {"id": "grnSP",   "when": "mc >= 23 && o2 < 14", "do": [["sp", "Greenery"], ["space", "44|35|20"]]},
  {"id": "pass",    "when": "mc < 14", "do": [["pass"]]}],
 "goals":  [{"id": "cultivator", "desc": "lead > red's free plants swing", "ok": "grn > opp.red.grn + Math.floor((opp.red.pl + opp.red.plp) / 8)"},
            {"id": "pace", "desc": "VP not behind best rival by > 5", "ok": "vp >= maxOpp('vp') - 5"}],
 "assume": [{"id": "ocean-open", "ok": "oceans <= 8"}, {"id": "red-poor", "ok": "opp.red.mc < 46"}],
 "watchCards": ["Mangrove", "Tundra Farming", "Luna Metropolis"],
 "wake": ["funded", "claimed"]}
```
- Rules: first true guard that hasn't run this gen runs as a `batch` (repeat:true = may run again). Put contested
  plays (last track steps, contested spaces, awards) first. Space lists use `a|b|c` fallbacks. Guard vars: gen phase
  temp o2 oceans venus tr mc st ti pl en he mcp hand played tags grn cities pending steps vp acts done(id)
  maxOpp(key) opp.<color>.{mc,vp,tr,pl,plp,he,mcp,hand,grn,cities,cards,tags}.
- Exits (the only wake-ups): `GOAL AT RISK`, `ASSUMPTION BROKEN`, `EVENT` (rival funded/claimed/played a watched
  card), `NEEDS DECISION` (no rule/draft/buy answer), `NEW GEN` (past `until`), `FOLLOW-UP`/`UNKNOWN PROMPT`,
  `BATCH STOPPED`. A tree whose goal is already false refuses to start: re-plan first.
  On a wake: read only the exit summary (+ `turn --compact` if needed), fix or extend the tree, restart autopilot.
- When to think: write the tree at gen start (after Scout/Strategist), then only on wakes. Judgement goes into the
  tree's guards (prices per VP, clock, rival swings), so most turns cost nothing. Pivot moments (award funding,
  last-gen order, a race) still deserve a manual turn: leave them out of the tree so it wakes there.
- `until` = last gen whose draft/buy the tree covers: write next gen's `draft`/`buy` before passing (until = next gen), so the draft runs while we sleep; that gen's action phase wakes us if no rule matches. Before any tile rule, put
  `board` results into the space fallbacks.
- Mechanics the tree must respect: `sell` uses an action (2 per turn); a tile next to oceans refunds 2 M€ per ocean
  (count it when sizing a chain); 8 plants -> `greenery <space>`; `pick` with no names buys nothing.

**Board tool (no browser)**: `tm.sh <pid> board` prints the ASCII map, our tiles, rivals' tiles by color, the top greenery spots touching our tiles (our cities touched, ocean refund, bonus), city spots with no adjacent city ranked by a one-space gap to our cities (the gap greenery touches two cities = 2 VP), and open ocean slots. `board <id> ...` prints one adjacency line per space (bonus, oceans, cities/greeneries by owner, empty land). The board is a static graph (every official map is the same 61-hex grid, ids 03-63; tm.js fills x/y from the id when the API omits them) saved once per map to `cache/maps/<board>.json` as nodes {type, bonus, x, y, nbrs}; only tiles change, and they come from the state we already fetch. Run it before EVERY tile placement and in dead time; never use screenshots to read the board.

## Start gate (do ALL of these, in order, before the first game action; say "gate done" in the narration)
1. Session model is Sonnet (tell the user once if not); one game per session.
2. Read lessons.md checklist; write the plan file with "Lessons applied" (incl. trades, stocks-first, attack-target check, award rules).
3. `races`, `ma`, `clock`: note every opponent's corp + forced first action, who can reach each milestone first and how soon.
4. Write `analyst-prompt.md` in the live dir (return files as text; trust `brief`/`clock` over the event line) and SPAWN THE FIRST ANALYST NOW (fresh Haiku, background), before choosing the corporation. Re-spawn at every gen start before the first draft pick.
5. Loop from here: write `tree.json` (stocks !! flag = first rule; contested plays next; trades priced net of fee) and run `autopilot`; on each wake: `races` if a race is live, `brief` before any placement/SP not already in the tree, act or fix the tree, narrate. Research phase: budget cards + plays + one trade per fleet. Last 2 gens: count rivals' hands/cash as last-gen VP and plan for the whole hand to be played.
6. Opponent hand size + cash is the hidden-VP/award-flip risk: re-check before funding any award or relying on a lead.

## Planner agent (goals, subgoals, decision trees, endgame plan)
The Analyst only reports state; planning needs its own agent. Spawn a fresh read-only **Planner** (`general-purpose`, `model: "haiku"` = Haiku 5.5, background, never resumed; prompt in the live dir as `planner-prompt.md`, adapted per game) at: setup (before choosing the corporation if time allows), every gen start once setup is done, and after any game-changing event (rival claims a milestone or funds an award, a large production/tile swing). It returns TEXT (the harness blocks file writes): (1) goal tree (end VP target, margin over each rival including their last-gen dump, subgoals with gen, metric, competitors); (2) phase plan with cash forecast and outlets priced per VP; (3) the next gen's `tree.json` (goals with guards for the long and short term, assumptions, watchCards from `rivals`/`synergy`, draft want/deny, buy list, guarded rules in priority order; format in "Decision tree + autopilot") plus a decision tree for the next 2 pivots with branch triggers; (4) endgame plan (last 2 gens, award timing/defense, clock control); (5) risks and the 3 checks to run before acting. The main agent verifies its numbers against `brief`/`races`/`clock`, saves the result into the plan file (replacing the ROLLING SCHEDULE and goals), and decides. Cost: Haiku runs only (user preference), small next to the main thread. Haiku's numbers are often stale or wrong, so verify every figure before saving. Don't wait on it during a draft pick, but have its plan before the research buy and actions.

## Rolling schedule (the fix for deciding only on the current gen)
At setup and at EVERY gen start, rewrite the plan file's "ROLLING SCHEDULE": (1) cash forecast per remaining gen (TR + production, no new buys), total MC to allocate; (2) the outlets with current price per VP (caps and contested ones marked); (3) the phase (build / tiles / convert) and its end gen; (4) VP checkpoints vs the target and vs each rival's projection; (5) the 2-3 biggest decisions due in the next 3 gens. Before any play or buy ask: what does this do to the schedule (cash in later gens, an outlet it uses or blocks, a race it enters)? A play that is good only locally (like trading idle stock) fails this question. Update the schedule when the forecast changes; log forecast vs actual in the postmortem.

## Setup (once per session)

0. **Lessons are binding guidance, not background reading.** Read `references/lessons.md` (its Checklist is our
   repeated mistakes) and turn each checklist item into a concrete commitment for THIS game in the plan file
   (section "Lessons applied", see Game plan). The commitments are then checked at every gen start (Analyst,
   analysis.md "Lessons status") and at every decision they touch (main agent, with `stocks`/`races`). `references/lessons-log.md` holds the raw dated
   evidence; consult it for detail. New lessons: append to the log (shared, never rewrite others' entries), then fold
   into lessons.md by editing an existing principle (keep it ≤ ~100 lines).
1. Then read `references/strategy.md` sections 0, 2, 3
   (and 7 for expansions in this game) and `references/combos.md` (marquee combos, stock converters, hunt themes)
   before the first decision. Re-read 4-5 as the game reaches midgame/endgame. `references/api.md` is the raw API spec — only
   needed when a builder command doesn't cover an input.
2. `scripts/tm.sh <player-url> brief` — saves the seat (host + id in `cache/session.json`) and prints everything.
   First run downloads the card DB to `cache/cards-<host>.json` (997 cards: cost, tags, requirements, VP, text).
3. Optionally show the game: `tabs_context_mcp` → `tabs_create_mcp` → `navigate` to the player URL. The page
   auto-refreshes after API moves. Screenshots only when the user asks; the board comes from `board`.
4. Note the game options (expansions, board name, WGT = gameOptions.solarPhaseOption, draft, undo) and any special
   space types on this board (map legend, e.g. Hollandia `d` deflection zone): they change strategy.
5. Write the game plan (next section) during the corporation / initial-cards step, before submitting `initial`.
5b. **Read every opponent's corporation (mandatory, before our first action).** As soon as corps are revealed
   (prelude phase), run `cards "<each opponent corp>"` and note in the plan file each one's effect and forced first
   action (Poseidon/Aridor/Celestic/Vitor/... free colonies, tiles, cards, award funding) and what races it wins.
   Re-check before any milestone/award/colony race. Our own forced first action also consumes one of our 2 actions.
6. **Run the first Analyst at setup** (see "Analyst"): a fresh `general-purpose` agent with `model: "haiku"`, never a
   fork, with a short self-contained prompt (player id, host, skill dir, the file it owns, the event, "read SKILL.md
   'Analyst' + references/lessons.md Checklist yourself"). Save that prompt in the live dir as `analyst-prompt.md`
   and reuse it for every later run. There is no Scout/Strategist/Tactician team any more: it cost ~4-5M Opus tokens
   per game, mostly duplicate reads and turn scripts that went stale before our turn.

## Game plan (written once at setup, revised only when things change)

Milestones and awards are usually **randomized** in our games, so never assume a board's default set or anything
online about "Tharsis milestones". `ma` prints this game's actual milestones/awards with descriptions (pulled from the
live server's client bundle, so they always match the deployed version) and current scores per player.

At the initial-cards step (phase `research`, pending `initialCards`), before choosing:
1. Run `ma`, `map`, and `brief`. For each corp option, score it against *this* game: which milestones it can
   realistically reach and by when, which awards it is likely to lead, which expansions/colonies it uses.
2. Check for milestones claimable on turn 1 (e.g. Minimalist ≤2 cards in hand: buy ≤2 initial cards and claim
   immediately, especially as first player). Let that cap the number of cards you buy.
   Choose corp + preludes + cards with that in mind (a milestone reachable in the first half of the expected game is worth ~5 VP for 8 M€ —
   a real tiebreaker between corps).
3. Write `cache/plans/<spectatorId>-<color>.md` (`plan` prints the exact path) with:
   - game facts: players, expansions, board, draft/undo, colonies in play;
   - **game-length forecast**: "expected last gen = N (range N-1..N+1)", from player count (strategy.md §-1.10), WGT,
     prelude, corps/preludes that terraform fast, then from measured steps per gen. It sets the **engine cutoff gen**
     (last gen where production/engine buys still pay back, roughly last gen minus 3-4 for pure production) and the
     pivot gen to TR/VP. Every production, engine or long-horizon buy is checked against the cutoff. Update the
     forecast at each generation start and log old vs new so misses are visible for the postmortem;
   - milestone targets (ordered, with the tag/resource counts needed and a target generation), and ones to deny;
   - award candidates to fund later and what to accumulate for them. Rank by STRUCTURAL lead (an engine only we
     have feeds the metric) over current count; generic metrics everyone grows are contested in 4-5P;
   - engine plan (production/tag focus), key cards to look for in drafts, city/greenery areas on the map;
   - **Long-horizon arc**: target final VP (5P ~80-85, 3P ~70), VP budget by source (TR share, card VP, board, awards,
     milestones) with the gen each must start scoring, and the gen the engine stops growing. Re-check at every gen
     start: projected VP vs the best rival (their cards, hand, awards), and where the gap closes. Income with no
     VP outlet by its gen is wasted: plan outlets (VP cards, accumulators, awards, board) 2-3 gens ahead;
   - **hunt themes** (from `synergy` + combos.md): which pieces we hold or start with (tags, hosts, steel/Ti stock) and
     which payoffs/converters to draft for. The live list is `cache/live/<dir>/hunt.md` (lines `- Card — why`), owned
     by the Analyst and edited only on events (a piece drafted/played/passed, a theme dies);
   - **subgoals** (3-6): target gen, what each unlocks, progress, who competes (their distance, income toward it,
     turn order → projected winner of each race). Re-rank at every generation start
     (drop ones an opponent has locked up or the clock has made too slow, add newly opened ones). Planner agents keep
     this list current in analysis.md;
   - opponent notes (filled in once their corps are known);
   - **Lessons applied**: one line per lessons.md Checklist item (plus any other principle this setup triggers) as a
     concrete, checkable commitment with a target expressed as a share of the expected game (recompute with `clock`), e.g. "Board VP: first city by ~40% of the expected game, greeneries right after",
     "Stock sinks: Ti → space VP cards; steel → Space Elevator + building VP cards". Deviating from one later is
     allowed only with a written reason in analysis.md or the turn narration.

Revisit (`plan`, then edit the file) only at generation start (research phase) **and** only if something changed: a
milestone got claimed, an award got funded, an opponent is racing you for a target, you drew a pivot card, or the
game clock moved faster/slower than expected. Otherwise follow the plan — no re-analysis every draft pick.

Invoke the helper as **one plain command by full path**: `~/.claude/skills/terraforming-mars/scripts/tm.sh <pid> <cmd> …`
(the wrapper adds `--use-system-ca`, needed behind TLS-inspecting corporate proxies, and hides Node cert warnings).
The user's permission allow rule is `Bash(*/terraforming-mars/scripts/tm.sh *)`. Commands wrapped in `cd … &&`
chains, `for` loops or pipes don't match it, and auto mode may block them as "Create Public Surface" (moves post to
a public server). So make one call per action, and batch through parallel tool calls, not shell loops.

## The loop

```
brief            -> read state + PENDING INPUT
decide           -> strategy.md heuristics; `cards "X"` for full text of any card; `map` for the board
act              -> a builder command (below); its output shows the NEXT pending input
repeat until output says "no input pending" -> `wait` (blocks until GO/END; default 540 s)
```

- Every successful command prints the next pending input, so chain follow-ups (tile placement, target choice)
  without re-running `brief`.
- **Analyst + main agent (default for games vs humans; replaces the old 3-agent team).** Cost rule: one cheap
  subagent, few runs, no turn scripts written by agents. The main agent (the session model, Sonnet) makes every
  decision.
  - **Analyst** (`general-purpose`, `model: "haiku"`, a fresh agent per run, never forked or resumed) owns ONE file:
    `cache/live/<spectatorId>-<color>/analysis.md` (whole-file rewrite, ≤80 lines, header: updated time, gen/phase,
    last log line read). Sections:
    1. **Opponents**: corp + forced first action, resources/production/hand, recent actions, unused blue/corp
       actions, free fleets + fee, likely next moves in this gen's turn order, threats to us (attacks, plant removal,
       contested spots/tracks), likely hand from `passed.md`. From 2 gens before the forecast end: hidden end VP
       (held VP/TR cards ~ hand size, cash ÷ 8, plants, resource cards with a refill track).
    2. **Board**: VP race, clock (`clock` + measured pace, assume ±1 gen; the one forecast the plan file copies;
       WGT is off by default, World Government Advisor is the usual free-step source), ranked city/greenery/ocean
       spaces (adjacency, rival cities to avoid, city bait), next track bonus per track.
    3. **Races**: paste `races` output and interpret it (who reaches each threshold first in turn order, fund/deny).
    4. **Lessons status**: each "Lessons applied" commitment from the plan file ON TRACK / AT RISK / DROPPED + next
       action. From 2 gens before the end: paste `stocks` and name the missing sinks to hunt in the draft.
    5. **Draft rubric** for the next research phase (wanted tags/sinks, hate list, max buys at our card cost).
    It also owns `hunt.md`. Read-only tm.sh commands only.
    **The harness blocks subagent file writes** ("Subagents should return findings as text", verified 2026-10-11),
    so the Analyst RETURNS analysis.md and hunt.md as two text blocks in its final report and never calls Write
    (nor shell redirects to get around it). The main agent checks the report's facts against `races`/`clock`
    (Haiku got the milestone count and the game-length forecast wrong once), fixes them, and saves both files itself.
    Put "return the files as text, do not Write" and "the event line may be stale: trust `brief`" in analyst-prompt.md.
  - **Don't skip the Analyst.** Spawn it at setup and at every gen start, before the first draft pick. In the
    2026-10-11 game it was skipped for 3 gens and a rival took a milestone we had built the corp around. Also run
    `races` at each gen start and play the card that unlocks a contested milestone first.
  - **When the Analyst runs (event-driven, ~1-2 runs per gen):** spawn a fresh agent (`run_in_background: true`)
    with `analyst-prompt.md` + a one-line event at (a) each generation start (draft begins) and (b) a game-changing
    event: milestone claimed, award funded, a big attack or tile play, a track about to close. Never after each of
    our own moves, never per draft pick. It rebuilds from analysis.md (header = last log line read) + `brief
    --compact` + `log gen <N>` from that line, rewrites the file, ends with a ≤5-line report, and exits. Never
    SendMessage/resume it (cold cache rewrite of its whole history, see Cost rules 5).
  - **Mark guesses.** Every inferred claim in analysis.md (hidden VP, likely hand, next moves, "can't reach X this
    gen") ends with `(est: <basis>)`; facts read from state carry no tag. Before a race, funding, or a pass/end-game
    decision the main agent re-checks any `(est)` line it relies on with `races`/`clock`/`log`.
  - **Main agent per turn** (no Tactician): on GO, read `analysis.md`, then `turn` (state + log + pending), and
    **run `stocks` EVERY turn: any `!!` flag (8+ plants, NO SINK) is the FIRST action** (greenery before any card, trade
    or blue action) unless the narration states a written reason that beats the expected loss (rivals removed 2
    of our 8 plants the turn we deferred; the reason we gave was a trade we could have paid for in M€). **Attack/removal cards**
    (asteroids, comets): before playing, check that a target with the resource exists (`brief` opponents); if there is none, value the
    card without its attack and don't pay for the attack. `races` when a decision touches it. **Trade check, every turn before choosing actions** (fleets
    are an action source; in the 2026-10-11 game ours sat idle for 5 gens while rivals took Luna 13 and Triton):
    for each colony in the pending "Trade with a colony tile" list, value = track value [x] in M€ terms (Luna/MC
    as is, Pluto cards ~3 M€ each, Ti 3, steel 2, energy/heat per what we can use, Europa prod MC permanent) minus the
    fee (9 M€, 3 energy or 3 Ti; Cryo-Sleep/Rim Freighters discounts). **Value energy/heat/plants only if we can still
    convert them in time**: steps left on that track (temp/O2) minus what rivals will raise before our next action
    (the first player rotates; if we act late, assume the track moves), and energy/heat arrive as stock only after
    production, so they convert next gen at the earliest. If the track may close first, value them at ~0 (Callisto
    13 energy with temp 5 steps from max, blue +8 heat/gen and us last = wasted). List the best 2 with net value, compare against
    the best card play per action, and say so in the narration. Take the trade first if it nets ≥ ~4 M€ or a
    rival is likely to take that track before our next turn (check who is before us in turn order and which
    colonies they own); keep ≥ 9 M€ (or 3 energy / 3 Ti) in reserve for it when the plan allows. Also price
    `Build Colony` (17) when a track we trade on has no colony of ours. Decide, execute with one guarded `batch`, then narrate. For a
    predictable turn while opponents act, the main agent may write a guarded go.sh itself (template:
    scripts/go.template.sh: guard each step on what its value depends on, answer every follow-up, end after any draw)
    and run `scripts/autogo.sh <id> <liveDir>` in the background. Re-check the premise (actions left, target still
    open, rival not yet qualified) before running anything pre-planned; if it broke, decide fresh.
  - Draft picks: the main agent picks from the Analyst's rubric plus `synergy "<pack cards>"`; append passed cards to
    `passed.md` at every pick.
  - Watchers stay model-free: `waitturn`/`wait`/`prewatch` in the background (one at a time; `watch` only when
    the user wants live commentary); a poll loop on `pending` during drafts.
  - After the game: TaskStop any running Analyst and watcher (check with ListAgents), run `scripts/cost.js`.
- **Mechanical checks (no model):** `tm.sh <id> stocks` lists every stockpile with its VP sink and flags NO SINK and
  8+ plants; `tm.sh <id> races` lists all corps with their forced first actions and every open milestone/award as
  distance-to-threshold and our rank/margin. Run `races` before any race and `stocks` at the last 2 research phases
  and before passing; they are the enforcement points for lessons checklist items 3 and 4.
- `ERROR: …` means the server rejected it and **state is unchanged** — fix and resend.
- Waiting on humans can take minutes. Use `wait 540` in the foreground for short waits; for long ones run
  `tm.sh <pid> wait 3000` with `run_in_background: true` and you'll be notified when it's your turn. Don't poll in a
  tight loop.
- Before a non-trivial decision re-run `brief` (opponents may have changed the board/milestones since).
- `log 30` shows what opponents did recently.

## Commands

State: `brief [--nohand] [--noopp]`, `pending`, `map`, `board [id ...]`, `log [n] | log gen <N> | log all`, `cards "A" "B"`,
`stocks` (every stockpile + its VP sink, NO SINK / 8+ plants flags), `races` (all corps with forced first actions,
open milestones as distance-to-threshold, awards with our rank/margin and the next funding price), `ma` (milestones/awards with
descriptions + scores), `clock` (capacity-based game-end forecast: earliest/likely/slowest last gen, per-player capacity), `synergy` (payoffs for our tags, tag-req unlocks, resource links, steel/Ti sinks, hunt.md status
with unseen/passed/in-play) and `synergy "A" "B" …` (what in the remaining pool links to those cards: one call per
draft pack), `plan` (game plan file path/contents), `seats`, `wait [sec]`, `use <url>`, `refreshdb`
(re-download card + milestone/award data after the server is redeployed)
`--compact` (any command: ~25% shorter brief, card text cut to 90 chars, opp tableaus as counts, one-line colonies;
default output is unchanged for scripts that grep it), `turn [n]` (turn.sh STATE/LOG/PENDING in one process).
Watchers (one long-lived process each; poll the tiny `/api/waitingfor` endpoint, full state only on change):
`waitturn [maxSec] [ms]` (GO when any input pending), `prewatch <color> [maxSec] [ms]` (used by prewatch.sh),
`watch [maxSec] [ms]` (EVENT + new log lines on any change, or GO), `watch-go <go.json> [maxSec] [ms] [--decline-offers]`
(waits for "Take your first/next action", then runs the batch steps in go.json in-process; other prompts -> UNKNOWN
PROMPT -> manual; exit 3 = no go.json). `batch` steps: `[cmd,args…]`, `["if-pending","re",cmd,…]`, `["guard","js expr"]`
(vars gen phase temp o2 oceans venus tr mc st ti pl en he mcp hand pending).

Main menu:
| Command | Does |
|---|---|
| `play "Card" ['{"steel":2,"megacredits":5}']` | Play a project card. Omit payment → auto: steel on building tags, titanium on space tags, rest M€ |
| `sp "City"` / `"Greenery"` / `"Aquifer"` / `"Asteroid:SP"` / `"Power Plant:SP"` / `"Air Scrapping"` / `"Build Colony"` | Standard project (also answers "Select your first standard project" prompts) |
| `action "Card"` | Blue card action (then answer its follow-up) |
| `claim "Milestone"` / `fund "Award"` | Milestone / award (fund may be followed by a `pay` prompt) |
| `heat` / `greenery <spaceId>` | 8 heat → temperature / 8 plants → greenery |
| `trade "Colony" [feeText]` | Trade; feeText matches the fee option ("M€", "energy", "titanium"); default first |
| `sell "A" "B"` / `pass` / `endturn` / `undo` | |
| `menu <titleRegex> ['<innerJson>']` | Any other menu option (Turmoil delegate, CEO action…) |

Follow-ups (pending input is itself the prompt): `space <id>`, `pick "A" "B"` (card choice, draft, research buy,
prelude to play — `pick` with no names = select none), `amount <n>`, `player <color>`, `option`, `or <i> ['<inner>']`,
`colony "Name"`, `party "Name"`, `delegate <color|NEUTRAL>`, `pay <mc|json>`,
`initial '{"corp":"X","preludes":["A","B"],"projects":["C"]}'`, `send '<raw InputResponse json>'` (see api.md §4).

Reading the render: `[i]` = index in an `or`, `&i` = part of an `and`, `DISABLED` = can't be chosen now.
Legal spaces come annotated: `24(4,3) ocean bonus:heat+heat | adj ocean×1(+2mc), MYcity×1, emptyLand×4` — the server
already filtered legality, so just pick the best.

## User preferences (confirmed by the user)

- **Draft:** pick by delta (our gain + denial to the receiving opponent). Hate-draft whenever the denial clearly
  outweighs our best own option.
- **Attacks:** only for big, lasting swings against the leader (permanently removes several VP) and only with a card
  worth playing anyway. No spite cycles. Forced removal choices (e.g. Comet) are simulated per strategy.md §-1.5.
  (Research note, pending user decision: top-player data shows cheap attacks bundled with value score about average.)
- **Narration:** detailed reasoning: what we did, the main alternatives, and why. Write it **after** submitting
  the move so it doesn't run the game clock, and keep heavy analysis off-clock (Analyst runs while opponents act).
- **Models / cost:** main thread on Sonnet (session model), every subagent on Haiku 5.5 (`model: "haiku"`), one
  game per session (see Cost rules). Analyst for games against humans; none for test games against ourselves.

## Decision guidance (summary — details in strategy.md)

**Plans expire fast** (strategy.md "Plans expire fast"): in 4-5P the board shifts several times between our turns.
Every plan is conditional on written assumptions; re-check them against the log right before acting. The agent
team exists to keep plans current off the game clock, so verify, then act.

**Start from strategy.md §-1 "The win model".** Judge every choice by expected final-VP margin over the best
opponent across the whole game, given the forecast game length. Never by what it does this turn or this
generation. lessons.md holds the principles learned from our games; its examples illustrate, they aren't rules.

- Scale to player count (strategy.md §-1.10). Typical length with Prelude: 2P ~11, 3P 9-10, 4P 8-9, 5P 7-8 gens
  (WGT shortens it). 2P: build engines longer; 4-5P: only fast payback once about a quarter of the expected game has passed.
- Count generations left before every buy/play: production pays ~1× its value per remaining generation; TR = 1 VP +
  1 M€/gen; 1 VP ≈ 4 M€ early, ~10 M€ late. Expect good opponents to end the game a gen early: keep a VP buffer.
- Economy phase (roughly the first 40-50% of the expected game in 2-3P, the first ~25% in 4-5P; always from the live `clock`): production (plant prod is the best buy), discounts, early colonies;
  card draw only if it pays back. Then shift to TR and VP (cards under ~10 M€/VP). Last 1-2 gens: stop buying cards
  you can't play; convert everything to VP.
- Non-TR VP decides 3P+ games: greeneries next to cities, animal/microbe VP cards, milestones, awards.
- Only 3 milestones get claimed, total. Compare everyone's distance to every unclaimed milestone (and turn order);
  once 2 are gone, only chase the last one if you'll get there first. Otherwise value plays on their own merits.
- Milestones: 8 M€ = 5 VP is cheap only if our engine reaches the requirement anyway ("on-engine"). Price the path
  for off-engine ones (off-plan buys + displaced plan VP + race risk); often skip them. Claim on-engine ones the moment you qualify
  (`!` in the brief) and can pay, before opponents. Awards: scored only at game end, and a funded award scores for whoever leads at the end (rivals included) and becomes a target. Fund early only when the lead is clear:
  it survives each rival's maximum one-gen gain on that metric (their corp, tableau, cash and hand, not a formula) and we budget the cost of defending it.
  Otherwise wait and fund in the LAST gen once the standing is locked. Two games lost awards we had paid for (a +7 production card; a tile-heavy corp with saved cash). In 2-player games only 1st place scores an award.
- Draft: before passing, check whether any card in the pack advances an opponent toward an OPEN milestone we race or a live
  award we lead (hate-draft candidate). After each pick, append the cards you passed (gen, recipient, names) to cache/live/<dir>/passed.md.
- Draft: it's multiplayer — value every pick as a delta (my gain + what the receiving opponent would gain). Know
  each opponent's corp/tags/milestone-award races; hate-draft combo pieces and cards that hurt us (strategy.md §6). Unmet requirements aren't disqualifying:
  estimate whether we'll get the tags from future drafts, given which tags opponents collect. Global min-requirements
  open up over time, so draft high-value endgame cards and let them reshape the plan (Penguins → push oceans).
- Draft packs: run `synergy "<each pack card>"` once per pack (prebuilt index, no reasoning card by card) and value a
  card by the links it has to our tableau/hunt.md plus what it would complete for the receiver. A piece of a live
  theme outranks a higher standalone card; a payoff for tags we don't have is worth only as much as the odds of
  getting the tags. For unmet global requirements, compare waiting for the draft with the printed SP route.
- Research phase: 3 M€ per card. Budget the gen's spend as cards + plays + **one trade per fleet (9 M€/3 energy/3 Ti reserve)** together; price trade enablers (Cryo-Sleep, Trade Envoys, colony cards) by trades we'll really make, and in the draft treat them as engine parts. Buy only cards you expect to play within ~2 gens; in the draft, also hate-draft
  cards that would be huge for the opponent.
- Placement: cities where 3+ greeneries (anyone's) will realistically surround them, ideally where two players'
  greeneries meet; greeneries next to your cities; ocean adjacency +2 M€ each; grab placement bonuses.
- Colonies: build early (Pluto near-default), trade every gen at the highest `[x]` value, before opponents.
- Tempo: often take 1 action per turn to keep information and react; take 2 when the second is contested.
- **Closing plan (write it in the plan file at gen N-3, N = forecast last gen; see lessons.md 'Closing protocol')**: per rival, projected final VP = now + last-gen cash/price + hand VP + converters, from observed behaviour; our conversion capacity vs the gap; VP outlet list with caps (spots, cards in hand, TR steps left); production buys stop at N-4; card pipeline of 3+ cheap VP cards by N-3; compare every late buy by VP per M€ and keep the full table of outlets. If projected behind, say so and change plan (deny, slow tracks, hate-draft), not just spend.
- Last generation checklist: strategy.md §5.3 — greenery conversion, heat, standard-project VP (greenery 23 if it
  also bumps oxygen/city VP), awards, VP cards, then pass. Leftover M€ is worthless at the end.
- Game end flow (verified): after everyone passes in the generation where all globals are maxed, final production
  runs, then each player gets `"Place any final greenery from plants"` → `greenery <id>` (or `or 1` to skip). Then
  `wait` returns `END`, and `brief` shows `phase end` and the final VP breakdown for everyone. Post the result, and
  append lessons to `references/lessons-log.md`, then fold general ones into `references/lessons.md`.
  Postmortem rule: for each mistake, first ask "did lessons.md already cover this?" If yes, the gap is enforcement:
  fix where the check should have fired (plan "Lessons applied", analysis.md status, `stocks`/`races` checks) instead
  of adding another lesson. Only genuinely new principles get folded in.

## Known limitations / gotchas

- Card text in the DB is sometimes partial: effects/actions drawn only as icons (common for corporations and blue
  cards, e.g. "Add two floaters to ANY JOVIAN CARD" missing its trade action) show little text. Use your own card
  knowledge; `cards "X"` shows everything the DB has.
- The game's `or` indices shift as options appear/disappear — always use the builder commands or read indices from a
  fresh `pending`, never reuse old indices.
- Undo only exists if the game was created with undo on; it appears after your first action of a turn.
- Forced first actions (Aridor, Poseidon, Celestic, Vitor, …) show only "Take first action of X" + Pass: answer
  `or 0`, then its follow-up (e.g. `colony Europa`).
- "Select your first/second standard project" prompts (e.g. Established Methods) are bare projectCard prompts: use `sp`.
- `fund "Award"` pays M€ immediately. Actions with no real choice resolve instantly; check `log 5` if unsure.
- Card actions may raise a follow-up "Select one option" (e.g. Vermin: animal vs microbe). Scripts must answer it.
- Opponent cards can raise off-turn prompts for us (e.g. "Pay 2 M€ to draw a card"); these only exist when such a card
  is in play.
- In multi-seat games, during research/draft all seats act simultaneously; in the action phase only the active seat
  gets `GO`.
- **Always pass the player id (or URL) as the first argument of every command** (`tm.sh p5cbc… pass`). The saved
  seat in `cache/session.json` is shared by every Claude session on this machine, so another instance can change it
  under you.
- Don't post attacks or public chat on the user's behalf beyond game moves; the game itself is fine to play.
- Games expire after inactivity (`expectedPurgeTimeMs`).
