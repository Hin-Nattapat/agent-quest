# Cursor adapter — design

> Adds a Cursor (1.7+) adapter as a thin per-agent parsing layer over the existing agent-agnostic
> `adapters/generic/emit.sh`. No change to `emit.sh` or `core/` — agent-awareness stays in the adapter,
> exactly like the Codex adapter. Cursor activity flows into the one shared hero and shows up in
> `stats.by_source` (the multi-agent values shipped in #93 surface it automatically once ≥2 sources).

## 1. Goal & decisions

**Goal:** capture Cursor agent activity into the normalized journal so it earns XP / drives the
companion, with the same fidelity as Claude Code and Codex.

**Decisions (from brainstorming):**
- **Tool capture = generic `postToolUse`** (mirror Codex), not the specialized `afterFileEdit` /
  `afterShellExecution` hooks. The docs describe `postToolUse` as a *"Generic tool use hook (fires for
  all tools)"*, so one hook covers edits, shell, reads, search, and MCP. Confirm on first live capture
  (§8); `--native` preserves the raw tool name as a fallback if a name is mis-mapped.
- **Failure is exact.** Cursor has a dedicated `postToolUseFailure` hook, so `action_fail` needs no
  `tool_response` heuristic (Codex inferred it). Both `postToolUse` and `postToolUseFailure` are wired
  to **one** `on-tool.sh` that picks the type from `hook_event_name` (Fix 2 — DRY, single action map).
- **Include `session_end` and `subagent → delegate`** (chosen extras). Cursor's real `sessionEnd` gives
  accurate session boundaries (Codex had none); `subagentStart → action(delegate)` surfaces parallel
  sub-agents.
- **Single global hero / source-agnostic seam unchanged.** `--source cursor` is a free string the
  reducer already buckets.

**Non-goals (YAGNI):** statusline for Cursor, `preCompact`/`afterAgentThought`/`workspaceOpen`/tab
hooks, MCP per-tool sub-mapping, forwarding prompt/command text, installer auto-merge of `hooks.json`.

## 2. What already exists (no change)

- `adapters/generic/emit.sh` — builds + appends one `INormalizedEvent`; knows the contract only.
- `adapters/generic/cmd-tag.jq` — classifies a shell command into a `CmdTag` (git/test/etc.) without
  storing the raw text.
- `core/reduce.ts` — tallies `stats.by_source[source] = {xp, sessions}`; `EventType` /`AgentAction`
  enums in `core/events.ts` are the wire strings.
- `tools/install.sh` — `chmod +x "$SRC"/adapters/*/hooks/*.sh` globs every adapter, so a new
  `adapters/cursor/` is covered with no installer edit.
- Test harness `test/helpers.ts` — `runHookAt(adapter, script, payload, home)`, `journalLines`,
  `makeHome`.

## 3. Architecture

```
Cursor hook (JSON on stdin) ─► adapters/cursor/hooks/on-*.sh ─(parse w/ jq)─► generic/emit.sh ─► journal/<sid>.ndjson
```

Every script: read stdin, extract fields with one `jq` call (STX `\u0002` join so empty middle fields
survive `IFS` read on bash 3.2), call `emit.sh`. No stdout, always `exit 0`, append-only.

## 4. Files

```
adapters/cursor/
  hooks/_common.sh            # RPG_HOME, SOURCE="cursor", EMIT=../../generic/emit.sh
  hooks/on-session-start.sh   # sessionStart        → session_start
  hooks/on-prompt.sh          # beforeSubmitPrompt   → prompt
  hooks/on-tool.sh            # postToolUse / postToolUseFailure → action / action_fail
  hooks/on-subagent.sh        # subagentStart        → action (delegate)
  hooks/on-stop.sh            # stop                 → turn_end
  hooks/on-session-end.sh     # sessionEnd           → session_end
  config.snippet.json         # ~/.cursor/hooks.json merge snippet
  README.md
test/adapters/
  cursor-session.test.ts      # session_start / prompt / stop / session_end / subagent
  cursor-tool.test.ts         # tool→action map, cmd redaction, postToolUseFailure→action_fail
```

## 5. Components

### 5.1 Session identity (the key cross-hook invariant)

`conversation_id` is a **common field on every hook** → it is the journal session key everywhere
(`--session`). `sessionStart`/`sessionEnd` also carry their own `session_id`; it is **ignored** so all
events for a conversation land in one file.

**Fix 1 — `subagentStart` exception:** it carries only `parent_conversation_id`, not `conversation_id`.
`on-subagent.sh` uses `--session (.conversation_id // .parent_conversation_id)` so delegate events
attach to the parent session instead of an orphan `unknown` file.

### 5.2 `_common.sh`

```sh
#!/usr/bin/env bash
# Shared helpers for the Cursor adapter. Sourced by cursor hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="cursor"
EMIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)/emit.sh"
```

### 5.3 `on-session-start.sh` — `sessionStart` → `session_start`

`sessionStart` has no `cwd`; the working dir is `workspace_roots[0]`. `model` is a common field.

```sh
IFS=$'\002' read -r sid cwd model < <(printf '%s' "$input" \
  | jq -rj '[.conversation_id // "unknown", (.workspace_roots[0] // ""), .model // ""] | join("\u0002")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
```
(emit emits `cwd`/`model` only for `session_start`; repo is derived + cached from `cwd`.)

### 5.4 `on-prompt.sh` — `beforeSubmitPrompt` → `prompt`

```sh
IFS=$'\002' read -r sid < <(printf '%s' "$input" \
  | jq -rj '[.conversation_id // "unknown"] | join("\u0002")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type prompt --source "$SOURCE" --session "$sid"
```
Prompt text is never read or stored.

### 5.5 `on-tool.sh` — `postToolUse` / `postToolUseFailure` → `action` / `action_fail`

One script for both hooks (Fix 2). `type` from `hook_event_name`. Tool→action map (best-guess Cursor
tool names, refined on live capture; `--native` keeps the raw name):

| tool_name (case-insensitive) | action |
|---|---|
| `edit_file`, `search_replace`, `apply_patch` | `edit` |
| `write`, `create_file` | `write` |
| `run_terminal_cmd`, `shell`, `bash`, `exec` | `run` (+ `cmd_tag` on `tool_input.command`) |
| `read_file`, `list_dir` | `read` |
| `codebase_search`, `grep_search`, `file_search`, `web_search` | `search` |
| `mcp__*`, anything else | `other` |

```sh
LIB="$(cd "$DIR/../../generic" && pwd)"
IFS=$'\002' read -r sid cwd type action native cmd file < <(printf '%s' "$input" | jq -L "$LIB" -rj '
  include "cmd-tag";
  (.tool_name // "") as $t |
  ($t|test("^(run_terminal_cmd|shell|bash|exec)$";"i")) as $isShell |
  (if   ($t|test("^(edit_file|search_replace|apply_patch)$";"i")) then "edit"
   elif ($t|test("^(write|create_file)$";"i")) then "write"
   elif $isShell then "run"
   elif ($t|test("^(read_file|list_dir)$";"i")) then "read"
   elif ($t|test("^(codebase_search|grep_search|file_search|web_search)$";"i")) then "search"
   else "other" end) as $a |
  (if $isShell then cmd_tag(.tool_input.command // "") else "" end) as $cmd |
  (.tool_input.file_path // "") as $file |
  (if (.hook_event_name // "") == "postToolUseFailure" then "action_fail" else "action" end) as $type |
  [(.conversation_id // "unknown"), (.cwd // ""), $type, $a, $t, $cmd, $file] | join("\u0002")
' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0
args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
[ -n "$cmd" ]  && args+=(--cmd "$cmd")
[ -n "$file" ] && args+=(--file "$file")
"$EMIT" "${args[@]}"
```

### 5.6 `on-subagent.sh` — `subagentStart` → `action` (delegate)

```sh
IFS=$'\002' read -r sid native < <(printf '%s' "$input" \
  | jq -rj '[(.conversation_id // .parent_conversation_id // "unknown"), .subagent_type // ""] | join("\u0002")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
args=(--type action --source "$SOURCE" --session "$sid" --action delegate)
[ -n "$native" ] && args+=(--native "$native")
"$EMIT" "${args[@]}"
```

### 5.7 `on-stop.sh` — `stop` → `turn_end` · `on-session-end.sh` — `sessionEnd` → `session_end`

Both parse only `conversation_id` and call emit with the respective type (same shape as `on-prompt.sh`).

### 5.8 `config.snippet.json` (`~/.cursor/hooks.json`)

```json
{
  "version": 1,
  "hooks": {
    "sessionStart":       [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-session-start.sh" }],
    "beforeSubmitPrompt": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-prompt.sh" }],
    "postToolUse":        [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-tool.sh" }],
    "postToolUseFailure": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-tool.sh" }],
    "subagentStart":      [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-subagent.sh" }],
    "stop":               [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-stop.sh" }],
    "sessionEnd":         [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-session-end.sh" }]
  }
}
```

**Fix 3 — merge, don't paste.** `hooks.json` is one JSON object; pasting a second `{...}` corrupts it.
README documents a `jq` merge for an existing file:
```sh
jq -s '.[0] * .[1]' ~/.cursor/hooks.json adapters/cursor/config.snippet.json > /tmp/h.json \
  && mv /tmp/h.json ~/.cursor/hooks.json
```
If Cursor does not expand `~` in `command`, the README notes replacing it with the absolute path.

## 6. Error handling / hook safety (non-negotiable)

Every script: never writes stdout; always `exit 0`; appends to one `journal/<sid>.ndjson`; builds JSON
via `jq` (`--arg`); keeps lines < 4 KB (no prompt/command text inline); no network; no reducer. The STX
`\u0002` separator preserves empty middle fields under bash 3.2 `IFS` read. Malformed stdin → empty
parse → `sid="unknown"`, still `exit 0` with no stdout.

## 7. Testing (TDD)

`bun test` spawns the real scripts via `runHookAt("cursor", "<script>", payload, home)` and asserts
(a) the journal line shape, (b) `exit 0`, (c) empty stdout — mirroring `codex-*.test.ts`.

- **cursor-tool.test.ts:** each row of the §5.5 map (`tool_name` → `action`, `native` = raw name);
  `run_terminal_cmd` with a `git push --force` command → `cmd: "force_push"` and the raw command is
  **not** in the journal; `hook_event_name: "postToolUseFailure"` → `type: "action_fail"`; malformed
  stdin → exit 0, empty stdout.
- **cursor-session.test.ts:** `sessionStart` → `session_start` with `session_id` taken from
  `conversation_id`, `cwd` from `workspace_roots[0]`, `model` emitted; `beforeSubmitPrompt` → `prompt`;
  `stop` → `turn_end`; `sessionEnd` → `session_end`; `subagentStart` with only `parent_conversation_id`
  → `action`/`delegate` keyed on the parent (Fix 1).

## 8. Open questions (resolve on live capture)

- Exact Cursor `tool_name` values and whether `tool_input` carries `command` / `file_path` (drives the
  §5.5 map; `--native` fallback covers mismatches).
- Whether `postToolUse` truly fires for file edits + shell, or whether the dedicated `afterFileEdit` /
  `afterShellExecution` hooks fire *instead* (would require adding those hooks). Docs say "fires for all
  tools"; confirm against a real payload.
- Whether `stop` fires once per turn or once per response loop (affects turn pacing; `loop_count` is
  available if pacing needs it later).
