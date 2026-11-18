#!/bin/bash
# Installs or updates the runner in the unprivileged account that plays the games.
# Run as the machine's owner (who must be able to `sudo -n -u <account>`), from this directory.
#   ./install.sh [account]        default account: tmclaude
#
# The runner's code is copied, not run from a checkout, so that only a deliberate re-run of this
# script changes what executes outside the sandbox. The checkout it clones is used for the skill
# and its lessons, which only ever run inside the sandbox.
set -euo pipefail
ACCT="${1:-tmclaude}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="/Users/$ACCT/tm-claude"
REPO_URL="${TM_REPO_URL:-https://github.com/LiquorBoys/terraforming-mars.git}"
cd /
as() { sudo -n -H -u "$ACCT" "$@"; }

as /bin/mkdir -p "$DEST/runner"
for f in server.mjs sign.mjs notify.mjs league.mjs run-seat.sh start.sh; do
  as /usr/bin/tee "$DEST/runner/$f" < "$HERE/$f" > /dev/null
done
as /bin/chmod 755 "$DEST/runner/run-seat.sh" "$DEST/runner/start.sh"
echo "runner code installed in $DEST/runner"

if as /bin/test -d "$DEST/repo/.git"; then
  echo "skill checkout already present at $DEST/repo"
else
  as /usr/bin/git clone -q "$REPO_URL" "$DEST/repo"
  echo "cloned $REPO_URL to $DEST/repo"
fi

# The league data repository: game records and Claude's lessons. Cloning over ssh needs the
# account's deploy key to be registered on that repository; without it the runner still works
# and keeps everything in a local directory.
LEAGUE_URL="${TM_LEAGUE_URL:-git@github.com:LiquorBoys/tm-league.git}"
if as /bin/test -d "$DEST/league/.git"; then
  echo "league checkout already present at $DEST/league"
elif as /usr/bin/git clone -q "$LEAGUE_URL" "$DEST/league"; then
  echo "cloned $LEAGUE_URL to $DEST/league"
else
  echo "could not clone $LEAGUE_URL (git printed the reason above); records and lessons will stay local in $DEST/league"
fi

if as /bin/test -s "$DEST/runner-secret"; then
  echo "shared secret already present (left unchanged)"
else
  as /bin/sh -c "umask 077; /usr/bin/openssl rand -hex 32 > '$DEST/runner-secret'"
  echo "generated a new shared secret at $DEST/runner-secret; the bot's CLAUDE_RUNNER_SECRET must be set to the same value"
fi

if as /bin/test -f "$DEST/runner.env"; then
  echo "runner.env already present (left unchanged)"
else
  printf '%s\n' '# Settings for the Terraforming Mars Claude runner (see claude-runner/README.md).' \
    'TM_MODEL=opus' 'TM_BUDGET_USD=300' 'TM_MAX_CONCURRENT=2' 'TM_MAX_PER_DAY=8' \
    '# TM_STATUS_URL=https://<bot-domain>/api/claude/status' | as /usr/bin/tee "$DEST/runner.env" > /dev/null
  echo "wrote default settings to $DEST/runner.env"
fi
