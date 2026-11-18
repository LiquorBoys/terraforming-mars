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

CHILD=
trap 'say "signal received: stopping without marking the game done"; [ -n "$CHILD" ] && kill -TERM "$CHILD" 2>/dev/null; exit 143' TERM INT

# One writer at a time in the shared checkout (two games can start or end together).
lock() { local i=0; until mkdir "$ROOT/repo.lock" 2>/dev/null; do i=$((i + 1)); [ "$i" -ge 120 ] && { say "repo lock held for 2 minutes; taking it"; break; }; sleep 1; done; }
unlock() { rmdir "$ROOT/repo.lock" 2>/dev/null; }

# Bring the checkout's claude/lessons branch up to date with main, so this game plays with every
# lesson already merged there plus the ones this machine has written since.
refresh_repo() {
  [ -d "$REPO/.git" ] || { say "no git checkout at $REPO; using the skill as it is"; return; }
  lock
  local out
  if ! out=$(git -C "$REPO" fetch -q origin "$BASE_BRANCH" 2>&1); then say "git fetch failed, playing with the checkout as it is: $out"; unlock; return; fi
  git -C "$REPO" switch -q claude/lessons 2>/dev/null || git -C "$REPO" switch -q -c claude/lessons "origin/$BASE_BRANCH"
  if ! out=$(git -C "$REPO" rebase -q "origin/$BASE_BRANCH" 2>&1); then git -C "$REPO" rebase --abort 2>/dev/null; say "rebase onto $BASE_BRANCH failed, playing with the checkout as it is: $out"; fi
  unlock
}

# Fold this game's lessons back into the checkout and push them. Each file is merged three ways
# against the copy the game started from, keeping both sides of any overlap; cleaning that up is
# what the pull request from claude/lessons is for.
sync_lessons() {
  [ -d "$REPO/.git" ] || { say "no git checkout at $REPO; lessons stay in $GAME/lessons"; return; }
  lock
  local f out changed=0
  for f in lessons.md lessons-log.md; do
    [ -f "lessons/$f" ] && [ -f "lessons-seed/$f" ] || continue
    cmp -s "lessons/$f" "lessons-seed/$f" && continue
    git merge-file --union "$REFS/$f" "lessons-seed/$f" "lessons/$f" 2>/dev/null; changed=1
  done
  if [ "$changed" -eq 1 ]; then
    git -C "$REPO" add slack-bot/claude-skill/terraforming-mars/references
    if out=$(git -C "$REPO" -c user.name="Claude (TM runner)" -c user.email="noreply@anthropic.com" commit -q -m "lessons: $1" 2>&1); then
      say "lessons committed on claude/lessons"
      if out=$(git -C "$REPO" push -q --force-with-lease origin claude/lessons 2>&1); then say "lessons pushed"; else say "lessons not pushed (they stay committed locally): $out"; fi
    else say "lessons commit failed: $out"; fi
  else say "the game changed no lessons"; fi
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
  refresh_repo
  [ -f "$SKILL_SRC/SKILL.md" ] || finish failed "the skill was not found at $SKILL_SRC"
  mkdir -p plugin/.claude-plugin plugin/skills
  echo '{"name": "tm", "description": "Terraforming Mars player skill", "version": "0.0.1"}' > plugin/.claude-plugin/plugin.json
  cp -R "$SKILL_SRC" plugin/skills/terraforming-mars
  for f in lessons.md lessons-log.md; do cp "$REFS/$f" "lessons/$f"; cp "$REFS/$f" "lessons-seed/$f"; done
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

# run <first|resume> <prompt>; sets RUN_RC, RUN_SECS, RUN_RESULT (the result event's subtype) and RUN_ERR
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
  CHILD=$!; wait "$CHILD"; RUN_RC=$?; CHILD=
  RUN_SECS=$(( $(date +%s) - t0 ))
  local summary
  summary=$(node -e '
    let last = null;
    for (const l of require("fs").readFileSync(process.argv[1], "utf8").split("\n")) {
      if (!l) continue; try { const j = JSON.parse(l); if (j.type === "result") last = j; } catch {}
    }
    if (!last) { console.log("none\t\t"); process.exit(0); }
    console.log([last.subtype, last.total_cost_usd ?? "", last.subtype === "success" ? "" : String(last.result ?? "").replace(/\s+/g, " ").slice(0, 300)].join("\t"));' "logs/$tag.jsonl")
  RUN_RESULT=$(printf '%s' "$summary" | cut -f1); local cost; cost=$(printf '%s' "$summary" | cut -f2); RUN_ERR=$(printf '%s' "$summary" | cut -f3)
  [ -n "$cost" ] && echo "$cost" > cost
  [ -z "$RUN_ERR" ] && [ "$RUN_RC" -ne 0 ] && RUN_ERR=$(tail -c 300 "logs/$tag.err" | tr '\n' ' ')
  say "$tag end rc=$RUN_RC secs=$RUN_SECS result=$RUN_RESULT total_cost_usd=${cost:-unknown} ${RUN_ERR:+error: $RUN_ERR}"
}

say "seat ${PLAYER:0:5}… model=$MODEL budget=$BUDGET session=$SID first=$FIRST"
if [ "$FIRST" -eq 1 ]; then
  run first "/tm:terraforming-mars $URL play"
else
  RUN_RC=0; RUN_SECS=999; RUN_RESULT=resumed; RUN_ERR=
fi

fails=0; final_sent=0
while :; do
  case "$RUN_RESULT" in *budget*) finish failed "the per-game budget of \$$BUDGET was reached" ;; esac
  # A run that failed, or ended almost at once, is backed off so a rate limit or a broken
  # install cannot spin the loop.
  if [ "$RUN_RC" -ne 0 ] || [ "$RUN_SECS" -lt 20 ]; then
    fails=$((fails + 1))
    [ "$fails" -ge 20 ] && finish failed "Claude Code failed 20 times in a row. Last error: ${RUN_ERR:-none reported}"
    sleep 120
  else
    fails=0
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
    sync_lessons "$name"
    finish ended ""
  fi
  run resume "Runner: your previous run ended, the game is still live and your seat has input pending. Continue playing."
done
