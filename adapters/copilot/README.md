# Copilot adapter

Maps GitHub Copilot CLI hook events to Agent Quest's normalized journal via `../generic/emit.sh`.

## Install

1. Install Agent Quest (deploys this adapter to `~/.agentrpg/adapters/copilot`).
2. Copy `config.snippet.json` to `~/.copilot/hooks/agent-quest.json` (Copilot CLI loads `~/.copilot/hooks/*.json`).
3. Start a Copilot CLI session — events append to `~/.agentrpg/journal/<session_id>.ndjson`.

## Event mapping

| Copilot event | event | notes |
|---|---|---|
| `SessionStart` | `session_start` | `session_id`, `cwd`, `source`; `model` only if the payload carries it |
| `UserPromptSubmit` | `prompt` | prompt text is NOT stored |
| `PostToolUse` | `action` | tool → action (below) |
| `PostToolUseFailure` | `action_fail` | a dedicated failure event — no heuristic needed |
| `Stop` | `turn_end` | |
| `SessionEnd` | `session_end` | |

Tool → action: `bash`/`shell`/`exec`→`run` (+ git/test command tag); `create`/`write`→`write`;
`str_replace`/`apply_patch`/`edit`→`edit`; `read`/`view`→`read`; `web_search`→`search`;
`mcp__*` and anything else→`other`.

## Safety

We hook only post- and lifecycle events. `PreToolUse`/`PermissionRequest` are deliberately NOT
hooked: Copilot treats a hook's non-zero exit / timeout on those as a tool *denial*, so wiring
them could block the agent. Every hook writes nothing to stdout and exits 0.

## Known approximations (refine against a real payload)

- Field names are read as both snake_case (`session_id`, `tool_name`, `tool_input`) and camelCase
  (`sessionId`, `toolName`, `toolArgs`).
- Copilot's exact built-in tool names are unverified; the tool→action ladder is best-effort and
  matches on substrings. `mcp__*` is forced to `other`.
- No statusline (like Codex) — the companion app/server reduces the journal to render `state.json`.
