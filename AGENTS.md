# AGENTS.md

Rules for AI coding agents (Codex, Cursor, Copilot, etc.) working in this repo.
**[`CLAUDE.md`](CLAUDE.md) is the full canonical ruleset — read it before any code change.**
This file is a condensed mirror of the non-negotiables so non-Claude agents don't miss them.

Project: gamifies AI coding-agent usage into an RPG. The same rules apply to every agent — this repo
is multi-agent by design (`adapters/claude-code`, `adapters/codex`, `adapters/cursor`).

## 1. The seam (non-negotiable)

```
agents ──(adapters)──► append-only journal (NDJSON) ──(reducer)──► state.json ──► hud/app
```

- **Agent-awareness lives ONLY in `adapters/`.** Everything else consumes the normalized event and
  knows nothing about any specific agent.
- **One contract: `core/events.ts`.** Adapters may import the event *types* only — never game logic.
  `core/` never imports an adapter.
- App/extension may import only `core/state` (type-only) + the `core/events` contract at runtime —
  never `core/` game logic (`reduce`, `classes`, …). The two sanctioned exceptions that DO run game
  logic are the host edges: `app/server.ts` and `app/extension/src/`.
- Authoritative layout: `docs/reference/project-structure.md`.

## 2. Dependencies

- **Runtime deps = `jq` + `bun` only.** No runtime npm packages.
- Dev-only tooling is allowed as `devDependencies` (types, prettier).

## 3. TypeScript conventions

- **Run on Bun** — Bun executes `.ts` directly; tests run with `bun test`. No transpile step. Bun does
  NOT type-check, so run `bunx tsc --noEmit` to catch type errors before committing.
- **String enums, not string-literal unions.** Any finite set of states is a string-valued `enum`
  referenced by member at every call site — never a bare `"prompt"` literal or `"a" | "b"` union. Enum
  string values that cross the bash↔TS boundary ARE the wire strings — keep them in sync.
- **Type prefixes:** `interface I*` for shapes (`INormalizedEvent`); `type T*` for unions/aliases.
- **Arrow functions assigned to `const`** — never `function` declarations — across all source AND tests.
  - 0–2 params: pass directly. 3+ params: a single props object destructured on line 1, typed by a
    named `interface I<Fn>Args`.
- **No `any`** (including in tests) — use `unknown` + a type guard, or the proper type.
- **Braces on every `if`/`else`** — including single-statement guards.
- **No clever/nested/multi-line ternaries** — a ternary is only for a simple one-line value.
- **kebab-case** for all file names. Formatting is Prettier (`bun run format`).

## 4. Hook scripts (bash + jq) — safety (non-negotiable)

Every `adapters/*/hooks/*.sh` runs on the agent's hot path and must:

1. **Never write stdout** — hook stdout can be injected into the model context.
2. **Always `exit 0`** — a non-zero exit can block the agent.
3. **Append-only, one file per session** — `journal/{session_id}.ndjson`. Never touch other sessions.
4. **Build JSON with `jq`** (`--arg` / object construction) — never string-concat JSON.
5. **Keep each line < 4 KB** so concurrent `>>` (O_APPEND) stays atomic. No prompt/command text inline.
6. **Be light** — no network, no reducer; one `git` call per session at most.

Multi-field parsing uses the STX separator: `IFS=$'\002' read ...` against jq `... | join("")`
(plain `\002`/`` escapes — never an embedded raw control byte). This preserves empty middle
fields under bash 3.2 (macOS).

## 5. Testing (TDD)

Red → green → refactor; commit per logical change. Hook scripts are tested from `bun test` by spawning
the real script, feeding fixture JSON to stdin, and asserting the journal line, `exit 0`, and empty
stdout. Keep deps to jq + bun. Don't use `any` in tests — prefer the `core/events.ts` types.

## 6. Commits

Conventional Commits, simplified prefixes: `init` · `feat` · `fix` · `refactor` · `chore` · `docs` ·
`style` · `test`. Imperative present tense; subject ≤ 90 chars; one logical change per commit.

## 7. Before you open a PR

`bun test` (all green) · `bunx tsc --noEmit` (clean) · `bun run format:check`. See
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the full dev setup.
