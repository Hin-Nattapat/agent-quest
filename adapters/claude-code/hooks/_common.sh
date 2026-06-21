#!/usr/bin/env bash
# Shared helpers. Sourced by claude-code hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="${RPG_SOURCE:-claude-code}"
EMIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)/emit.sh"

# emit_simple TYPE — uses global $input. For prompt / turn_end / session_end.
emit_simple() {
  local sid cwd
  IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
    | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
  [ -z "$sid" ] && sid="unknown"
  "$EMIT" --type "$1" --source "$SOURCE" --session "$sid" --cwd "$cwd"
}
