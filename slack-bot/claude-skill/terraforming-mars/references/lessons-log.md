# Lessons log

Raw dated lessons, archived. Principles live in lessons.md.
Append new dated lessons at the bottom of this file; fold them into lessons.md once they generalize.

---

# Lessons learned (shared across Claude instances — read at setup, append when you learn something)

Append new entries at the bottom under a dated heading. Keep each lesson to 1-3 lines: what happened, what to do.
Several Claude sessions may use this skill at once; append (Edit at the end), never rewrite others' entries.

**Read these as cases of the general principles in strategy.md §-1 (win model), not as card-specific rules.**
The recurring root cause in our losses has been short-sightedness: judging a card, trade or attack by its effect
this turn or this generation instead of its effect on final VP margin over the whole (usually shorter than expected)
game. When adding a lesson, name the general principle it illustrates, not just the card.

## Distilled principles (index; entries below are the evidence)

| Win-model principle (strategy.md) | Lessons below that illustrate it |
|---|---|
| §-1.1/§5.1 Forecast length by arithmetic, err short | 5P ended gen 7 not 9; pace doubles; count energy→heat, blue actions, ~1 hand step/opponent; WGT was off |
| §-1.2/§-1.10 Value by gens left, scale to player count | +22 M€ prod but lowest TR in 5P; unplayed gen-5 buys; score preludes in M€ now (Donation > Floating Trade Hub); 0-income opening |
| §-1.4/§-1.5 Relative value; attacks are investments | Energy Tapping denied nothing + retaliation; Comet targeting by simulated end-game VP lost |
| §-1.6 Diversify non-TR VP | Poseidon 0 city VP; black won at TR 26 via milestone/awards/cards; Capital/Boom Town cities |
| §-1.8 Subgoals must survive opponents; turn order | Milestone pool of 3 (Terran race lost); Minimalist turn-1 claim; turn order/track bonuses |
| §4.3 Awards | Reconciled: "fund late, only if pulling away" (5P blue-card chase) and "funding the lead decided the game" (Contractor/Urbanist) are the same rule: fund early at 8 M€ only a lead you structurally keep; otherwise wait |
| §3.4/§6 Card draw | Reconciled: draw is usually overpriced; the Pluto/Sub-Crust lesson applies when the plan needs specific pieces and the draw pays back in the remaining gens |
| Tooling | CLI by full path, pid first arg, pending prompts off-turn, end-game greenery flow |

## 2026-09-26 — test game "Radiant Particle Stream" (2 seats, both Claude; CE+promo+Venus+Colonies+Prelude 1&2, Vastitas Borealis, draft, undo, random MA)

Tooling
- Always pass the player id as the first CLI argument (`tm.sh p5cbc… brief`). A bare id is used for that call only;
  a full URL is also saved to `cache/session.json`, which every instance on this machine shares — never rely on it.
- Behind the corporate Netskope proxy Node needs `--use-system-ca` (tm.sh adds it). Nonexistent bundle chunks return
  mangled 404s that crash `fetch` — tm.js already skips them.
- Don't play through the Chrome javascript tool: output is capped at ~1000 chars and anything containing `=` is blocked.
- Forced "first action" corps (Poseidon, Celestic, …) show a menu with only "Take first action of X corporation" +
  Pass: answer `or 0`, then the follow-up (e.g. `colony Europa`).
- Established Methods (prelude) asks "Select your first/second standard project" as a bare projectCard prompt; `sp`
  handles it.
- Card actions with no real choice (e.g. Extreme-Cold Fungus with no other microbe card) resolve instantly with no
  follow-up — check `log 5` if unsure what happened.
- `fund "Award"` pays M€ immediately (no payment prompt when you only have M€).
- Undo (when enabled) reverts the whole last action including tile placement; resources are restored.
- The DB text for corporations and blue cards is often missing the icon-only effects/actions (e.g. Titan Floating
  Launch-pad's "spend a floater to trade"). Fill gaps from your own card knowledge.

Strategy
- Interplanetary Cinematics + Boom Town + Established Methods left the seat with 0 M€ production after gen 1 — avoid
  openings that spend everything on TR and leave no income; Established Methods is better used for production SPs
  or colonies.
- Poseidon: building 2 colonies in gen 1 (first action + Build Colony SP) gave +2 M€ prod and a card-draw colony
  (Pluto) — strong, consistent opener with Colonies.
- Ocean placements with plant/card bonus next to existing oceans (+2 M€ each) are worth prioritizing early.

## 2026-09-26 — 5P game (Aridor, Colonies+Prelude, random MA)

Strategy
- At the initial-cards step, check every milestone for an **immediate** claim before choosing how many cards to buy.
  Minimalist (≤2 cards in hand) was claimable at game start: buy ≤2 initial cards, then claim on your first turn,
  ideally as first player. Hand-size/resource milestones decide how many cards to buy, not just which corp to take.
- Draft picks = delta: my gain + denial of the next player's gain. Track each opponent's corp, tags, milestone/award
  races and purchases; take cards that would swing them big (their combo pieces, their milestone/award cards,
  attacks aimed at us) even if they're only marginal for us. Hate-drafting is free (you don't have to buy).
- Denial plays must survive the opponent's response: Energy Tapping (-1 VP forever) to block Energizer failed —
  the opponent built a Callisto colony (+1 energy) and claimed it the same gen. Before any attack/denial, ask
  "can they recover in 1-2 turns?" Judge moves by final score, planning both this gen and the endgame.
- Don't write off cards with unmet tag requirements; estimate whether the tags will reach us through upcoming drafts,
  given which tags opponents are accumulating and drafting (contested tags rarely get passed).
- Global min-requirements open up as the game advances. Draft high-value endgame cards early, and let a strong card
  steer the plan (drafting Penguins → push oceans). Max requirements expire, so play those early.
- Milestones are a shared pool of 3: once 2 are claimed, only the one closest to completion **for anyone** matters.
  I chased Pioneer/Tradesman at 2/3 while two opponents sat at 5/6 Earth tags for Terran — Terran was claimed next
  and the rest died. Each turn, count the claims left and each opponent's distance (and turn order). Don't make
  plans or spend for a milestone you can't reach before the last slot goes; value those plays on their own merits.
- Awards are risky unless we're clearly pulling away. Funding one signals it: opponents then draft and play toward
  it for the free points (especially in 5P, where 2nd place also scores). Fund late, and only with a lead others
  can't realistically close.
- Read opponents every generation (`brief` + `log 30`): what engine they're building, which parameter they'll push,
  which awards they'll fund, where they trade. Record it in the plan and use it to find edges: colonize where they
  trade, time requirement cards to their terraforming, and hate-draft their combo pieces.
- The game clock tracks our thinking time and penalizes slow players. Plan the next generation and next turn right
  after acting, while opponents move (write it in the plan file), then execute quickly on GO. Keep per-turn
  checks minimal, and use a single `brief --noopp` when nothing major changed.
- Human opponents retaliate. After our Energy Tapping on black, black hit our energy production back (Power Supply Consortium) two gens later
  (spite, not their best play). In multiplayer, an attack costs its card plus likely retaliation, and the players
  we didn't attack gain. Attack only for a large, lasting swing.
- City placement: count only the greeneries that will realistically exist, not the empty land. I chose space 19 (5 empty
  land) over 09 (an opponent greenery already adjacent = 1 guaranteed VP, plus steel bonus and ocean +2 M€). With plant
  production 1 we'll never fill 5 spots. Bank guaranteed VP and bonuses now, and count opponents' greeneries as ours to
  score.
- Remember forced first actions (Aridor's colony tile, Poseidon, etc.) use up one of your 2 first-turn actions.

## 2026-09-26 — Postmortem insights (5P, gen 6: we're 30 VP vs leaders 40-42)
- The leaders all bank VP/TR from gen 1: green (Tharsis) TR 33 via UNMI Contractor + heat/asteroids; yellow (Vitor)
  free award at start + 11 VP from cards; blue (Point Luna) 18-card hand + Terran; black (Splice) Energizer + animals.
  We spent gens 1-5 on M€ production (+22, top of the table) with TR 23 (lowest) and 2 card VP. In 5P+Prelude the
  game is ~8 gens, so production bought after gen 3 barely pays back. Target TR ≥ table average by gen 4.
- Corp/prelude pick: we took Aridor + Dome Farming + Floating Trade Hub (slow, low-value). Prefer immediate TR/VP/
  resources in 5P (UNMI Contractor-style, Donation's 21 M€ > FTH). Score preludes in M€ now, not engine later.
- Blue-card hoarding for an unfunded award (A. Manufacturer) bought low-VP cards (Floyd, Atmo Collectors 15 M€,
  Martian Zoo). Buy a card for its own VP/M€ value; award progress is a tiebreaker only.
- Energy Tapping cost 1 VP + retaliation and denied nothing. No attacks unless the swing is large and lasting.
- Trade for free: opponents paid 3 energy per trade (Callisto/Power cards); we paid 9 M€ for weak tracks (Europa =
  1 energy prod). Energy production 3 early = a free trade every gen. Skip trades under ~8 M€ of value.
- Minimalist (keep ≤2 cards) starved our card flow. Worth it only if claimed turn 1, then buy cards freely.
- Opponents' heat piles (green +8, blue 14) end temperature fast; count their heat/plants into the clock at setup.
- Plant removal (Comet etc.): don't just hit "the leader". For each target compute plants before/after vs the 8
  threshold (does removal stop a greenery **this gen**?), their plant production (how fast they rebuild), and the
  VP/TR swing. I picked black by "VP leader" without checking that green could then green up to tie. Black was
  still right (bigger plant income), but only the numbers show that.
- Estimate the end generation with arithmetic, not intuition: steps left per parameter vs each player's heat/8 and
  plants/8 **after next production**, plus cash for SPs/cards, plus the WG step. Scout guessed "gen 7 last 75%";
  counting showed ~5 of 12 steps possible, so gen 8. Don't rush cards/SPs if another draft and income are coming;
  keep a flexible reserve and re-check mid-gen.
- Turn order rotates every generation. When planning, note our position this gen: if we're late, contested things
  (best colony tracks, milestone/award slots, prime spaces, max-requirement cards, the last steps of a parameter) may
  be gone before our turn. Take the contested ones on our first action; when we're first, grab what goes first.
- Put turn order into opponent predictions too: whoever acts before us this round can take the track, space or
  parameter step first. Predict their moves in seat order and plan our first action against what's left.
- Global track bonuses are in strategy.md §1.5/§9 (temp -24/-20 heat prod, 0°C ocean, O2 8% temp step, Venus 8% card,
  16% TR) but we never planned around them. Planners must list the next bonus on each track, who is positioned to take
  it (in turn order), and whether we should time a raise to take it or avoid handing it to an opponent.

## 2026-09-26 — test game "Radiant Particle Stream" finished (gen 11; IC 79 beat Poseidon 72)

Tooling / mechanics (all verified live through game end)
- Permissions: auto mode can block tm.sh calls as "Create Public Surface" (it posts to a public server). The user
  has an allow rule `Bash(*/terraforming-mars/scripts/tm.sh *)`. Call the helper as a **single command by full path**
  (`~/.claude/skills/terraforming-mars/scripts/tm.sh <pid> <cmd>`): `cd … &&` chains, `for` loops and pipes don't
  match the rule and can get blocked. One call per action; don't batch in shell loops.
- End of game: after the last pass in the terraformed generation the server runs the final production, then each
  player gets `<or> "Place any final greenery from plants"` ([0] space, [1] "Don't place a greenery"). `greenery <id>`
  works on it; `or 1` skips. Then `wait` returns `END` and `brief` shows `phase end` with final VP breakdowns.
- M€ left after the last action phase is worthless, and final production adds more. Spend everything in the last gen
  (greenery SP 23 = 1 VP + possible city adjacency even with O2 maxed; Air Scrapping SP = Venus TR while Venus < 30%).
- Playing a science-tag card with Mars University in play triggers an `or` "discard a card to draw / Do nothing"
  **before** you get the menu back, including Mars University itself. Other "when you play X" effects behave the
  same way, so read the returned prompt before sending the next action.
- Opponents' trades on your colony can hand you a prompt (e.g. Pluto "Select a card to discard") while it isn't your
  turn. `wait` returns GO for it, and the menu command then fails with "pending input is <card>…". Answer it first.
- The trade fee option text contains "titanium" / "M€" / "energy": `trade Titan titanium` paid 3 ti. Luna Metropolis
  places its city on its reserved off-board space automatically (no prompt).
- `heat` shows `warnings:maxtemp` once temperature is maxed: still legal but gives no TR. Don't use it unless a card
  effect needs heat spent.
- Once the 3 milestones are claimed, the `ma`/brief scores for the rest show `{}` (nothing claimable).

Strategy
- Cities matter: Poseidon never built a Mars city and scored 0 city VP. The IC seat's Capital (placed at 4 adjacent
  oceans) plus a Boom Town city with greeneries around gave city/greenery points, and it won 2 funded awards
  (Contractor, Urbanist). Plan at least one city that greeneries (anyone's) will surround.
- Funding the award you lead (Contractor at 7-2, Urbanist at 6-0) was worth 10 VP for 28 M€ and decided the game.
- Last gen: always read the Tactician's next.md before the first action. I traded Enceladus (9 M€ for +2 VP) without
  reading it and lost the M€ to fund Estate Dealer (20 M€ for +5 VP via a 3-way tie). In the final gen, rank every M€
  use by VP per M€ before spending, including unfunded awards we're tied for first on (ties all score 5).
- The draft isn't the only card source. When chasing a tag or card (a requirement, a combo piece), add draws: Pluto
  colony and trades, Development Center, Mars University, AI Central, Olympus Conference, Research, Sub-Crust
  Measurements, Solar Probe, Venus 8% bonus. Each draw is another roll at the piece we need, and a card-draw engine
  often pays back strongly when the plan depends on specific cards. Black drew with Pluto trades and Sub-Crust every gen.

## 2026-09-26 — Final postmortem — Radiant/Aridor 5P (ended gen 7; us 5th, 46 vs green 59, blue/yellow 53, black 51)
Data: `/api/player` → `game.globalsPerGeneration` gives the end-of-gen globals; `/api/game/logs?id=<pid>&generation=N` gives the full log for gen N (`log` only shows the last 50 lines).
- Mars steps per gen were 2,1,2,5,10,11, then 11 in the first half of gen 7 (42 total). The pace **doubles** once engines are up. Forecast rule: next gen ≥ last gen's steps; if steps left ≤ 1.2 × last gen's steps, the next gen is the last. At the end of gen 5 (22 left, 10 done that gen) this said "ends gen 7". We said "gen 9" (gen 5) and then "gen 8" (gen 6).
- Gen 7 steps we missed: green's 14 banked **energy became heat at production** (24 heat = 3 temp steps), yellow's Strip Mine (+2 O2) and WG Advisor action, blue's Regolith Eaters (+1 O2) and Small Asteroid, and **our own** Nitrogen-Rich Asteroid plus a heat conversion. Count energy stock as heat, count blue-card global actions, and assume every opponent plays about 1 step from hand per late gen.
- **WGT was OFF** (`gameOptions.solarPhaseOption:false`), even with Venus on. The steps we credited to "WG" came from yellow's World Government Advisor prelude action. Read gameOptions at setup and don't write "Venus(WGT)" from memory.
- VP by gen: us 24,25,26,26,28,36 vs green 30,26,27,29,41,51. Low TR is survivable: black finished 51 at TR 26 with 23 VP from milestone + awards + cards. We had 14 (5+2+7) at TR 30. We lost on both TR and card VP.
- Production timing: gen-5 Space Port and Casinos (+8 M€ prod) paid out twice. Callisto Penal Mines (bought gen 5), Weather Balloons, Cloud Tourism, Underground Detonations and Solar Probe were never played (15 M€ of buys wasted). From gen 4 in 5P, buy only cards that carry VP or TR.
- Correction: the retaliation was Power Supply Consortium (gen 4, -1 energy prod), not Energy Tapping. Energy Tapping itself still netted +1 energy and +1 M€ prod (Aridor power tag) for -1 VP. It denied nothing: black had 5 energy prod + Power Plant SP + Callisto colony = 6.
- Decision verdicts:
  - Right: Minimalist (8 M€ = 5 VP, our only milestone), Dome Farming (+4 M€ +1 plant prod with Aridor), Luna colony (+2 prod, plus our 7-12 M€ energy trades), Floyd Continuum (4 M€ → 12 M€), Comet on black (black would have hit 8 plants for a gen-7 greenery; green's greenery was fed by Arctic Algae anyway).
  - Wrong: Floating Trade Hub over Donation (~15 M€ spread over the game vs 21 now), 9 M€ trade for Europa +1 energy prod, the blue-card chase (A. Manufacturer 2nd place = 2 VP, the same as 3 others at 7), city at 19 (1 VP; blue's 09 city scored 2 plus ocean adjacency).
- What winners did that we didn't: green made +3 TR on turn 1 (UNMI Contractor), then heat, asteroids and energy→heat every gen, and Arctic Algae turned every ocean into plants (3 greeneries, 3 cities). Blue took production cards that also carry VP (Luna Metropolis, Sky Docks), plus Terran (gen 3) and TR events. Yellow used Vitor to fund Curator free and earned +3 M€ per VP card (16 card VP). Black had Energizer on turn 1, traded with free energy every gen, and won Curator (building 9) on yellow's funding.
Assumptions that failed:
  - "5P game = 9-10 gens": it was 7.
  - "WGT is on": it was off.
  - "The clock = heat/8 + plants/8": energy stock, blue actions and cards in hand were missing.
  - "Economy first pays off": our production peaked in gen 6, one production phase before the end.
  - "An attack denies a milestone": they recovered the same turn.
  - "A blue-card lead wins the award": the Vitor player out-built us.
  - "Board.md and the plan file agree": the gen-6 plan still said gen 9 while board.md said gen 7.
- Resource-removal targeting (principle: value = the opponent's end-of-game VP actually lost). Simulate each target's
  plants per remaining production (including the final post-game conversion) with and without the hit, and count
  greeneries lost by game end, not "who has most income". Comet case: green 8 plants, 0 production, oceans maxing
  (Arctic Algae dead) → the hit permanently kills a greenery (~2-3 VP off the leader). Black 5 plants +4/gen with 2
  productions left → still reaches 1 greenery at the final conversion, so the hit mostly delayed it (~0-1 VP). Green
  was the right target; the error came from assuming a longer game.
- Early city placement (principle: project where greeneries and oceans will be, and whose they'll be). With no
  greeneries or oceans on the board yet, an isolated spot with many empty neighbors (game 2, space 56) only pays if
  WE will fill it. Arklight with 0 plant production won't. Prefer spots next to oceans ALREADY placed (+2 M€ each, paid only at placement; oceans added later pay the placer, not us)
  and near where plant-heavy opponents will expand, so their greeneries score for us. Don't count a milestone (Polar
  Explorer) unless we have a real path to all 3 tiles. The main agent must check the Tactician's placement against
  lessons, not accept it blindly.
- When gaining a trade fleet (Space Port etc.) or a colony plan, plan the payment in the same breath: energy or
  titanium production (3 per free trade) or cost reducers. A 9-M€ trade nets ~0; an energy trade nets its full value.
- Compare cost per unit of the subgoal across ALL sources before committing: e.g. energy via Callisto colony (17 M€
  for +1 prod plus an opponent-dependent bonus) vs energy cards (~4-6 M€ per prod) vs the SP (11). Pick the cheapest
  reliable path, and keep the expensive one as a fallback with explicit trigger conditions.
- Estimate count-based VP (cities in play, tags, tiles) from evidence: the current board plus the same group's
  previous final counts, not a hopeful projection. I projected 9-12 cities for Immigration Shuttles; the same group
  ended the previous 5P game with ~7-8, so ~2 VP. Then check the buy against the engine cutoff. A 31-M€ production
  card played in gen 3 of a 7-gen game is only about break-even.
  Refinement: don't over-index on the current board either. Forecast cities from drivers: opponents' greenery or plant
  engines (they want cities to score greeneries), city corps and preludes (Tharsis etc.), city-rewarding milestones
  and awards in this game (e.g. Architect, Urbanist, Cosmic Settler), city cards seen in the draft, and the previous
  game's count as a baseline.
- Evaluate cards as parts of our engine, not one at a time. For each card ask which live subgoals and engines it
  feeds (e.g. Arklight: animal/plant tags → animals; award: production-changing cards; tags toward a milestone;
  resources that feed a converter card), what it enables next, and whether its value decays with time (production,
  accumulators → play early) or not (TR events → can wait). A card that advances 2-3 of our threads beats a
  standalone card with a higher face value.
- Clock: in the draft, apply a pre-written rubric (tags we want, hate list, max buys) and pick within seconds.
  Never run slow shell/python checks while a pick is pending.
- Award choice (principle: fund where our lead is STRUCTURAL, not just current). Rank awards by who keeps adding
  to the metric: an engine only we have (Arklight animals → Zoologist) is safe; a generic metric that every player
  grows (A. Engineer: any production card) is contested, especially in 4-5P. Game 2: I funded A. Engineer first on a
  5-3 count, and blue tied it within 2 gens, while Zoologist (2-0, corp-driven, animal cards gated by O2) was the
  safe first award at 8 M€ and ended up costing 14.
- Resource awards (Zoologist, animal/microbe counts): project the lead to game end, not the current count. Most
  animal cards are gated by O2/temperature and flood in mid-late game, so an early 2-0 lead can vanish. Keep late
  accumulator cards (Fish) instead of selling them, and hate-draft animal cards once the award is funded.
- Plans expire within a round (game 2, gen 5: Pets tied Zoologist, blue tied A. Engineer, the last milestone slot went,
  and Polar Explorer died). Write plans as "if X still holds → Y", list the assumptions, and re-verify before each
  action. That is the purpose of the event-driven agent team.
- Clock efficiency: all thinking and agent work happens while others play. On our turn, run one `scripts/turn.sh`
  call, check the EXECUTE block's ASSUMES line against the state, and run the commands chained in one Bash call.
  Messages to agents go out after the move is submitted.
- A turn should take seconds: decide before it starts. The plan is a decision tree finalized while the player before
  us acts (prewatch.sh). Game 2: I spent ~30 s on our clock weighing Ceres vs Luna and choosing Business Contacts
  cards. Those choices belong in the tree as branches.
- Turn latency comes from (1) unanswered follow-up prompts: the clock runs until the main agent reacts, (2) a new
  Node process + TLS handshake per tm.sh call (~2 s each), (3) watcher polling. Fix: go.sh = one `batch` call with
  every follow-up answered, and autogo polling every 1 s.
- Global track bonuses need an owner in the plan, not just a mention. Game 2: the Scout noted the O2 8% temp bonus, but
  nobody planned to take it; Plantation drawn mid-turn at 7% could have taken it (+1 free TR). The plan must list,
  for each track: next bonus, steps away, who reaches it first in turn order, and which of our cards land exactly on it.
- Pre-written turn scripts must stop after any mid-turn card draw (Sub-Crust, Business Contacts, Spin-off...) and
  hand back, because a drawn card can change the best second action.
- Endgame clock: count opponents' CASH, not just heat/plants and cards. In the final 1-2 gens players dump money into
  standard projects (Asteroid 14, Greenery 23, Aquifer 18), so the remaining steps close far faster than card-based
  forecasts suggest. If we're first player in the likely last gen, take the open parameter steps on our first turn.
- Last-gen VP price cap: once Mars is terraformed, Air Scrapping (15 M€ → 1 Venus TR) sets the ceiling. Never pay
  more than ~15 M€ per VP in the final gen; rank everything below that by M€/VP.
- Map scan in the last 1-2 gens: list empty spaces where a city would touch 2+ existing greeneries (anyone's). A City SP
  there = adjacent greeneries + city-count card VP (e.g. Immigration Shuttles per 3 cities) + Urbanist-type awards,
  minus what it feeds opponents (Pets-type cards). Worth it at ≤15 M€/VP (2+ adjacent greeneries). Reserve the cash
  for it when planning the final gen. Also place final greeneries next to our own cities.
- Track the draft: every pick shows us the cards we pass to the neighbour. Record them (passed.md: gen, recipient,
  cards) and have the Scout turn them into "likely in opponent X's hand" with a playability date. Plan defenses in the
  tree (e.g. convert plants before a known Birds/asteroid; don't feed a known award racer) and hate-draft copies.
- Greenery placement is defensive too: each greenery scores for every adjacent city of any owner, and it creates a
  spot where an opponent can later place a city to score off our greeneries. If we won't place more cities, put
  greeneries next to OUR cities and away from opponents' cities and open city spots. In the final conversion (no
  cities can follow), just maximize our city adjacency and avoid touching opponents' cities.
- Example (game 2, gen 8): our greenery on 61 gave an opponent's city and Urbanized Area +1 VP each, while 62 (only our
  city, plus ocean 63 = +2 M€) was open. Rule: every planned tile placement lists each candidate's neighbors (our cities,
  opponents' cities, oceans), and the main agent re-checks against the live `map` output (legal-space annotations show
  adjacency) before placing. Never place from a stale pre-picked id.
- Greenery pairs create city bait: an empty space touching 2+ greeneries is worth ~2 VP to whoever places a city there.
  When placing greeneries, check which empty spaces they'd leave touching 2+ greeneries. Either keep such a spot for
  a possible own follow-up city (a VP option in the tree, not a commitment; weigh it against other uses) or avoid
  creating it. The
  Scout/Strategist list current "city bait" spots and who can take them first in turn order.
- Stalling / tempo (general principle): delaying can be worth more than acting now, because opponents may create a
  better scenario for us. The example below is one case, not the rule. E.g. a track bonus is 2 steps
  away and we hold a 1-step raise: let an opponent take the first step, then land on the bonus. Tools: take a cheap or
  neutral action (a blue-card action, 1-action turn) or play other cards first, keeping the key raise for later in the
  gen. Weigh it against the risk that someone else takes the bonus, and against turn order (how many players act
  before our next turn). Put it in the tree as a "hold until X" branch.
- Game 2 result: 2nd of 5 with 62 VP (blue 65). Game 1: last with 45 VP (winners 64). What changed: fast-economy
  opening sized to a 7-8 gen forecast, a structural award (Zoologist via Arklight) + A. Engineer, event-driven agent
  team with decision trees and auto-played guarded batch scripts. What still cost the win (~3 VP): missed the O2 8% bonus,
  a greenery fed opponents' cities, an isolated first city. (Funding A. Engineer first cost only ~6 M€, not VP: we won
  both awards.)

## 2026-09-26 — Game 2 deep postmortem (5P Arklight, ended gen 8: blue 65, us 62, yellow 58, green 58, black 56)
Data: VP by gen us 20,27,27,36,37,44,50,62 vs blue 23,25,34,40,41,48,55,65. Steps/gen 4,2,4,2,6,8,12,4.
- **The gap was set in gen 3 and never closed** (§-1.8, §4.2): blue +9 that gen (Tactician 5) while we gained 0 building production; we then trailed by 4-5 every gen. All 3 milestones went in gens 2, 3 and 4 (yellow 10 VP, blue 5, us 0). In 5P, score "which milestone can we claim by gen 3" as part of the opening; with none, we start the race 5 VP down.
- **Board VP was the biggest non-TR gap** (§-1.6): blue got 6 greeneries + 8 city VP = 14, we got 6. Blue's pattern: plant production 3-5 from gen 2 → a greenery almost every gen (gens 1, 3, 5, 6, 8, 8), a City SP in gen 5 between its own greeneries (it ended with 4 adjacent), then 2 late cities into existing greenery pockets (4 VP). 3 of those 8 city VP came from other players' greeneries (ours at 55, green's 40, black's 42). In 5P a plant engine plus our own city is ~2 VP per greenery. We had 0 plant production until gen 7.
- **Correction to the gen-8 "61" example above:** 61 touches only 55/56/60/62, so it fed no one. The real feed came in gen 6: our Plantation greenery at 55 plus our city 56 turned 49 into a spot next to 2 cities and 2 greeneries. Blue's Urbanized Area went there for 2 VP (+2 M€ prod). Plantation on 62 (city +1, ocean +2 M€) would have held that city to 1 VP. When scanning for bait, count spots that become legal for "adjacent to 2 cities" cards too, not just spots next to 2 greeneries.
- **Missed denial city** (§4.4 blocking): at gen 8 T1 (we were first) space 48 was a legal city next to 2 greeneries. A City SP for 25 M€ = +2 adjacency +1 Shuttles (12th city) -1 Vermin = +2 VP, and it would have made 41 and 49 illegal for cities. Those were black's and blue's gen-8 cities, worth 2 VP each. Funded by dropping Fish + Sponsored Academies (18 M€, 2 VP), that's roughly +2-3 relative vs blue, enough to tie or win. In the last gen, value a city as own adjacency + the opponent spots it blocks.
- **Opponents gain ~10 VP in the final gen** (blue +10, black +10, yellow +8, green +14). Our gen-8 VP race held the leaders at their current totals ("blue 55"). Forecast each rival's last gen as: cash/10 + greeneries from plants (×2 with a city) + TR cards known in hand + cities into open pockets. A deficit entering the final gen has to come from relative moves (denial, blocking), not our own VP alone.
- **Repeatable TR engines beat one-shots** (§-1.2): green got 17 TR from cards and actions (Pharmacy Union +1 TR per science tag ×6, Water Import ocean action ×5, Terraforming Ganymede 4, Nitrogen from Titan 2) and no cities. Black got 7 free TR from a once-per-gen prelude action, plus 4 Io heat trades. A 1-TR-per-gen action started in gen 1 is worth ~7 VP. Price it that way in the opening and the draft.
- **Check for thieves/attackers before investing** (§-1.5): blue's Ants took 3 Tardigrades microbes (gens 6-8), leaving us 0 VP and blue +1 (6 actions + 7 M€ for a -2 relative). Blue's Birds (Inventrix meets the O2 requirement 2 early) hit our Bushes the turn after we played it: -4 plants, about the missing 2nd final greenery. If a resource thief or production attack is in play or playable, skip slow 1-VP-per-4 accumulators and play exposed production after the attack is used.
- **What worked:** Vermin was worth ~5 relative VP: Zoologist 18 vs 9 instead of 8 vs 9 (+3), and its -1 VP per city hit yellow 4, black 3, blue 3, us 1. A global penalty on a stat opponents build more of than we do is a strong buy. Both awards (10 VP for 22 M€). Only 2 draft buys went unplayed (vs 5 last game). ~7 M€ unspent at the end.
- **Late draw is dead:** in gens 6-8 we drew ~15 cards (Pluto trade 4, Sub-Crust, Business Contacts, Sponsored Academies) and sold 13 for 1 M€ each. The gen-7 Pluto trade (3 energy) scored 0 VP. From the second-to-last gen, trade and spend for resources that convert before the end (plants for the final greenery, M€).
- **Forecast check** (§-1.1, §-1.11): gens 1 and 3 said the last gen was 7, gen 5 said 8-9; it ended in gen 8. The early calls leaned on last game's gen 7, but gens 1-4 here ran only 2-4 steps. The pace rule ("next gen ≥ last; last gen when steps left ≤ 1.2 × last gen's steps") was correct from the end of gen 6. City forecast was 8-9; actual was 11 (4 off-Mars: Phobos, Ganymede Colony, Dawn City, Luna Metropolis; 5 cities in gen 8 alone), so count space-city cards. The gen-5 Zoologist call ("green wins 6-7 vs 5-6") counted only cards in hand. Green's Pets reached 9 via cities, and we reached 18 with a Vermin drafted later. Project award races with the draft still to come, and include count-driven triggers like cities.
- Milestones are not free 5 VP: price the PATH, not just the 8 M€ claim. If our engine naturally reaches the
  requirement (tags or resources we'd get anyway), it's cheap and worth racing. If reaching it means buying off-plan
  cards, tiles or tags, count that spend and the plan VP it displaces, plus the chance an opponent claims first (turn
  order, 3-slot pool). Often sticking to the engine scores more. The planner should mark each milestone as "on-engine"
  (race it) or "off-engine" (only if cheap and uncontested). Game 2's "milestones set the gap" means: pick openings
  and engines whose natural path touches a milestone; don't chase ones they don't touch.
- Passed cards feed milestone and award races. Before passing a pack, check whether any card would move the receiving
  neighbour (or players further down the pass order) toward a milestone we're racing or an award we lead (tags, city
  tags, requirement cards, resources). That's a hate-draft candidate. The Scout uses passed.md to estimate each opponent's
  milestone completion ("blue got 2 requirement cards from us → Tactician likely by gen 3") in the race table.
  Drop a milestone from these checks once it is claimed, and drop all milestone checks once 3 are claimed. Same for
  an award once the outcome is locked.

## 2026-09-26 game 3 (Hollandia board)
- Boards differ: check `boardName` and special space types in /api/player game.spaces at setup (e.g. Hollandia
  "deflection" spaces: a player whose tiles are ALL there can't lose plants). The map render now marks them `d`.
  WGT is in gameOptions.solarPhaseOption; read it, don't assume it from Venus being in play.
- (game 3, gen 6) Armed a turn (GHG) without re-checking which hand cards had just become playable: temperature had
  reached -4°C, so Artificial Lake (1 VP + 1 TR for 5 steel + 5 M€) was cheaper per VP and got squeezed out. Before
  arming go.sh, re-list playable hand cards against the live parameters (requirements unlock mid-gen) and re-rank.
- (game 3) Space prompts vary in wording ("Select space for ocean tile", "Select a land space to place an ocean tile").
  In go.sh match space follow-ups with ["if-pending","^root <space>","space","a|b|c"], not a title phrase.
- Game 3 result (Hollandia, 5P): tied 1st on 66 VP with yellow, ahead on the M€ tiebreaker (65 vs 48); green 64,
  black 63, red 56. What worked: an opening engine that reached two milestones (Energizer + Builder) by gen 3,
  Contractor funded on a structural lead, steel/Ti turned into VP, a late TR push (Magnetic Shield, Venus combo), and
  auto-played turns. What cost points: Banker flipped to green (a generic metric), our planned city spots were taken
  (24, then 31), and Artificial Lake was squeezed out in gen 6 by a stale plan.
- (game 3, user feedback; corrected) Traded Io for 8 heat when temperature was ALREADY maxed (black's greeneries hit the O2 8% bonus step before our turn; Comet's temp step was wasted too). The go.sh
  guard checked energy, not the temperature track. Also Banker flipped late: M€ production is easily swung by single
  cards. Folded into lessons.md §5 (volatility) and §7 (value resources at execution time).
- (game 4, gen 3) Bought Import of Advanced GHG for an Economizer claim one gen away, instead of Giant Ice Asteroid's sure
  TR while oceans were open. Red was already able to claim Rim Settler, so only ONE milestone slot remained, and black
  took it (Mayor) before our gen-4 turn. Before investing in a milestone path, count the slots left once rivals'
  ready claims land (anyone who can claim now counts as claimed); with one slot left, only a same-turn claim is safe.
- Game 4 result (Arabia Terra, 5P, 9 gens): 5th on 71 VP (green 87, red 86, yellow 81, black 76). TR 48 was the
  best on the table (+12..22 over each rival) and TR also paid ~48 M€/gen, so TR was not the problem. The gap was
  cards 8 VP (rivals 28-48), cities 5 (13-18) and awards 0. Root cause (user diagnosis, confirmed in the log): the
  opening gave "hammers" (Supply Drop 8 steel, Ceres steel prod + steel trades) but the draft never treated steel as
  currency. We passed the steel sinks (Space Elevator: 1 steel -> 5 M€; Advanced Alloys; building-tag cities Lava
  Tube Settlement, Noctis City, Domed Crater; Industrial Center, Ironworks) and then paid 25 M€ for a City SP and
  ~145 M€ for 10 Asteroid/Air Scrapping SPs, which accept only M€. We ended with 8 steel + 4 Ti idle. Also: we spent
  draft picks on cards we then didn't buy (Luna Metropolis, Livestock in gen 3, Vesta Shipyard, Security Fleet,
  Soil Studies...) instead of steel sinks or hate picks, and only bought 13 cards in 8 drafts, so the hand ran dry
  and M€ flowed into standard projects at ~14-15 M€/VP. First trade was gen 5 despite the colony opening.
- (game 4, gen 9, user note) Red's +12 in the final gen came from hidden end VP: a Miranda trade adding 3 animals to
  Stratospheric Birds (1 VP each; the track had been left to grow), Omnicourt (+2 TR held to the end), then City SP +
  Air Scrappings from cash. We acted first in gen 9 and traded Triton for 3 Ti we never spent; user: don't spend late
  actions to deny points; in 5P the others gain and we still fall behind. Track hidden VP to forecast, not to deny. Scout now tracks hidden end VP and refill tracks from 2 gens before the end.

## 2026-10-04 game scfff31fbb50e (orange, Kuiper, 5P Prelude+Venus+Colonies) — 21 M€ left at game end
- Ended with 21 M€ unspent: 2 short of a Greenery SP, and nothing else on the menu scored (temp/oceans/Venus maxed,
  all 3 awards funded). The user rightly called this a planning failure.
- Root cause 1: in gen 8 and gen 9 research I bought 0 VP cards because "budget exactly used" by a plan that assumed
  gen 8 was last. Refugee Camps (13 incl. buy, 1 VP/gen → 2 VP once gen 9 happened) and Teslaract (17 for 1 TR) were
  passed. A cheap VP card is the hedge that converts leftover cash whatever the clock does.
- Root cause 2: the final-gen plan said "~12 M€ left, doesn't matter" and I accepted it. Leftover is never fine:
  either find a sink (buy a VP card in research, keep a cheap VP card in hand) or reshape payments to hit a 23 M€
  greenery (pay space cards fully with Ti, Titan trade with M€ vs Ti, etc.). Compute final cash to the M€ before research.
- Root cause 3: once tracks max, our engine's sinks die (Kuiper asteroids, heat 10 wasted). Late-game plans must list
  which sinks remain after each track closes and keep one VP sink that needs no open track.
- Rule: at the last 2 research phases, compute (cash + income) − planned spend; if > 0, buy the best VP card ≤ ~15 M€/VP.
- FINAL (gen 9): yellow 84, red 79, blue 76, us 75, black 70 → 4th. We led 60-51 entering gen 8 and lost it.
  - Space Baron flipped twice: red (PhoboLog, Ti prod 6+) went 5→11 space tags in gens 7-9; our funded award paid
    red 5 and us 2. A funded award on a metric a rival's engine pumps (Ti flood + space cards) is not structural; we
    should have kept a +2 buffer by drafting/buying every cheap non-event space tag (we passed Sulphur Exports gen 7).
  - Forecast missed by 1 gen (said 8, was 9) because O2 stalled; our engine (temp/ocean sinks) ran dry once those
    maxed, while the leaders kept scoring from card VP (yellow cards 34, black 40) and board (red/blue city 7-8).
  - Board VP was our weak spot: 2 greeneries, city VP 2 vs 7-8 for the top three. One city + no plant engine.

## 2026-10-04 game s8bf7cd8b5126 (orange, Polyphemos, 5P) — stranded titanium (user feedback)
- Final gen: 5 Ti (=15 M€) had no sink. I passed 16 Psyche in the gen-6 draft buy to "save cash"; it was the only space
  card that would have turned the Ti into 2 VP (+1 Celebrity). Then I spent 3 Ti on a Europa trade (+1 plant prod, +1 M€)
  that could not score: plant prod never reaches 8 plants in the last gen, and the M€ wasn't needed.
- User called the trade a serious mistake. The trade itself cost 0 VP (Ti has no other use without a space card), but the
  real error was upstream: the final-cash rule must count Ti/steel stock too, and buy the card that converts them.
- Rule: at the last 2 research phases, list every stock (M€, steel, Ti, heat, plants) with its sink. A card payable mostly
  by an otherwise-dead stock is nearly free VP (Psyche: 14 M€ + 5 dead Ti for 2 VP). Never take actions whose gain can't
  convert to VP before the end; if nothing converts, just pass.
- FINAL (gen 7): black 62, blue 61, us 60, yellow 59, red 56 → 3rd, 2 VP off 1st. Forecast "gen 6" was 1 gen short.
  - Winners of a close game: 2 VP = the 16 Psyche skip (Ti stranded) or ~8 M€ + 4 steel left at the end.
  - Board VP again 0 for us (no Mars city, no greenery): the gen-5 city was dropped for Earth Elevator, and later
    "gen 6 is last" made city+greenery look poor. Black/blue each got 2 city VP + greeneries.
  - Neptunian Power Consultants was excellent late (6 VP for ~33 M€ incl. other players' oceans, steel-payable).
  - Celebrity funded on a 3-2 lead ended tied 5-5 with red (both 5 VP): needed Asteroid Mining late to hold the tie.

## 2026-10-04 game s1b1375fcb925 (orange, Philares, 5P) — lost Pioneer race in gen 1 (user feedback)
- Built a 3rd colony with the 17 M€ SP to claim Pioneer, but Philares' forced first action used one of our two
  actions, so the claim slipped to our next turn. Black was Poseidon (forced first action = free colony): it reached
  3 colonies right after us and claimed Pioneer. Our colony also gave black +1 M€ prod (Poseidon effect).
- Checklist item 4 (races) already existed: enforcement gap. I never read opponents' corps/first actions before
  racing. The race was unwinnable once the claim couldn't happen this turn; the right play was the 13 M€ Luna trade.
- Fix: before any gen-1/2 race, read every opponent corp + forced first action + preludes; and count our own
  actions (forced first actions consume one) so "build + claim" really fits in the same turn.
- Follow-up (user): I also forgot our OWN forced first action (Philares greenery) used one of the 2 actions. When
  that became visible (the greenery prompt came first), I still ran the pre-made "build colony + claim" batch instead
  of re-deciding. A plan step whose premise just broke must stop the batch and trigger a fresh decision.
- FINAL (gen 7): black 85, us 63, blue 59, yellow 57, red 56 → 2nd (best of the 3 games with this group).
  - What worked (lessons enforced): city by gen 2 + 2nd city gen 6, greeneries next to our cities, no rival city fed
    → board 12 VP (5 greenery + 7 city); Cultivator funded on a structural plant-prod lead → 5 VP; Urbanist tied 1st;
    steel had sinks all game (Neptunian 8 VP incl. rivals' oceans, Strip Mine, WSP, Greenhouses); final cash ~0.
  - Misses: Pioneer race (opponent corps unread, own forced action forgotten); 3 Ti stranded (Phobos dropped when the
    last award slot cost 20 instead of 14 after black funded first — still the higher-VP line); plants wiped once by
    black's asteroid (converted immediately afterwards).
  - Clock: forecast gen 7 (range 6-8) correct.

## 2026-10-11 (game s1981122f2de6, 5P, Stormcraft)
- Gen 3: green claimed Rim Settler (3 jovian tags) a turn before our Cloud Tourism play. I planned the corp around it but never counted green's jovian tags (Jovian Lanterns, Titan Floating Launch-pad, Saturn Surfing) while drafting. Checklist 4: run `races` each gen start and play the milestone-enabling card FIRST when a rival is within 1-2 cards.
- Gen 6 (2026-10-11): ignored `stocks` "!! CONVERT NOW" (8 plants) to play Big Asteroid + Callisto trade first; red then removed 2 plants and the greenery slipped. Also played Big Asteroid whose plant-removal had no target. Fix: SKILL.md per-turn step makes `stocks` flags the first action; attack cards need a verified target. The trade could have been paid in M€ (9) instead of Ti.
- Gen 6 (2026-10-11): traded Callisto for 13 energy (-> 13 heat at production) valuing it as 1.6 TR, with temperature 5 steps from max, blue adding ~8 heat/gen and us last in gen 7 turn order: the heat may never convert. Rule: price converter-dependent resources (heat, energy, plants) only if the track still has room when we can act, accounting for turn order and rivals' raises.

## 2026-10-11 POSTMORTEM, game s1981122f2de6 (5P, Stormcraft). Final: yellow 85, green 69, blue 63, red 62, us 58 (5th).
- Method: TR/Venus-floater engine (TR 20->37) + 3 cities + 1 greenery + A.Engineer funded. Card VP only 14 vs yellow 35, green 25. TR alone does not win 5P.
- Forecast misses: setup said last gen 7-8, actual 8 (ok). Analyst clock said 9-10 three times (wrong); `clock` was right. Hidden-VP estimate "hand/3" was wrong by 3-4x: yellow held 17 cards + 40 MC, passed, then scored 35 card VP + won A.Engineer (14 vs our 10). Rule: a rival with 12+ cards and unspent cash can play the whole hand in the last gen; price any award we lead by their hand, not the current count.
- A.Engineer: funded 14 MC at 10 vs 8 with one gen left and a 17-card rival: gave yellow 5 VP. Violated lessons 5 (leads of 1-2 flip). Do not fund on a <3 lead unless the lead cannot be flipped by one gen of plays (rivals' hands count).
- Milestones: lost Rim Settler (green, gen 3) after building the corp around it; never counted green's jovian tags. 3/3 gone by gen 4; we claimed 0 (gen 1-4 opponents claimed).
- Colonies: fleet idle gens 1-5 (0 trades until gen 6); built 0 colonies; rivals took Luna 13 / Triton. Added trade check at research and per turn.
- Process errors (all enforcement gaps): subagent Analyst skipped for 3 gens (setup step missed); ignored `stocks` !! 8-plants flag (lost 2 plants); played an attack asteroid with no target; priced energy->heat with temp near max and us last in order; placed a greenery 'for TR' without re-checking O2 right before submitting (O2 maxed first, no TR).
- Cost: $15.0 total (main $14.91 Opus then Sonnet, 5 Haiku Analyst runs $0.08). Analysts are cheap but their numbers need verifying (stale event lines, wrong clock).
- What worked: Stormcraft floaters -> Balloons Venus steps (TR), Phobos/Luna Metropolis/Field-Capped cities as VP+prod bundles, Big Asteroid Ti paying the trade fee.
- 2026-10-11 game s26842f6502e5, gen 1: board space 33 had an unfamiliar bonus label `temp4mc` (user: heat/temperature for 4 M€). I placed both Established Methods cities elsewhere without decoding it. Rule: decode every unrecognized placement-bonus label (compare with the map legend / `cards`/api) before placing tiles; special spaces are worth planning city/greenery around.
- 2026-10-11 game s26842f6502e5, gen 6: funded the 3rd award (Landlord, 20 MC) immediately on an Analyst "(est) blue likely funds Benefactor" claim, without checking the evidence (no rival had funded an award in 5 gens) or pricing the alternative (greenery on contested space 30, cards/engines). User feedback: cheap early awards (8, 14) make sense; the last 20 MC one felt rushed. Awards only score at the end: fund the last tier as late as the observed rival behavior allows, and compare it explicitly with the best alternative outlet (greenery/card) including timing.
- 2026-10-11 game s26842f6502e5, gen 7-8: funded Banker (8 MC) on +13 vs yellow +4 prod. Yellow played Luna Metropolis (+7) and passed us (18 vs 15->17); yellow gets 5 VP from an award we paid for, we get 2. Yellow finished within 1 VP of us: unfunded, we would have led by ~2 VP. Same failure as game 1's A.Engineer (rival hand dump). Fix: fund awards only when locked, normally the last gen.
- 2026-10-11 tool bug: scripts/clock.js counted stock (heat/plants/cash) only in the 'action' phase, so during drafting/research the FORECAST was ~1 gen too long (said earliest 9 when gen 8 could close). Fixed: drafting/research now count stock. Don't trust a forecast read in draft before this fix; recompute by hand: temp from heat/8, O2 from plants/8 + SP cash/23.

## 2026-10-11 POSTMORTEM, game s26842f6502e5 (5P, CrediCor). Final: blue 76, yellow 74, red 56 = us 56, green 49 (3rd/4th tie).
- We funded all 3 awards (8+14+20 MC). Final: Banker tie 17-17 (yellow and us), Urbanist and Landlord both went to BLUE (Arcadian: cities 3 -> 8 in two gens, 80 MC saved for the last gen). Awards gave blue +10 and yellow +5; we got 9. Early/unsafe funding handed rivals 15 VP.
- Last-gen jumps: yellow +9, blue +10-12, red +7, us +6. Card VP at the end: yellow 39, red 21, blue 13, us 5.
- Led entering gen 8 (56 vs 52-54) both games; fix is the closing protocol (lessons.md) + fund awards last with a per-rival one-gen swing check (corp, tableau, cash, hand).
- Worked: Mayor gen 1 (Established Methods + Lava Tube), city chain 38/29/30 greeneries (4 VP each), Ganymede trade to hit 8 plants, board.js tool, Analyst each gen start (but its numbers were stale/wrong 5+ times: verify against brief/races/clock), clock.js bug found and fixed.
- Didn't work: engine buys in gens 3-4 paid back ~1x, almost no card VP/flow, banker/awards funded early, last 2 gens cash too low to convert.
- 2026-10-11 game s31f47dfa072b gen 1: traded Luna (7 MC) paying 3 Ti (worth 9 MC in space cards) for a net -2 MC and +2 MC to red, justified as 'idle Ti' and 'Capitalist margin'. User: not worth it; we were first next gen and uncontested for the Capitalist milestone. Rule: price stock at what it will buy; check contention before bending tempo for a race.

## 2026-10-11 POSTMORTEM, game s31f47dfa072b (5P, Polyphemos). Final: yellow 72, us 61 (2nd), red 58, green 54, blue 47.
- Better than games 1-2 (58, 56): Capitalist claimed gen 2 (5 VP uncontested), city chain with one-space gaps (cities 25/32/16 + greeneries 24/33/17/23/40/41: 4 VP each for the two-city ones), Urbanist funded gen 4 on a lead of 4-0 and held (12 vs 5), Wave Power/Space Station/Public Baths as cheap VP, board.js tool, the three Haiku agents (Strategist goal tree, Tactician layouts, Scout rival data).
- Lost to yellow's card engine again: card VP yellow 14 -> 27 in the LAST gen (+13) vs ours 6; Promoter (events) 5 VP to yellow, Hoverlord 5. Agents' 'dump +7-10' per rival understated yellow (+13): estimate each rival's dump from its own hand size and card-VP history, not a flat number.
- Card pipeline: bought 0 cards in gens 3-4 (weak packs, Polyphemos 5 MC/card); never found 2-VP cards at <=6 MC/VP except Public Baths. Polyphemos' +5 prod was good early but made the card-VP route expensive; with a card-VP rival at the table a cheaper-card corp (CrediCor 3 MC) or earlier card flow (Pluto trades, draw cards) may be better.
- Process errors: agents spawned one wait early (gen 4: stopped within seconds); reports stale by 1-2 events (verify vs live); trade for 7 MC paid with 9 MC of Ti (gen 1); drafted with too much denial pick-ing in gens 6-7 (fine for denial, but no VP source came from drafts).
- Cost: session $80 (main $79.47 at avg 392k context/call; ALL agents $0.70, ~18 Haiku runs this game ~ $0.35 + one stopped Sonnet $0.22). Agents are ~1% of cost: the lever is a fresh session per game for the main thread.
- 2026-10-11 game 3 trajectory (approx, from snapshots): us 33/38/44/49/55/61 at gen ends 2-7; yellow ~22/29/31/40/55/72. Our growth flat ~5.5/gen; yellow +2,+2,+9,+15,+17. Last gen: yellow +17, red +16, blue +12, us +3 net. Our income was the highest at the table, our conversion rate (7-8 MC/VP in tiles) the worst: rivals ~3 MC/VP via cards/accumulators/awards. Fix in lessons.md "Linear vs convex VP".
- 2026-10-11 game 3 last-gen log read: yellow ~16 actions (Solarnet, Development Center, Anti-Gravity Tech, Orbital Cleanup, Hospitals/Weather Balloons/Celestic actions paying +9/+7/+8 MC, Self-replicating Robots -> Interstellar Colony Ship 4 VP, Venus Waystation); red ~20 (Terraforming Ganymede +3 TR, Luna Metropolis, Outdoor Sports, Forecaster funded, Floyd Continuum +9, sold 7 patents, plants->greenery); blue ~14 (Molecular Printing +14, Mangrove greenery, Fish, 2 greeneries from plants, sold 4); green ~7. We: 2 greeneries + sell, then passed with 2 MC. Gated VP cards we passed earlier (Warp Drive, Atmoscoop, Interstellar Colony Ship, Anti-Gravity) were the winners' cheap VP once the science tags existed.
- 2026-10-11 user guidance: never hardcode generation numbers in rules; express timing as shares of the expected game length or as state conditions (steps left, income), recomputed every gen from `clock`.
- 2026-10-11 game 4: all 3 milestones gone by gen 2 (blue Capitalist + Mayor via Vitor loan/Nobel/Immigrant City, red Specialist). Milestones at this table go in gens 1-2: at setup compute each rival's fastest milestone (incl. cash-holding Capitalist) and decide to race or to concede; do not assume uncontested.

## 2026-10-11 POSTMORTEM, game sd56e3aebe98b (game 4, 5P, UNMI + Terraforming Deal). Final: blue 81, red 75, us 73 (3rd), yellow 66, green 56.
- Best of the 4 games at this table (58, 56, 61, 73) but still 8 behind blue. VP by gen start: us 36 (g4), 49 (g6), 59 (g8) -> 73; last gen: us +14, blue +17 (64->81, cards 14->25 + awards 5->7), yellow +20 (46->66, hand 37 cards), red +11, green +2. Same shape as games 1-3: rivals' last-gen dumps again 11-20.
- What worked: UNMI + Terraforming Deal engine (TR 22 -> 43 at ~1 M€ net per TR, Project Inspection repeating the UNMI action); Refugee Camps + Birds as free end-game VP actions; first city only at gen 6 via Field-Capped City (late); greeneries adjacent to my own city (each +2 VP); not funding any award (red funded Cultivator in the last gen and we still held first with 7 greeneries vs 5: +5 VP free-ridden); as first player in the last gen taking the last ocean (Lake Marineris) + heat step ourselves, so rivals lost their cheap TR outlets.
- Last-gen tricks worth repeating: (1) a tile placed next to an ocean refunds 2 M€ per adjacent ocean: count it when checking whether two greenery SPs (23 each) are affordable (42 + 2 refund + 2 sold cards = exactly 46); (2) `sell` counts as an action: selling 2 cards as the 2nd action ended the turn before the 2nd greenery; sell BEFORE the first spend only if it is the first action, else plan the order; (3) after a rival funds the last award slot, the award is a pure tile race: compute each rival's end plants (stock + production, converted after the last production) + SP cash / 23 to see its max count.
- What did not work: first city only at gen 6 and 0 cards bought gens 4-5 (packs weak); production at gen 6-8 (+13/gen) arrived with nothing to buy (M€ 0 at the end, 12 M€ production wasted); Cultivator tie risk relied on red's mistakes; gen-4 closing plan correctly flagged "more VP cards" but only Lake/Birds/Miranda landed.
- Agents (Haiku, 2-3 per gen): useful for rival VP/clock cross-check and award swings; wrong or stale 4+ times (Luna/Triton trades listed after they left the offer list, Strip Mine "unplayable", events described before our plays, Scout and Strategist contradicted each other on greenery counts). Every decision that mattered (Cultivator math, last-gen order, ocean refund, first-player step denial) came from live `brief`/`races`/`board.js` checks, not from agent output. Compute looked helpful but this is confounded with corp choice (UNMI engine), the lessons in lessons.md and variance (n=1 per setup).
- Tooling notes: `wait` returns immediately while a draft pick is pending (open selection); use a shell poll on `turn --compact` for the next pack. `waitturn` returns on ANY pending input. `pick` with no arguments buys no cards. Plants -> greenery is `greenery <space>`; `space` doesn't answer that prompt.
- Cost: session total $113.43 (main $112.54, subagents $0.89) at cost.js; game 4 alone = ~$33.4 main + ~$0.19 agents (Scout+Strategist runs ~$0.01-0.03 each). Avg main context 390k per call.
