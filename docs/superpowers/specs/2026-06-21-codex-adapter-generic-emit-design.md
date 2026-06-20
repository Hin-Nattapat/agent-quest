# Agent Quest — Codex adapter + generic emit (design)

> Fills GitHub issue #6 (Phase 5 — generic emit + second adapter). Proves the seam is
> agent-agnostic: a second agent flows through the same journal → reducer → state with **zero
> changes to `core/` or game logic**.

## 1. Goal & decisions

Add a **Codex CLI** adapter and a **generic emit** CLI, so events from a second agent reach the
existing pipeline unchanged.

Decisions taken during brainstorming:

- **Scope:** Codex adapter **and** `adapters/generic/` emit (both halves of issue #6).
- **Field mapping source:** build to OpenAI's **documented** Codex hook schema; fixtures derived from
  the docs; live capture refines later.
- **Convergence (DRY):** the existing `claude-code` adapter is refactored to call the shared
  `generic/emit.sh` too — no duplicated emit logic. Its existing `bun test` hook tests are the
  regression guard.

Non-negotiables carried from `CLAUDE.md`: agent-awareness lives **only** in `adapters/`; runtime deps
stay **jq + bun only**; hooks are bash + jq, never write stdout, always `exit 0`, append-only one file
per session, build JSON with jq, keep each line < 4 KB, stay light (no network, no reducer).

## 2. Architecture

```
<agent> ──hooks──► adapters/<agent>/hooks/*.sh ──► adapters/generic/emit.sh ──► journal/{sid}.ndjson ──► reducer ──► state
                   (parse THIS agent's payload,     (normalized contract only:
                    map event + tool names)          build INormalizedEvent, append)
```

The split is the whole point: everything agent-specific (event names, tool names, payload shape,
failure signal) lives in the per-agent hook layer; `emit.sh` knows only `core/events.ts`.

### File layout

```
adapters/
  generic/
    emit.sh              # flag-driven emitter: build one INormalizedEvent line, resolve repo, append
    README.md
  codex/
    hooks/
      _common.sh         # slurp stdin, extract common fields, map Codex tool → AgentAction
      on-session-start.sh
      on-prompt.sh
      on-tool.sh
      on-stop.sh
    config.snippet.toml  # [[hooks.*]] entries the user pastes into ~/.codex/config.toml
    README.md
  claude-code/           # refactored to call generic/emit.sh (behavior unchanged)
    hooks/*.sh
    _common.sh           # thinned: parsing/extraction only; emit delegated to generic/emit.sh
    settings.snippet.json
```

## 3. `adapters/generic/emit.sh` — the shared emitter

Agent-agnostic. Builds exactly one normalized event line and appends it. Owns repo resolution
(the cached `git` lookup) and atomic append. Knows nothing about any agent.

```
emit.sh --type <session_start|prompt|action|action_fail|turn_end|session_end>
        --session <sid>
        [--source <id>]        # default: $RPG_SOURCE, else "claude-code" (back-compat)
        [--cwd <path>]         # used to resolve repo when --repo absent; emitted on session_start
        [--repo <name>]        # if absent, resolved from the sid cache / --cwd
        [--start <startup|resume|clear|compact>]   # session_start only
        [--model <slug>]                            # session_start only
        [--action <edit|write|run|read|search|delegate|other>]  # action/action_fail
        [--native <raw tool name>]                  # action/action_fail
        [--cmd <CmdTag>]                            # action/action_fail (Bash classification)
        [--file <path>]                             # optional
```

Behavior:

- `--source` is a **free string** (not an enum) — each adapter passes its own id (`codex`, later
  `cursor`, `copilot`). Default preserves current `claude-code` behavior.
- Repo resolution moves here from `claude-code/_common.sh` (`resolve_repo`): read `{sid}.repo`
  cache; on miss, one `git -C <cwd> rev-parse --show-toplevel`, then write the cache.
- Output line is built with `jq` (`--arg` / object construction), conditional fields only when
  present, `ts:(now|todate)`, appended with `>>` to `$RPG_HOME/journal/{sid}.ndjson`.
- Never writes stdout; returns 0 even on bad input (caller hooks also `exit 0`).
- `$RPG_HOME` resolves as today: `${AGENTRPG_HOME:-$HOME/.agentrpg}`.

The emitted object matches `INormalizedEvent` (`core/events.ts`) field-for-field; enum string values
ARE the wire strings.

## 4. `adapters/codex` — the Codex adapter

Codex hooks receive a single JSON object on **stdin** (same model as Claude Code). Common fields:
`session_id`, `cwd`, `hook_event_name`, `model`, `turn_id`, `transcript_path`, `permission_mode`.

### Hook → event mapping

| Codex hook event | emit `--type` | notes |
|---|---|---|
| `SessionStart` | `session_start` | `.source` (startup/resume) → `--start`; `.model` → `--model`; seed repo cache from `.cwd` |
| `UserPromptSubmit` | `prompt` | payload carries `.prompt` (not forwarded — privacy; keep lines < 4 KB) |
| `PostToolUse` | `action` / `action_fail` | success vs failure inferred from `.tool_response` (see below) |
| `Stop` | `turn_end` | end of a turn |

Not wired: **`SessionEnd`** (Codex exposes no such hook) and **statusLine** (a Claude-Code-only
concept; the companion app still renders from `state.json`). `PreToolUse`, `Permission*`,
`Pre/PostCompact`, `Subagent*` are out of scope for v1.

### `tool_name` → `AgentAction`

`apply_patch` → `edit` · `Bash`/`shell`/`exec`/`local_shell` → `run` (+ Bash `cmd` classification on
`.tool_input.command`, reusing the existing `CmdTag` jq ladder) · `read`/`read_file` → `read` ·
`WebSearch`/web tools → `search` · `mcp__*` → `other` · anything else → `other`. Raw name preserved
in `--native`.

`apply_patch` is mapped to `edit` for v1 (it covers both create and modify); distinguishing
`write` (new file) by inspecting the patch body is deferred. `.tool_input.file_path` → `--file`
when present.

### Failure detection (best-effort, refine on capture)

Codex has no `PostToolUseFailure`. In `on-tool.sh`, treat the action as `action_fail` when
`.tool_response` signals an error — heuristic: a non-empty `.tool_response.error`, or
`.tool_response.exit_code` non-zero, or `.tool_response.success == false`. Otherwise `action`. This
is the one mapping most likely to need adjustment against a real payload; called out in the README.

### Config delivery

`config.snippet.toml` with `[[hooks.SessionStart]]`, `[[hooks.UserPromptSubmit]]`,
`[[hooks.PostToolUse]]` (tool matcher), `[[hooks.Stop]]`, each an inner `[[hooks.<Event>.hooks]]`
of `type = "command"` pointing at `~/.agentrpg/adapters/codex/hooks/*.sh`. README explains pasting it
into `~/.codex/config.toml` (or `~/.codex/hooks.json`). The hooks set `RPG_SOURCE=codex` (via the
adapter `_common.sh`) so `emit.sh` stamps the right `source`.

## 5. claude-code convergence

`claude-code/hooks/*.sh` keep their **parsing/mapping** (the tool table + `CmdTag` ladder live in the
agent layer) but delegate the final build+append to `generic/emit.sh`. `resolve_repo`/`emit_simple`
leave `_common.sh`; `_common.sh` shrinks to field extraction + the call into `emit.sh`. Behavior is
identical; the existing hook `bun test`s must stay green (they spawn the real scripts and assert the
journal line, `exit 0`, empty stdout).

## 6. Testing (TDD)

- **`emit.sh`**: spawn with fixture flags; assert the appended NDJSON line parses, passes
  `isNormalizedEvent` (imported from `core/events.ts`), and carries the expected fields per `--type`
  (incl. conditional `repo`/`cmd`/`file`/`start`/`model`).
- **Codex hooks**: spawn each script feeding a docs-derived fixture JSON on stdin; assert (a) the
  journal line (type, action, native, cmd, repo), (b) `exit 0`, (c) empty stdout. Cover: SessionStart
  (start+model), UserPromptSubmit, PostToolUse for `apply_patch`→edit and `Bash`→run+`force_push`
  cmd, and a `tool_response` error → `action_fail`.
- **Regression**: existing `claude-code` hook tests stay green after convergence.
- No `any` in tests; use `core/events.ts` types.

## 7. Out of scope (YAGNI)

HTTP emit (all current/known agents support command hooks; revisit only for a non-local/non-command
agent) · Cursor & Copilot adapters (see appendix) · Codex statusLine · `session_end` for Codex ·
exact `apply_patch` edit-vs-write split · per-tool MCP sub-mapping · forwarding prompt/command text.

## 8. Appendix — future adapters (forward-compatibility, not built now)

Research confirms Cursor (1.7+) and GitHub Copilot CLI both use **command hooks with JSON on stdin**,
so the same pattern (thin per-agent hook layer → `emit.sh`) covers them. `emit.sh` needs **no change**
to support them — only a new `adapters/<agent>/` parsing layer. Quirks to handle when built:

| Agent | prompt event | tool event(s) | session event | failure signal |
|---|---|---|---|---|
| Cursor 1.7+ | `beforeSubmitPrompt` | `afterFileEdit`, `beforeShellExecution` (split by tool kind) | App lifecycle hooks | none obvious → infer |
| Copilot CLI | `onUserPromptSubmitted` | `onPreToolUse` / `onPostToolUse` | `onSessionStart` | `onErrorOccurred` (clean) |

Implications baked into this design so they need no rework: `--source` is a free string; the tool→
action map and failure signal are per-adapter; `--native` preserves the raw tool name for debugging
across agents. HTTP emit remains unnecessary for these three.

## 9. Open questions (resolve on live capture)

- Exact Codex `tool_response` error shape (drives the `action_fail` heuristic).
- Real Codex tool names (`apply_patch` vs `shell`/`exec` vs `local_shell`) — confirm the map.
- Whether Codex emits a usable turn boundary beyond `Stop` for multi-turn XP pacing.
