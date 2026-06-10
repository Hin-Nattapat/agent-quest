# CLAUDE.md

Rules for AI agents working in this repo. Read before any code change.
Project: gamifies AI coding agent usage into an RPG. Conventions adapted from the
`klang-web` FE styles — only the parts that apply to a Bun/TypeScript + bash/jq project.

## 1. Architecture — the seam (non-negotiable)

```
agents ──(adapters)──► append-only journal (NDJSON) ──(reducer)──► state.json ──► hud/app
```

- **Agent-awareness lives ONLY in `adapters/`.** Everything else consumes the normalized event and knows nothing about Claude Code.
- **One contract: `core/events.ts`.** Adapters may import the event *types* only — never game logic. `core/` never imports an adapter.
- Authoritative layout: `docs/reference/project-structure.md`. Spec/plans live in `docs/superpowers/`.

## 2. Dependencies

- **Runtime deps = `jq` + `bun` only.** No runtime npm packages.
- **Type-only devDependencies are allowed** for editor DX (`@types/bun`, `@types/node`). They never affect runtime or the `install.sh` deploy.

## 3. TypeScript

- **Run on Bun.** Bun executes `.ts` directly; tests run with `bun test`. No transpile step.
- **String enums, not string-literal unions.** Any finite set of states is a string-valued `enum` (e.g. `EventType`, `AgentAction`) referenced by member at every call site — never a bare `"prompt"` literal or `"a" | "b"` union. String values only (no numeric enums). Enum string values that cross the bash↔TS boundary ARE the wire strings — keep them in sync.
- **Type prefixes:** `interface I*` for object/shape types (`INormalizedEvent`); `type T*` for unions/aliases/entities.
- **No `any`.** Use `unknown` + a type guard, or define the proper type.
- **kebab-case** for all file names (`events.ts`, `on-tool.sh`).

## 4. Hook scripts (bash + jq) — safety (non-negotiable)

CC hooks run in the agent's hot path. Every `adapters/claude-code/hooks/*.sh` must:

1. **Never write stdout** — `UserPromptSubmit`/`SessionStart` stdout is injected into the model context.
2. **Always `exit 0`** — `exit 2` blocks the agent.
3. **Append-only, one file per session** — `journal/{session_id}.ndjson`. Never touch other sessions' files.
4. **Build JSON with `jq`** (`--arg` / object construction) — never string-concat JSON.
5. **Keep each line < 4 KB** so concurrent `>>` (O_APPEND) stays atomic. No prompt/command text inline.
6. **Be light** — no network, no reducer; `git` runs once per session at `SessionStart`.

## 5. Testing (TDD)

- Red → green → refactor; commit per task.
- Hook scripts are tested from `bun test` by spawning the real script, feeding fixture JSON to stdin, and asserting (a) the journal line, (b) `exit 0`, (c) empty stdout. Keeps deps to jq+bun while testing the actual shell.
- Don't use `any` in tests; prefer the `core/events.ts` types.

## 6. Comments

Comment **why**, not what. No section-divider/ceremony comments. Delete a comment before it can go stale. The bar is a non-obvious why: an invariant the types can't express, a workaround, or a decision that contradicts expectation.

## 7. Commits

Conventional Commits, simplified prefixes: `init` · `feat` · `fix` · `refactor` · `chore` · `docs` · `style` · `test`. Imperative present tense; subject ≤ 90 chars; one logical change per commit.
