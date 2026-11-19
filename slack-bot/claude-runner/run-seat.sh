#!/bin/bash
# Supervisor for one Claude seat in a Terraforming Mars game. Started by server.mjs.
# Usage: run-seat.sh <gameDir>      (gameDir holds job.json)
#
# Runs `claude -p` on the skill inside an OS sandbox. The skill's own loop keeps a run alive for
# a whole live game; whenever a run ends while the game is still going, this waits with plain
# HTTP polling (no model, no model-written code) until the seat has input, then resumes the same
# session. It writes `done` only when it will never need to run again; without `done`, the
# server starts it again after a restart and it picks the session back up.
set -u
GAME="$1"
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="${TM_RUNNER_HOME:-$HOME/tm-claude}"
REPO="${TM_SKILL_REPO:-$ROOT/repo}"
LEAGUE="${TM_LEAGUE_DIR:-$ROOT/league}"
SKILL_SRC="${TM_SKILL_DIR:-$REPO/slack-bot/claude-skill/terraforming-mars}"
BUDGET="${TM_BUDGET_USD:-300}"
IDLE_HOURS="${TM_IDLE_HOURS:-12}"
BASE_BRANCH="${TM_BASE_BRANCH:-main}"
CLAUDE="${CLAUDE_BIN:-$(command -v claude || echo "$HOME/.local/bin/claude")}"
TOKEN_FILE="${TM_CLAUDE_TOKEN_FILE:-$HOME/.tm-claude/claude-oauth-token}"
LOG="$GAME/supervisor.log"
say() { echo "$(date '+%Y-%m-%dT%H:%M:%S') $*" >> "$LOG"; }

cd "$GAME" || { echo "cannot enter $GAME"; exit 1; }
URL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("job.json","utf8")).playerUrl)') || { say "STOP: job.json unreadable"; exit 1; }
PLAYER="${URL##*id=}"; BASE="${URL%%/player*}"
# The model was drawn when the seat was accepted and is fixed for the game.
MODEL=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("job.json","utf8")).model || "opus")')
REFS="$SKILL_SRC/references"
mkdir -p logs cache lessons lessons-seed

CHILD=; WATCH=
trap 'say "signal received: stopping without marking the game done"; [ -n "$WATCH" ] && kill "$WATCH" 2>/dev/null; [ -n "$CHILD" ] && kill -TERM "$CHILD" 2>/dev/null; exit 143' TERM INT

# The runner's account has two checkouts:
#   $REPO    this repository, read-only, for the skill itself
#   $LEAGUE  the league data repository, which it may push to; lessons/ there holds Claude's
#            live lessons. They are not pushed to this repository: every branch pushed here gets
#            a Vercel preview deployment with the bot's Slack tokens, so write access here would
#            be access to those tokens.
# One writer at a time in the league checkout (two games can start or end together, and the
# league collector commits there too).
lock() { local i=0; until mkdir "$ROOT/league.lock" 2>/dev/null; do i=$((i + 1)); [ "$i" -ge 120 ] && { say "league lock held for 2 minutes; taking it"; break; }; sleep 1; done; }
unlock() { rmdir "$ROOT/league.lock" 2>/dev/null; }
lgit() { git -C "$LEAGUE" -c user.name="Claude (TM runner)" -c user.email="noreply@anthropic.com" "$@"; }

# commit_lessons <message>: commit lessons/ in the league checkout and push; failures are logged, never fatal.
commit_lessons() {
  local out
  [ -d "$LEAGUE/.git" ] || { say "$LEAGUE is not a git checkout; lessons are kept there unpublished"; return; }
  lgit add lessons
  if lgit diff --cached --quiet; then return; fi
  if ! out=$(lgit commit -q -m "$1" 2>&1); then say "lessons commit failed: $out"; return; fi
  if out=$(lgit pull -q --rebase 2>&1 && lgit push -q 2>&1); then say "lessons pushed: $1"; else say "lessons committed locally, not pushed: $out"; fi
}

# Before a game: update the skill, then fold any lessons people have merged into this repository
# into Claude's live copies. lessons/.base holds this repository's version as of the last fold,
# which is what makes a three-way merge possible.
refresh() {
  local out f
  lock
  if [ -d "$REPO/.git" ]; then
    out=$(git -C "$REPO" pull -q --ff-only origin "$BASE_BRANCH" 2>&1) || say "skill update failed, playing with the checkout as it is: $out"
  else say "no git checkout at $REPO; using the skill as it is"; fi
  [ -d "$LEAGUE/.git" ] && { out=$(lgit pull -q --rebase 2>&1) || say "league update failed, continuing with the local copy: $out"; }
  mkdir -p "$LEAGUE/lessons/.base"
  for f in lessons.md lessons-log.md; do
    [ -f "$REFS/$f" ] || continue
    if [ ! -f "$LEAGUE/lessons/$f" ]; then cp "$REFS/$f" "$LEAGUE/lessons/$f"; cp "$REFS/$f" "$LEAGUE/lessons/.base/$f"
    elif ! cmp -s "$REFS/$f" "$LEAGUE/lessons/.base/$f"; then
      git merge-file --union "$LEAGUE/lessons/$f" "$LEAGUE/lessons/.base/$f" "$REFS/$f" 2>/dev/null; cp "$REFS/$f" "$LEAGUE/lessons/.base/$f"
    fi
  done
  commit_lessons "lessons: fold in changes from the skill repository"
  unlock
}

# After a game: merge what it wrote into the live copies, three ways against the copy it started
# from, keeping both sides of any overlap. Tidying that up is a person's job when they copy the
# lessons back into the skill by pull request.
publish_lessons() {
  local f
  lock
  for f in lessons.md lessons-log.md; do
    [ -f "lessons/$f" ] && [ -f "lessons-seed/$f" ] || continue
    cmp -s "lessons/$f" "lessons-seed/$f" && continue
    git merge-file --union "$LEAGUE/lessons/$f" "lessons-seed/$f" "lessons/$f" 2>/dev/null
  done
  commit_lessons "lessons: $1"
  unlock
}

finish() { # finish <ended|failed> <detail>
  say "finish: $1 $2"
  node "$HERE/notify.mjs" "$GAME" "$1" "$2" >> "$LOG" 2>&1
  date '+%Y-%m-%dT%H:%M:%S' > done
  [ "$1" = ended ] && exit 0 || exit 1
}

# ---- first start only: skill copy, lessons copies, sandbox settings, session id ----
if [ ! -f session_id ]; then
  refresh
  [ -f "$SKILL_SRC/SKILL.md" ] || finish failed "the skill was not found at $SKILL_SRC"
  mkdir -p plugin/.claude-plugin plugin/skills
  echo '{"name": "tm", "description": "Terraforming Mars player skill", "version": "0.0.1"}' > plugin/.claude-plugin/plugin.json
  cp -R "$SKILL_SRC" plugin/skills/terraforming-mars
  chmod +x plugin/skills/terraforming-mars/scripts/*.sh
  for f in lessons.md lessons-log.md; do cp "$LEAGUE/lessons/$f" "lessons/$f"; cp "$LEAGUE/lessons/$f" "lessons-seed/$f"; done
  cat > settings.json <<EOF
{
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "autoAllowBashIfSandboxed": true,
    "filesystem": {"denyRead": ["~/"], "allowRead": ["$GAME"], "allowWrite": ["$GAME"]},
    "network": {"allowedDomains": ["${BASE#https://}"], "strictAllowlist": true},
    "credentials": {"envVars": [
      {"name": "CLAUDE_CODE_OAUTH_TOKEN", "mode": "deny"},
      {"name": "ANTHROPIC_API_KEY", "mode": "deny"},
      {"name": "ANTHROPIC_AUTH_TOKEN", "mode": "deny"}
    ]}
  },
  "env": {"NODE_USE_ENV_PROXY": "1", "TM_CACHE_DIR": "$GAME/cache"},
  "permissions": {"allow": ["Bash", "Edit", "Write"]}
}
EOF
  uuidgen | tr 'A-Z' 'a-z' > session_id
  FIRST=1
else
  FIRST=0
fi
SID=$(cat session_id)

OVERLAY="Context for this session: you are playing one seat of a live Terraforming Mars game, unattended, started by an automated runner because someone ticked 'Add Claude' when creating the game. Nobody reads your output while the game runs and nobody can answer questions, so make every decision yourself and never wait for a reply. The other players are people waiting on you, so act promptly when input is pending.

Environment: the skill's directory is $GAME/plugin/skills/terraforming-mars and is read-only; use that path wherever the skill text says ~/.claude/skills/terraforming-mars. TM_CACHE_DIR is set, so every cache/... path in the skill means $GAME/cache/.... Bash commands run in an OS sandbox: only $GAME is readable and writable, and only the game server is reachable over the network. There is no browser. The operator chose this session's model, so the skill's instruction to use Sonnet and to tell the user about it does not apply. scripts/cost.js cannot read session transcripts from inside the sandbox; skip it, the runner records cost.

Lessons: the live copies are $GAME/lessons/lessons.md and $GAME/lessons/lessons-log.md. Read those instead of the copies under references/, and write this game's lessons to them; the runner publishes them after the game.

Keep per-move narration to two or three lines; it goes to a log that is read after the game.

Stay in the game while it is active: when nothing is pending, wait with the skill's model-free watcher or autopilot as a background command. If a watcher times out twice in a row with no change in the game, end your run instead of starting a third; the runner resumes this session as soon as your seat has input, and waiting that way costs nothing.

When the game ends, do the skill's end-of-game steps (final result, postmortem, lessons), then create the empty file $GAME/postmortem.done as your last action."

[ -r "$TOKEN_FILE" ] && export CLAUDE_CODE_OAUTH_TOKEN="$(cat "$TOKEN_FILE")"
n=$(ls logs 2>/dev/null | grep -c '\.jsonl$')

# Prints: end | go | wait | error:<why>
state() {
  node -e '
    fetch(process.argv[1] + "/api/player?id=" + process.argv[2], {signal: AbortSignal.timeout(20000)}).then(async (r) => {
      if (!r.ok) { console.log("error:HTTP " + r.status); return; }
      const j = await r.json();
      if (j.game && j.game.phase === "end") console.log("end");
      else console.log(j.waitingFor !== undefined ? "go" : "wait");
    }).catch((e) => console.log("error:" + ((e.cause && e.cause.code) || e.message)));' "$BASE" "$PLAYER"
}

# run <first|resume> <prompt>; sets RUN_RC, RUN_SECS, RUN_RESULT (the result event's subtype), RUN_ERR
# and RUN_RESET (when the usage allowance comes back, as epoch seconds, if the run hit it)
run() {
  n=$((n + 1)); local tag; tag=$(printf 'run-%03d' "$n")
  local sess=(--resume "$SID"); [ "$1" = first ] && sess=(--session-id "$SID")
  local t0; t0=$(date +%s)
  say "$tag start ($1, model $MODEL)"
  "$CLAUDE" -p "$2" --model "$MODEL" "${sess[@]}" \
      --restricted --tools "Bash,Read,Write,Edit,Glob,Grep,Agent,Skill" --strict-mcp-config \
      --plugin-dir "$GAME/plugin" --settings "$GAME/settings.json" \
      --permission-mode dontAsk --permission-prompts none \
      --max-budget-usd "$BUDGET" --autocompact 200k --append-system-prompt "$OVERLAY" \
      --output-format stream-json --verbose \
      < /dev/null > "logs/$tag.jsonl" 2> "logs/$tag.err" &
  CHILD=$!
  # Once the game is over the run has nothing left to do, but `claude -p` stays open until every
  # background command it started has exited, and a watcher started just before the end can sit
  # there for another 50 minutes, holding one of the runner's game slots. So stop the run a
  # minute after the postmortem is written, or 15 minutes after the game ended if it never is.
  (
    over=0
    while kill -0 "$CHILD" 2>/dev/null; do
      sleep 30
      if [ -f postmortem.done ]; then
        sleep 30; say "$tag: the game is over and the postmortem is written; stopping the run"
        kill -TERM "$CHILD" 2>/dev/null; exit 0
      fi
      if [ "$(state)" = end ]; then over=$((over + 1)); else over=0; fi
      if [ "$over" -ge 30 ]; then
        say "$tag: the game has been over for 15 minutes with no postmortem; stopping the run"
        kill -TERM "$CHILD" 2>/dev/null; exit 0
      fi
    done
  ) &
  WATCH=$!
  wait "$CHILD"; RUN_RC=$?; CHILD=
  kill "$WATCH" 2>/dev/null; wait "$WATCH" 2>/dev/null; WATCH=
  # A run that wrote its postmortem did its job, however it then ended.
  [ -f postmortem.done ] && RUN_RC=0
  RUN_SECS=$(( $(date +%s) - t0 ))
  local summary
  summary=$(node -e '
    let last = null;
    for (const l of require("fs").readFileSync(process.argv[1], "utf8").split("\n")) {
      if (!l) continue; try { const j = JSON.parse(l); if (j.type === "result") last = j; } catch {}
    }
    // When the usage allowance is spent, Claude Code says when it comes back.
    let reset = "";
    for (const l of require("fs").readFileSync(process.argv[1], "utf8").split("\n")) {
      if (!l.includes("rate_limit_event")) continue;
      try { const r = JSON.parse(l).rate_limit_info; if (r && r.status === "rejected" && r.resetsAt) reset = r.resetsAt; } catch {}
    }
    if (!last) { console.log(["none", "", "", reset].join("\t")); process.exit(0); }
    // A failed run can still carry subtype "success"; is_error is what says it failed.
    const failed = last.is_error || last.subtype !== "success";
    console.log([last.subtype, last.total_cost_usd ?? "", failed ? String(last.result ?? "").replace(/\s+/g, " ").slice(0, 300) : "", reset].join("\t"));' "logs/$tag.jsonl")
  RUN_RESULT=$(printf '%s' "$summary" | cut -f1); local cost; cost=$(printf '%s' "$summary" | cut -f2); RUN_ERR=$(printf '%s' "$summary" | cut -f3); RUN_RESET=$(printf '%s' "$summary" | cut -f4)
  [ -n "$cost" ] && echo "$cost" > cost
  [ -z "$RUN_ERR" ] && [ "$RUN_RC" -ne 0 ] && RUN_ERR=$(tail -c 300 "logs/$tag.err" | tr '\n' ' ')
  say "$tag end rc=$RUN_RC secs=$RUN_SECS result=$RUN_RESULT total_cost_usd=${cost:-unknown} ${RUN_ERR:+error: $RUN_ERR}"
}

say "seat ${PLAYER:0:5}… model=$MODEL budget=$BUDGET session=$SID first=$FIRST"
if [ "$FIRST" -eq 1 ]; then
  run first "/tm:terraforming-mars $URL play"
else
  RUN_RC=0; RUN_SECS=999; RUN_RESULT=resumed; RUN_ERR=; RUN_RESET=
fi

fails=0; final_sent=0; limit_told=0
while :; do
  case "$RUN_RESULT" in *budget*) finish failed "the per-game budget of \$$BUDGET was reached" ;; esac
  # A run that failed, or ended almost at once, is backed off so a rate limit or a broken
  # install cannot spin the loop.
  if [ -n "$RUN_RESET" ] && [ "$RUN_RC" -ne 0 ]; then
    # Out of usage is not a fault to retry every two minutes and then give up on: Claude Code
    # says when the allowance returns, so tell the host once, wait until then, and carry on.
    back=$(date -r "$RUN_RESET" '+%H:%M')
    if [ "$limit_told" -eq 0 ]; then
      limit_told=1
      say "usage allowance spent; waiting until $back"
      node "$HERE/notify.mjs" "$GAME" failed "it has used up its usage allowance until $back and will pick the game up again then if it is still going" >> "$LOG" 2>&1
    fi
    pause=$(( RUN_RESET - $(date +%s) + 90 )); [ "$pause" -lt 120 ] && pause=120
    sleep "$pause"
  elif [ "$RUN_RC" -ne 0 ] || [ "$RUN_SECS" -lt 20 ]; then
    fails=$((fails + 1))
    [ "$fails" -ge 20 ] && finish failed "Claude Code failed 20 times in a row. Last error: ${RUN_ERR:-none reported}"
    sleep 120
  else
    fails=0; limit_told=0
  fi
  errs=0; idle_since=$(date +%s)
  while :; do
    st=$(state)
    case "$st" in
      end|go) break ;;
      wait) errs=0
            [ $(( $(date +%s) - idle_since )) -ge $(( IDLE_HOURS * 3600 )) ] && finish failed "nothing was asked of Claude's seat for $IDLE_HOURS hours, so it stopped waiting"
            sleep 5 ;;
      *) errs=$((errs + 1)); say "game state check failed ($st), attempt $errs"
         [ "$errs" -ge 60 ] && finish failed "the game server could not be read 60 times in a row (${st#error:})"
         sleep 30 ;;
    esac
  done
  if [ "$st" = end ]; then
    if [ ! -f postmortem.done ] && [ "$final_sent" -eq 0 ]; then
      final_sent=1
      run resume "Runner: the game has ended. Do the end-of-game steps now, then create $GAME/postmortem.done."
      continue
    fi
    name=$(node -e 'console.log(JSON.parse(require("fs").readFileSync("job.json","utf8")).gameName || "unnamed game")')
    publish_lessons "$name"
    finish ended ""
  fi
  run resume "Runner: your previous run ended, the game is still live and your seat has input pending. Continue playing."
done
