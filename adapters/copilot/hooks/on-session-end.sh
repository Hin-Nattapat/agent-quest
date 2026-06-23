#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\002' read -r sid < <(printf '%s' "$input" \
  | jq -rj '[(.session_id // .sessionId // "unknown")] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type session_end --source "$SOURCE" --session "$sid"
exit 0
