#!/usr/bin/env bash
# Generic, agent-agnostic emitter. Builds one INormalizedEvent (core/events.ts) NDJSON line and
# appends it. Knows the normalized contract only — never an agent's payload, events, or tool names.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"

type="" sid="" source="${RPG_SOURCE:-claude-code}" repo="" cwd="" start="" model=""
action="" native="" cmd="" file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --type)    type="$2";   shift 2 2>/dev/null || shift;;
    --session) sid="$2";    shift 2 2>/dev/null || shift;;
    --source)  source="$2"; shift 2 2>/dev/null || shift;;
    --repo)    repo="$2";   shift 2 2>/dev/null || shift;;
    --cwd)     cwd="$2";    shift 2 2>/dev/null || shift;;
    --start)   start="$2";  shift 2 2>/dev/null || shift;;
    --model)   model="$2";  shift 2 2>/dev/null || shift;;
    --action)  action="$2"; shift 2 2>/dev/null || shift;;
    --native)  native="$2"; shift 2 2>/dev/null || shift;;
    --cmd)     cmd="$2";    shift 2 2>/dev/null || shift;;
    --file)    file="$2";   shift 2 2>/dev/null || shift;;
    *) shift;;
  esac
done
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0
mkdir -p "$RPG_HOME/journal" 2>/dev/null

# Repo: --repo wins; else the session cache; else ONE git call from --cwd, then cache it.
cache="$RPG_HOME/journal/$sid.repo"
if [ -z "$repo" ]; then
  if [ -f "$cache" ]; then
    repo="$(<"$cache")"
  elif [ -n "$cwd" ]; then
    top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
    if [ -n "$top" ]; then repo="${top##*/}"; else repo="${cwd##*/}"; fi
  fi
fi
# Cache the repo (from any source) for future calls in this session
[ -n "$repo" ] && printf '%s' "$repo" > "$cache" 2>/dev/null

line="$(jq -nc \
  --arg source "$source" --arg sid "$sid" --arg type "$type" --arg repo "$repo" \
  --arg cwd "$cwd" --arg start "$start" --arg model "$model" \
  --arg action "$action" --arg native "$native" --arg cmd "$cmd" --arg file "$file" '
  {ts:(now|todate), source:$source, session_id:$sid, type:$type}
  + (if $repo  !="" then {repo:$repo}     else {} end)
  + (if $action!="" then {action:$action} else {} end)
  + (if $native!="" then {native:$native} else {} end)
  + (if $cmd   !="" then {cmd:$cmd}       else {} end)
  + (if $file  !="" then {file:$file}     else {} end)
  + (if $type=="session_start" and $cwd  !="" then {cwd:$cwd}     else {} end)
  + (if $type=="session_start" and $start!="" then {start:$start} else {} end)
  + (if $type=="session_start" and $model!="" then {model:$model} else {} end)
' 2>/dev/null)"
[ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
exit 0
