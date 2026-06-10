#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true                 # slurp stdin, no cat spawn

IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
repo="$(resolve_repo "$sid" "$cwd")"

line="$(printf '%s' "$input" | jq -c --arg source "$SOURCE" --arg repo "$repo" '
  ({ "Edit":"edit","MultiEdit":"edit","Write":"write","Bash":"run",
     "Read":"read","Grep":"search","Glob":"search","Task":"delegate" }[.tool_name] // "other") as $a |
  { ts:(now|todate), source:$source, session_id:(.session_id // "unknown"),
    type:(if .hook_event_name=="PostToolUseFailure" then "action_fail" else "action" end),
    action:$a, native:(.tool_name // "unknown") }
  + (if $repo != "" then {repo:$repo} else {} end)
  + (if (.tool_input.file_path // "") != "" then {file: .tool_input.file_path} else {} end)
' 2>/dev/null)"
[ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
exit 0
