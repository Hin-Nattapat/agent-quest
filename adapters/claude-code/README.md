# Claude Code adapter (Phase 0)

bash+jq hooks that append normalized events to `~/.agentrpg/journal/{session_id}.ndjson`.
Observational only: never writes stdout, always exits 0, appends one line per event.

| CC hook event | script | emits |
|---|---|---|
| SessionStart | on-session-start.sh | session_start (+ git repo, caches repo) |
| UserPromptSubmit | on-prompt.sh | prompt |
| PostToolUse | on-tool.sh | action |
| PostToolUseFailure | on-tool.sh | action_fail |
| Stop | on-stop.sh | turn_end |
| SessionEnd | on-session-end.sh | session_end |

See `docs/superpowers/specs/2026-06-10-commit-quest-phase0-design.md`.
