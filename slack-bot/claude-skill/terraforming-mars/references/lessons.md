# Lessons: general principles (distilled from our games)

**How to use.** Apply by analogy: look for situations with the same *structure*, whatever the cards. Examples are
illustrations, not rules. Foundation: strategy.md §-1 "The win model" and "Plans expire fast" (not repeated here).
New lessons go to `lessons-log.md` first (dated, raw, shared; never rewrite others' entries). Fold into this file only
when a lesson generalizes, by **editing an existing principle** rather than adding a bullet. Keep this file under ~100
lines; if it grows, merge. Card-specific detail stays in the log.

## Checklist (the mistakes we keep repeating)
1. **Clock**: re-forecast at every gen start; assume ±1 gen and prefer plays that score either way.
2. **Board VP**: first Mars city early (within the first ~40% of the expected game, from the live `clock` forecast), greeneries around it. Don't defer it gen after gen.
3. **Every stockpile has a sink**: M€, steel, Ti, heat, plants. At the last 2 research phases, list each with the
   card/SP that converts it to VP and buy that card. Leftover anything at the end = lost VP.
4. **Races**: for every milestone/award/slot, count each rival's cheap plays to the threshold, in turn order,
   including corp effects and forced first actions (read every opponent's corp before racing). Only spend toward a
   race we can finish in actions we actually have this turn; otherwise take the uncontested value.
5. **Awards: fund when the lead is clear, otherwise last; test each rival's one-gen swing; a funded award is a target.** A funded award scores for whoever leads at the end, rivals included, and it tells every rival which metric to contest. Early funding is fine only if the lead survives each rival's maximum one-gen gain on that metric (from their corp, tableau, cash AND hand, not a formula) and we budget the cost of defending it. A lead that is merely ahead today: wait and fund in the last gen once the standing is locked. Game 2: blue (tile-oriented corp, 80 M€ saved) went 3 to 8 cities in two gens and took both awards we paid for; yellow's +7 production card flipped Banker. Game 4: funded none; red filled the last slot in the final gen and we still won first with 7 greeneries vs 5 (+5 free): an award we lead is worth defending with last-gen tiles, not with our own 20 M€.
6. **Trade fleet is an action source (plan it at research time too, not just at the turn)**: at every turn start compare each colony track value vs the fee (e.g. pay 9 get 13 = +4 and a free card or resource). Unused fleet = lost value; rivals take the best track first (yellow took Luna 13 and Triton the turn we skipped it). Take the top trade before a marginal card play when it beats ~4 M€ net.

## Long-horizon arc (the one structural gap: economy built, then it fizzled)
- **Plan backward from the final gen.** Winning score in 5P ~80-85 (3P ~70). Write the VP budget by source (TR, cards, board, awards, milestones) and the gen each source must start scoring. A source that starts in the last 2 gens only gets what is left.
- **TR is a finite pool shared by all players** (42 steps in total). Count our realistic share; once the tracks close it pays nothing. Income then has to go into VP sources that compound or can be bought late (VP cards, resource accumulators, awards, board), started 2-3 gens before the end.
- **Income is only worth its conversion.** Each gen ask: what turns this gen's M€ into final VP at the best rate, and is that outlet still open by the time the cash arrives? Peak income in the last gens with no outlet = fizzle.
- **Linear vs convex VP (game 3: led by 10-15 for the first half of the game, lost by 11).** We scored a flat ~5.5 VP/gen (income / ~7.5 M€ per VP in capped tile outlets); the winner scored +2, +9, +15, +17 per gen from cards, accumulators and awards at ~3 M€/VP, with LOWER income. Track each rival's VP gained per gen and per M€ at every checkpoint; if ours is flat and theirs accelerates, change plan early (while more than about half of the expected game remains, recomputed with `clock` each gen): start 2-3 VP accumulators (animals/microbes/floaters with actions, events), a card engine, and cheap TR before the tracks close. Income is not the constraint; conversion rate is.
- **What rivals did in the last gen (game 3 log)**: 14-20 actions each vs our 5 (we passed with 2 M€). Their blue-card actions paid M€ mid-gen (+9, +8, +7, +5) and funded further plays; a science tag engine (6+ tags) made gated VP cards cheap in one gen (Anti-Gravity 3, Interstellar Colony Ship 4, Orbital Cleanup 2, Hospitals, Solarnet); they sold 4-7 leftover cards for cash; plant stock became 1-2 free greeneries; cards gave TR (Terraforming Ganymede +3). So as soon as the first drafts show our tags (while at least ~half the expected game remains), pick a TAG IDENTITY and draft its gated VP cards, take 2-3 M€-paying card actions, and hold a plant stock/production for the last gen; judge the plan by actions available in the last gen, not only cash.
- **Checkpoint every gen start**: our projected final VP vs the best rival's (their cards, hand, awards), and what source closes the gap. If the gap is growing, change the plan, don't repeat the engine.
- **Closing protocol (from 3 games: we led entering the last gen all three times and lost; N = expected last gen, recomputed every gen from `clock`, never a fixed number).** (1) Rivals add +7..+13 VP in the LAST gen each (cash + hand dump; yellow +13 in game 3, estimated per rival from its own hand size and card-VP rate, not a flat number); a lead under ~10 entering it is not a lead. Project each rival as: VP now + their cash/price + hand VP cards + production converters, from observed behaviour, not hand/3. (2) Production stops paying ~4 gens before the end (cost > production x gens left): after that buy only VP, TR, tiles, or converters of production/stock into VP (Refugee Camps-type, -production for cash/VP cards). Entering the last gen with high production and little cash is the failure mode: income that arrives after the final action is worth 0. (3) Keep a VP-card pipeline: by N-3 hold 3+ cheap VP cards (<= 8 MC/VP) via draw, trades (Pluto) and the draft; card VP was 33/25/11 for the winners vs 5 for us. (4) Cash timing: spend early only on capped/contested VP (specific tile gaps, contested spots); hoard for uncapped late buys only if prices don't rise; never fund awards early. (5) Count the clock: whoever leads should end it; if behind the projection, do not raise the last tracks. (6) As first player in the last gen, take the last track steps ourselves (each is +1 TR and removes a rival's cheap TR outlet); a tile next to an ocean refunds 2 M€ per ocean, count it when sizing the final chain; selling cards counts as an action.

- **Never judge by TR/VP now**: rivals' late dumps (hand, stock, awards) can add 20+ VP in the last gen.

## 1. Clock
- **Forecast from capacity, not pace or intuition**: what the table CAN do each gen (heat incl. energy→heat, plants,
  global-raising actions, hand plays, WGT). Cash only matters in the gen it can close the game. `clock` simulates
  this; take the earlier of capacity and pace. Watch who benefits from ending vs delaying: that decides SP spending.
- **Misses run both ways** (ours: 1-2 gens long early on, then 1 short when a track stalled). Plans that are only
  right if "this is the last gen" lose either way. Read game options (WGT) and re-forecast every gen into one clock.

## 2. Valuing options
- **Everything in final-VP margin** over the best rival, over the gens left. 1 VP ≈ 4 M€ early, ~10 late.
- **Time decay**: production/engines lose value each gen; past the cutoff buy only VP/TR or ≤2-gen payback.
  An immediate TR/VP bundle usually beats a slow engine in 4-5P.
- **Unplayed cards are pure loss**: buy only what you'll play within ~2 gens.
- **Accumulators scale with the clock and all their sources** (own action, triggers from anyone's plays, feeder
  cards, colony tracks). Re-price them when the forecast moves.
- **Compare cost per unit across all routes** to a goal (cards, colonies, SPs, other players' triggers); take the
  cheapest reliable one, keep the next as a fallback. Effects that pay off on *opponents'* actions are often the cheapest.
- **Price cards in what we'd actually pay with**: idle steel/Ti stock makes building/space cards nearly free; stock
  with no matching card is worth 0. Standard projects take only M€.

## 3. Engine & subgoals
- **Judge cards as engine parts**: how many live subgoals they feed beats face value. Play decaying value early.
- **On-engine only**: chase a target only if our engine reaches it anyway; otherwise price the detour honestly.
- **Let strong cards steer the plan**; min requirements open later, max requirements expire.
- **Diversify VP**: every engine needs a VP outlet. Zero board VP is not survivable in 4-5P (see checklist 2).
- **Pair every capacity with its fuel** (fleets, converters, actions need a cheap payment source).

## 4. Opponents & races
- **Read them every gen** in turn order: what they'll push, fund, trade, and their non-M€ actions.
- **Races**: list rivals, distance in *cheap plays*, income toward it and turn order; drop races we'll lose.
  e.g. a rival went 7→15 cards in two gens and took the last milestone a turn before us.
- **Draft memory**: what we passed tells us their hand and threats.
- **Exposed stock is a target**: attacks can't be predicted, so never sit on 8+ plants (or a big removable pile).
  Convert to a greenery on the first action we can; only hold below the threshold.
- **Attacks and denial**: only large, lasting swings against the leader that survive their response; hurting one
  rival in multiplayer mostly helps the others.
- **Forecast rivals' hidden end VP** (held VP cards ~ hand size, cash ÷ 8, plants, resource cards with a refill
  track) to plan our own finish, not to spend actions denying.

## 5. Milestones & awards
- **Only 3 milestones**: once 2 are gone, only the one closest for anyone matters. Check turn-1/early claims at setup.
- **Fund awards on a structural, slow-moving lead** (tags/tiles our engine alone grows), not a current count, and
  keep one qualifying play in reserve. Leads of 1-2 got caught or flipped in both recent games.
- **Award price rises as others fund (8/14/20)**: a plan that funds late must budget the next tier, or fund first.
- **Ties score first for everyone**: in the last gen an unfunded award we tie for first can be cheap VP.
- **Prune dead checks** once milestones/awards are settled.

## 6. Board & placement
- **Cities**: place where greeneries (anyone's) will realistically surround them; bank guaranteed adjacency and
  ocean +2 M€ now. Greeneries go next to our cities and away from rivals' cities and open city spots.
- **City bait**: an empty space touching 2+ greeneries is ~2 VP for whoever builds there: take it or don't create it.
- **Re-check placement against the live map**; take track bonuses deliberately (who reaches each one first).

## 7. Colonies & trades
- **Trade only with cheap fuel and only for resources that will convert to VP** before the end; a full-M€ trade on a
  weak track, or any late trade whose output can't score, is a wasted action.
- **Guard every move on the live track its value needs** (temp/O2/oceans still open), checked at execution.

## 8. Draft & buying
- **Pick by delta** (our gain + denial of the receiver); hate-drafting is free.
- **Pre-write the rubric** (wanted tags, hate list, max buys) so picks are fast.
- **Every buy must be a likely play**; under-buying that ends in SPs or stranded stock is as bad as over-buying.

## 9. Endgame
- **Convert everything** (checklist 3): compute final cash *and stock* to the unit at the last 2 research phases;
  hold a cheap, track-independent VP sink (≤ ~15 M€/VP), because SP/heat sinks die when tracks max.
- **Never spend an action on gains that can't become VP; pass instead.**
- **Last 1-2 gens**: scan for city spots touching greeneries and final greeneries next to our cities; first player
  in the last gen takes contested steps first. Read the last-gen plan before the first action.

## 10. Tempo
- Take contested things first (awards, tracks, colony slots), especially late in turn order; otherwise a 1-action
  turn can keep information. Don't over-plan unlikely branches.

## 11. Execution
- **When a plan's premise breaks mid-turn, stop and re-decide**: don't run the remaining steps. Guard multi-step
  plans on their premises (actions left this turn, target still open, rival not yet qualified), not just on cost.
  e.g. our forced first action ate one of 2 actions, the "build + claim" plan no longer fit, and I built anyway.
- Analyst + main agent per SKILL.md; any go.sh must carry every contingency and guard each step on what its value
  depends on. Run `stocks` / `races` at the decisions they cover instead of trusting memory.
- Read every returned prompt before the next action (follow-ups and off-turn prompts run our clock).
- Postmortem the *method* each game: compare forecasts with outcomes and fix the estimating rule here.
