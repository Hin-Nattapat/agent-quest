# Reference — Commit Quest Project Structure

> Authoritative repo layout for all phases. Organized by **the seam** (design §2) and
> shaped by the clean split in `pixel-agents-hq` (see `pixel-agents.md`). Phase 0 fills
> only a small subset; the rest are placeholders so later phases drop in without churn.
> This supersedes the illustrative `phase0/` layout in the Phase 0 spec §5.

## Principles

1. **Source mirrors runtime.** The repo layout matches `~/.agentrpg/` so `install.sh` is a
   near-1:1 copy/symlink, not a transform.
2. **Agent-awareness lives only in `adapters/`.** Everything else consumes the normalized
   event and knows nothing about Claude Code (or Codex, later).
3. **One contract: `core/events.ts`.** It is the only thing `adapters/` and `core/` share.
   `adapters/` may import the event *type*; it must never import game logic. `core/` must
   never import an adapter.
4. **Don't over-engineer (design §1.5).** No formal monorepo tooling yet — plain Bun +
   directories. Add workspaces only if a real need appears.

## Tree

```
commit-quest/
├── README.md
├── package.json                       # Bun scripts; deps = none in Phase 0 (jq+bun only)
├── config/
│   └── default.json                   # tuning: XP weights, curve, drop tables, achievements,
│                                      #   secret classes. INERT in Phase 0 (placeholder).
│
├── core/                              # ── AGENT-AGNOSTIC (downstream of the seam) ──
│   ├── events.ts                      # normalized event schema = THE CONTRACT  (Phase 0)
│   ├── state.ts                       # state.json shape                         (Phase 1)
│   ├── reduce.ts                      # journal -> state.json (idempotent fold)  (Phase 1)
│   ├── xp.ts                          # XP weights + level curve                 (Phase 1)
│   ├── classes.ts                     # 4 lines x 4 tiers + secret classes       (Phase 2)
│   ├── achievements.ts               # data-driven registry evaluation          (Phase 2)
│   ├── loot.ts                       # rarity + drop tables                      (Phase 2)
│   └── README.md
│
├── adapters/                          # ── AGENT-AWARE (the ONLY agent-specific code) ──
│   └── claude-code/
│       ├── hooks/                     # bash+jq live capture                     (Phase 0)
│       │   ├── _common.sh             #   sourced helpers (resolve_repo, emit_simple)
│       │   ├── on-session-start.sh
│       │   ├── on-prompt.sh
│       │   ├── on-tool.sh
│       │   ├── on-stop.sh
│       │   └── on-session-end.sh
│       ├── settings.snippet.json      # hooks block to merge into ~/.claude/settings.json
│       ├── importer.ts                # JSONL backfill (port pixel-agents parser) (Phase 4)
│       └── README.md
│
├── hud/                               # ── statusline HUD ── (Phase 1) — Bun, reads state.json
│   └── statusline.ts
│
├── app/                               # ── companion UI ── (Phase 3.1) — separate React+Vite workspace
│   │                                  #   own renderer (single character); NOT a pixel-agents fork.
│   │                                  #   npm lives ONLY here; core/adapter/hud stay jq+bun.
│   ├── CLAUDE.md                      #   FE conventions (klang subset: hooks, body order, enums)
│   ├── server.ts                      #   Bun bridge: fs.watch(state.json) -> SSE /events + serve dist
│   ├── src/
│   │   ├── transport.ts               #   ITransport seam (SSE now -> postMessage in 3.3)
│   │   ├── use-game-state.ts          #   feature hook: subscribe transport -> IState
│   │   ├── view.ts                    #   pure HUD helpers (xpPercent, classLabel, …)
│   │   ├── activity.ts                #   AFK state machine: activityState -> farming/idle/rest (3.2a)
│   │   ├── scene.ts                   #   sceneFor(tier) -> theme + monster (3.2a)
│   │   ├── use-activity.ts            #   hook: derive activity + client timer (3.2a)
│   │   ├── game-events.ts            #   diffStates -> boss encounter events (3.2b)
│   │   ├── use-encounter.ts          #   hook: queue boss encounters + min-duration (3.2b)
│   │   ├── app.tsx / main.tsx         #   composition + mount
│   │   └── components/                #   scene-view, hero, monster, boss-encounter, loot-toast; hud + badges
│   ├── index.html · vite.config.ts · package.json   #   IState/EventType from core (contract only)
│   ├── extension/                     #   VS Code UI host (3.3) — own npm pkg (esbuild); NOT in adapters/ (not agent-aware)
│   │   └── src/                       #     extension.ts (command+panel), webview-html.ts (CSP+nonce), state-feed.ts (fs.watch -> postMessage)
│   └── (3.2b: boss/loot-drop/up-class transition · 3.3 reskin: pixel-MMO UI)
│
├── tools/
│   ├── inspect.ts                     # journal summary (Phase 0 verification)
│   └── install.sh                     # deploy to ~/.agentrpg (--link dev / copy prod)
│
├── test/
│   └── adapters/claude-code/
│       └── fixtures/                  # recorded hook stdin JSON for TDD (Phase 0)
│
└── docs/
    ├── claude-code-rpg-design.md      # full game design (all phases)
    ├── commit-quest-build-spec.md     # original Phase 0 brief (superseded)
    ├── reference/
    │   ├── pixel-agents.md            # reuse map
    │   └── project-structure.md       # this file
    └── superpowers/specs/
        └── 2026-06-10-commit-quest-phase0-design.md
```

## Source → runtime mapping

`install.sh` produces `~/.agentrpg/` (override `$AGENTRPG_HOME`):

| Repo source | Runtime (`~/.agentrpg/`) | Mode |
|---|---|---|
| `adapters/claude-code/` | `adapters/claude-code/` | symlink (`--link`) or copy |
| `core/`, `hud/`, `bridge/`, `tools/` | mirrored as needed (`lib/`-style) | symlink or copy |
| `config/default.json` | `config.json` (only if absent) | copy, never overwrite |
| — (created at runtime) | `journal/{sid}.ndjson`, `journal/{sid}.repo`, `state.json` | generated |

Hook commands in `settings.snippet.json` therefore point at
`~/.agentrpg/adapters/claude-code/hooks/on-*.sh`.

## Dependency rule (enforce in review)

```
adapters/claude-code  ──imports type only──►  core/events.ts  ◄──imports──  core/reduce.ts
        │                                                                         ▲
        └── writes ──► journal/*.ndjson ──► read by ──► core/reduce ──► state.json ─┘
                                                                          │
                                              hud/ , bridge/ , app/ ──read──┘
```

- `adapters/` → may import `core/events.ts` (the contract). Nothing else from `core/`.
- `core/` → never imports `adapters/`. Pure functions over events.
- `hud/`, `bridge/`, `app/` → read `state.json` (or subscribe via `bridge/`). Never touch
  adapters or the journal directly.

## What each phase fills

| Phase | Adds / fills | Leaves untouched |
|---|---|---|
| **0** | `adapters/claude-code/hooks/*`, `settings.snippet.json`, `core/events.ts`, `tools/inspect.ts`, `tools/install.sh`, `test/.../fixtures`, `config/default.json` (inert) | reducer, hud, bridge, app |
| **1** | `core/{state,reduce,xp}.ts`, `hud/statusline.ts` | classes, loot, app |
| **2** | `core/{classes,achievements,loot}.ts`, activate `config/default.json` | bridge, app |
| **3** | `bridge/`, `app/` (fork pixel-agents-hq) | — |
| **4** | `adapters/claude-code/importer.ts` (backfill), concurrency merge | — |
| **5** | `adapters/<second-agent>/`, `adapters/generic/` (CLI/HTTP emit) | core/game logic (unchanged — proves agent-agnostic) |

The win: adding agent #2 in Phase 5 means a new folder under `adapters/` and zero changes
to `core/`, `hud/`, `bridge/`, or `app/`.

## Packaging the VS Code extension

The companion installs as a local `.vsix`:

- `cd app/extension && npm run package` → builds the app (Vite), copies `app/dist/assets` into
  `app/extension/webview/` (gitignored), bundles the extension host (esbuild), and runs `vsce package`
  → `commit-quest-companion-<version>.vsix`.
- Install: `code --install-extension commit-quest-companion-<version>.vsix`.
- The webview loads its bundle from the in-extension `webview/` dir, so the same artifacts run under
  F5 and in the installed vsix — **run `npm run build:all` before pressing F5.**
