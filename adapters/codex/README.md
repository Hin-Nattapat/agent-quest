# Codex adapter

Maps OpenAI Codex CLI hook events to Agent Quest's normalized journal via `../generic/emit.sh`.

## Install

1. Install Agent Quest (deploys this adapter to `~/.agentrpg/adapters/codex`).
2. Paste `config.snippet.toml` into `~/.codex/config.toml`.
3. Start a Codex session — events append to `~/.agentrpg/journal/<session_id>.ndjson`.

## Event mapping

| Codex hook | event | notes |
|---|---|---|
| `SessionStart` | `session_start` | `source`→start, `model`, repo from `cwd` |
| `UserPromptSubmit` | `prompt` | prompt text is NOT stored |
| `PostToolUse` | `action` / `action_fail` | failure inferred from `tool_response` |
| `Stop` | `turn_end` | |

Tool → action: `apply_patch`→`write` (pure new file) or `edit`; `shell`/`exec`/`bash`→`run`
(+ git/test command tag); `read`→`read`; `WebSearch`→`search`; `mcp__*` and others→`other`.

## Known approximations (refine against a real payload)

- Failure is heuristic: `tool_response.error`, non-zero `exit_code`, or `success == false`.
- `apply_patch` patch text is read field-agnostically (`patch`/`input`/`changes`/whole input).
- No `SessionEnd` hook in Codex; no statusline (the companion app renders from `state.json`).
