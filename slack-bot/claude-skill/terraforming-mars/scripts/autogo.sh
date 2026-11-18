#!/usr/bin/env bash
# Wait for our turn, then immediately run the guarded go.sh (no model in the loop).
# Any prompt other than our action menu hands back to the main agent at once (off-turn prompts only exist when a
# card in play creates them; the planner decides those case by case).
# go.sh must exit 0 only if it submitted the move; it's consumed after one run.
# Usage: autogo.sh <playerId> <liveDir> [maxSeconds]
P="$1"; LIVE="$2"; MAX="${3:-3000}"; DIR="$(cd "$(dirname "$0")" && pwd)"; T="$DIR/tm.sh"
start=$(date +%s)
while :; do
  pend=$(bash "$T" "$P" pending 2>/dev/null)
  if echo "$pend" | grep -q "^root"; then
    if echo "$pend" | grep -qE "Take your (first|next) action"; then break; fi
    echo "UNKNOWN PROMPT -> manual"; echo "$pend" | head -10; exit 0
  fi
  [ $(( $(date +%s) - start )) -ge "$MAX" ] && { echo "TIMEOUT"; exit 0; }
  sleep 1
done
if [ -f "$LIVE/go.sh" ]; then
  mv "$LIVE/go.sh" "$LIVE/go.used.sh"
  if bash "$LIVE/go.used.sh" "$P"; then
    echo "AUTO-PLAYED"; bash "$T" "$P" log 3
    if bash "$T" "$P" pending | grep -q "^root"; then echo "FOLLOW-UP PENDING -> manual"; bash "$T" "$P" pending | head -8; fi
    exit 0
  fi
  echo "GUARD FAILED -> manual"; exit 0
fi
echo "GO (no go.sh) -> manual"
