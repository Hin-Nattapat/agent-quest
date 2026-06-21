# Contributing to Agent Quest

Thanks for helping! This guide gets you from clone to PR. The architecture rules live in
[`CLAUDE.md`](CLAUDE.md) (canonical) and [`AGENTS.md`](AGENTS.md) (condensed, for non-Claude agents) —
read one of them before changing code.

## Prerequisites

- [Bun](https://bun.sh) and [`jq`](https://jqlang.github.io/jq/) on your `PATH` — the only runtime deps.
- [Node.js](https://nodejs.org) — **only** for building the VS Code extension (`app/extension/` uses npm).

## Setup

```bash
git clone https://github.com/Hin-Nattapat/agent-quest && cd agent-quest
bun install                       # dev tooling (prettier, types)
bash tools/install.sh --link      # deploy engine to ~/.agentrpg as SYMLINKS (live dev — edits apply instantly)
```

`--link` symlinks `~/.agentrpg` to your working tree, so changes to adapters/hooks/core take effect
without reinstalling. (Plain `bash tools/install.sh` copies instead — that's the prod/user path.)

## Day-to-day

```bash
bun test                 # whole suite, incl. hook scripts (spawned with real bash + jq)
bunx tsc --noEmit        # type-check the root (core/, tools/, test/)
bun run format           # apply Prettier   (bun run format:check to verify only)

# Companion app (React + Vite):
cd app && bun install && bun run dev      # dev server;  bun run serve runs the SSE bridge
cd app && bun run typecheck               # app type-check

# VS Code extension (npm, not bun):
cd app/extension && npm install && npm run typecheck
cd app/extension && npm run build:all     # build the webview + extension bundle
```

## Conventions (the short version — full rules in CLAUDE.md / AGENTS.md)

- **The seam:** agent-awareness lives only in `adapters/`; `core/` is a pure, source-agnostic reducer
  over the `core/events.ts` contract. The app imports only `core/state` (type-only) + `core/events`.
- **TypeScript:** arrow-`const` functions (no `function` decls), `interface I*` / `type T*`, **no
  `any`**, **string enums** (never bare `"a" | "b"` unions), braces on every `if`/`else`, kebab-case
  files.
- **Hook scripts:** never write stdout, always `exit 0`, append-only one journal file per session,
  build JSON via `jq`, no network. See [`AGENTS.md`](AGENTS.md) §4 for the full list.

## Adding a new agent adapter

The engine is built so a new agent is *just a new adapter* — no change to `core/`, `hud/`, or `app/`.
Mirror an existing one (`adapters/codex/` or `adapters/cursor/` are the cleanest references): a thin
`hooks/*.sh` layer that parses the agent's payload and calls `adapters/generic/emit.sh`
(see [`adapters/generic/README.md`](adapters/generic/README.md) for the emitter's CLI). Add tests under
`test/adapters/` that spawn your real hooks against fixture payloads.

## Opening a PR

Before you push, make sure all three pass:

```bash
bun test            # all green
bunx tsc --noEmit   # clean
bun run format:check
```

- One logical change per commit; [Conventional Commits](https://www.conventionalcommits.org) prefixes
  (`feat` / `fix` / `refactor` / `chore` / `docs` / `style` / `test`), imperative, subject ≤ 90 chars.
- Branch off `main` and open a PR against `main` (it's protected — direct pushes are blocked).
- New behavior needs a test. New hook scripts need the journal-line / `exit 0` / empty-stdout assertions.

CI runs the same three checks on your PR. Thanks again! 🦦
