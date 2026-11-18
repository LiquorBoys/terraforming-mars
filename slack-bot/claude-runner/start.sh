#!/bin/bash
# Starts the runner with its configuration. Run as the runner's own account.
#   runner.env (optional, next to the runner/ directory) holds TM_* settings, one VAR=value per line.
ROOT="${TM_RUNNER_HOME:-$HOME/tm-claude}"
export TM_RUNNER_HOME="$ROOT"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
if [ -f "$ROOT/runner.env" ]; then set -a; . "$ROOT/runner.env"; set +a; fi
cd "$ROOT" || { echo "cannot enter $ROOT"; exit 1; }
exec node "$(cd "$(dirname "$0")" && pwd)/server.mjs"
