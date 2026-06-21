#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

# STX (\u0002) separator so IFS-read preserves empty fields (e.g. empty model).
IFS=$'\002' read -r sid cwd model < <(printf '%s' "$input" | jq -rj '[.conversation_id // "unknown", (.workspace_roots[0] // ""), .model // ""] | join("\u0002")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
exit 0
