#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

# Use STX (\x02) as separator so IFS-read preserves empty fields (e.g. empty cwd).
IFS=$'\002' read -r sid cwd < <(printf '%s' "$input" \
  | jq -rj '[.session_id // "unknown", .cwd // ""] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type prompt --source "$SOURCE" --session "$sid" --cwd "$cwd"
exit 0
