# Terraforming Mars: Competitive Strategy Reference (for an AI player)

Covers the base game, Corporate Era (CE), Prelude, Venus Next, Colonies, Turmoil, and the draft variant, with short notes on Promos, Ares, Moon and Pathfinders. It is written for the open-source online implementation (terraforming-mars.herokuapp.com, repo github.com/terraforming-mars/terraforming-mars).

Source key (cited inline in brackets):
- [RDK]: RuneDK93 dataset, win rates from about 1,500 BGA arena games played by top-25 players in 3P base+CE, plus a second set with Prelude. https://github.com/RuneDK93/terraforming-mars-dataset
- [SRC]: open-source game code, https://github.com/terraforming-mars/terraforming-mars (colony and party definitions checked in `src/server/colonies/*.ts` and `src/server/turmoil/parties/*.ts`)
- [BGS]: Boardgame Strategist, https://boardgamestrategist.wordpress.com/category/terraforming-mars/
- [BOL]: Board of Life corporation notes, https://boardoflife.wordpress.com/2018/08/03/strategic-notes-on-terraforming-mars-corporations/
- [OG]: Opinionated Gamers roundtable, https://opinionatedgamers.com/2024/06/24/how-do-you-terraform/
- [UBG]: UltraBoardGames rules pages, https://www.ultraboardgames.com/terraforming-mars/
- [N&S]: https://www.nerdsandscoundrels.com/terraforming-mars-corporations-ranked/
- [STEAM]: https://steamcommunity.com/app/800270/discussions/0/2273701484024047879/
- [BGG-LEN]: game length by player count, https://boardgamegeek.com/thread/3318220
- [BGG-CUT]: ending the game a gen early to strand engines, https://boardgamegeek.com/thread/3032535

How to read win-rate data: "win rate when played" favours cheap late-game VP and terraforming cards, because those get played by whoever is already winning. Treat it as a hint, not proof.

---

## -1. The win model (read first; everything else is detail)

The game is won by **final VP relative to the other players**, summed over the whole game. No single
generation, card or attack decides it. Every choice is an investment judged by its effect on our end-of-game
margin over the best opponent.

1. **Forecast the game length first and keep revising it.** Value depends on generations remaining, so the clock
   is the most important estimate. Measure pace (steps/gen, which accelerates), count every source (stored
   resources after production, action cards, parameter-raising cards) and assume the next gen is at least as
   fast as the last. Err short: an engine that pays after the game ends is worth nothing.
2. **Convert everything to "expected final VP".** Use the same scale for a card, a production step, a tile, a
   trade or an attack: VP it yields by game end (production × gens left ÷ M€ per VP; TR = 1 VP + income;
   tags/resources = what they unlock by the end). Compare options only on that scale, net of cost (M€, actions,
   tempo, cards not played). Exchange rate: M€ loses ~10% per gen; 1 VP ≈ 4 M€ early, ~10 M€ late (VP cards
   under ~10 M€/VP are good, under ~7 excellent; standard projects ~13-14). Production timing: energy pays a gen
   late (it's spent next gen), plant production still pays in the final greenery conversion.
3. **Plan the whole arc, not the turn.** Have a written path from our current state to ~X VP by the final gen:
   engine phase → conversion phase → final-gen dump, with the switch point set by the clock. Re-plan when the
   forecast changes, not every pick. Each card is judged by how it moves that path (does it fit our tags,
   subgoals, board position and timeline?), not by its standalone text.
4. **Relative, not absolute.** In multiplayer, a move is good by our gain minus the best opponent's gain it
   enables or denies. Drafting, attacks, placement, award funding and parameter bonuses all hand value to
   someone. Track the leader and whoever acts next in turn order.
5. **Attacks and denial are investments too.** Count the permanent cost (VP, card, action), how fast the target
   recovers, retaliation, and the free gain for the untouched players. Temporary denial rarely beats building.
   For removal, simulate each target through the remaining productions (plus the final conversion) and hit
   whoever permanently loses the most end-game VP. That's often the player with a big pile and no income, not
   the one with the highest income.
6. **Diversify VP sources for the finish.** In 3P+ the winner usually adds 15-25 VP beyond TR (milestones,
   awards, board, card VP, resource accumulators). Start those accumulators early enough to compound. In
   [RDK] data the strongest non-TR sources are plants/greeneries and animal VP cards (Terraformer/Gardener
   claimers win 50-53%); in 4P "always buy animals" [BOL].
7. **Subgoals are chains.** A card with a requirement or resource need is only as good as the probability we
   reach the requirement in time × the payoff, plus everything else the same subgoal unlocks (milestones, other
   cards, trades). Pick subgoals that stack. Card draw raises the odds, but pay for it only if it pays back in the
   remaining gens (§3.4).
8. **Keep an explicit, fluid subgoal list.** The arc is reached through 3-6 concrete subgoals (e.g. "energy
   production 6 by gen 4 → Energizer + Physics Complex", "3 colonies", "Jovian tags for Voyager", "greenery ring
   around city X", "top Curator tag"). Each one gets a target gen, what it unlocks, its current progress, and the
   competition for it. Re-rank every generation: drop subgoals an opponent has locked up or the clock has made
   too slow, add ones a new card, milestone race or board change opens. Choose cards and actions by how many
   live subgoals they advance at once.
   **Every subgoal must survive the opponents.** For each one, list who else is racing for it (same milestone,
   award, colony slot, city space, parameter bonus, card type in the draft), their distance, their income toward
   it, and **turn order** (who acts first each round, and who is first player next gen). Project who gets there
   first. If we lose the race, drop it or switch to denial. If we're barely ahead, take it on our first action.
   A plan that only works if opponents stand still isn't a plan.
9. **Expect the game to be cut short.** Good players end the game a gen early on purpose to strand engines
   [BGG-CUT]. Keep a buffer: have VP plays ready one gen before the forecast end, and when leading, be the one who
   cuts it.
10. **Scale the strategy to player count.** More players raise more steps per generation, so the game is shorter
   and production pays off fewer times. With Prelude [BGG-LEN]: 2P ~11 (11-13 without), 3P 9-10, 4P 8-9, 5P 7-8.
   - 2P: engines, card draw and discounts pay back most; build longer (to ~gen 5-6) and convert late.
   - 3P: engine through ~gen 4, then pivot.
   - 4-5P: early (gen 1-2) production should pay back within ~5-6 gens; from gen 3 favor TR, VP, accumulators
     already running, and cards that pay back within ~2 gens (production bundled with VP/TR is still fine).
     Discounts beat draw; heat + plant rushes are strong in 5P. Milestones/awards are raced harder (2nd place
     scores), and single-target attacks help the untouched players.
   Always confirm with the measured pace (principle 1) rather than trusting the table.
11. **Review against outcome.** After each game, compare our forecasts (length, VP path, opponent moves) with
   what happened and fix the estimating method, not just the specific card call.

### Plans expire fast. Re-plan on every event.
In a 4-5 player game the board changes several times between two of our turns. Game 2, in one round: an opponent
played Pets (our "safe" Zoologist lead was contested), blue tied our A. Engineer award, the last milestone slot
vanished, and the planned Polar Explorer route died. A plan written at the start of a generation is usually wrong by
our second turn. So:
- Treat every plan as conditional: "if X still holds, do Y; else Z". Write down the assumptions it depends on.
- Re-check those assumptions against the log right before acting. Never execute a stale plan because it was written.
- The Analyst (SKILL.md) refreshes the picture at each generation start and on big events, off the game clock; the
  main agent re-checks the live log and decides at the moment we move.
- Fluid is not aimless. The win model (final VP margin, game-length forecast) stays fixed; subgoals, targets and
  move order change as the game does.

## 0. The 12 commandments (read these if nothing else)

1. **Economy first, points later** (the window shrinks with player count, §-1.10). In gens 1-3 (gens 1-2 in 4-5P), buy production and discounts. Chasing points early is the most common way to fall behind by gen 4 ([BGS]; https://everythingisagame.com/terraforming-mars-strategy/).
2. **The value of anything is time-dependent.** 1 MC of production is worth roughly the number of production phases left. Around gen 1 that is about 8 MC of raw income, but after discounting and tempo it is closer to 5-6 MC. By the final gen it is worth 0 (https://playallevening.com/guide-mastering-terraforming-mars).
3. **TR counts twice.** Each TR is 1 VP plus 1 MC every remaining generation. Terraforming early is never wasted, and it also denies that step to opponents.
4. **Count generations remaining at every decision.** Most decisions come down to "does this pay back before the game ends?"
5. **Specialise.** Commit to 1-2 production types and 1-2 tag families. Don't spread across all six resources ([BGS]).
6. **Cards are the currency, but pure draw is usually overpriced.** Discounts beat draw (especially 4-5P). Value draw only if it pays back in the remaining gens, or when the plan needs specific cards; the few draw cards above average are Mars University, AI Central, Invention Contest (Olympus Conference, Inventors' Guild below). See §3.4.
7. **Milestones are the best VP per MC in the game (5 VP for 8 MC).** Commit to one from the start and claim the moment you qualify and can pay; opponents race you, harder in 4-5P.
8. **Fund an award when you lead it and likely stay ahead.** The first one at 8 MC while leading is good value; 14/20 MC tiers need a bigger lead. Funding invites competition (§4.3).
9. **Board VP is big.** Greeneries next to your cities score twice (1 for the greenery, +1 for the city). Place your cities where they can be surrounded by greeneries, including other players' greeneries.
10. **Stop buying cards in the last 1-2 generations** unless you can play them immediately for VP.
11. **Before passing in the last generation,** convert every 8 plants to a greenery and every 8 heat to temperature (while temperature is not maxed). Spend all MC on VP: standard projects, VP cards, awards.
12. **Control the game clock.** Rush the end (raise parameters) when you lead on TR and board. Slow down (avoid raising parameters) when your engine or VP accumulators are still growing.

---

## 1. Rules summary (sufficient to play correctly)

### 1.1 Setup
- Everyone starts at **TR 20**. Global parameters start at: temperature -30°C, oxygen 0%, oceans 0/9, and Venus 0% if Venus is in play.
- Choose a corporation and receive its starting MC, resources and production.
  - **Standard (non-CE) game:** everyone also starts with 1 production of each resource.
  - **CE game:** no extra production, and the deck includes CE cards. Most online games use CE.
- **Starting hand:** 10 project cards. In the research step you keep any number at **3 MC each**, paid from corporation MC. Cards you don't keep are discarded.
- **Prelude:** deal 4 preludes and keep 2. They are played before gen 1, after corporations.
- **Online draft options:**
  - Card draft each gen.
  - Initial draft: draft the 10 starting cards as 5 + 5.
  - Prelude draft.
  - Corporation choice from 2 or more dealt corporations.

### 1.2 Generation phases
1. **Player order.** The first-player marker passes clockwise (skipped in gen 1).
2. **Research** (skipped in gen 1, since the starting hand replaces it). Draw 4 cards, or draft them, and buy any at 3 MC each.
3. **Action phase.** On your turn take **1 or 2 actions**, or pass. Once you pass you are out for the rest of the generation. Play continues until everyone passes.
4. **Production.**
   - All energy converts to heat.
   - Then gain resources equal to your production. MC income = **MC production + TR**. MC production can go down to -5.
- **Solar phase** (Venus Next / World Government Terraforming, WGT). The first player raises one non-maxed global parameter. This raises the parameter only: no TR and no placement bonuses. The ocean placed this way belongs to no one. With Colonies, colony trade tracks also advance by 1 here.
- **Turmoil phase** (if in play). See section 7.3.

### 1.3 Actions (choose 1-2 per turn)
- **Play a project card** from hand. Pay its cost in MC.
  - **Steel = 2 MC** toward **building-tag** cards only.
  - **Titanium = 3 MC** toward **space-tag** cards only.
  - Phobolog and Advanced Alloys add +1 to titanium value. Advanced Alloys also adds +1 to steel value.
  - Requirements (e.g. "oxygen 5% or more", "max -10°C", "2 science tags") must be met when you play the card.
- **Use a blue card's action.** Each blue action can be used once per generation.
- **Standard project** (costs listed below).
- **Claim a milestone:** 8 MC. **Fund an award:** 8 / 14 / 20 MC.
- **Convert 8 plants** into a greenery tile (Ecoline: 7). This raises oxygen by 1 and gives +1 TR if oxygen is not already maxed.
- **Convert 8 heat** to raise temperature by 1 step (+1 TR). You can't do this once temperature is maxed.
- **Colonies:** trade with a colony (9 MC, 3 energy or 3 titanium).
- **Turmoil:** send a delegate. The lobby delegate is free; delegates from reserve cost 5 MC.
- **Pass.**

### 1.4 Standard projects
| Project | Cost | Effect |
|---|---|---|
| Sell patents | +1 MC per card discarded | Turn dead cards into MC |
| Power Plant | 11 | +1 energy production |
| Asteroid | 14 | +1 temperature step (+1 TR) |
| Aquifer | 18 | Place an ocean (+1 TR, placement bonus, +2 MC per adjacent ocean) |
| Greenery | 23 | Place a greenery (+1 oxygen step while oxygen is not maxed, +1 TR, 1 VP, city adjacency) |
| City | 25 | Place a city, +1 MC production |
| Air Scrapping (Venus) | 15 | +1 Venus step (+1 TR) |
| Build Colony (Colonies) | 17 | Place a colony |
| Lobby (Turmoil) | 5 | Send a delegate from reserve |

Standard projects are poor value early. Late, they are the VP "sink": greenery at 23 MC can be worth 2-4 VP, and Asteroid at 14 MC is 1 VP.
- **Rule of thumb** ([BGS]): Asteroid is about 14 MC per VP, so any VP card at 10 MC per VP or better deserves consideration.
- **Credicor bonus:** Credicor gets 4 MC back on the Greenery and City standard projects (and on cards costing 20+).

### 1.5 Global parameters and their bonuses
- **Temperature:** -30 to +8°C in 2° steps, which is **19 steps**.
  - At **-24°C** and **-20°C**, the raiser gets **+1 heat production**.
  - At **0°C**, the raiser places an **ocean** (if any remain), with +1 TR for the ocean.
- **Oxygen:** 0 to 14%, which is **14 steps**. At **8%**, the raiser also raises temperature 1 step (+1 TR).
- **Oceans:** **9 tiles**. Each one gives +1 TR.
- **Venus (Venus Next):** 0 to 30% in 2% steps, which is **15 steps**.
  - At **8%**: draw a card.
  - At **16%**: +1 TR.
  - **Venus is NOT an end condition** (https://www.ultraboardgames.com/terraforming-mars/venus-next.php).
- Every step you raise gives you +1 TR. Maxed parameters can't be raised further, and cards that would raise them give no TR.
- **Total:** 42 Mars steps. The track bonuses add a few more free TR.

### 1.6 Tiles and placement
- **Ocean:** only on reserved ocean spaces. Oceans are owned by nobody.
- **Greenery:** must be placed adjacent to one of your own tiles if possible, and must not go on ocean spaces. It gets your marker.
- **City:** may **not** be adjacent to another city, whoever owns it, and must not go on ocean spaces. Noctis City and some other cities go on reserved spots. Off-map cities (Ganymede Colony, Phobos Space Haven, Stanford Torus) ignore adjacency but score no greenery points.
- **Special tiles** (e.g. Mining Area, Nuclear Zone, Lava Flows, Ecological Zone, Capital) follow the rules on the card.
- **Placement bonuses:**
  - Gain the resources or cards printed on the space: steel, titanium, plants, cards, and heat on Hellas.
  - Gain **+2 MC for each adjacent ocean tile**, whatever tile you place (including oceans next to oceans).
- **Hellas special:** the south-pole space lets you pay 6 MC to place an ocean.
- **Tharsis:** Noctis City space is reserved. There are volcanic spaces (Tharsis Tholus, Ascraeus, Pavonis, Arsia) used by Lava Flows.

### 1.7 End game and scoring
- The game ends at the end of the generation in which **temperature, oxygen and oceans are all maxed**.
- After that final production phase, each player may convert plants to greeneries one last time, in player order. Heat can't be converted then.
- **Solo:** 14 generations, or 12 with Prelude. Goal is TR 63 with all parameters maxed.
- **VP sources:**
  - TR.
  - Greenery tiles: 1 VP each.
  - Cities: 1 VP per adjacent greenery, owned by anyone.
  - Milestones: 5 VP each.
  - Awards: 1st place 5 VP, 2nd place 2 VP. In 2P there is no second place. If tied for 1st, all tied players get 5 and no 2nd is awarded.
  - VP printed on cards, including VP from resources on cards.
- **Tiebreaker:** most MC.

### 1.8 Milestones and awards
- **Milestones:** max 3 claimed per game, 8 MC each, 5 VP.
- **Awards:** max 3 funded; the 1st costs 8 MC, the 2nd 14, the 3rd 20. They pay out at game end to whoever leads, **not** necessarily the funder.

| Map | Milestones | Awards |
|---|---|---|
| **Tharsis** | Terraformer (TR 35), Mayor (3 cities), Gardener (3 greeneries), Builder (8 building tags), Planner (16 cards in hand) | Landlord (most tiles on Mars), Banker (highest MC production), Scientist (most science tags), Thermalist (most heat resources), Miner (most steel + titanium resources) |
| **Hellas** | Diversifier (8 different tags), Tactician (5 cards with requirements), Polar Explorer (3 tiles on the two bottom rows), Energizer (6 energy production), Rim Settler (3 Jovian tags) | Cultivator (most greeneries), Magnate (most green/automated cards), Space Baron (most space tags), Eccentric (most resources on cards), Contractor (most building tags) |
| **Elysium** | Generalist (+1 in all 6 productions), Specialist (10 production of one resource), Ecologist (4 bio tags: plant/microbe/animal), Tycoon (15 green + blue project cards), Legend (5 events) | Celebrity (most cards costing 20+ MC), Industrialist (most steel + energy resources), Desert Settler (most tiles south of the equator), Estate Dealer (most tiles adjacent to oceans), Benefactor (highest TR) |
| **Venus add-on** | Hoverlord (7 Venus tags) | Venuphile (most Venus tags) |

(Condition wording: https://www.ultraboardgames.com/terraforming-mars/hellas-and-elysium.php, https://steamcommunity.com/sharedfiles/filedetails/?id=2814848530)

- **Other maps:** the online version also has Arabia Terra, Vastitas Borealis, Amazonis, Terra Cimmeria and Utopia Planitia, plus a "random milestones/awards" option. Read the list shown in the game UI.
- **Tag rules:** only tags on **played non-event cards** count toward tag milestones and awards. Event tags count only for Legend and similar "events played" goals. Wild tags count toward single-tag requirements.

**Which milestones and awards do well** ([RDK], Prelude dataset, 3P Tharsis, win rate of the claimer or funder):
- Milestones: Terraformer 53%, Gardener 50%, Planner 45%, Builder 37%, Mayor 30%.
- Awards: Landlord 52%, Scientist 42%, Banker 37%, Miner 31%, Thermalist 30%.

Interpretation: board presence (Landlord, Gardener) and TR correlate with winning. Mayor, Miner and Thermalist are easy to claim or fund but less predictive of a win (resource-hoard awards cost you the TR/cards you didn't convert).

---

## 2. Economy math

### 2.1 Game length expectations
| Setup | Typical generations |
|---|---|
| 2P base+CE | 11-13 (no WGT); ~11 with Prelude; faster with WGT |
| 3P CE + Prelude | 9-10 |
| 4P CE + Prelude | 8-9 |
| 5P CE + Prelude | 7-8 (our two 5P CE+Prelude+Colonies+Venus games, no WGT: 7 and 8) |
| Solo | 14 (12 with Prelude) |

- **Venus WGT** raises one parameter per generation for free, which shortens the game about 1 gen per 5-6 gens. The Venus expansion doesn't mean WGT is on: check `gameOptions.solarPhaseOption` in the first state.
- Prelude shortens the game by about 1-2 gens ([OG]: Prelude "speeds up early game").
- **5P + Prelude games run 7-8 gens, even without WGT** (game 1: 7, game 2: 8 with a slow gens 1-4 of 2-4 steps). Use measured pace from gen 3, not the last game, to pick 7 vs 8. Production bought after gen 3 barely pays back. Keep TR at or above the table average from gen 3 on. (Our lesson: +24 M€ production, the table's best, but TR 21 at gen 5 while the others had 25-29. We finished last.)
- **Remaining steps to watch:** the Mars steps left, divided by the combined "terraforming speed" of the table. Good 3P tables raise about 6-8 steps per gen by mid-game. The pace **accelerates**: our 5P game went 2,1,2,5,10,11,11+ steps per gen (42 total). Forecast next gen ≥ last gen's count, never the early average (§5.1).

### 2.2 Approximate value of things in MC (gen 1-2 of a 3P Prelude game, about 8-9 production phases left)
| Item | Approx. value early | Late |
|---|---|---|
| 1 MC production | 5-6 | ~0 in the last gen |
| 1 steel production | 8-9 (if you play building cards) | 0 |
| 1 titanium production | 11-13 (if you play space cards) | 0 |
| 1 plant production | 8-10 (8 plants ≈ greenery ≈ 1 TR + 1 VP + oxygen) | 0 |
| 1 energy production | 7 (the Power Plant standard project is 11) | 0 unless consumed |
| 1 heat production | 4-5 (8 heat = 1 TR while temperature is open) | 0 |
| 1 card in hand | 3-4 (buy cost 3; average playable card nets more) | ~1 (sell value) |
| 1 steel / 1 titanium | 2 / 3 | 2 / 3 |
| 1 plant | 2-2.5 | 2.5-3 (greenery VP) |
| 1 heat | ~1 (while temperature is open) | ~1.5 (TR), 0 if temperature is maxed |
| 1 TR | ~7-8 early (1 VP + income) | ~10 (pure VP, at the late VP rate) |
| 1 VP | ~4 early (you'd rather have production) | ~10 late (standard-project cost is ~13-14 per VP) |

Rules of thumb:
- **Plant production is the best production buy** in most games: it compounds into greeneries (TR + VP + oxygen + city VP) and still pays at the final conversion.
- **A production card pays for itself** when (production value per gen) × (gens left) exceeds its cost + 3 (the buy cost) + the opportunity cost.
- **Example (Sponsors):** Sponsors costs 6 MC + 3 to buy = 9, and gives +2 MC production. In gen 2 with 8 gens left it pays 16 back. Good. In gen 7 it barely breaks even.
- **Payback threshold:**
  - Pure-production cards should pay back within about 4-5 generations. If fewer than about 4 gens remain, skip them unless they carry VP or tags you need.
  - As a rough rule, don't buy 1 MC of production for more than about 4-5 MC after gen 3 of a 9-gen game, or after gen 5 of a 12-gen game.
  - In a 7-gen 5P game, production played in gen N pays (7 − N) times. From gen 4, prefer production cards that also carry VP or TR (Luna Metropolis, Sky Docks, Callisto Penal Mines played *early*), and don't buy production cards you can't play this gen.
- **TR cards early are good twice over:** the income plus the VP. A TR raise in gen 1 is worth about 1 VP + 8 MC.
- **VP card ratio** ([BGS]): cost ÷ VP.
  - Under ~7 MC per VP is excellent. Examples: Colonizer Training Camp at 5.5, Breathing Filters at 7.
  - Under ~10 MC per VP is good.
  - Above ~13-14 MC per VP is worse than a standard project.
  - Count the 3 MC buy cost if you haven't bought the card yet.
- **Late game:** MC is only worth what it converts to in VP. Plan your final 2 gens to end with about 0 MC.

### 2.3 Engine versus rush
- **Engine:** high MC or titanium production and card draw, then many VP cards in gens 6-10. It is strong in 2P and in slow games without WGT. It is vulnerable when opponents end the game early.
- **Rush (terraform race):** heat, plant and ocean cards, plus asteroid events, to push parameters and pile up TR. That shortens the game so engines never pay off. Strong with Ecoline, Pharmacy Union, and heavy heat production (Io colony, the Kelvinists party); Helion/UNMI want it but win little in data. A heat + plant rush is especially strong in 5P.
- **Balance:** the winner usually has the best economy by gen 3-4, then converts it to TR and VP efficiently. Rule: **match the table's pace**.
  - If the table is terraforming fast, stop engine-building a generation earlier.
  - If everyone is building engines, the rusher ends the game while others still hold unplayed hands.
- **Benchmarks** (loose, https://everythingisagame.com/terraforming-mars-strategy/): by gen 3-4, total income (MC production + TR) of about 25-30+ and 3-5 steel production if you are building-heavy.

### 2.4 How many cards to buy
- **Starting hand (10 cards):** keep about 3-6.
  - Keep cards that are playable in gens 1-3 and build economy or card-flow.
  - Keep cards that fit your corporation or prelude.
  - Keep 1-2 strong later cards (e.g. a Jovian VP card) if MC allows.
  - Keep MC for gen 1 plays. A common error is buying 8 and having nothing left to play.
- **Research phase:** typically buy 1-3 of 4 in the early and middle game, and 0-1 in the last 2 gens.
- **Hand size:** aim for ~4-6 cards. Fewer starves options; more is M€ sunk in cards you can't afford to play.
- **Always sell unplayable cards** (sell patents) rather than hold them. The exception is holding for the Planner milestone.

---

## 3. Opening

### 3.1 Evaluating corporation + preludes + 10 cards
1. **Sum the concrete value.** Starting MC + (production × about 5-6 MC per production) + resources + the value of prelude effects.
2. **Synergy check.**
   - Which tags does the hand lean toward?
   - Is there a gen-1 play that uses the corporation's ability right away? Examples: Point Luna with Earth cards, Phobolog with titanium and space, Mining Guild with steel spaces, Saturn Systems with Jovian cards, Interplanetary Cinematics with events, Ecoline with plants.
   - Which milestones are within reach (e.g. Builder, Gardener, Mayor, Terraformer)?
3. **Gen-1 plan.** Aim to play 2-4 cards in gen 1, prioritising production and discounts or draw.
4. **Pick the corporation with the strongest concrete start** unless another has an obvious combo. As players improve and games shorten, starting MC outvalues starting production ([BOL]; tier list threads).

### 3.2 Corporation tiers
Blended from [RDK] win rates, community tier lists ([N&S], [BOL], [STEAM], BGG threads such as https://boardgamegeek.com/thread/2408406), and online-play consensus. S and A are good defaults.

[RDK] Prelude-era win rates, 3P top players:

| Corporation | Win rate |
|---|---|
| Credicor | 40.9% |
| Interplanetary Cinematics | 40.2% |
| Tharsis Republic | 40.0% |
| Cheung Shing Mars | 38.5% |
| Ecoline | 37.2% |
| Vitor | 36.9% |
| Saturn Systems | 36.6% |
| Point Luna | 36.3% |
| Mining Guild | 32.6% |
| Valley Trust | 32.1% |
| Teractor | 31.8% |
| Inventrix | 28.3% |
| Thorgate | 27.0% |
| Phobolog | 26.1% |
| Robinson Industries | 22.6% |
| Helion | 18.5% |
| UNMI | 16.9% |

**S tier**
- **Point Luna** (Prelude): +1 titanium production; draw a card for every Earth tag. Endless card flow; some tables ban it ([N&S]).
- **Tharsis Republic**: MC production from all cities and MC from its own cities. Snowballs, and pairs well with Mayor and Landlord ([BOL]: "most powerful").
- **Poseidon** (Colonies): starts with a colony, and every colony built gives +1 MC production. It tops several rankings ([N&S]).
- **Credicor**: 57 MC, plus 4 MC back on 20+ MC plays and on the City/Greenery standard projects. Stable and simple; it ranks #1 in [RDK].
- **Manutech** (Venus Next): gains resources equal to production increases. "Extremely powerful" ([BOL]).
- **Vitor** (Prelude): +3 MC for each VP card played; it funds an award for free at start. A "better Credicor" ([N&S]).

**A tier**
- **Interplanetary Cinematics**: 30 MC + 20 steel, +2 MC per event. Better than its reputation in top play ([RDK]), though some rate it lower ([STEAM]).
- **Cheung Shing Mars** (Prelude): +3 MC production; building cards cost 2 less.
- **Ecoline**: +2 plant production, 3 plants, greenery for 7 plants. Strong for Gardener, board and oxygen.
- **Saturn Systems** (CE): +1 titanium production, and MC production for all Jovian tags played by anyone.
- **Teractor** (CE): 60 MC; Earth cards cost 3 less.
- **Valley Trust** (Prelude): science cards cost 2 less; an extra prelude.
- **Mining Guild**: steel production from steel and titanium spaces. It can be blocked on the board ([BOL]).
- **Utopia Invest** (Turmoil): 40 MC, +1 steel and +1 titanium production; can convert production into resources ([N&S]).
- **Aridor** (Colonies): MC production for each new tag type played; adds a colony tile.
- **Arklight** (Colonies): animal VP engine.
- **Celestic** (Venus Next): floaters; strong with an early Hoverlord ([BOL]).
- **Morning Star Inc.** (Venus Next): 50 MC + 3 Venus cards.
- **Viron** (Venus Next): re-uses a blue action. Strong with good action cards ([BOL]).
- **Pharmacy Union** (Promo): TR via science cards ([N&S]).
- **Septem Tribus** (Turmoil): MC per party with delegates.
- **Lakefront Resorts** (Turmoil): +1 MC production per ocean and bigger ocean adjacency bonuses.
- **Philares** (Promo): rewards placing tiles next to opponents.

**B tier**
- Inventrix (+3 cards; requirements ±2): Helion's flexibility is nice; ok for rush.
- Thorgate: energy discount; balanced but weak ([BOL]).
- Phobolog: titanium worth 4 but low starting MC; it needs space cards ([STEAM]: "situational, draw-dependent").
- Robinson Industries.
- Stormcraft, Aphrodite ("weak cousin of Ecoline" [BOL]).
- Polyphemos (cards cost 5 to buy).
- Recyclon, Splice, Terralabs, Mons Insurance, Pristar, AstroDrill, Factorum.

**C tier**
- **UNMI:** +1 TR per generation in which you raised TR, at a 3 MC cost. The lowest win rate in [RDK] (17%; Helion 18%, Robinson 23% are next-worst).

**Situational notes**
- Ecoline and Tharsis get stronger at 4P, with more board interaction.
- Credicor and UNMI improve at 2P (https://everythingisagame.com/terraforming-mars-strategy/).
- Helion is weak in data but fine if you have heat production and a plan to max temperature.

### 3.3 Prelude tiers
[RDK] Prelude win rates (3P), with my comments. Pattern: instant value/TR preludes win; slow or costly ones (Society Support, Loan, Biofuels, Mohole) lose.

**Top tier**
- Great Aquifer (41%): 2 oceans means 2 TR, 2 placement bonuses and income.
- Supply Drop (40%): 3 titanium + 8 steel + 3 plants.
- Allied Banks (39%): +4 MC production + 3 MC.
- Smelting Plant (39%): 2 oxygen + 5 steel.
- Metal-Rich Asteroid (39%): temperature + 4 titanium + 4 steel.
- Experimental Forest (38%): a greenery + 2 plant cards.
- Research Network (38%): +1 MC production, 3 cards, wild tag.
- Metals Company (37%).
- Aquifer Turbines (37%): ocean + 2 energy production.
- Business Empire (36%): +6 MC production for 6 MC.

**Solid**
- UNMI Contractor (+3 TR, 1 card).
- Supplier.
- Orbital Construction Yard.
- Polar Industries.
- Mining Operations.
- Power Generation.
- Eccentric Sponsor (play a card with 25 MC off; great with a big card in hand).
- Acquired Space Agency.
- Huge Asteroid.
- Galilean Mining.

**Weak**
- Dome Farming, Biosphere Support, Ecology Experts (good only with a strong plant-requirement card), Biolabs.
- Martian Industries, Io Research Outpost, Donation, Early Settlement.
- Nitrogen Shipment, Self-Sufficient Settlement, Mohole, Mohole Excavation.
- **Biofuels, Loan and Society Support are the worst.**

Online extras (Promos, Prelude 2): many new preludes. **Merger** (play a second corporation) is excellent if the corporation pair is good. Value any prelude by concrete MC: production at about 5-6 MC each, TR at about 7-8.

### 3.4 Strong cards to keep and draft

**Engine, card flow and discount**
Draw is usually overpriced: a drawn card still costs 3 MC to buy plus its play cost. Take draw only if it pays back in the remaining gens or the plan needs specific pieces; prefer discounts in 4-5P. Above-average draw: Mars University, AI Central, Invention Contest; below: Olympus Conference, Inventors' Guild.
- AI Central: 2 cards per generation, 1 VP; needs 3 science tags. Its gen-1 win rate is extreme in [RDK].
- Media Group (+3 MC per event).
- Earth Catapult (-2 on all cards, VP).
- Earth Office (-3 on Earth cards).
- Mars University (swap cards on science tags).
- Olympus Conference, Business Network, Inventors' Guild, Development Center.
- Restricted Area, Space Station (-2 on space cards).
- Quantum Extractor, Shuttles, Research.
- Anti-Gravity Technology (VP, discount).
- Standard Technology (standard projects 3 MC cheaper).
- Sky Docks, Warp Drive, Mass Converter, Cartel, Sponsors, Acquired Company.

**Production**
- Robotic Workforce, Mining Area, Mining Rights, Building Industries.
- Indentured Workers (-8 on your next card), Special Design (±2 requirements).
- Heat Trappers, Nuclear Zone.
- Io Mining Industries, Asteroid Mining Consortium, Power Supply Consortium.
- Immigrant City and Capital (with oceans).
- Kelp Farming, Farming, Trees, Moss, Nitrophilic Moss, Arctic Algae.

**TR, VP and terraform**
- Big Asteroid, Giant Ice Asteroid, Deimos Down, Nitrogen-Rich Asteroid, Imported Hydrogen, Imported Nitrogen.
- Ice Asteroid, Lake Marineris, Ice Cap Melting (late cheap ocean), Permafrost Extraction.
- Large Convoy ("kingmaker" 7-ish VP; https://eriktwice.com/en/2019/01/26/terraforming-mars-best-cards-game-2/).
- Terraforming Ganymede (1 TR per Jovian tag).
- Water Import from Europa, Ganymede Colony (Jovian VP).
- Physics Complex, Interstellar Colony Ship.

**VP accumulators (best played early)**
- Animals: Birds, Fish, Livestock, Small Animals, Predators, Pets.
- Microbes: Ants, Tardigrades, Decomposers.
- Herbivores, Ecological Zone, Insects, Advanced Ecosystems.
- [RDK]'s overall top win rates include Ice Cap Melting, Advanced Ecosystems, Insects, Ecological Zone, Investment Loan, Indentured Workers, Herbivores, Nitrogen-Rich Asteroid, Mangrove, Virus, Imported Nitrogen, Anti-Gravity Tech, Lake Marineris and Media Archives. Note the late-play bias.

**Traps**
Low [RDK] win rate, plus consensus:
- Underground Detonations (worst), Security Fleet, Power Grid, Micro-Mills, Space Mirrors, Food Factory, Dust Seals.
- Aerobraked Ammonia Asteroid (situational), Fusion Power, Soil Factory, Tectonic Stress Power.
- Lunar Beam, Extreme-Cold Fungus (needs microbe targets), Adapted Lichen, Giant Space Mirror.
- Great Escarpment Consortium, Underground City, Release of Inert Gases, Nuclear Power, Solar Power.
- Magnetic Field Generators, Tropical Resort, Rad-Chem Factory, Trans-Neptune Probe (as an early play).

General trap patterns:
- Expensive energy cards without an energy consumer.
- Heat production with no plan.
- Pure spend-to-hurt attack cards in 3P+ (you pay, a third player benefits). Cheap attacks bundled with value are fine (§4.5).
- Buying high-requirement cards you will realistically never unlock.

### 3.5 Gen-1 play order
1. Discount and engine cards first (Earth Catapult, Earth Office, AI Central, Media Group, Mars University), so later plays benefit.
2. Then production cards, cheapest payback first.
3. Save MC for the gen-2 research buy of about 6-9 MC.
4. Do not do standard projects in gen 1-2, except a City standard project in some Tharsis Republic openings.

---

## 4. Midgame

### 4.1 Engine building and tags
- **Build around 1-2 tag families:**
  - **Earth:** Point Luna, Teractor, Earth Office, Media Group-ish, Luna Metropolis, Sky Docks.
  - **Space / Jovian:** Phobolog, Saturn Systems, Io Mining, Ganymede Colony, Terraforming Ganymede, Water Import from Europa, Space Station, Shuttles, Warp Drive, Titan colony.
  - **Science:** Mars University, Olympus Conference, AI Central, Physics Complex, Anti-Gravity, Valley Trust, Scientist award.
  - **Building:** Mining Guild, IC, Cheung Shing, Builder milestone, Contractor award, Robotic Workforce.
  - **Plant / animal / microbe:** Ecoline, Arklight, Ecological Zone, Herbivores, Predators, Decomposers, Insects, Gardener.
  - **Event:** IC, Media Group, Legend.
  - **Venus:** Morning Star, Celestic, Aphrodite, Hoverlord, Venuphile, Dirigibles, Floating Habs.
- **Discount stacking:** several -1/-2/-3 discounts across 20+ card plays pay back hugely. Get them early.
- **Blue action cards** are extra actions each generation (e.g. Development Center: 1 energy → 1 card; Water Import; animal cards). Use every one, every generation.
- **Energy:** needs a consumer (cards that spend energy, Colonies trades at 3 energy, Physics Complex). Surplus energy just becomes heat.
- **Heat:** 8 heat = 1 TR while temperature is open. Once temperature maxes, heat is worthless except for Helion and a few cards. **Spend heat before the temperature closes.**
- **Plants:** vulnerable to plant-removal attacks (Asteroids, Comet, Birds-type, Predators, Virus). Convert at 8 promptly unless protected, e.g. by Protected Habitats.

### 4.2 Milestones (first come, first served; only 3 per game)
- Claim immediately when eligible if you can pay 8 MC. It is 5 VP, roughly 40 MC of value, the best rate in the game.
- Commit to one realistic milestone from the start (corp/prelude pick). In 4-5P others race, so aim for one you reach first.
- Track opponents' progress. If you and an opponent are both one step away, prioritising the milestone this turn is usually right.
- **Easy targets:**
  - Tharsis: Mayor (3 cities), Gardener (3 greeneries), Builder (8 building tags), Terraformer (35 TR), Planner (16 cards).
  - Hellas: Diversifier and Energizer.
  - Elysium: Generalist and Ecologist.
- **Denial:** if an opponent will claim the last available milestone and you can claim another first, grab it. Once 3 are claimed, the rest are closed to everyone.

### 4.3 Awards
- **Fund when:**
  - you currently lead,
  - opponents are unlikely to pass you,
  - and the price (8/14/20) is less than the expected VP swing × the current M€-per-VP rate (§-1.2).
- **2P:** 5 VP to the winner and 0 to the other, so a funded award is a 5-VP swing.
- **3P+:** 2nd place gets 2 VP, so the effective swing is smaller. Watch that you don't fund an award for someone else.
- **Timing (one rule):** funding early at 8 MC is good *when you lead an award you structurally keep leading*
  (board/tag awards: Landlord funders win 52%, Scientist 42%, Banker 37%; resource-hoard awards Miner 31%,
  Thermalist 30% do not). Funding invites competition: opponents then draft and play toward it for free points,
  so a thin lead, or one in a stat others can pump cheaply, should wait. The 14/20 MC tiers need a bigger, safer
  lead. Common pattern: 1 award in your strength early/mid-game, another in the last 1-2 gens if clearly yours.
- **Most reliable award leads:**
  - Banker (MC production) and Miner (resources in hand; hoard steel and titanium before end).
  - Thermalist (heat resources: don't spend heat until final scoring if you need the lead, but weigh this against the TR from heat).
  - Landlord (tiles), Scientist (science tags).
- Heat, steel and titanium "resource" awards are measured **at game end**. Keep the resources to win them. Only spend them if the TR or MC from spending beats the award VP swing.

### 4.4 Board placement
- **City placement:**
  - Choose spots with many free adjacent spaces, preferably near ocean spaces (2 MC per adjacent ocean) and placement bonuses.
  - Cities next to spaces where opponents will put greeneries score off their greeneries. Placing a city in a cluster of opponent greeneries is a classic VP steal.
  - Your city also makes adjacent empty spaces legal greenery spots for you.
  - A city needs ~3+ adjacent greeneries (realistically placed, anyone's) to beat its cost.
  - A city one hex off the edge leaves fewer open neighbours, so your greeneries there are harder for opponents' cities to share.
  - Take spots where two players' greeneries meet: one city scores both.
- **Greenery placement:**
  - Must be next to your own tile if possible.
  - Put greeneries next to your own cities (+1 VP each). Avoid feeding opponents' cities.
  - If forced, pick the spot that helps opponents least, or one that grabs a bonus or ocean adjacency.
- **Ocean adjacency:** placing next to 2-3 oceans means 4-6 MC. Lakefront Resorts boosts this.
- **Blocking:**
  - A city blocks other cities nearby.
  - Occupying the prime spots around an opponent's city denies them greenery VP.
  - Taking reserved steel or titanium spots hurts Mining Guild.
- **Tharsis Republic / Mayor / Landlord:** tile count matters. Cheap tiles come from Mining Rights and Area, Natural Preserve, the Ecological Zone family, and Land Claim.
- **End-game geometry:** plan your last greenery spots 2-3 gens ahead so that they sit next to your cities and not opponents'.

### 4.5 Attacks and interaction
- **Plant and resource removal:** Asteroid-type events ("remove up to 3 plants from any player"), Virus, Predators, Hired Raiders, Sabotage.
  - Target the leader or the player closest to a greenery.
  - Removal is mandatory to resolve but you choose the target, and you may target yourself with 0 if allowed.
- **Production reduction:** e.g. Energy Tapping, Power Supply Consortium, Hackers, Great Escarpment. These are good in 2P, where the harm is a direct swing, and weaker in 3P+.
- **Bundled vs pure attacks:** cheap attacks that come with value for you (Virus, Hired Raiders, Sabotage: ~42-47% win rate in [RDK] 3P) are fine. Pure spend-to-hurt, and single-target hits in 5P, are weak: the untouched players gain.
- **Etiquette:** attacks are legal and part of competitive play. Aim at the leader, not the weakest player, to avoid kingmaking.

### 4.6 Tempo within a generation
- **Take cheap, contested things first:** milestones, prime board spots, the last ocean or temperature bonus steps (the 0°C ocean, the -24/-20 heat production steps, the 8% oxygen temperature step), and the best colony trades.
- **Delay uncontested actions:** blue actions, private production cards.
- **Passing early** can be fine when holding resources or waiting for requirements, or to bank M€ for a big final round (income + saved M€ next gen). But opponents then act knowing your position.
- **1 vs 2 actions:** taking 1 action per turn keeps information hidden and lets you react; take 2 only when the second is contested (last milestone/award slot, a track bonus, a prime spot) or both must happen before an opponent acts.
- **Value of stalling:** delaying an action can be worth more than doing it now. Opponents may open a better
  scenario (a bonus, a requirement, a spot, information about their plans). Keep "hold until X" branches in the tree
  and weigh the gain against the risk of losing the option. Example: a track bonus 2 steps away while we hold a
  1-step raise. (Old detail:
  1 action) and let an opponent make the first step, then land on the bonus. It is a "hold until X" tree branch,
  weighed against the risk that an opponent takes it and the number of players acting before us.
- **Terraform at the start of your turn** to gain income and points that are then denied to others (https://sleevekings.com/blogs/news/terraforming-mars-strategy-the-ultimate-guide-to-winning-the-game).

---

## 5. Endgame

### 5.1 Recognising the last generation
- **Count the remaining Mars steps** (temperature + oxygen + oceans), including the WGT step. Compare with what players can do this generation:
  - heat on hand ÷ 8. Measure it **after production**: stored energy turns into heat, then heat production is added (green's 14 energy became 3 temp steps);
  - plants on hand ÷ 8, after production and ocean-triggered plants (Arctic Algae);
  - MC available for standard projects;
  - asteroid and ocean cards in hand. You can't see them: assume about 1 step per opponent per late gen from hand;
  - blue-card global actions (Regolith Eaters, World Government Advisor, floater/Venus cards) and **our own** terraforming plays.
- **Cross-check against the pace:** record the steps left at every gen start. If steps left ≤ ~1.2 × last gen's steps, the coming gen is the last one. When the two disagree, take the EARLIER answer. Plain hand-counting once under-predicted by half (predicted gen 8, ended gen 7) because it left out cash and growing production; `tm.sh <id> clock` models heat/plants/actions/hand/WGT per track, with cash → SPs only in the closing gen, which is what the pace lags behind.
- **If the parameters will close this generation, this is the last one.** Everything left after the final production phase is worthless, except plants for the final greenery conversion and award resources.
- **In the second-to-last generation:** production is still worth 1 generation of income. Prefer VP cards and terraforming.

### 5.2 Should I end the game or delay it?
- **End it (raise parameters)** if you lead on TR and VP, or if opponents have bigger engines and VP accumulators that grow each generation.
- **Delay it** (avoid terraforming, spend on cards and VP) if you are behind but your engine out-produces the others, or if your animal and microbe cards gain VP each gen.
- In 3P+ you can rarely delay alone. In 2P it's very controllable.

### 5.3 Last-generation checklist
1. **Research:** buy only cards you can play this generation that give more VP than they cost (at 3 + cost ≤ about 8-10 MC per VP). Usually 0-2 cards.
2. **Claim any available milestone** (8 MC = 5 VP).
3. **Fund an award you'll win**, and possibly one where you secure 2nd while the leader would otherwise win anyway. Compare 14 or 20 MC against the VP swing.
4. **Play VP cards:**
   - Jovian VP cards and TR events (Big Asteroid, Giant Ice Asteroid, Large Convoy, Deimos Down).
   - Terraforming Ganymede, and cards whose VP depends on tags you already have.
   - **Skip production cards.** Their production is worthless now, unless they also carry VP or TR.
5. **Use every blue action** (animal and microbe VP cards, Development Center, etc.).
6. **Convert heat to temperature** (8 heat = 1 TR) **before temperature maxes.** If temperature is about to close, spend heat early in the generation. Do it before opponents close it, **unless** you're keeping heat for Thermalist.
7. **Convert plants to greeneries during the generation** (before others close oxygen), for TR while oxygen is open. Any plants left after the final production phase can still become greeneries (VP + city adjacency, and no TR if oxygen is maxed).
8. **Standard projects with leftover MC**, ranked by VP per MC:
   - **Greenery (23):** 1 VP + 1 TR if oxygen is open + adjacent own city VP. That is 2-3 VP, or about 8-11 MC per VP.
   - **Asteroid (14):** 1 TR if temperature is open, about 14 MC per VP.
   - **Aquifer (18):** 1 TR + bonus MC if oceans remain.
   - **City (25):** worth it only if it immediately touches 2+ greeneries (any owner) or wins Mayor or Landlord.
   - **Air Scrapping (15):** 1 TR, plus 1 more if it crosses 16%.
9. **Final greenery placement:** place greeneries one at a time in turn order to maximise adjacency to your own cities and minimise it to opponents'. Remember that later players can place next to your cities too.
10. **Steel and titanium:** spend them on building and space VP cards unless you're winning Miner or Industrialist with them.
11. **Sell patents** for MC if that MC completes one more standard project.
12. **Tiebreaker:** leftover MC. Minor.

---

## 6. Draft heuristics (draft variant: 4 cards, pick 1, pass; odd gens pass left, even gens pass right)

- **Core rule: value each pick as a delta** = (what it's worth to me) + (what it would be worth to the player who
  receives the pack next, and anyone downstream who could still take it). A card worth +2 to me but +10 to the
  next player is usually the pick over a +5 card for me. Before each pick, check the receiving opponent's corp,
  tags, tableau, milestone/award races (`brief`), and what they've been taking/buying (`log`).
- **Subgoal cards (e.g. Physics Complex needs 6 energy per use).** Price the subgoal: the cheapest path in our hand,
  corp, preludes or colonies (Power Plant SP at 11 per energy production never pays), and by which gen. Then count
  every other reward the same subgoal unlocks (Energizer milestone, energy trades, other energy-eating cards). Keep
  it if P(subgoal in time) × payoff beats the alternatives. If there's no cheap path, pass or hate-draft.
- **Draws beyond the draft.** When a plan needs specific tags or cards, extra draw (Pluto, Development Center,
  Mars University, AI Central, draw events) raises the odds of finding the piece. Build it early and only if it
  pays back in the remaining gens; otherwise draw is overpriced (§3.4).
- **Balance the delta against what wheels back.** In a 4-card pack, a card the next players don't want may return
  to you; take the contested card first.
- **Speculative picks for requirements.** A card whose requirement we don't meet yet (e.g. 3 science tags) is not
  dead. Estimate the chance we'll reach it in the next few drafts: how many of those tags we have, how many are
  left in the deck, and how many the other players are taking. A tag that neighbours collect (e.g. science for a
  science corp) rarely survives the draft to us. Draft it if that probability × its value beats the alternatives,
  and decide whether to buy at research time.
- **Global requirements open up over time.** Oxygen, temperature and ocean minimums will be met later in the game,
  so high-value endgame cards (big VP, animal accumulators) are worth drafting early. A strong card can also change
  our plan: e.g. drafting Penguins (needs 8 oceans) is a reason to push oceans ourselves. Update the game plan
  file when that happens. Max requirements (e.g. "-10°C or colder") are the opposite: they expire, so play those early.
- **Pick order within a pack:**
  1. Cards that are great for you right now (discount, engine, strong production at a good rate).
  2. Cards that are great for the player you pass to (hate-draft).
  3. Generally strong cards.
  4. Filler.
- **Know your neighbours.** Track the corporation, tags and plans of the player you're passing to this generation. Deny them key combo pieces:
  - Jovian VP for Saturn Systems or a space player.
  - Animal cards and Ecological Zone for a bio player.
  - Earth cards for Point Luna or Teractor.
  - Events for IC or Media Group.
  - A milestone- or award-deciding card.
- **Hate-draft more as the game progresses** ([UBG]-style advice; https://playallevening.com/guide-mastering-terraforming-mars).
  - Early, your own economy matters more.
  - Late, a single Large Convoy, Giant Ice Asteroid or big Jovian VP card can swing 5-10 VP. Deny it even though you pay nothing: drafting is free, and only buying costs 3 MC.
- **You don't have to buy what you draft.** Drafted cards you won't play are simply not bought. A hate-draft costs nothing beyond the card you gave up.
- **Read the signals.** Cards passed to you reveal what upstream players don't need. If strong Earth cards keep coming, that tag is open.
- **2P draft:** you keep one card and your opponent gets the other three. Hate-drafting matters more.
- **Draft more science and discount cards early.** Draft VP and terraform cards late.
- **The initial draft of 10 (5 + 5)** is the most important draft. Prioritise gen-1-playable economy cards that fit your likely corporations.

---

## 7. Expansion tips

### 7.1 Prelude
- The game starts faster, with fewer generations (~1-2 fewer). That makes **production slightly less valuable and TR and VP slightly more valuable** than in base+CE.
- Choose the 2-of-4 preludes that best combo with the corporation.
  - Generic strong picks: Great Aquifer, Supply Drop, Allied Banks, Business Empire, Research Network, Smelting Plant, Metal-Rich Asteroid.
  - Avoid Loan, Society Support and Biofuels unless needed.
  - In 4-5P (~7 gens), value a prelude in M€ now plus TR: UNMI Contractor (+3 TR), World Government Advisor (+2 TR) and Donation (21 M€) beat slow action preludes like Floating Trade Hub (~15 M€ over the whole game).
- Prelude corporations: Point Luna, Vitor, Cheung Shing, Valley Trust (all strong), Robinson (weak).
- **Order matters:** play preludes that give resources before ones that let you play cards (e.g. Eccentric Sponsor, Ecology Experts).

### 7.2 Venus Next
- **World Government Terraforming (WGT):** each generation the first player raises a non-maxed parameter at no cost and gets no TR. Expect faster games. WGT is an option (`solarPhaseOption`), not automatic with Venus. The World Government Advisor prelude gives its owner a private WGT-style action every gen: count it in the clock. Choose the step that helps you and hurts others:
  - Don't hand an opponent the 0°C ocean, or the oxygen 8% temperature step.
  - Consider raising a parameter an opponent's card requirement is waiting on, or one that caps an opponent's heat.
- **Venus track:** 15 steps. The 8% step draws a card; the 16% step gives an extra TR. Air Scrapping at 15 MC per step is poor except at the 16% bonus or in the last generation.
- **Floaters:**
  - Floater engines (Dirigibles, Floating Habs, Titan, Celestic) turn floaters into Venus steps or VP.
  - Early floater production pays back. Late floater cards are mostly VP.
- **Hoverlord (7 Venus tags) and Venuphile:** worthwhile if you lean on Venus.
- **Corporations:** Manutech is strong. Morning Star and Celestic are good. Viron depends on its blue cards. Aphrodite is weak.
- Venus can be ignored entirely in some games. It's a TR outlet that doesn't advance the end (not an end condition), useful when Mars parameters are contested or when you want TR without shortening the game (https://eriktwice.com/en/2022/03/25/terraforming-mars-venus-next-boardgame-review/).

### 7.3 Turmoil
- **Every generation all players lose 1 TR** ("TR revision"). Terraforming is still needed, and chairman TR helps ([UBG]).
- **Turmoil phase order:**
  1. TR revision.
  2. Global event (modified by influence).
  3. New government: the dominant party becomes ruling, its bonus applies to all players, the new chairman gains +1 TR, delegates return, and the lobby refills.
  4. Changing times: new events and neutral delegates.
- **Delegates:**
  - One free lobby delegate per generation. Always use it, cheaply, often late in the generation.
  - Extra delegates from reserve cost 5 MC.
  - The first delegate in a party is the party leader. Having more delegates than the current leader replaces them.
  - The leader of the dominant party becomes chairman: **+1 TR** and 1 influence.
- **Influence (0-3+):** +1 for chairman, +1 for leading the dominant party, +1 for having a non-leader delegate in the dominant party. It modifies global events, whose effects scale with influence (often up to 5).
- **Party policies** (default/first policy used in the base setup; alternates are online options) [SRC]:
  - **Reds:** each TR step raised costs **3 MC**. It punishes terraforming. Push Reds when you are behind on TR or when the table has big TR plays queued. Ruling bonus: the lowest-TR player gains 1 TR, or the highest-TR player loses 1.
  - **Greens:** +4 MC per greenery placed. Bonus: 1 MC per plant/microbe/animal tag, or 2 MC per greenery.
  - **Mars First:** +1 steel per tile placed on Mars. Bonus: 1 MC per building tag, or per tile on Mars.
  - **Scientists:** action: pay 10 MC to draw 3 cards. Bonus: 1 MC per science tag, or 1 MC per 3 cards in hand.
  - **Unity:** titanium is worth +1. Bonus: 1 MC per Venus, Earth and Jovian tag, or per space tag.
  - **Kelvinists:** action: pay 10 MC for +1 energy and +1 heat production. Bonus: 1 MC or 1 heat per heat production.
- **Strategy:**
  - Place delegates to make the party whose policy and bonus help you dominant, and to become its leader, for the chairman TR.
  - Look ahead at the upcoming global events (current, coming, distant). Prepare for them with influence, or play to exploit them.
  - Reds rule means don't terraform unless it's worth +3 MC per TR. Do production and VP cards instead.
  - Delegates also count toward Septem Tribus and a few cards.
- **Corporations:** Utopia Invest (strong), Septem Tribus, Lakefront Resorts, Terralabs, Pristar (rewards not raising TR), Mons Insurance.
- **Opinion:** Turmoil is divisive ([OG]). Colonies become relatively less central in all-expansion games, per community tier-list threads.

### 7.4 Colonies
**Rules**
- Colony tiles in play: players + 2 (5 in 2P). Build a colony (standard project) for 17 MC.
  - Max 3 colonies per tile, and each player may have only 1 colony per tile.
  - Building gives the tile's placement bonus.
- **Trade:** pay 9 MC, 3 energy or 3 titanium. Send your fleet to a tile with no fleet on it this generation, then gain the value at the track marker.
  - **Every** colony owner on that tile gets that tile's colony bonus.
  - The marker then drops to the lowest position not below the number of colonies there.
  - Track markers advance by 1 each generation.
  - Each player has 1 trade fleet. Cards add more: Trade Envoys, Trading Colony, Space Port, Cryo-Sleep, and more.
- Titan, Enceladus and Miranda activate only when someone has a card that holds floaters, microbes or animals, respectively ([UBG]).

**Colony table** [SRC]:

| Colony | Build bonus | Trade track (low → high) | Colony bonus (to owners when anyone trades) |
|---|---|---|---|
| Luna | +2 MC production | 1, 2, 4, 7, 10, 13, 17 MC | 2 MC |
| Ceres | +1 steel production | 1, 2, 3, 4, 6, 8, 10 steel | 2 steel |
| Io | +1 heat production | 2, 3, 4, 6, 8, 10, 13 heat | 2 heat |
| Europa | Place an ocean | +1 production: MC, MC, energy, energy, plant, plant, plant | 1 MC |
| Ganymede | +1 plant production | 0-6 plants | 1 plant |
| Callisto | +1 energy production | 0, 2, 3, 5, 7, 10, 13 energy | 3 energy |
| Triton | 3 titanium | 0, 1, 1, 2, 3, 4, 5 titanium | 1 titanium |
| Titan | 3 floaters | 0, 1, 1, 2, 3, 3, 4 floaters | 1 floater |
| Enceladus | 3 microbes | 0, 1, 2, 3, 4, 4, 5 microbes | 1 microbe |
| Miranda | 1 animal | 0, 1, 1, 2, 2, 3, 3 animals | 1 card (per current code) |
| Pluto | Draw 2 cards | 0, 1, 2, 2, 3, 3, 4 cards | Draw 1, discard 1 |

**Colony tips**
- **Best general colonies:**
  - **Pluto:** near-default build (cheap steady card flow).
  - **Luna:** big MC trades plus 2 MC production on build. Push-your-luck: trade 7 now or wait for 10 next gen, if no one else takes it first.
  - **Europa:** the build is an ocean (TR + bonus); trades give **permanent production**.
  - **Triton:** titanium for space players.
  - **Ganymede:** plant production and plants.
- **Situational:**
  - Io and Callisto: heat and energy engines. Callisto energy feeds energy trades.
  - Ceres: for building players.
  - Titan, Enceladus, Miranda: only if you own the matching resource card. Enceladus/Miranda are all-or-nothing: with a good microbe/animal VP card a trade is several VP; without one, worthless.
- **Build colonies early** (gens 1-4). Each one gives its build bonus, plus a colony bonus every time anyone trades there, plus a cheaper trade value floor. 17 MC for a colony is usually worth it by gen 4-5 at the latest; late colonies are poor value unless they give VP (e.g. Europa's ocean).
- **Trade every generation** once you have a fleet and 9 MC, 3 energy or 3 titanium. Trade with the highest track value, ideally 6-10+ MC of value.
  - An early energy production of 3 lets you "trade for free" each generation ([OG]: "a fun rush to get 3 energy production").
  - Trade cost reducers: Rim Freighters, Cryo-Sleep.
- **Trade timing:**
  - Trade early in the generation before opponents take the best track.
  - Trading a tile where you have a colony gives you its colony bonus as well.
  - Trade ending positions leave the track low for the next trader. Consider denying opponents a high-value trade.
- **Good Colonies cards:** Poseidon (corporation), Trading Colony, Space Port, Mining Colony, Productive Outpost, Rim Freighters, Cryo-Sleep, Sky Docks, Interplanetary Colony Ship, Market Manipulation, Trade Envoys, Titan Floating Launch-pad.

### 7.5 Promos, Ares, Moon, Pathfinders (brief)
- **Promos:** many strong corporations (Pharmacy Union, Philares, Factorum, Mons Insurance, Recyclon, Splice, Arcadian Communities, AstroDrill) and strong cards (Self-replicating Robots, Penguins, Hi-Tech Lab, etc.). Evaluate them with the same MC math.
- **Ares:**
  - Hazard tiles (dust storms, erosions) sit on Mars. Placing next to them costs production unless you mitigate it; removing them gives TR or bonuses.
  - Special tiles grant **adjacency bonuses to the tile's owner** when others place next to them. Place your special tiles where opponents will want to build.
- **The Moon:**
  - An extra board with 3 tracks (habitat, mining, logistics rates). Each raise gives TR.
  - Moon standard projects exist. Moon tiles and roads give VP.
  - Treat it as another TR sink and look for cheap Moon steps. The online version flags it as a variant.
- **Pathfinders:**
  - Planetary tracks (Venus, Earth, Mars, Jovian, Moon) advance when anyone plays those tags. Rewards go to whoever triggers each threshold, with a bonus for the player who played the most.
  - Favour tags whose track you can push to thresholds.
  - It includes many new corporations and preludes and a "Mars" tag.

---

## 8. Per-turn decision checklist

At the start of each generation:
1. **How many generations remain?** Estimate the steps left ÷ **last** gen's steps (the pace keeps rising), including WGT if it's on, plus the §5.1 hand count. This sets production value (about gens left MC per MC of production) and whether this is the last generation.
2. **Research:**
   - Buy cards that pay back in the remaining time, fit your tags or plan, or deny a key card (in the draft).
   - Keep enough MC for this generation's key plays **and for one trade per fleet** (9 MC / 3 energy / 3 Ti): budget it in the same spend plan as the cards, not after.
   - Value trade enablers (Cryo-Sleep, Trade Envoys, Rim Freighters, Space Port, Trading Colony, colony-building cards) by the trades we will actually make: value per trade x gens left x fleets; an idle fleet means they are worth more, not less.
   - Late game: only buy what you can play for VP.
3. **Plan the generation:**
   - List affordable plays **including the best colony trade** (value minus fee; reserve 9 MC / 3 energy / 3 Ti for it before spending the rest).
   - Order them: discounts and engines first, then contested board and milestone actions, then private production, then VP.

On each turn (1-2 actions):
4. **Is there a milestone I can claim now?** Claim it: 8 MC for 5 VP. Is someone about to take the last one?
5. **Is there a contested spot or bonus?**
   - A prime city spot, a greenery spot next to my city, the 0°C ocean or -24/-20 heat steps, the oxygen 8% step, the best colony trade.
   - If so, take it before others.
6. **Blue actions and trade (check EVERY turn, before the card plays):** use all blue actions. Price each colony as track value minus fee (9 MC / 3 energy / 3 Ti); take the best one when it nets about 4+ MC or a rival will take that track before our next turn (e.g. Luna at 13 for a 9 fee). A trade competes with a card play for the action: pick the higher net. Never leave the fleet idle two gens running.
7. **Conversions:**
   - 8+ plants: make a greenery now if plant attacks threaten, or if oxygen is about to max.
   - 8+ heat: raise temperature unless I'm keeping heat for Thermalist, or the temperature is far from maxing and I have nothing to fear.
8. **Card choice:** best value per MC for the current stage.
   - Early: production (plants first), discounts; draw only if it pays back.
   - Mid: TR plus production, tag-synergy VP, VP accumulators.
   - Late: raw VP or TR. Nothing that only gives production.
9. **Awards:** do I lead one with a margin that will hold (§4.3)? Fund it if the cost is below the expected VP swing × the current M€-per-VP rate. Is the funding price about to go up?
10. **Interaction:** does a removal or attack card hit the leader for good value? Does my placement feed an opponent's city? Should I hate-block a spot?
11. **Game clock:** am I ahead (so push parameters) or behind with a stronger engine (so slow down, and avoid feeding opponents' requirements)?
12. **Pass check:** have I used every blue action, conversion and useful MC spend? In the last generation, have I converted all heat and plants, spent all MC on VP, and set up my final greeneries?
13. **Turmoil:**
    - Place the free lobby delegate toward the party I want ruling next generation, or to become party leader.
    - Pay 5 MC for extra delegates only when that secures the chairman TR, a key policy, or influence for a nasty event.
14. **Colonies:** build an early colony (Pluto by default; Luna, Europa or Triton) when affordable (gens 1-4). Get more fleets if trading pays.

---

## 9. Quick-reference numbers
- **Buy a card:** 3 MC. **Sell a card:** 1 MC.
- **Steel = 2** (building). **Titanium = 3** (space).
- **Conversions:** 8 plants = greenery (7 for Ecoline). 8 heat = +1 temperature.
- **Milestones:** 8 MC for 5 VP; max 3.
- **Awards:** 8 / 14 / 20 MC; 5 VP for 1st, 2 for 2nd (not in 2P); max 3.
- **Standard projects:**
  - Power Plant 11, Asteroid 14, Aquifer 18, Greenery 23, City 25.
  - Colony 17, Air Scrapping 15, Delegate 5, Trade 9 MC / 3 energy / 3 titanium.
- **Parameters:** temperature -30 → +8 (19 steps), oxygen 0 → 14% (14 steps), oceans 9, Venus 0 → 30% (15 steps).
- **Parameter bonuses:**
  - Temperature: heat production at -24 and -20; ocean at 0°C.
  - Oxygen 8%: +1 temperature step.
  - Venus: card at 8%, TR at 16%.
- **Ocean adjacency:** +2 MC per adjacent ocean.
- **Game end:** after the generation in which temperature, oxygen and oceans are maxed, followed by a final plant-to-greenery conversion.
- **Starting TR:** 20. Income = MC production + TR each generation.
- **Turmoil:** -1 TR per generation for everyone; chairman +1 TR; Reds policy means +3 MC per TR raised.
