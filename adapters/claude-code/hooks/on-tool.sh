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
  (.tool_input.command // "") as $c |
  (if .tool_name == "Bash" then
     (if   ($c|test("git\\s+rebase\\b.*--onto")) then "git_rebase_onto"
      elif ($c|test("git\\s+rebase\\b.*(-i|--interactive)")) then "git_rebase_i"
      elif ($c|test("git\\s+cherry-pick")) then "cherry_pick"
      elif ($c|test("git\\s+push\\b.*(--force|-f\\b)")) then "force_push"
      elif ($c|test("git\\s+bisect")) then "bisect"
      elif ($c|test("git\\s+reflog")) then "reflog"
      elif ($c|test("git\\s+stash")) then "stash"
      elif ($c|test("gh\\s+pr\\s+merge")) then "pr_merge"
      elif ($c|test("git\\s+(push|merge)\\b.*\\b(main|master|prod|production|uat)\\b")) then "cowboy"
      elif ($c|test("(bun|npm|pnpm|yarn)\\s+(run\\s+)?test|pytest|go\\s+test|jest|vitest|cargo\\s+test|mocha|rspec")) then "test_run"
      else null end)
   else null end) as $cmd |
  { ts:(now|todate), source:$source, session_id:(.session_id // "unknown"),
    type:(if .hook_event_name=="PostToolUseFailure" then "action_fail" else "action" end),
    action:$a, native:(.tool_name // "unknown") }
  + (if $repo != "" then {repo:$repo} else {} end)
  + (if (.tool_input.file_path // "") != "" then {file: .tool_input.file_path} else {} end)
  + (if $cmd != null then {cmd: $cmd} else {} end)
' 2>/dev/null)"
[ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
exit 0
