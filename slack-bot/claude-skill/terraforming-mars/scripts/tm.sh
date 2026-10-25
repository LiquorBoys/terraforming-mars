#!/usr/bin/env bash
# Wrapper: trusts the OS cert store (needed behind TLS-inspecting proxies) and hides Node's cert warnings.
# ${0%/*} instead of $(dirname "$0"): avoids a subshell fork (~150 ms on Windows/Git Bash) on every call.
D="${0%/*}"; [ "$D" = "$0" ] && D=.
exec node --use-system-ca "$D/tm.js" "$@" 2>/dev/null
