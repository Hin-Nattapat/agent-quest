#!/usr/bin/env bash
# Shared helpers. Sourced by hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="${RPG_SOURCE:-claude-code}"

# resolve_repo SID CWD -> prints repo name.
# Cache hit: read via $(<file) (bash builtin, no spawn).
# Cache miss: ONE git call, then write the cache so later events pay nothing.
resolve_repo() {
  local cache="$RPG_HOME/journal/$1.repo" top repo
  if [ -f "$cache" ]; then printf '%s' "$(<"$cache")"; return; fi
  top="$(git -C "$2" rev-parse --show-toplevel 2>/dev/null)"
  if [ -n "$top" ]; then repo="${top##*/}"; else repo="${2##*/}"; fi
  mkdir -p "$RPG_HOME/journal" 2>/dev/null
  [ -n "$repo" ] && printf '%s' "$repo" > "$cache" 2>/dev/null
  printf '%s' "$repo"
}

# emit_simple TYPE — uses global $input. For prompt / turn_end / session_end.
emit_simple() {
  local sid cwd repo line
  IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
    | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
  [ -z "$sid" ] && sid="unknown"
  mkdir -p "$RPG_HOME/journal" 2>/dev/null
  repo="$(resolve_repo "$sid" "$cwd")"
  line="$(jq -nc --arg source "$SOURCE" --arg sid "$sid" --arg type "$1" --arg repo "$repo" \
    '{ts:(now|todate), source:$source, session_id:$sid, type:$type}
     + (if $repo!="" then {repo:$repo} else {} end)' 2>/dev/null)"
  [ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
}
