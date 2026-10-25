#!/usr/bin/env bash
# Exit when <prevColor> (the player right before us) becomes ACTIVE, or when it's our turn, or when the phase changes.
# Outputs: "PRE-TURN: <color> active" | "GO" | "PHASE: a -> b" | "TIMEOUT".
# One long-lived node process polling the tiny /api/waitingfor endpoint every 3 s (was 2 node starts per 8 s).
# Usage: prewatch.sh <playerId> <prevColor> [maxSeconds]
P="$1"; PREV="$2"; MAX="${3:-3000}"; DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$DIR/tm.sh" "$P" prewatch "$PREV" "$MAX" 3000
