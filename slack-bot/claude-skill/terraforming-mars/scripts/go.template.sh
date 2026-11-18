#!/usr/bin/env bash
# Template for the Tactician's cache/live/<dir>/go.sh. Guards first; exit 1 (no action) if any fails.
# ONE tm.sh call = one node start + one state fetch: ["guard","<js expr>"] steps replace a separate `brief` + greps.
# Guard vars: gen phase temp o2 oceans venus tr mc st ti pl en he mcp hand(names[]) pending(rendered text) v g p.
# The same JSON array can instead go in cache/live/<dir>/go.json for `tm.sh <id> watch-go <go.json>` (no bash at all).
P="$1"; T="$HOME/.claude/skills/terraforming-mars/scripts/tm.sh"
out=$(bash "$T" "$P" batch '[
 ["guard","gen==6 && phase==\"action\""],
 ["guard","mc>=14 && st>=1"],
 ["if-pending","Great Dam","play","Great Dam:promo","{\"steel\":1,\"megacredits\":13}"],
 ["if-pending","^root <space>","space","58|57|50"]
]')
echo "$out"
echo "$out" | grep -q "BATCH STOPPED" && exit 1
exit 0
# Branching: put alternatives in separate if-pending steps, or a guard like 'temp>=-10' in a second go.sh variant.
