#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type prompt --source "$SOURCE" --session "$sid" --cwd "$cwd"
exit 0
