#!/usr/bin/env bash
# Shared helpers. Sourced by claude-code hook scripts -- not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="${RPG_SOURCE:-claude-code}"
EMIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)/emit.sh"

# emit_simple TYPE -- uses global $input. For prompt / turn_end / session_end.
emit_simple() {
  local sid cwd
  # Use STX (\x02) as separator so IFS-read preserves empty fields (e.g. empty cwd).
  IFS=$'\002' read -r sid cwd < <(printf '%s' "$input" \
    | jq -rj '[.session_id // "unknown", .cwd // ""] | join("\u0002")' 2>/dev/null)
  [ -z "$sid" ] && sid="unknown"
  "$EMIT" --type "$1" --source "$SOURCE" --session "$sid" --cwd "$cwd"
}
