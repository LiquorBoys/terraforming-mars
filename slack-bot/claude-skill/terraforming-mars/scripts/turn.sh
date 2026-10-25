#!/usr/bin/env bash
# One-shot turn view: Tactician's EXECUTE block + compact state + recent log + pending prompt.
# Usage: turn.sh <playerId> [liveDir]
P="$1"; DIR="$(cd "$(dirname "$0")" && pwd)"
LIVE="${2:-$(ls -td "$DIR"/../cache/live/*/ 2>/dev/null | head -1)}"
T="$DIR/tm.sh"
echo "=== EXECUTE (next.md) ==="
if [ -f "$LIVE/next.md" ]; then
  head -1 "$LIVE/next.md"
  awk '/^## EXECUTE/{f=1;next} /^## /{if(f)exit} f' "$LIVE/next.md"
fi
# STATE (4 lines) + LOG 5 + PENDING (25 lines) from one node process (state and log fetched in parallel)
bash "$T" "$P" turn 5
