# Cursor adapter

Maps Cursor (1.7+) agent hooks to Agent Quest's normalized journal via `../generic/emit.sh`.

## Install

1. Install Agent Quest (deploys this adapter to `~/.agentrpg/adapters/cursor`).
2. Merge `config.snippet.json` into `~/.cursor/hooks.json`. `hooks.json` is a single JSON object, so
   **merge** rather than paste. The snippet is the one deployed by step 1, so these commands work
   from any directory:
   ```sh
   # first time (no existing file):
   cp ~/.agentrpg/adapters/cursor/config.snippet.json ~/.cursor/hooks.json
   # merging into an existing file:
   jq -s '.[0] * .[1]' ~/.cursor/hooks.json ~/.agentrpg/adapters/cursor/config.snippet.json \
     > /tmp/cursor-hooks.json && mv /tmp/cursor-hooks.json ~/.cursor/hooks.json
   ```
   If Cursor does not expand `~` in `command`, replace it with the absolute path to your home dir.
3. Start a Cursor agent session — events append to `~/.agentrpg/journal/<conversation_id>.ndjson`.

## Event mapping

| Cursor hook | event | notes |
|---|---|---|
| `sessionStart` | `session_start` | session=`conversation_id`, `model`, cwd=`workspace_roots[0]` |
| `beforeSubmitPrompt` | `prompt` | prompt text is NOT stored |
| `postToolUse` | `action` | tool→action map below |
| `postToolUseFailure` | `action_fail` | same action derivation, type forced fail |
| `subagentStart` | `action` (`delegate`) | session=`conversation_id` // `parent_conversation_id` |
| `stop` | `turn_end` | |
| `sessionEnd` | `session_end` | |

Tool → action: `edit_file`/`search_replace`/`apply_patch`→`edit`; `write`/`create_file`→`write`;
`run_terminal_cmd`/`shell`/`bash`/`exec`→`run` (+ git/test command tag); `read_file`/`list_dir`→`read`;
`codebase_search`/`grep_search`/`file_search`/`web_search`→`search`; `mcp__*` and others→`other`.

## Known approximations (refine against a real payload)

- Tool names and the `tool_input` field layout (`command`/`file_path`) are best-guess; `--native`
  preserves the raw `tool_name` for any mismatch.
- The raw shell command and prompt text are never stored — only a `CmdTag` from `cmd_tag`.
- No Cursor statusline (the companion app renders from `state.json`).
