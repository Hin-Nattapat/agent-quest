#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd start model < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // "", .source // "", .model // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
mkdir -p "$RPG_HOME/journal" 2>/dev/null

# ONE git call per session; cache repo for every later event (D5/D6).
top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
if [ -n "$top" ]; then repo="${top##*/}"; else repo="${cwd##*/}"; fi
[ -n "$repo" ] && printf '%s' "$repo" > "$RPG_HOME/journal/$sid.repo" 2>/dev/null

line="$(jq -nc --arg source "$SOURCE" --arg sid "$sid" --arg repo "$repo" \
  --arg cwd "$cwd" --arg start "$start" --arg model "$model" '
  {ts:(now|todate), source:$source, session_id:$sid, type:"session_start"}
  + (if $repo !="" then {repo:$repo}   else {} end)
  + (if $cwd  !="" then {cwd:$cwd}     else {} end)
  + (if $start!="" then {start:$start} else {} end)
  + (if $model!="" then {model:$model} else {} end)' 2>/dev/null)"
[ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
exit 0
