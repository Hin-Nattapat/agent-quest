#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
LIB="$(cd "$(dirname "$0")/../../generic" && pwd)"
IFS= read -rd '' input || true

# STX (\x02) separator so IFS-read preserves empty middle fields (e.g. empty cmd).
IFS=$'\002' read -r sid cwd type action native cmd file < <(printf '%s' "$input" | jq -L "$LIB" -rj '
  include "cmd-tag";
  (.tool_name // "") as $t |
  ($t|test("^(run_terminal_cmd|shell|bash|exec)$";"i")) as $isShell |
  (if   ($t|test("^(edit_file|search_replace|apply_patch)$";"i")) then "edit"
   elif ($t|test("^(write|create_file)$";"i")) then "write"
   elif $isShell then "run"
   elif ($t|test("^(read_file|list_dir)$";"i")) then "read"
   elif ($t|test("^(codebase_search|grep_search|file_search|web_search)$";"i")) then "search"
   else "other" end) as $a |
  (if $isShell then cmd_tag(.tool_input.command // "") else "" end) as $cmd |
  (.tool_input.file_path // "") as $file |
  (if (.hook_event_name // "") == "postToolUseFailure" then "action_fail" else "action" end) as $type |
  [(.conversation_id // "unknown"), (.cwd // ""), $type, $a, $t, $cmd, $file] | join("\u0002")
' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0

args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
[ -n "$cmd" ]  && args+=(--cmd "$cmd")
[ -n "$file" ] && args+=(--file "$file")
"$EMIT" "${args[@]}"
exit 0
