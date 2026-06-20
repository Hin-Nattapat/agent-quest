# Agent Quest — Build Spec (Phase 0 handoff)

> Implementation brief for an AI coding agent (Claude Code). Build **Phase 0 only**.
> Full game design (Thai, all phases) lives in `agent-quest-design.md` — read it for context on later phases, but Phase 0 below is self-contained.

---

## 1. What Agent Quest is

A system that gamifies **AI coding agent** usage into an RPG: the developer earns XP, levels up, picks a class, and finds loot — purely by using a coding agent. It is **observational only**: it never modifies or interferes with the agent's real work.

**Agent-agnostic by design.** Claude Code is just the first adapter; Codex / Cursor / generic tools plug in later without touching game logic.

## 2. Architecture (the seam)

```
agents ──(adapters)──► append-only journal (NDJSON) ──(reducer)──► state.json ──► HUD / companion app
```

- **Adapters** translate one agent's native signals → normalized events. Only adapters know a specific agent.
- **Journal** = append-only NDJSON, one file per session (no locking, race-safe across many agents/instances).
- **Reducer / state.json / HUD / app** = agent-agnostic, consume only normalized events. **Not in Phase 0.**

## 3. Locked decisions (do not re-litigate)

| Decision | Value |
|---|---|
| Hook scripts language | **bash + jq** (hot path, ~0 startup) |
| Everything else (reducer, inspect, importer, bridge) | **Bun + TypeScript** |
| Home directory | `~/.agentrpg` (override via `$AGENTRPG_HOME`) |
| XP scope | global character + per-repo / per-source stats |
| First adapter | Claude Code (hooks for live, JSONL for backfill) |
| Dependencies | `jq` and `bun` only. No npm packages in Phase 0. |

---

## 4. Phase 0 — scope

**Goal:** prove that normalized events flow into the journal with correct fields, on a real Claude Code session. **No XP, levels, classes, loot, statusline, or app yet.**

### 4.1 Normalized event (one NDJSON line)

```jsonc
{
  "ts": "2026-06-10T08:30:00Z",   // UTC ISO8601
  "source": "claude-code",         // adapter id
  "session_id": "abc123",
  "repo": "RMS_REPO",              // optional, derived from cwd (see 4.4)
  "type": "action",                // prompt | action | action_fail | turn_end | session_end
  "action": "edit",                // abstract action, only for type=action/action_fail
  "native": "Edit",                // optional, raw tool name from the agent
  "file": "src/app/page.tsx"       // optional
}
```
Reducer (later) computes XP from `action`, never from `native`. Keep events raw; do not compute scores in the adapter.

### 4.2 Native tool → abstract action map (Claude Code)

| native `tool_name` | `action` |
|---|---|
| `Edit`, `MultiEdit` | `edit` |
| `Write` | `write` |
| `Bash` | `run` |
| `Read` | `read` |
| `Grep`, `Glob` | `search` |
| `Task` | `delegate` |
| (anything else) | `other` |

### 4.3 Claude Code hook event → script → emitted event

| CC hook event | script | emits `type` |
|---|---|---|
| `UserPromptSubmit` | `on-prompt.sh` | `prompt` |
| `PostToolUse` | `on-tool.sh` | `action` |
| `PostToolUseFailure` | `on-tool.sh` | `action_fail` |
| `Stop` | `on-stop.sh` | `turn_end` |
| `SessionEnd` | `on-session-end.sh` | `session_end` |

### 4.4 repo derivation
From the hook's `cwd`: `git -C "$cwd" rev-parse --show-toplevel` → `basename`; if not a git repo, `basename "$cwd"`.

---

## 5. Files to produce

```
~/.agentrpg/
├── config.json                       # minimal: home, source_default, adapters enabled
├── adapters/claude-code/
│   ├── emit.sh                       # shared: build+append one normalized event
│   ├── on-prompt.sh                  # UserPromptSubmit -> prompt
│   ├── on-tool.sh                    # PostToolUse/Failure -> action/action_fail
│   ├── on-stop.sh                    # Stop -> turn_end
│   └── on-session-end.sh             # SessionEnd -> session_end
├── lib/
│   └── inspect.ts                    # Bun: read journal, print summary (verification)
├── settings.snippet.json             # hooks block to merge into ~/.claude/settings.json
├── install.sh                        # copy to $AGENTRPG_HOME, chmod +x, print resolved settings snippet
└── README.md                         # prerequisites + install + verify
```

## 6. Hard rules for hook scripts (safety — non-negotiable)

1. **Never write to stdout.** `UserPromptSubmit` / `SessionStart` stdout is injected into the model context. All output goes to the journal file only.
2. **Always exit 0.** Never exit non-zero (exit 2 blocks the agent). Wrap the emit call with `|| true`.
3. **Be fast & light.** Read stdin once, parse with `jq`, append one line. No network, no reducer, no heavy work.
4. **Append-only.** One file per session: `$AGENTRPG_HOME/journal/{session_id}.ndjson`. Never read/modify other sessions' files.
5. Build JSON with `jq -n --arg ...` for safe escaping (file paths/prompts may contain quotes). Never string-concatenate JSON.

## 7. Reference implementation

### emit.sh
```bash
#!/usr/bin/env bash
# Append ONE normalized event to the journal. Never writes to stdout. Requires jq.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="${RPG_SOURCE:-claude-code}"
type="${1:-}"; shift 2>/dev/null || true
action=""; native=""; session="unknown"; cwd=""; repo=""; file=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --action) action="${2:-}"; shift 2;;
    --native) native="${2:-}"; shift 2;;
    --session) session="${2:-}"; shift 2;;
    --cwd) cwd="${2:-}"; shift 2;;
    --repo) repo="${2:-}"; shift 2;;
    --file) file="${2:-}"; shift 2;;
    *) shift;;
  esac
done
if [ -z "$repo" ] && [ -n "$cwd" ]; then
  top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
  if [ -n "$top" ]; then repo="$(basename "$top")"; else repo="$(basename "$cwd")"; fi
fi
[ -z "$session" ] && session="unknown"
mkdir -p "$RPG_HOME/journal" 2>/dev/null
ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
jq -nc \
  --arg ts "$ts" --arg source "$SOURCE" --arg session "$session" \
  --arg type "$type" --arg action "$action" --arg native "$native" \
  --arg repo "$repo" --arg file "$file" \
  '{ts:$ts, source:$source, session_id:$session, type:$type}
   + (if $repo!=""   then {repo:$repo}     else {} end)
   + (if $action!="" then {action:$action} else {} end)
   + (if $native!="" then {native:$native} else {} end)
   + (if $file!=""   then {file:$file}     else {} end)' \
  >> "$RPG_HOME/journal/$session.ndjson" 2>/dev/null
exit 0
```

### on-tool.sh (the others follow the same shape)
```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"
input="$(cat)"
sid="$(printf '%s' "$input" | jq -r '.session_id // "unknown"' 2>/dev/null)"
cwd="$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null)"
ev="$(printf '%s' "$input" | jq -r '.hook_event_name // empty' 2>/dev/null)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // "unknown"' 2>/dev/null)"
file="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null)"
case "$tool" in
  Edit|MultiEdit) action=edit;; Write) action=write;; Bash) action=run;;
  Read) action=read;; Grep|Glob) action=search;; Task) action=delegate;; *) action=other;;
esac
type=action; [ "$ev" = "PostToolUseFailure" ] && type=action_fail
"$DIR/emit.sh" "$type" --action "$action" --native "$tool" \
  --session "$sid" --cwd "$cwd" --file "$file" >/dev/null 2>&1 || true
exit 0
```

`on-prompt.sh` → `emit.sh prompt --session ... --cwd ...`
`on-stop.sh` → `emit.sh turn_end --session ... --cwd ...`
`on-session-end.sh` → `emit.sh session_end --session ... --cwd ...`

### settings.snippet.json (merge into ~/.claude/settings.json)
```json
{
  "hooks": {
    "UserPromptSubmit": [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-prompt.sh" } ] } ],
    "PostToolUse": [ { "matcher": "Edit|MultiEdit|Write|Bash|Read|Grep|Glob|Task", "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-tool.sh" } ] } ],
    "PostToolUseFailure": [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-tool.sh" } ] } ],
    "Stop": [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-stop.sh" } ] } ],
    "SessionEnd": [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/on-session-end.sh" } ] } ]
  }
}
```
> Verify against current Claude Code hooks docs that event names, the stdin JSON fields (`session_id`, `cwd`, `tool_name`, `tool_input.file_path`, `hook_event_name`), and `~`/`$HOME` expansion in `command` are correct. Adjust if the schema differs. Docs: https://code.claude.com/docs/en/hooks

### lib/inspect.ts (Bun — verification)
Read every `*.ndjson` in `$AGENTRPG_HOME/journal`, parse lines (skip malformed), and print:
- total event count and number of session files
- counts grouped by `type`, `action`, `source`, `repo`
- the last 10 events (ts, source, type[:action], repo, file)

## 8. Definition of done (Phase 0)

1. `install.sh` places files in `$AGENTRPG_HOME` and makes hooks executable.
2. After merging the settings snippet and running one real Claude Code session:
   - `~/.agentrpg/journal/<session_id>.ndjson` exists with one line per prompt / tool call / stop / session end.
   - Each line is valid JSON with correct `source`, `type`, `action` (mapped), and `repo`.
3. `bun ~/.agentrpg/lib/inspect.ts` prints a correct summary.
4. Hooks produce **no** visible output in the Claude Code session and never error it (confirm normal usage is unaffected).

## 9. Out of scope (later phases — do not build now)

XP weights & level curve, classes / up-class / secret classes, loot, achievements, statusline HUD, companion app (Pixel Agents fork), backfill importer, generic emit, second adapter. See `agent-quest-design.md`:
- §5 XP/level · §6 classes + secret classes · §7 loot + achievements
- §9 statusline · §10 companion app (Pixel Agents) · §12 backfill · §13 roadmap

Design Phase 0 so it does **not** block these (events stay raw and complete; reducer is a separate consumer of the journal).
