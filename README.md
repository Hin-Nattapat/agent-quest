# Commit Quest — Phase 0

Gamifies AI coding agent usage into an RPG. Phase 0 only proves normalized events flow
into an append-only journal from a real Claude Code session (no XP/levels/UI yet).

## Prerequisites
- `jq` and `bun` installed (`jq --version`, `bun --version`).

## Install
```bash
bun test                 # run the suite
tools/install.sh --link  # dev: symlink into ~/.agentrpg (or omit --link to copy)
```
Then merge the printed snippet into `~/.claude/settings.json`.

## Verify
Run one Claude Code session, then:
```bash
bun ~/.agentrpg/tools/inspect.ts
```
Expect a summary with session_start / prompt / action / turn_end / session_end events.

After merging the `statusLine` from the snippet into `~/.claude/settings.json`, the bottom
of Claude Code shows `Lv.N ███░░ %  |  model  $cost  ·  ctx %`, updating as you work.

## Known limitations
- `--continue`/`--resume` replays recorded hook stdout and does not re-run hooks, so
  resumed spans may be sparse. (Hooks emit no stdout, so no stale data is injected.)
- `config.json` is inert in Phase 0 (placeholder for later phases).

See `docs/` for the full design, spec, and structure. Conventions: `CLAUDE.md`.
