#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd start model < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // "", .source // "", .model // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$start" ] && args+=(--start "$start")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
exit 0
