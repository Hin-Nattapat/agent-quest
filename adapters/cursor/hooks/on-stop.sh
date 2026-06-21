#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\002' read -r sid < <(printf '%s' "$input" \
  | jq -rj '[.conversation_id // "unknown"] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type turn_end --source "$SOURCE" --session "$sid"
exit 0
