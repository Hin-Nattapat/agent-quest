#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
LIB="$(cd "$DIR/../../generic" && pwd)"
IFS= read -rd '' input || true

tsv="$(printf '%s' "$input" | jq -L "$LIB" -r '
  include "cmd-tag";
  ({ "Edit":"edit","MultiEdit":"edit","Write":"write","Bash":"run",
     "Read":"read","Grep":"search","Glob":"search","Task":"delegate" }[.tool_name] // "other") as $a |
  (if .tool_name == "Bash" then cmd_tag(.tool_input.command // "") else "" end) as $cmd |
  (if .hook_event_name=="PostToolUseFailure" then "action_fail" else "action" end) as $type |
  [(.session_id // "unknown"), (.cwd // ""), $type, $a,
   (.tool_name // "unknown"), $cmd, (.tool_input.file_path // "")] | @tsv
' 2>/dev/null)"

sid=$(echo "$tsv" | cut -f1)
cwd=$(echo "$tsv" | cut -f2)
type=$(echo "$tsv" | cut -f3)
action=$(echo "$tsv" | cut -f4)
native=$(echo "$tsv" | cut -f5)
cmd=$(echo "$tsv" | cut -f6)
file=$(echo "$tsv" | cut -f7)

[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0

args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
[ -n "$cmd" ]  && args+=(--cmd "$cmd")
[ -n "$file" ] && args+=(--file "$file")
"$EMIT" "${args[@]}"
exit 0
