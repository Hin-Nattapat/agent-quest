#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

# Copilot sends snake_case or camelCase depending on surface — read both. STX (\x02) separates
# fields so IFS-read keeps empty ones (e.g. no model in the SessionStart payload).
IFS=$'\002' read -r sid cwd start model < <(printf '%s' "$input" | jq -rj '
  [(.session_id // .sessionId // "unknown"),
   (.cwd // ""),
   (.source // ""),
   (.model // .modelId // "")] | join("\u0002")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$start" ] && args+=(--start "$start")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
exit 0
