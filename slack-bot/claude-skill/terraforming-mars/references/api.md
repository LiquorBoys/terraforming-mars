# Terraforming Mars (open-source web app) — JSON API reference for an AI agent

Source: `github.com/terraforming-mars/terraforming-mars`, `main` branch, shallow clone taken 2026-09-26.
Every type and field name below comes from that source. **Live check:** the flows marked "(verified live)" were run against
`https://terraforming-mars.herokuapp.com` on 2026-09-26: a solo game was created, initial cards were picked, preludes were played, a greenery was placed, a standard project was bought, undo was used, and bad inputs were sent to see the errors.

Key source files (all under `src/`):
- `common/app/paths.ts` — every route
- `server/server/requestProcessor.ts` — route table
- `server/routes/*.ts` — handlers (`PlayerInput.ts`, `ApiPlayer.ts`, `ApiWaitingFor.ts`, `ApiCreateGame.ts`, `Reset.ts`, ...)
- `common/models/PlayerModel.ts`, `GameModel.ts`, `SpaceModel.ts`, `CardModel.ts`, `PlayerInputModel.ts`, `WaitingForModel.ts`
- `common/inputs/InputResponse.ts` (response shapes), `common/inputs/Payment.ts`, `common/inputs/Spendable.ts`
- `common/input/PlayerInputType.ts`
- `server/inputs/*.ts` — server-side validation for each input type
- `server/Player.ts` — `getActions()` builds the main action menu, `takeAction()`, `process()`
- `client/components/WaitingFor.vue` — how the real UI polls and posts

---

## 1. URLs and IDs

| Page | URL | Notes |
|---|---|---|
| Start screen | `/` | |
| Create game form | `/new-game` | Vue form. Submitting it POSTs to `/api/creategame`. |
| Game home (lists every seat's link) | `/game?id=g…` | Shown after you create a game with 2 or more players. |
| Player page (one per seat) | `/player?id=p…` | **The player id is the only credential.** Anyone who has the link controls that seat. |
| Spectator page | `/spectator?id=s…` | Read-only. |
| End screen | `/the-end?id=p…` (or `s…`) | |
| Card browser | `/cards` | Visual list of every card (Vue "card-list" chunk). |
| Help | `/help` | |

ID formats (`common/Types.ts`):
- `PlayerId = \`p${string}\``
- `GameId = \`g${string}\``
- `SpectatorId = \`s${string}\``
- `SpaceId = \`${TwoDigits}\` | \`m${TwoDigits}\`` (the `m` prefix is for Moon spaces)

IDs are built by `generateRandomId(prefix)` = prefix + a random hex number below 16^12. Real examples: `gbc11b5aec`, `p856fa7af4995`, `s52c0854fecca`.

Authentication: none by default. Handlers call `isUser(player.user, ctx)`. That check only matters if the player's seat was linked to a Discord login (`player.user` is set). Normally it is `undefined`, so a plain `fetch` with the player id works. `POST /player/input` does no user check at all.

---

## 2. HTTP endpoints

Every path is relative to the host root. Query parameter `id` is always the participant id.

### 2.1 `GET /api/player?id=pXXXX` → `PlayerViewModel` (JSON)
- This is the full state as that player sees it. `waitingFor` is the pending input, or `undefined` (the key is absent from the JSON) when nothing is pending.
- Errors: `404 Not found`, `403 forbidden` (Discord-owned seat), `400 Bad request: invalid player id`.

### 2.2 `GET /api/waitingfor?id=pXXXX&gameAge=N&undoCount=M` → `WaitingForModel` (long-poll style, cheap)
```ts
type WaitingForModel = {
  result: 'GO' | 'REFRESH' | 'WAIT',
  waitingFor: Array<Color>,   // colors of players who currently have a required (non-optional) input
}
```
Logic in `ApiWaitingFor.getPlayerWaitingForModel`:
- `GO`: this player has a non-optional `waitingFor`, or the phase is `end`. Fetch `/api/player` and act.
- `REFRESH`: `game.gameAge > gameAge` or `game.undoCount > undoCount`. The state changed, so re-fetch.
- `WAIT`: nothing new.

Where the inputs come from:
- `gameAge` and `undoCount` are `playerView.game.gameAge` and `playerView.game.undoCount` from your last `/api/player` response.
- Both parameters are required. Missing ones give 400.
- The real client polls every `settings.waitingForTimeout` ms (a few seconds).
- It also works with a spectator id (`s…`), which never returns `GO`.

### 2.3 `POST /player/input?id=pXXXX` — submit a response (verified live)
- Headers: `Content-Type: application/json`.
- Body: one `InputResponse` JSON object (section 4). You may add an optional `"runId"` field. The real client sends `{runId: playerView.runId, ...response}`.
  - If `runId` is present and doesn't match the server's current run id (the server restarted), you get 400 with `id: "invalid-run-id"`. Re-fetch and resend.
  - Leaving `runId` out is fine. The server deletes it before validating.
- Success: `200` with the **new `PlayerViewModel`**. There is no need to call `/api/player` again.
- Failure: `400` with `Content-Type: application/json` and body `AppErrorResponse`, `{"id"?: string, "message": string}`. Examples seen live:
  - `{"message":"Incorrect options provided"}`
  - `{"message":"Not a valid SelectInitialCardsResponse"}`
  - `{"message":"payment is not a valid type"}`
  - Other messages: `"Space not available"`, `"Too many cards selected"`, `"Did not spend enough to pay for card"`, `"You do not have that many resources"`, `"Not waiting for anything"`, `"Unknown card name X"`.
- **A failed input is rolled back.** `Player.process` restores `waitingFor` on any exception, so after a 400 you can simply retry with a corrected response.
- **Undo is also sent here** (see 2.6). The response to undo is the restored `PlayerViewModel`.
- Validation is strict about keys. Most `is…Response` guards use `matches(response, fields)`, which requires **exactly** those keys, with no extra keys and none missing (`runId` is stripped first).

### 2.4 `GET /api/game?id=gXXXX` → `SimpleGameModel`
```ts
type SimpleGameModel = {
  activePlayer: Color; id: GameId; name: string; phase: Phase;
  players: Array<{color: Color; id: PlayerId; name: string}>;   // every seat's player id
  spectatorId: SpectatorId; gameOptions: GameOptionsModel;
  lastSoloGeneration: number; expectedPurgeTimeMs: number;
}
```
If you have the game id, this gives you **every seat's player id**.

### 2.5 `GET /api/spectator?id=sXXXX` → `SpectatorModel`
Same as `ViewModel`, with `color: 'neutral'`, `thisPlayer: undefined`, and no `waitingFor`.

### 2.6 Undo
- Undo only works when the game was created with `undoOption: true`.
- It then shows up as the last option of the main action `OrOptions`: `{"type":"option","title":"Undo last action","buttonLabel":"Undo","warnings":["undoBestEffort"]}`. It appears only after the player has taken at least one action this turn (`actionsTakenThisRound > 0`).
- To use it, POST `{"type":"or","index":<index of that option>,"response":{"type":"option"}}`.
  - `PlayerInput.isWaitingForUndo` detects this and restores the save from 2 saves ago (`lastSaveId - 2`), then returns the restored model.
  - `game.undoCount` goes up by one. Verified live: after undo, energy production went back 1 → 0, M€ 18 → 29, and `undoCount` went 0 → 1.
- `GET /reset?id=p…` reloads the game from the last save. It is solo-only and active-player-only. Prefer the Undo option.

### 2.7 Other endpoints
- `GET /api/game/logs?id=<p…|s…>[&generation=N]` → `Array<LogMessage>`, each `{message, data: [{type, value, attrs?}], timestamp, type?, playerId?}`.
  - Placeholders `${0}`, `${1}`, … in `message` index into `data`.
  - `data[i].type` is a `LogMessageDataType` number: 0 STRING, 1 RAW_STRING, 2 PLAYER(color), 3 CARD, 4 AWARD, 5 MILESTONE, 6 COLONY, 8 PARTY, 9 TILE_TYPE, 10 SPACE_BONUS, 11 GLOBAL_EVENT, 12 UNDERGROUND_TOKEN, 13 SPACE, 14 CARDS.
  - Without `generation`, you get only recent messages.
- `POST /api/creategame` (also `PUT /game`, a legacy route) creates a game. See section 8.
- `GET /api/cloneablegame?id=g…` returns cloneable game info.
- `GET /autopass?id=p…&autopass=true|false` toggles autopass. It is disabled in `takeAction`, so it has no effect.
- `GET /api/games` and `/api/stats` are admin-only (they need `serverId`).

---

## 3. `PlayerViewModel` (`common/models/PlayerModel.ts`, `GameModel.ts`)

```ts
interface ViewModel {
  game: GameModel;
  players: Array<PublicPlayerModel>;   // in generation (turn) order
  id: ParticipantId;
  color: Color;                        // (not seen in the live payload; use thisPlayer.color)
  thisPlayer: PublicPlayerModel | undefined;
  runId: string;
}
interface PlayerViewModel extends ViewModel {
  autopass: boolean;
  cardsInHand: ReadonlyArray<CardModel>;          // includes calculatedCost (after discounts)
  dealtCorporationCards, dealtPreludeCards, dealtProjectCards, dealtCeoCards: ReadonlyArray<CardModel>;
  draftedCards: ReadonlyArray<CardModel>;
  ceoCardsInHand: ReadonlyArray<CardModel>;
  pickedCorporationCard: ReadonlyArray<CardModel>;
  preludeCardsInHand: ReadonlyArray<CardModel>;
  id: PlayerId;
  thisPlayer: PublicPlayerModel;
  waitingFor: PlayerInputModel | undefined;       // <-- what the game needs from you now
}
```

### `GameModel`
```ts
{
  aresData: AresData | undefined;
  awards: ReadonlyArray<FundedAwardModel>;        // ALL awards in this game; funded ones have color/playerName set
  colonies: ReadonlyArray<ColonyModel>;
  discardedColonies: ReadonlyArray<ColonyName>;
  deckSize: number; discardPileSize: number; otherDeckSizes: OtherDeckSizesModel;
  expectedPurgeTimeMs: number;
  gameAge: number;                                 // monotonically increasing; use for polling
  gameOptions: GameOptionsModel;
  generation: number;
  globalsPerGeneration: Array<Partial<Record<GlobalParameter, number>>>;
  isSoloModeWin: boolean; lastSoloGeneration: number;   // solo: 14 (12 with Prelude)
  milestones: ReadonlyArray<ClaimedMilestoneModel>;// ALL milestones; claimed ones have color/playerName set
  moon: MoonModel | undefined;
  name: string;
  oceans: number;                                  // 0..9
  oxygenLevel: number;                             // 0..14
  passedPlayers: ReadonlyArray<Color>;
  pathfinders: PathfindersModel | undefined;
  phase: Phase;   // 'initial_drafting'|'preludes'|'ceos'|'research'|'drafting'|'action'|'production'|'solar'|'intergeneration'|'end'
  spaces: ReadonlyArray<SpaceModel>;
  spectatorId: SpectatorId;
  step: number;
  tags: ReadonlyArray<Tag>;
  temperature: number;                             // -30..+8, steps of 2
  isTerraformed: boolean;
  turmoil: TurmoilModel | undefined;
  undoCount: number;
  venusScaleLevel: number;                         // 0..30, steps of 2
}
ClaimedMilestoneModel = { name; playerName?; color?; scores: Array<{color; score; claimable: boolean}> }
FundedAwardModel      = { name; playerName?; color?; scores: Array<{color; score}> }
ColonyModel           = { colonies: Array<Color>; isActive; name: ColonyName; trackPosition; visitor: Color|undefined }
TurmoilModel          = { dominant; ruling; chairman; parties: [{name, partyLeader, delegates:[{color, number}]}];
                          lobby: Color[]; reserve: [{color, number}]; distant; coming; current; politicalAgendas; policyActionUsers }
```

### `PublicPlayerModel` (`thisPlayer` and each `players[i]`)
```ts
{
  actionsTakenThisRound, actionsTakenThisGame: number;
  actionsThisGeneration: CardName[];      // blue-card actions already used this generation
  availableBlueCardActionCount: number;
  cardCost: number; cardDiscount: number; cardsInHandNbr: number;
  citiesCount, coloniesCount, fleetSize, tradesThisGeneration, influence: number;
  color: Color; name: string; id: PlayerId | undefined; isActive: boolean;
  megacredits, megacreditProduction,
  steel, steelProduction, steelValue,          // steelValue normally 2
  titanium, titaniumProduction, titaniumValue, // titaniumValue normally 3
  plants, plantProduction, energy, energyProduction, heat, heatProduction: number;
  terraformRating: number;
  tableau: CardModel[];                        // played cards incl. corporation; `resources` = resources on card
  selfReplicatingRobotsCards: CardModel[];
  tags: Record<Tag, number>;                   // 'building','space','science','power','earth','jovian','venus','plant','microbe','animal','city','moon','mars','crime','wild','event','clone'
  noTagsCount: number;
  needsToDraft?: boolean; needsToResearch?: boolean;
  lastCardPlayed?: CardName;
  protectedResources, protectedProduction: Record<Resource, 'off'|'on'|'half'>;
  timer: TimerModel; handicap?: number;
  underworldData: {corruption, activeBonus, tokens};
  victoryPointsBreakdown: { terraformRating, milestones, awards, greenery, city, victoryPoints, total, detailsCards:[{cardName, victoryPoint}], ... };
  victoryPointsByGeneration: number[];
  globalParameterSteps: Partial<Record<GlobalParameter, number>>;
  alliedParty?, deltaProject?
}
```
Note: the key is **`megacredits`**, all lowercase, everywhere (resources, production is `megacreditProduction`, `Payment`, `Units`).

### `CardModel` (all the API tells you about a card; see section 9 for full card data)
```ts
{ name: CardName; resources?: number; calculatedCost?: number; isDisabled?: boolean;
  discount?: CardDiscount[]; warnings?: Warning[]; reserveUnits?: Units; bonusResource?: Resource[];
  additionalProjectCosts?; cloneTag?; isSelfReplicatingRobotsCard?; standardProjectCanPayWith? }
```
`isDisabled: true` inside an input means the card can't be chosen. For example, a standard project you can't afford right now.

---

## 4. `waitingFor` input types and the exact response to POST

Every model extends `BaseInputModel = { title: string | Message; warning?: string | Message; buttonLabel: string; optional?: boolean }`.

`Message` is `{message: string, data: [{type, value}]}`, with `${i}` placeholders (same scheme as the logs). To render it, substitute `data[i].value`.

`PlayerInputType` (`common/input/PlayerInputType.ts`) is one of: `'and' | 'or' | 'amount' | 'card' | 'delegate' | 'payment' | 'projectCard' | 'initialCards' | 'option' | 'party' | 'player' | 'space' | 'colony' | 'productionToLose' | 'aresGlobalParameters' | 'globalEvent' | 'policy' | 'resource' | 'resources' | 'claimedUndergroundToken' | 'deltaProject'`.

| Model `type` | Model fields (besides base) | Response to POST (exact keys) | Server checks |
|---|---|---|---|
| `or` (OrOptionsModel) | `options: PlayerInputModel[]`, `initialIdx?` | `{"type":"or","index":i,"response":<response for options[i]>}` | `index` in range. `index` is the **raw index into `options`** (the UI hides some options, but it maps back to the original index). |
| `and` (AndOptionsModel) | `options: PlayerInputModel[]` | `{"type":"and","responses":[r0, r1, ...]}` | One response per option, in order |
| `initialCards` (SelectInitialCardsModel) | `options: PlayerInputModel[]` (each a `card` input) | `{"type":"initialCards","responses":[{"type":"card","cards":[...]}, ...]}` | `responses.length === options.length`. See 4.1 |
| `option` (SelectOptionModel) | `warnings?` | `{"type":"option"}` | Must have exactly one key |
| `card` (SelectCardModel) | `cards: CardModel[]`, `min`, `max`, `showOnlyInLearnerMode`, `selectBlueCardAction`, `showOwner`, `showSelectAll` | `{"type":"card","cards":["Card Name", ...]}` | `min <= count <= max`. Each name must be in `cards` and not `isDisabled` |
| `projectCard` (SelectProjectCardToPlayModel) | `cards: CardModel[]` (with `calculatedCost`, `reserveUnits`, `isDisabled`), `paymentOptions: Partial<PaymentOptions>`, `microbes`, `floaters`, `lunaArchivesScience`, `seeds`, `graphene`, `kuiperAsteroids`, `auroraiData`, `spireScience` (spendable counts) | `{"type":"projectCard","card":"Card Name","payment":{...full Payment...}}` | See 4.2. `payment` must contain **all 13 keys** |
| `payment` (SelectPaymentModel) | `amount`, `paymentOptions`, `seeds`, `auroraiData`, `kuiperAsteroids`, `spireScience`, `reserveUnits` | `{"type":"payment","payment":{...full Payment...}}` | Must be able to spend it. `payingAmount >= amount` |
| `space` (SelectSpaceModel) | **`spaces: SpaceId[]`** (the valid spaces; not called availableSpaces) | `{"type":"space","spaceId":"15"}` | Id must be in `spaces`. It is a string with 2 digits and leading zero, e.g. `"05"` |
| `player` (SelectPlayerModel) | `players: Color[]` | `{"type":"player","player":"red"}` | |
| `amount` (SelectAmountModel) | `min`, `max`, `maxByDefault` | `{"type":"amount","amount":3}` | Number, `min <= amount <= max` |
| `colony` (SelectColonyModel) | `coloniesModel: ColonyModel[]` | `{"type":"colony","colonyName":"Europa"}` | |
| `delegate` (SelectDelegateModel) | `players: Array<Color \| 'NEUTRAL'>` | `{"type":"delegate","player":"red"}` or `"NEUTRAL"` | |
| `party` (SelectPartyModel) | `parties: PartyName[]` | `{"type":"party","partyName":"Mars First"}` | Values: `'Mars First'`, `'Scientists'`, `'Unity'`, `'Kelvinists'`, `'Reds'`, `'Greens'` |
| `productionToLose` (SelectProductionToLoseModel) | `payProduction: {cost: number, units: Units}` | `{"type":"productionToLose","units":{"megacredits":0,"steel":0,"titanium":0,"plants":0,"energy":1,"heat":1}}` | All 6 keys, all >= 0, sum equals `cost`, must own the production |
| `resource` (SelectResourceModel) | `include: Array<keyof Units>` | `{"type":"resource","resource":"plants"}` | |
| `resources` (SelectResourcesModel) | `count` | `{"type":"resources","units":{megacredits,steel,titanium,plants,energy,heat}}` | All >= 0, sum equals `count` |
| `aresGlobalParameters` (ShiftAresGlobalParametersModel) | `aresData` | `{"type":"aresGlobalParameters","response":{"lowOceanDelta":0,"highOceanDelta":0,"temperatureDelta":0,"oxygenDelta":0}}` | Each value is -1, 0 or 1 |
| `globalEvent` (SelectGlobalEventModel) | `globalEventNames` | `{"type":"globalEvent","globalEventName":"..."}` | |
| `policy` | — | `{"type":"policy","policyId":"mp01"}` | PolicyId = party letter (m,s,u,k,r,g) + `p01`..`p04` |
| `claimedUndergroundToken` | `tokens`, `min`, `max` | `{"type":"claimedUndergroundToken","selected":[0,2]}` | Indices into `tokens`, no duplicates |
| `deltaProject` | `validSteps: number[]` | `{"type":"deltaProject","amount":n}` | |

`Units` is `{megacredits, steel, titanium, plants, energy, heat}`. All 6 keys are required wherever `Units` is validated.

### 4.1 `initialCards` (generation 1 setup) — verified live
- `options` is built in this fixed order by `server/inputs/SelectInitialCards.ts`. Identify each one by its `title`:
  1. `"Select corporation"` — card, min 1 / max 1 (always present)
  2. `"Select 2 Prelude cards"` — min 2 / max 2 (only if Prelude is on)
  3. `"Select CEO"` — min 1 / max 1 (only if CEO is on)
  4. `"Select initial cards to buy"` — min 0 / max 10 (always last)
- Send one `{"type":"card","cards":[...]}` per option, in the same order.
- The server rejects the whole thing (`"Too many cards selected"`) if `cardsInHand.length * cardCost > corporation.startingMegaCredits`. Each project card costs 3 M€ (`thisPlayer.cardCost`).
- Example sent live (Prelude game, 3 options):
```json
{"type":"initialCards","responses":[
  {"type":"card","cards":["Mining Guild"]},
  {"type":"card","cards":["Nitrogen Shipment","Experimental Forest"]},
  {"type":"card","cards":["Advanced Ecosystems","Technology Demonstration"]}]}
```
After this, the phase became `preludes`. `waitingFor` was then `{"type":"card","title":"Select prelude card to play","min":1,"max":1,...}`, sent twice, followed by any `space` placements.

### 4.2 `Payment` (`common/inputs/Payment.ts`) — all 13 keys are required
```json
{"megacredits":0,"heat":0,"steel":0,"titanium":0,"plants":0,
 "microbes":0,"floaters":0,"lunaArchivesScience":0,"spireScience":0,
 "seeds":0,"auroraiData":0,"graphene":0,"kuiperAsteroids":0}
```
- `isPayment()` requires every key in `SPENDABLE_RESOURCES`. Sending `{"megacredits":11}` alone gave `400 {"message":"payment is not a valid type"}` (live).
- The value paid is computed by `Player.payingAmount(payment, options)`:
  - megacredits ×1, steel × `steelValue` (2), titanium × `titaniumValue` (3), heat ×1 (only for Helion, `canUseHeatAsMegaCredits`), plants ×3 (Martian Lumber Corp, building cards only), microbes ×2, floaters ×3, seeds ×5, graphene ×4, data ×3, spireScience ×2, lunaArchivesScience ×1, kuiperAsteroids ×1.
- Which resources count, for project cards (`paymentOptionsForCard`):
  - steel only if the card has a `building` tag
  - titanium only if it has a `space` tag
  - microbes/seeds for `plant` tags
  - floaters for `venus` tags
  - graphene for `city` or `space` tags
  - Standard projects instead use `card.canPayWith(player)` (steel/titanium/seeds/kuiperAsteroids), plus Aurorai/Spire data.
- **Pitfall:** a resource that isn't usable for this card still gets **deducted** if you include it, but it counts as 0 toward the cost. Only send usable resources.
- Overpaying is allowed. The extra is lost (no change is given). The check is only `amountPaid >= cost`.
- `cost` is `card.calculatedCost` from the input's `cards` list (discounts already applied).
- Reserve units (`reserveUnits`, Moon) must stay unspent.
- A simple good strategy: use steel/titanium up to what the card allows without going over the cost, then pay the rest in M€.

### 4.3 The main action menu (`Player.getActions()` → `OrOptions`) — verified live
- Title: `"Take your first action"` or `"Take your next action"`. Button label: `"Take action"`.
- Options are added **only when available**, in this order. Always look up the index by `type` or `title`; never hard-code it.

| # | Option | Model | How to respond |
|---|---|---|---|
| 1 | `"Claim a milestone"` | `or` of `option`s (title = milestone name) | `{"type":"or","index":i,"response":{"type":"or","index":j,"response":{"type":"option"}}}` |
| 2 | Convert plants: `"Convert 8 plants into greenery"` | `space` | `{"type":"or","index":i,"response":{"type":"space","spaceId":"xx"}}` |
| 3 | `"Convert 8 heat into temperature"` | `option` | `{"type":"option"}` |
| 4 | Turmoil party action (if any) | varies | |
| 5 | `"Perform an action from a played card"` | `card` with `selectBlueCardAction: true`, max 1 | `{"type":"card","cards":["AI Central"]}`, then follow-up inputs |
| 6 | CEO once-per-game action (if any) | | |
| 7 | `"Play project card"` | `projectCard` (only playable cards: requirements already checked by the server) | `{"type":"projectCard","card":"X","payment":{...}}` |
| 8 | Trade with colonies (Colonies expansion) | `and` of (`or` titled `"Pay trade fee"`, `colony`) | `{"type":"and","responses":[{"type":"or","index":k,"response":{"type":"option"}},{"type":"colony","colonyName":"Europa"}]}` |
| 9 | Send delegate (Turmoil) | | |
| 10 | `"End Turn"` (multiplayer, after 1 action, not fast mode) | `option` | `{"type":"option"}` |
| 11 | `"Fund an award (N M€)"` | `or` of `option`s (award names), then a `payment` input | |
| 12 | `"Standard projects"` (button `"Confirm"`) | `projectCard` whose `cards` are standard projects, `isDisabled` if you can't act | `{"type":"projectCard","card":"Power Plant:SP","payment":{...}}` |
| 13 | `"Pass for this generation"` | `option` (warnings `["pass"]`) | `{"type":"option"}` |
| 14 | `"Sell patents"` | `card` (min 0, max = hand size) | `{"type":"card","cards":[...]}` |
| 15 | `"Undo last action"` (undoOption on, after 1 action) | `option` | `{"type":"option"}` (see 2.6) |

- Standard project card names (`CardName`):
  - `"Sell Patents"`, `"Power Plant:SP"` (11), `"Asteroid:SP"` (14), `"Aquifer"` (18), `"Greenery"` (23), `"City"` (25), `"Air Scrapping"` (Venus), `"Buffer Gas"` (solo/TR variant), `"Build Colony"` (Colonies)
  - Moon: `"Road Infrastructure"`, `"Lunar Mine"`, `"Lunar Habitat"`; plus `"Excavate:SP"`, `"Collusion:SP"`
- After most actions, the server immediately sets a follow-up `waitingFor`. Examples: a `space` input for city/greenery/ocean, a `card` input to choose a card to add resources to, or a `player` input to pick whom to attack. Keep resolving `waitingFor` until you get back the next main menu.
- Each player gets 2 actions per turn in multiplayer, or passes. Solo has no "End Turn" option. The turn moves on automatically after 2 actions.

Other phases (all use `card` inputs):
- Research (gen 2+): `SelectCard`, min 0, max 4. Each chosen card costs `cardCost` M€.
- Draft variant: pick one card per round.
- Prelude phase: `"Select prelude card to play"`, max 1.
- Final greenery conversion at game end: `or`/`space`.

### 4.4 `optional`
- If a model has `optional: true`, the game doesn't strictly need it (you are "waiting for other players").
- `/api/waitingfor` only returns `GO` for non-optional inputs.

---

## 5. Board / space IDs

`SpaceModel` (in `game.spaces`):
```ts
{ id: SpaceId; x: number; y: number; spaceType: SpaceType; bonus: SpaceBonus[];
  color?: Color;          // owner of tile
  tileType?: TileType;    // number enum
  highlight?: 'noctis'|'volcanic'; coOwner?; cube?; undergroundResource?; excavator?; ... }
```
- `SpaceType` is a string: `'land' | 'ocean' | 'colony' | 'lunar_mine' | 'cove' | 'restricted' | 'deflection'`.
- `SpaceBonus` is numeric: 0 TITANIUM, 1 STEEL, 2 PLANT, 3 DRAW_CARD, 4 HEAT, 5 OCEAN, 6 MEGACREDITS, 7 ANIMAL, 8 MICROBE, 9 ENERGY, 10 DATA, 11 SCIENCE, 12 ENERGY_PRODUCTION, 13 TEMPERATURE, 14 _RESTRICTED, 15 ASTEROID, 16 DELEGATE, 17 COLONY, 18 TEMPERATURE_4MC.
- `TileType` is numeric: 0 GREENERY, 1 OCEAN, 2 CITY, 3 CAPITAL, 4 COMMERCIAL_DISTRICT, 5 ECOLOGICAL_ZONE, 6 INDUSTRIAL_CENTER, 7 LAVA_FLOWS, 8 MINING_AREA, 9 MINING_RIGHTS, 10 MOHOLE_AREA, 11 NATURAL_PRESERVE, 12 NUCLEAR_ZONE, 13 RESTRICTED_AREA, 14 DEIMOS_DOWN, 15 GREAT_DAM, 16 MAGNETIC_FIELD_GENERATORS, 17+ (Ares/Moon/Pathfinders/...). See `common/TileType.ts`.

Layout (`server/boards/BoardBuilder.ts`):
- Ids `"01"` (Ganymede Colony) and `"02"` (Phobos Space Haven) are off-planet colony spaces. They have `x = y = -1` and `spaceType: 'colony'`.
- The 61 Mars hexes are `"03"`..`"63"`, row by row from the top. Row sizes are `[5,6,7,8,9,8,7,6,5]`. `y` = row (0..8), `x = (9 - tilesInRow) + i`. Id ranges by row:
  - y0 `03-07`
  - y1 `08-13`
  - y2 `14-20`
  - y3 `21-28`
  - y4 `29-37`
  - y5 `38-45`
  - y6 `46-52`
  - y7 `53-58`
  - y8 `59-63`
- Noctis City is reserved at `"31"` on Tharsis (`SpaceName.NOCTIS_CITY`).
- Other named off-board spaces:
  - `69` Stanford Torus
  - `70` Luna Metropolis
  - `71` Dawn City
  - `72` Stratopolis
  - `73` Maxwell Base
  - `75`–`78` Pathfinders
- Moon spaces are `m01`...
- Live sample: `{"x":4,"y":0,"id":"03","spaceType":"land","bonus":[1,1]}`, `{"x":5,"y":0,"id":"04","spaceType":"ocean","bonus":[1,1]}`.

Adjacency (`Board.computeAdjacentSpaces`, middle row y = 4). For a hex at (x, y), the neighbors are (x-1, y) and (x+1, y), plus:
- **y < 4**: top-left (x, y-1), top-right (x+1, y-1), bottom-left (x-1, y+1), bottom-right (x, y+1)
- **y == 4**: top-left (x, y-1), top-right (x+1, y-1), bottom-left (x, y+1), bottom-right (x+1, y+1)
- **y > 4**: top-left (x-1, y-1), top-right (x, y-1), bottom-left (x, y+1), bottom-right (x+1, y+1)

Ignore neighbors that don't exist. **You don't need to work out legal placements yourself.** A `space` input's `spaces` array is exactly the set of legal choices (for example, greenery adjacent to your tiles when possible, or cities not adjacent to other cities).

---

## 6. Vue UI (fallback for clicking)

- Root: `<div id="app">`. The pending-input area is `div.wf-root` (in `WaitingFor.vue`).
- `OrOptions`: `div.wf-options`, with radio buttons `label.form-radio > input[type=radio]` and `span` = option title. The selected option's sub-form renders under it, and the submit button is `.wf-action button.btn`.
- Buttons are all `AppButton`: `<button class="btn ...">` with the translated `buttonLabel` text, e.g. "Take action", "Play card", "Confirm", "Pass", "Sell", "Start", "Save", "Undo".
- `SelectCard`: `div.wf-component.wf-component--select-card`. Each card is a `label.cardbox` holding an `input[type=radio|checkbox]` and a `div.card-container`. Save button: `button.btn`. It may also show a "Skip this action" button.
- `SelectInitialCards`: `div.select-initial-cards`. It has 3–4 `SelectCard` blocks and one "Start" button.
- `SelectSpace`:
  - Board hexes are `div.board-space.board-space-<id>.board-space-selectable` with attribute `data_space_id="<id>"`, inside `#main_board` (also `#moon_board`, `#colony_spaces`).
  - Legal spaces get class `board-space--available`. Click one, then accept the "Place your tile here?" ConfirmDialog, unless the preference `hide_tile_confirmation` is set.
- Payment forms: `PaymentForm.vue` / `PaymentUnit.vue`, with +/- buttons per resource.
- Errors appear as an alert dialog ("Error with input" + the server message).
- Note: the page keeps polling on its own. After you POST through `fetch`, the open page will pick up `REFRESH`/`GO` and re-render within a few seconds, or call `location.reload()`.

---

## 7. Error handling summary
- `/player/input`:
  - Bad input → **HTTP 400**, JSON `{"message": "...", "id"?: "..."}`. The state is unchanged, so fix it and retry.
  - `id: "invalid-run-id"` means the server restarted. Re-fetch `/api/player` and send again.
- Other GET routes send plain-text errors: `400 "Bad request: <detail>"`, `404 "Not found[: detail]"`, `403 "forbidden"`.
- If you POST when nothing is pending, you get 400 `"Not waiting for anything"`.
- Games are purged after inactivity. `game.expectedPurgeTimeMs` gives the time.

---

## 8. Creating games / controlling seats

- There are **no AI bots** available in game creation. A MarsBot/automa exists in `server/automa/` but is not exposed in `NewGameConfig` or the `/new-game` form.
- Options:
  - **Solo** (1 player): the official solo rules. 2 neutral cities are placed with adjacent greeneries. The game ends after generation 14 (12 with Prelude, see `lastSoloGeneration`). You win if Mars is terraformed by then, or reach TR 63 with the `soloTR` option.
  - **Multi-seat** (2–6 players): every seat gets its own `p…` id. One agent can control all seats by polling each id's `/api/waitingfor` and posting to each id's `/player/input`. The create response and `/api/game?id=g…` both list all player ids.

### `POST /api/creategame` — verified live
- Headers: `Content-Type: application/json`.
- Body: `NewGameConfig` (`common/game/NewGameConfig.ts`).
- **Send every field.** The server copies each field into `GameOptions`, and a missing field becomes `undefined`, which *overrides* the default. For example, a missing `startingCorporations` breaks dealing.
- **Don't send `clonedGamedId: null`**: the server calls `.startsWith` on it. Leave the key out.

Body used live:
```json
{
  "players": [{"name":"Bot","color":"red","beginner":false,"handicap":0,"first":true}],
  "expansions": {"corpera":true,"promo":false,"venus":false,"colonies":false,"prelude":true,"prelude2":false,
                 "turmoil":false,"community":false,"ares":false,"moon":false,"pathfinders":false,"ceo":false,
                 "starwars":false,"underworld":false,"deltaProject":false},
  "board": "tharsis", "seed": 0.5, "randomFirstPlayer": false,
  "undoOption": true, "showTimers": false, "fastModeOption": false, "showOtherPlayersVP": true,
  "aresExtremeVariant": false, "politicalAgendasExtension": "Standard", "solarPhaseOption": false,
  "removeNegativeGlobalEventsOption": false, "modularMA": false,
  "draftVariant": false, "initialDraft": false, "preludeDraftVariant": false, "ceosDraftVariant": false,
  "startingCorporations": 2, "shuffleMapOption": false, "randomMA": "No randomization", "includeFanMA": false,
  "soloTR": false, "customCorporationsList": [], "bannedCards": [], "includedCards": [],
  "customColoniesList": [], "customPreludes": [], "requiresMoonTrackCompletion": false,
  "requiresVenusTrackCompletion": false, "moonStandardProjectVariant": false, "moonStandardProjectVariant1": false,
  "altVenusBoard": false, "twoCorpsVariant": false, "customCeos": [], "startingCeos": 3, "startingPreludes": 4
}
```
- The response is a `SimpleGameModel`: `{"id":"gbc11b5aec","players":[{"color":"red","id":"p856fa7af4995","name":"Bot"}],"spectatorId":"s52c...","phase":"research",...}`.
- For multiplayer, add more players with distinct colors from `['red','green','yellow','blue','black','purple','orange','pink']` and exactly one `first: true`.
- `board` values: `'tharsis'`, `'hellas'`, `'elysium'`, `'utopia planitia'`, `'vastitas borealis nova'`, `'terra cimmeria nova'`, `'arabia terra'`, `'vastitas borealis'`, `'amazonis p.'`, `'t. cimmeria'`, `'Hollandia'`, `'random official'`, `'random all'`.
- `randomMA` values: `'No randomization'`, `'Limited synergy'`, `'Full random'`.
- Alternatively, use the `/new-game` form. For a single player it redirects straight to `player?id=…`. For more players it shows `game?id=g…` with a link per seat.

---

## 9. Card data

- The API gives only `CardModel` (name, `calculatedCost`, `resources`, discount, `isDisabled`, ...). It does **not** include tags, text, requirements or VP.
- Server card definitions live at `src/server/cards/<module>/<CardClass>.ts`. For example, `src/server/cards/base/EcologicalZone.ts` has `cost`, `tags`, `requirements`, `behavior`, `victoryPoints`, and `metadata.renderData`/`description`. The raw form is `https://raw.githubusercontent.com/terraforming-mars/terraforming-mars/main/src/server/cards/base/<ClassName>.ts`, but file names are PascalCase class names, not card names.
- **Best source: the client card database (`ClientCard[]`), shipped in a lazily loaded JS chunk.**
  - It is built from `src/genfiles/cards.json`. On the live Heroku build it is `/chunks/756.js` (about 690 KB), which contains `JSON.parse('[{"module":"base","name":"Adaptation Technology",...}]')` with 997 cards.
  - Card types in it: active 240, automated 341, event 145, corporation 100, prelude 111, ceo 37, standard_project 21, standard_action 2.
  - The chunk number can change with each deploy, so find it dynamically (snippet below).
  - `ClientCard` = `{ name, module, tags: Tag[], cost?, type: CardType, requirements?: CardRequirementDescriptor[], victoryPoints?: number|'special'|{...}, metadata: {cardNumber, description?, renderData?, victoryPoints?}, productionBox?: Units, resourceType?, startingMegaCredits?, cardCost?, cardDiscount?, compatibility, hasAction }`.
  - Examples:
    - `{"name":"Ecological Zone","tags":["animal","plant"],"cost":12,"type":"active","victoryPoints":{"resourcesHere":{},"per":2},"resourceType":"Animal","requirements":[{"greeneries":1,"count":1}]}`
    - `{"name":"CrediCor","type":"corporation","startingMegaCredits":57,"metadata":{"description":"You start with 57 M€."}}`
    - `{"name":"Dust Seals","requirements":[{"oceans":3,"max":true,"count":3}],"metadata":{"description":"Requires 3 or less ocean tiles."}}`
  - Card text: use `metadata.description` when present. Otherwise collect every `text` string found recursively in `metadata.renderData`.
- The `/cards` page (`/cards`) renders all cards visually. Good for people, awkward for parsing.

---

## 10. Worked JS snippets (run in the page context, same origin)

### 10.1 Fetch state, poll, post
```js
const PID = new URLSearchParams(location.search).get('id');   // on /player?id=p...
const TM = {
  async state() {
    const r = await fetch(`/api/player?id=${PID}`);
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
    return r.json();                                   // PlayerViewModel
  },
  async poll(view) {                                   // resolves when it's our turn or state changed
    for (;;) {
      const g = view.game;
      const r = await fetch(`/api/waitingfor?id=${PID}&gameAge=${g.gameAge}&undoCount=${g.undoCount}`);
      const w = await r.json();                        // {result:'GO'|'REFRESH'|'WAIT', waitingFor:[colors]}
      if (w.result !== 'WAIT') return w;
      await new Promise((res) => setTimeout(res, 2000));
    }
  },
  async send(response, runId) {
    const r = await fetch(`/player/input?id=${PID}`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(runId ? {runId, ...response} : response),
    });
    const body = await r.json();
    if (!r.ok) return {ok: false, status: r.status, error: body.message, id: body.id};
    return {ok: true, view: body};                     // new PlayerViewModel
  },
};

// Compact summary for the LLM
function summarize(v) {
  const p = v.thisPlayer, g = v.game;
  return {
    gen: g.generation, phase: g.phase, temp: g.temperature, o2: g.oxygenLevel, oceans: g.oceans, venus: g.venusScaleLevel,
    me: {tr: p.terraformRating, mc: p.megacredits, mcProd: p.megacreditProduction, steel: p.steel, steelProd: p.steelProduction,
         ti: p.titanium, tiProd: p.titaniumProduction, plants: p.plants, plantProd: p.plantProduction,
         energy: p.energy, energyProd: p.energyProduction, heat: p.heat, heatProd: p.heatProduction,
         tags: p.tags, actionsTakenThisRound: p.actionsTakenThisRound, usedActions: p.actionsThisGeneration},
    hand: v.cardsInHand.map((c) => `${c.name} (${c.calculatedCost})`),
    tableau: p.tableau.map((c) => c.name + (c.resources ? ` [${c.resources}]` : '')),
    opponents: v.players.filter((o) => o.color !== p.color).map((o) => ({name: o.name, color: o.color, tr: o.terraformRating, mc: o.megacredits, cards: o.cardsInHandNbr, tableau: o.tableau.map((c) => c.name)})),
    milestones: g.milestones.map((m) => `${m.name}${m.color ? ' (claimed ' + m.color + ')' : ''}`),
    awards: g.awards.map((a) => `${a.name}${a.color ? ' (funded ' + a.color + ')' : ''}`),
    waitingFor: v.waitingFor,
  };
}

// Render a Message or string title
const msg = (t) => typeof t === 'string' ? t : t.message.replace(/\$\{(\d+)\}/g, (_, i) => t.data[i]?.value);
```

### 10.2 Building responses
```js
const PAY_KEYS = ['megacredits','heat','steel','titanium','plants','microbes','floaters','lunaArchivesScience','spireScience','seeds','auroraiData','graphene','kuiperAsteroids'];
const payment = (p = {}) => Object.fromEntries(PAY_KEYS.map((k) => [k, p[k] ?? 0]));

// Look up an option of the main OrOptions menu by title or type
const optIndex = (wf, pred) => wf.options.findIndex(pred);

// 1) Play a project card, paying with steel (building tag) then M€.
//    Pass the card's tags in (from the card DB) to decide steel/titanium.
function playCard(view, cardName, tags) {
  const wf = view.waitingFor;                              // main menu (type 'or')
  const i = optIndex(wf, (o) => o.type === 'projectCard' && msg(o.title) === 'Play project card');
  const card = wf.options[i].cards.find((c) => c.name === cardName);
  const me = view.thisPlayer; let cost = card.calculatedCost;
  const p = {};
  if (tags.includes('building')) { p.steel = Math.min(me.steel, Math.floor(cost / me.steelValue)); cost -= p.steel * me.steelValue; }
  if (tags.includes('space'))    { p.titanium = Math.min(me.titanium, Math.floor(cost / me.titaniumValue)); cost -= p.titanium * me.titaniumValue; }
  p.megacredits = cost;
  return {type: 'or', index: i, response: {type: 'projectCard', card: cardName, payment: payment(p)}};
}

// 2) Standard project (e.g. City) -- verified pattern with Power Plant:SP
const stdProject = (wf, name, mc) => ({type: 'or', index: optIndex(wf, (o) => msg(o.title) === 'Standard projects'),
  response: {type: 'projectCard', card: name, payment: payment({megacredits: mc})}});

// 3) Pass
const pass = (wf) => ({type: 'or', index: optIndex(wf, (o) => msg(o.title) === 'Pass for this generation'), response: {type: 'option'}});

// 4) Blue-card action
const cardAction = (wf, name) => ({type: 'or', index: optIndex(wf, (o) => o.type === 'card' && o.selectBlueCardAction), response: {type: 'card', cards: [name]}});

// 5) Follow-up inputs (when waitingFor itself is the input)
const placeTile = (spaceId) => ({type: 'space', spaceId});           // must be in waitingFor.spaces
const chooseCards = (names) => ({type: 'card', cards: names});
const chooseAmount = (n) => ({type: 'amount', amount: n});
const choosePlayer = (color) => ({type: 'player', player: color});

// Example loop step
(async () => {
  let v = await TM.state();
  if (!v.waitingFor) { await TM.poll(v); v = await TM.state(); }
  console.log(summarize(v));
  // ...LLM decides...  e.g.
  const res = await TM.send(pass(v.waitingFor), v.runId);
  if (!res.ok) console.warn('rejected:', res.error);     // state is unchanged; retry with a fix
  else v = res.view;
})();
```

### 10.3 Loading the card database (find the chunk dynamically)
```js
async function loadCardDb() {
  // Chunk URLs this page already loaded, plus numbered chunks referenced from main.js
  const loaded = performance.getEntriesByType('resource').map((e) => e.name).filter((n) => n.includes('/chunks/'));
  const main = await (await fetch('/main.js')).text();
  const ids = [...new Set([...main.matchAll(/\.e\((\d+)\)/g)].map((m) => m[1]))].map((id) => `/chunks/${id}.js`);
  for (const url of [...new Set([...loaded, ...ids])]) {
    const src = await (await fetch(url)).text();
    if (!src.includes('"startingMegaCredits"')) continue;
    const re = /JSON\.parse\('((?:[^'\\]|\\.)*)'\)/g; let m;
    while ((m = re.exec(src))) {
      if (!m[1].includes('"cardNumber"')) continue;
      const arr = JSON.parse(Function(`return '${m[1]}'`)());   // unescape JS string literal
      const db = new Map(arr.map((c) => [c.name, c]));
      return db;
    }
  }
  throw new Error('card db chunk not found');
}
function cardText(c) {                                       // flatten renderData texts
  if (c.metadata?.description) return typeof c.metadata.description === 'string' ? c.metadata.description : c.metadata.description.text;
  const out = []; (function walk(x) { if (!x || typeof x !== 'object') { if (typeof x === 'string') out.push(x); return; }
    if (typeof x.text === 'string') out.push(x.text); Object.values(x).forEach(walk); })(c.metadata?.renderData);
  return [...new Set(out)].join(' ');
}
// const DB = await loadCardDb(); DB.get('Ecological Zone') -> {tags:['animal','plant'], cost:12, requirements:[{greeneries:1,count:1}], ...}
```
(The extraction regex and unescape were tested with Node against the live `chunks/756.js`. They found 1 array of 997 cards.)

---

## 11. Gotchas checklist
- Casing: use `megacredits` (lowercase) in `Payment`, `Units` and the player model. The production field is `megacreditProduction`.
- Response keys must match exactly. Include all 13 `Payment` keys and all 6 `Units` keys.
- `space` ids are zero-padded strings (`"05"`). The model field is `spaces`.
- The `or` `index` is the raw index into `options`. Options appear and disappear depending on what's available, so always look them up by title or type.
- A `projectCard` list contains only cards the server thinks are playable (requirements checked). Unaffordable standard projects show `isDisabled: true`.
- You don't need to hard-code `initialCards` response order. Map the responses 1:1 onto `options` and identify each option by its title.
- After a successful POST, the returned model often has another `waitingFor` right away (tile placement, choose target, ...). Keep resolving it before polling.
- When one agent drives several seats: during research/draft all seats act simultaneously; during the action phase only the active player gets `GO`.
- Undo needs `undoOption: true` at creation. It appears as an `option` titled `"Undo last action"`.
