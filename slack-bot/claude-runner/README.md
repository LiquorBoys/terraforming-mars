# Claude runner

Plays the "Add Claude as a player" seat unattended. The Slack bot hands Claude's
player link to this runner; the runner starts Claude Code headless on the
[Terraforming Mars skill](../claude-skill/terraforming-mars) inside an OS
sandbox, keeps it in the game until the game ends, and reports back.

```
Slack modal -> bot (Vercel) --signed POST /seat--> runner (this) -> claude -p (sandboxed) -> TM server
                    ^-- signed POST /api/claude/status (ended / failed) --'
```

## Pieces

| File | Role |
| --- | --- |
| `league.mjs` | Builds the league record of a finished game from what its spectator id can read. |
| `server.mjs` | Listens on `127.0.0.1`. Runs the league collector. Verifies the signature, checks the link is a seat on the allowed TM server, enforces the limits, starts one supervisor per seat, and restarts supervisors for live games when it starts. |
| `run-seat.sh` | Supervisor for one seat: prepares the game directory, runs `claude -p`, resumes the session whenever a run ends while the game is live, publishes lessons, reports the outcome. |
| `notify.mjs` | Signed report to the bot. `failed` carries the seat link so a person can take over; `ended` carries the final standings. |
| `sign.mjs` | The request signature, shared by both directions. `../src/runner.ts` is the bot's copy; `tests/runner.spec.ts` checks they agree. |
| `install.sh`, `start.sh` | Install into the runner's account; start with its settings. |

## What contains the model

The skill's `tm.js` evaluates JavaScript that the model writes (the guards in
`tree.json`), so a list of allowed commands is not a boundary. Two things are:

1. **A separate, unprivileged OS account.** The runner and everything under it
   run as an account that cannot read the owner's home and cannot `sudo`. Its
   own secrets are the Claude token, the shared secret and a deploy key for
   the league repository.
2. **Claude Code's sandbox**, per game: Bash and everything it starts can read
   and write only that game's directory and reach only the TM server; the
   Claude token is removed from their environment. `--restricted` confines the
   file tools to the same directory and drops MCP servers and user settings.

## Settings

`runner.env` in the runner's home (`~/tm-claude/runner.env`), one `VAR=value` per line:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TM_MODEL` | `opus` | Model for the seat. A comma-separated list (`opus,sonnet`) gives each game the model that has played the fewest games so far, breaking ties at random, so the models end up with equal numbers of games; the choice is recorded in the game's `job.json`. |
| `TM_BUDGET_USD` | `300` | Per-game spend cap passed to `claude --max-budget-usd`. |
| `TM_MAX_CONCURRENT` | `2` | Games at once; further requests are declined and the bot falls back to DMing the operator. |
| `TM_MAX_PER_DAY` | `8` | Seats accepted per 24 hours. |
| `TM_IDLE_HOURS` | `12` | Give up on a game in which nothing was asked of Claude's seat for this long. |
| `TM_STATUS_URL` | unset | `https://<bot-domain>/api/claude/status`. Unset means outcomes are only logged locally. |
| `TM_ALLOWED_ORIGIN` | `https://terraforming-mars.herokuapp.com` | The only TM server whose seats are accepted. Must match the bot's `TM_BASE_URL`. |
| `TM_RUNNER_PORT` | `8787` | Localhost port. |
| `TM_BASE_BRANCH` | `main` | Branch of this repository the skill is updated from before each game. |
| `TM_COLLECT_SECONDS` | `60` | How often the league collector looks at unfinished games. |

The bot needs `CLAUDE_RUNNER_URL` (the public origin that reaches this
listener) and `CLAUDE_RUNNER_SECRET` (the contents of `~/tm-claude/runner-secret`).

## State and logs

Everything for a game is in `~/tm-claude/games/<player id>/`: `job.json`,
`supervisor.log` (one line per run with its cost), `logs/run-NNN.jsonl` (the
full Claude Code transcript), `cache/` (the skill's plans and analysis),
`lessons/`, and `done` once the supervisor has finished for good. A player id
is the credential for its seat, so the directory is private to the account
and the server log only ever prints a prefix.

## The league repository

The runner's account has two checkouts: this repository, read-only, for the
skill; and a separate data repository (`~/tm-claude/league`) that it may push
to. It has no write access to this repository on purpose: every branch pushed
here gets a Vercel preview deployment with the bot's Slack tokens in its
environment, so being able to push here means being able to read them.

### Game records

The bot tells the runner about every game it creates (`POST /game`), with or
without Claude. Once a minute the collector in `server.mjs` reads each of
those games through its spectator id; when one has ended it writes

- `games/<game id>.json.gz`: the whole public log and the final public state;
- an entry in `games.json`: the compact summary the stats page reads
  (`league.mjs` documents the fields);

and commits and pushes. No model is involved. People appear under their
in-game name and a keyed hash of their Slack id, never the id itself; Claude
appears as `claude-<model>`, which is the only place a game's model is
revealed. The seed comes from the bot, since spectators cannot see it. Games
the server has purged, or that are unfinished after 14 days, are dropped.

### Lessons

`lessons/` in the league repository holds Claude's live copies of
`lessons.md` and `lessons-log.md`. Before each game the supervisor folds in
whatever has changed in the skill's own copies since last time; each game
works on its own copies; after the game its changes are merged back, three
ways, keeping both sides of any overlap, and pushed. Getting them into the
skill is a pull request to this repository made by a person.
