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
| `server.mjs` | Listens on `127.0.0.1`. Verifies the signature, checks the link is a seat on the allowed TM server, enforces the limits, starts one supervisor per seat, and restarts supervisors for live games when it starts. |
| `run-seat.sh` | Supervisor for one seat: prepares the game directory, runs `claude -p`, resumes the session whenever a run ends while the game is live, publishes lessons, reports the outcome. |
| `notify.mjs` | Signed report to the bot. `failed` carries the seat link so a person can take over; `ended` carries the final standings. |
| `sign.mjs` | The request signature, shared by both directions. `../src/runner.ts` is the bot's copy; `tests/runner.spec.ts` checks they agree. |
| `install.sh`, `start.sh` | Install into the runner's account; start with its settings. |

## What contains the model

The skill's `tm.js` evaluates JavaScript that the model writes (the guards in
`tree.json`), so a list of allowed commands is not a boundary. Two things are:

1. **A separate, unprivileged OS account.** The runner and everything under it
   run as an account that cannot read the owner's home and cannot `sudo`. Its
   own secrets are the Claude token, the shared secret and (optionally) a
   deploy key.
2. **Claude Code's sandbox**, per game: Bash and everything it starts can read
   and write only that game's directory and reach only the TM server; the
   Claude token is removed from their environment. `--restricted` confines the
   file tools to the same directory and drops MCP servers and user settings.

## Settings

`runner.env` in the runner's home (`~/tm-claude/runner.env`), one `VAR=value` per line:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TM_MODEL` | `opus` | Model for the seat. |
| `TM_BUDGET_USD` | `300` | Per-game spend cap passed to `claude --max-budget-usd`. |
| `TM_MAX_CONCURRENT` | `2` | Games at once; further requests are declined and the bot falls back to DMing the operator. |
| `TM_MAX_PER_DAY` | `8` | Seats accepted per 24 hours. |
| `TM_IDLE_HOURS` | `12` | Give up on a game in which nothing was asked of Claude's seat for this long. |
| `TM_STATUS_URL` | unset | `https://<bot-domain>/api/claude/status`. Unset means outcomes are only logged locally. |
| `TM_ALLOWED_ORIGIN` | `https://terraforming-mars.herokuapp.com` | The only TM server whose seats are accepted. Must match the bot's `TM_BASE_URL`. |
| `TM_RUNNER_PORT` | `8787` | Localhost port. |
| `TM_BASE_BRANCH` | `main` | Branch the lessons branch is rebased onto before each game. |

The bot needs `CLAUDE_RUNNER_URL` (the public origin that reaches this
listener) and `CLAUDE_RUNNER_SECRET` (the contents of `~/tm-claude/runner-secret`).

## State and logs

Everything for a game is in `~/tm-claude/games/<player id>/`: `job.json`,
`supervisor.log` (one line per run with its cost), `logs/run-NNN.jsonl` (the
full Claude Code transcript), `cache/` (the skill's plans and analysis),
`lessons/`, and `done` once the supervisor has finished for good. A player id
is the credential for its seat, so the directory is private to the account
and the server log only ever prints a prefix.

## Lessons

Each game starts from the checkout's `claude/lessons` branch, rebased onto
`main`, and writes to its own copies of `lessons.md` and `lessons-log.md`.
After the game the supervisor merges those into the checkout (three-way,
keeping both sides of any overlap), commits, and pushes `claude/lessons`.
Getting them onto `main` is a pull request from that branch; the push needs a
deploy key with write access, and without one the commits simply stay local.
