#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\002' read -r sid native < <(printf '%s' "$input" \
  | jq -rj '[(.conversation_id // .parent_conversation_id // "unknown"), .subagent_type // ""] | join("\u0002")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type action --source "$SOURCE" --session "$sid" --action delegate)
[ -n "$native" ] && args+=(--native "$native")
"$EMIT" "${args[@]}"
exit 0
