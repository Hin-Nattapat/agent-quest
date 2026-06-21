#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

# Use STX (\x02) as separator so IFS-read preserves empty fields (e.g. empty cwd).
IFS=$'\002' read -r sid cwd start model < <(printf '%s' "$input" \
  | jq -rj '[.session_id // "unknown", .cwd // "", .source // "", .model // ""] | join("\u0002")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$start" ] && args+=(--start "$start")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
exit 0
