#!/usr/bin/env bash
# Shared helpers for the Copilot adapter. Sourced by copilot hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="copilot"
GENERIC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)"
EMIT="$GENERIC/emit.sh"

# Emit a tool event of the given normalized type (action | action_fail) from a PostToolUse /
# PostToolUseFailure payload on stdin. Tool names are matched best-effort (Copilot's exact tool
# set is unverified — see README "Known approximations"); mcp__* is forced to "other" so an mcp
# tool whose name contains read/edit/etc. is not misclassified.
emit_tool() {
  local type="$1" input sid cwd action native cmd file
  IFS= read -rd '' input || true
  IFS=$'\002' read -r sid cwd action native cmd file < <(printf '%s' "$input" | jq -L "$GENERIC" -rj '
    include "cmd-tag";
    (.tool_name // .toolName // "") as $t |
    (.tool_input // .toolArgs // {}) as $in |
    ($t|test("^(bash|shell|exec|run_in_terminal|execute)$";"i")) as $isShell |
    (if   ($t|test("^mcp__";"i")) then "other"
     elif $isShell then "run"
     elif ($t|test("(create|write|new_file|write_file|create_file)";"i")) then "write"
     elif ($t|test("(str_replace|apply_patch|edit|replace|modify|insert)";"i")) then "edit"
     elif ($t|test("(read|view|open_file|read_file)";"i")) then "read"
     elif ($t|test("(websearch|web_search)";"i")) then "search"
     else "other" end) as $a |
    (if $isShell then cmd_tag(($in.command // $in.cmd // $in.script // "")) else "" end) as $cmd |
    ($in.file_path // $in.path // $in.filePath // $in.file // "") as $file |
    [(.session_id // .sessionId // "unknown"), (.cwd // ""), $a, $t, $cmd, $file] | join("\u0002")
  ' 2>/dev/null)
  [ -z "$sid" ] && sid="unknown"
  local args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
  [ -n "$cmd" ]  && args+=(--cmd "$cmd")
  [ -n "$file" ] && args+=(--file "$file")
  "$EMIT" "${args[@]}"
}
