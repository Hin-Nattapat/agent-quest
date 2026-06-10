# Reference — Pixel Agents (reuse map)

> Analysis of `github.com/pixel-agents-hq/pixel-agents` (MIT) for what Commit Quest can
> borrow. This is the **newer, refactored org** — different from the repos named in
> `claude-code-rpg-design.md` §10.5 (`pablodelucca/pixel-agents`,
> `rolandal/pixel-agents-standalone`). Prefer this one: it has a clean agent-agnostic
> split that mirrors our seam.
> Checked: 2026-06-10.

## What it is

A VS Code extension that visualizes each Claude Code terminal as an animated pixel
character in an office. Observational only (never modifies CC). Stack: TypeScript
throughout; webview = React 19 + Vite + Canvas 2D; server = Node + vitest; build = esbuild.

## Their architecture (and a terminology trap)

```
core/        agent-agnostic contracts: adapter/provider/transport/schemas/messages
server/      long-running backend: file watching, JSONL parsing, hook handling, state store, WS http
adapters/    UI HOSTS: adapters/vscode/  (the thing that renders into an editor)
webview-ui/  React renderer (sprites, layout editor, pathfinding)
core/asyncapi.yaml   the WS protocol between server and UI
```

⚠️ **Naming is swapped vs ours.** They call the *agent connector* a **provider**
(`server/src/providers/hook/claude/`) and the *UI host* an **adapter**
(`adapters/vscode/`). In Commit Quest the *agent connector* is the **adapter**
(`adapters/claude-code/`) and the UI is the **app/hud**. When borrowing code, mind the
flip.

Role mapping:

| Pixel Agents | Commit Quest |
|---|---|
| `server/src/providers/hook/claude/` (provider) | `adapters/claude-code/` (adapter) |
| `core/` (transport + schemas, render-oriented) | `core/` (events + reducer + state) |
| `server/` (watcher + WS daemon) | `bridge/` (daemon, Phase 3) |
| `adapters/vscode/` + `webview-ui/` (UI host + renderer) | `app/` (companion, Phase 3) |

## Their events vs our journal — important difference

Their `core/asyncapi.yaml` is a **bidirectional WebSocket protocol** (single `/ws`,
`127.0.0.1:3100`) carrying **ephemeral "what is the character doing right now" render
messages** — `AgentToolStart`/`AgentToolDone`, `AgentStatus: active|waiting`,
sprite/layout/furniture payloads. It is a **live render feed, not a durable ledger.**

Our journal is the opposite: an **append-only gameplay ledger** for recomputing XP/state.
So their schema is **not** a drop-in for our normalized event — different purpose. But the
taxonomy gives ideas worth folding in:

- **`toolId` pairs `AgentToolStart` ↔ `AgentToolDone`.** We only emit on `PostToolUse`
  (done). If we ever want tool-duration, capture an id. Not needed for Phase 0 XP.
- **Subagents are first-class:** `SubagentToolStart/Done` carry `parentToolId`, and
  `ProviderCapabilities.subagentToolNames` lists spawning tools. This answers our open
  question in the Phase 0 spec §8 — subagent tool activity *is* distinguishable. Useful
  later for the `delegate` action and the Maestro / Orchestration Master classes.
- **`AgentTokenUsage { inputTokens, outputTokens }`** comes from JSONL — confirms tokens
  are available for our Tier A (`design §2.3`) and token XP bonuses (backfill, Phase 4).
- **`ProviderCapabilities { readingTools, subagentToolNames }`** externalizes the
  tool→category map as *declared provider capabilities* rather than hardcoding. Good
  pattern for staying agent-agnostic: each adapter declares its native→action mapping.

## Performance note

Pixel Agents is **watch-first** (a persistent server tails `~/.claude/projects/*.jsonl`
via `server/src/fileWatcher.ts` + `transcriptParser.ts`, plus optional hooks). Commit
Quest Phase 0 is **hook-first** (bash appends one line per event; no resident watcher).
Hook-first is lighter for *live* capture — no daemon required until Phase 3. We adopt
their watcher/parser only where we genuinely need to read JSONL (backfill, live daemon).

## Reuse map (by phase)

| Their file | What we borrow | Our phase | Our target |
|---|---|---|---|
| `server/src/providers/hook/claude/claudeHookInstaller.ts` | idempotent merge of hooks into `~/.claude/settings.json` | **0** | `tools/install.sh` logic |
| `server/src/providers/hook/claude/hooks/claude-hook.ts` | validates real hook stdin field names/shapes | **0** | sanity-check our `on-*.sh` field assumptions |
| `server/src/transcriptParser.ts` | parse `~/.claude/projects/{enc}/{sid}.jsonl` (messages, tool use, tokens) | **4** | `adapters/claude-code/importer.ts` |
| `server/src/fileWatcher.ts`, `timerManager.ts` | incremental/debounced file watching | **3** | `bridge/` daemon |
| `server/src/agentStateStore.ts`, `sessionRouter.ts` | per-session state + routing patterns | **1/3** | `core/reduce.ts`, `bridge/` |
| `core/asyncapi.yaml` + `core/src/transport.ts` | WS protocol shape for state→UI | **3** | `bridge/` ↔ `app/` |
| `webview-ui/` + `adapters/vscode/` + `core/asyncapi.yaml` | **fork the whole renderer/office shell** | **3** | `app/` (don't build sprites/pathfinding ourselves) |
| `docs/external-assets.md` | furniture/tileset asset handling (free vs paid) | **3** | `app/` assets |

## Bottom line

- **Phase 0:** borrow only the **installer pattern** + **hook field validation**. Our bash
  hooks stay as designed (lighter than their watcher).
- **Phase 3:** fork this repo as the companion shell; wire our `state.json`/`bridge` into
  their WS protocol and costume/furniture layer.
- **Phase 4:** port `transcriptParser.ts` into our backfill `importer.ts`.
- **Schema:** keep our journal as the durable ledger; optionally adopt their `tokens` and
  subagent/`parentToolId` modeling when those phases arrive.
