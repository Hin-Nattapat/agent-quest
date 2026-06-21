#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
LIB="$(cd "$DIR/../../generic" && pwd)"
IFS= read -rd '' input || true

# Use STX (\x02) as field separator so IFS-read preserves empty fields (e.g. empty cmd).
IFS=$'\002' read -r sid cwd type action native cmd file < <(printf '%s' "$input" | jq -L "$LIB" -rj '
  include "cmd-tag";
  (.tool_name // "") as $t |
  ($t|test("^(bash|shell|exec|local_shell)$";"i")) as $isShell |
  # apply_patch: read the patch text from its known input fields; markers drive action + file.
  (.tool_input.patch // .tool_input.input // .tool_input.changes // "") as $patch |
  (if   $t == "apply_patch" then
        (if ($patch|test("\\*\\*\\* Add File:")) and (($patch|test("\\*\\*\\* (Update|Delete) File:"))|not)
         then "write" else "edit" end)
   elif $isShell then "run"
   elif ($t|test("^(read|read_file)$";"i")) then "read"
   elif ($t|test("^(websearch|web_search)$";"i")) then "search"
   else "other" end) as $a |
  (if $isShell then cmd_tag(.tool_input.command // "") else "" end) as $cmd |
  (if $t == "apply_patch" then
     (($patch | capture("\\*\\*\\* (?:Add|Update|Delete) File: (?<p>[^\n]+)").p) // "" | gsub("^\\s+|\\s+$";""))
   else (.tool_input.file_path // "") end) as $file |
  (if ((.tool_response.error // "") != "")
      or ((.tool_response.exit_code // 0) != 0)
      or ((.tool_response.success) == false)
   then "action_fail" else "action" end) as $type |
  [(.session_id // "unknown"), (.cwd // ""), $type, $a, $t, $cmd, $file] | join("\u0002")
' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0

args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
[ -n "$cmd" ]  && args+=(--cmd "$cmd")
[ -n "$file" ] && args+=(--file "$file")
"$EMIT" "${args[@]}"
exit 0
