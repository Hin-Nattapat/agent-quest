# Commit Quest Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove normalized Claude Code events flow into an append-only NDJSON journal with correct fields, from a real session, with zero impact on the agent.

**Architecture:** bash+jq hooks (one per CC hook event) append one normalized line per event to `~/.agentrpg/journal/{session_id}.ndjson`. `git` runs once per session at `SessionStart` and the repo name is cached + written on every line. A Bun `inspect.ts` reads the journal for verification. Nothing computes XP yet — events stay raw for a later reducer.

**Tech Stack:** bash 3.2+ (macOS), `jq` (event building + `now|todate` timestamps), Bun + TypeScript (`inspect.ts`, tests via `bun test`). No npm packages.

**Reference:** Spec `docs/superpowers/specs/2026-06-10-commit-quest-phase0-design.md`; structure `docs/reference/project-structure.md`; reuse notes `docs/reference/pixel-agents.md`.

**Commit convention:** end each commit message body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` (omitted from the short `-m` examples below for brevity).

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | Bun scripts (`test`); declares no deps |
| `.gitignore` | ignore Bun/OS cruft |
| `config/default.json` | placeholder config (inert in Phase 0) |
| `core/events.ts` | normalized event types + runtime guard — THE CONTRACT |
| `adapters/claude-code/hooks/_common.sh` | sourced helpers: `resolve_repo`, `emit_simple` |
| `adapters/claude-code/hooks/on-session-start.sh` | `SessionStart` → `session_start` (git repo + cache) |
| `adapters/claude-code/hooks/on-prompt.sh` | `UserPromptSubmit` → `prompt` |
| `adapters/claude-code/hooks/on-tool.sh` | `PostToolUse`/`PostToolUseFailure` → `action`/`action_fail` |
| `adapters/claude-code/hooks/on-stop.sh` | `Stop` → `turn_end` |
| `adapters/claude-code/hooks/on-session-end.sh` | `SessionEnd` → `session_end` |
| `adapters/claude-code/settings.snippet.json` | hooks block for `~/.claude/settings.json` |
| `tools/inspect.ts` | journal summary (verification) |
| `tools/install.sh` | deploy to `$AGENTRPG_HOME` (`--link` dev / copy prod) |
| `test/helpers.ts` | spawn-a-hook + read-journal test helpers |
| `test/**/*.test.ts` | TDD tests driving the scripts |

---

## Task 0: Scaffold repo + Bun + branch

**Files:**
- Create: `package.json`, `.gitignore`, `config/default.json`
- Create dirs: `core/`, `adapters/claude-code/hooks/`, `tools/`, `test/`

- [ ] **Step 1: Create a feature branch**

Run:
```bash
git checkout -b feat/phase0-journal
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "commit-quest",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test"
  }
}
```

- [ ] **Step 3: Create `.gitignore`**

```gitignore
node_modules/
.DS_Store
*.log
```

- [ ] **Step 4: Create `config/default.json` (inert placeholder)**

```json
{
  "home": "~/.agentrpg",
  "source_default": "claude-code",
  "adapters": { "claude-code": { "enabled": true } }
}
```

- [ ] **Step 5: Create empty dirs with placeholders**

Run:
```bash
mkdir -p core adapters/claude-code/hooks tools test
```

- [ ] **Step 6: Verify Bun runs**

Run: `bun test`
Expected: exits 0 with "0 tests" (no test files yet) — confirms Bun works.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore config/default.json
git commit -m "chore: scaffold Phase 0 repo (Bun, config placeholder)"
```

---

## Task 1: `core/events.ts` — the contract

**Files:**
- Create: `core/events.ts`
- Test: `test/core/events.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/events.test.ts`:
```ts
import { test, expect } from "bun:test";
import { isNormalizedEvent, EventType, AgentAction } from "../../core/events";

test("valid event passes the guard", () => {
  expect(isNormalizedEvent({ ts: "2026-06-11T00:00:00Z", source: "claude-code", session_id: "a", type: EventType.Prompt })).toBe(true);
});

test("missing required field fails", () => {
  expect(isNormalizedEvent({ source: "claude-code", session_id: "a", type: EventType.Prompt })).toBe(false);
});

test("unknown type fails", () => {
  expect(isNormalizedEvent({ ts: "x", source: "x", session_id: "a", type: "bogus" })).toBe(false);
});

test("non-object fails", () => {
  expect(isNormalizedEvent(null)).toBe(false);
  expect(isNormalizedEvent("x")).toBe(false);
});

test("enums expose the wire values", () => {
  expect(Object.values(EventType) as string[]).toContain("session_start");
  expect(Object.values(AgentAction) as string[]).toContain("delegate");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/events.test.ts`
Expected: FAIL — cannot find module `../../core/events`.

- [ ] **Step 3: Write the implementation**

Create `core/events.ts` (string enums per CLAUDE.md §3; enum values are the wire strings):
```ts
// Normalized event schema — the single contract shared across the seam.
// Adapters MAY import these types; they must not import game logic.
//
// Enum string values ARE the on-the-wire strings emitted by the bash hooks
// (jq writes "session_start", "action", ... verbatim). Keep them in sync.

export enum EventType {
  SessionStart = "session_start",
  Prompt = "prompt",
  Action = "action",
  ActionFail = "action_fail",
  TurnEnd = "turn_end",
  SessionEnd = "session_end",
}

export enum AgentAction {
  Edit = "edit",
  Write = "write",
  Run = "run",
  Read = "read",
  Search = "search",
  Delegate = "delegate",
  Other = "other",
}

export interface INormalizedEvent {
  ts: string;              // UTC ISO8601, second precision
  source: string;          // adapter id, e.g. "claude-code"
  session_id: string;
  type: EventType;
  repo?: string;           // present on every line when determinable
  action?: AgentAction;    // type=action/action_fail only
  native?: string;         // raw tool name, type=action/action_fail only
  file?: string;           // optional
  cwd?: string;            // session_start only
  start?: string;          // session_start only: startup|resume|clear|compact
  model?: string;          // session_start only
}

export function isNormalizedEvent(o: unknown): o is INormalizedEvent {
  if (typeof o !== "object" || o === null) return false;
  const e = o as Record<string, unknown>;
  return (
    typeof e.ts === "string" &&
    typeof e.source === "string" &&
    typeof e.session_id === "string" &&
    typeof e.type === "string" &&
    (Object.values(EventType) as string[]).includes(e.type)
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/events.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add core/events.ts test/core/events.test.ts
git commit -m "feat(core): normalized event contract + runtime guard"
```

---

## Task 2: `_common.sh` + `on-prompt.sh` (first end-to-end slice)

**Files:**
- Create: `test/helpers.ts`
- Create: `adapters/claude-code/hooks/_common.sh`
- Create: `adapters/claude-code/hooks/on-prompt.sh`
- Test: `test/adapters/prompt.test.ts`

- [ ] **Step 1: Write the test helper**

Create `test/helpers.ts`:
```ts
import { join, basename } from "path";
import { mkdtempSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";

const REPO_ROOT = join(import.meta.dir, "..");

export const hookPath = (name: string) =>
  join(REPO_ROOT, "adapters/claude-code/hooks", name);

export function makeHome(): string {
  return mkdtempSync(join(tmpdir(), "agentrpg-test-"));
}

export async function runHook(
  name: string,
  input: object,
  home: string,
  extraEnv: Record<string, string> = {},
) {
  const proc = Bun.spawn(["bash", hookPath(name)], {
    stdin: Buffer.from(JSON.stringify(input)),
    env: { ...process.env, AGENTRPG_HOME: home, ...extraEnv },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { stdout, stderr, code };
}

export function journalLines(home: string, sid: string): any[] {
  const p = join(home, "journal", `${sid}.ndjson`);
  if (!existsSync(p)) return [];
  return readFileSync(p, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

export function repoCache(home: string, sid: string): string | null {
  const p = join(home, "journal", `${sid}.repo`);
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

export { basename };
```

- [ ] **Step 2: Write the failing test**

Create `test/adapters/prompt.test.ts`:
```ts
import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome, basename } from "../helpers";

test("on-prompt emits a prompt event, exit 0, no stdout", async () => {
  const home = makeHome();
  const cwd = "/tmp/cq-test-proj"; // non-git -> repo falls back to basename
  const { code, stdout } = await runHook("on-prompt.sh",
    { session_id: "p1", cwd, hook_event_name: "UserPromptSubmit", prompt: "hi" }, home);

  expect(code).toBe(0);
  expect(stdout).toBe(""); // safety: never write to stdout

  const lines = journalLines(home, "p1");
  expect(lines.length).toBe(1);
  const e = lines[0];
  expect(e.type).toBe("prompt");
  expect(e.source).toBe("claude-code");
  expect(e.session_id).toBe("p1");
  expect(e.repo).toBe(basename(cwd)); // "cq-test-proj"
  expect(e.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/adapters/prompt.test.ts`
Expected: FAIL — script `on-prompt.sh` does not exist (spawn error / empty journal).

- [ ] **Step 4: Write `_common.sh`**

Create `adapters/claude-code/hooks/_common.sh`:
```bash
#!/usr/bin/env bash
# Shared helpers. Sourced by hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="${RPG_SOURCE:-claude-code}"

# resolve_repo SID CWD -> prints repo name.
# Cache hit: read via $(<file) (bash builtin, no spawn).
# Cache miss: ONE git call, then write the cache so later events pay nothing.
resolve_repo() {
  local cache="$RPG_HOME/journal/$1.repo" top repo
  if [ -f "$cache" ]; then printf '%s' "$(<"$cache")"; return; fi
  top="$(git -C "$2" rev-parse --show-toplevel 2>/dev/null)"
  if [ -n "$top" ]; then repo="${top##*/}"; else repo="${2##*/}"; fi
  mkdir -p "$RPG_HOME/journal" 2>/dev/null
  [ -n "$repo" ] && printf '%s' "$repo" > "$cache" 2>/dev/null
  printf '%s' "$repo"
}

# emit_simple TYPE — uses global $input. For prompt / turn_end / session_end.
emit_simple() {
  local sid cwd repo line
  IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
    | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
  [ -z "$sid" ] && sid="unknown"
  mkdir -p "$RPG_HOME/journal" 2>/dev/null
  repo="$(resolve_repo "$sid" "$cwd")"
  line="$(jq -nc --arg source "$SOURCE" --arg sid "$sid" --arg type "$1" --arg repo "$repo" \
    '{ts:(now|todate), source:$source, session_id:$sid, type:$type}
     + (if $repo!="" then {repo:$repo} else {} end)' 2>/dev/null)"
  [ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
}
```

- [ ] **Step 5: Write `on-prompt.sh`**

Create `adapters/claude-code/hooks/on-prompt.sh`:
```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true
emit_simple prompt
exit 0
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test test/adapters/prompt.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add test/helpers.ts adapters/claude-code/hooks/_common.sh adapters/claude-code/hooks/on-prompt.sh test/adapters/prompt.test.ts
git commit -m "feat(adapter): _common.sh helpers + on-prompt hook"
```

---

## Task 3: `on-tool.sh` (action mapping — hot path)

**Files:**
- Create: `adapters/claude-code/hooks/on-tool.sh`
- Test: `test/adapters/tool.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/adapters/tool.test.ts`:
```ts
import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome } from "../helpers";

const base = { cwd: "/tmp/cq-test-proj", hook_event_name: "PostToolUse" };

test.each([
  ["Edit", "edit"],
  ["MultiEdit", "edit"],
  ["Write", "write"],
  ["Bash", "run"],
  ["Read", "read"],
  ["Grep", "search"],
  ["Glob", "search"],
  ["Task", "delegate"],
  ["WebFetch", "other"],
])("maps tool %s -> action %s", async (tool, action) => {
  const home = makeHome();
  const { code, stdout } = await runHook("on-tool.sh",
    { ...base, session_id: "t1", tool_name: tool }, home);
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "t1").at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe(action);
  expect(e.native).toBe(tool);
});

test("captures file_path when present", async () => {
  const home = makeHome();
  await runHook("on-tool.sh",
    { ...base, session_id: "t2", tool_name: "Edit", tool_input: { file_path: "src/a.ts" } }, home);
  const e = journalLines(home, "t2").at(-1);
  expect(e.file).toBe("src/a.ts");
});

test("PostToolUseFailure -> action_fail", async () => {
  const home = makeHome();
  await runHook("on-tool.sh",
    { cwd: base.cwd, session_id: "t3", tool_name: "Bash", hook_event_name: "PostToolUseFailure" }, home);
  const e = journalLines(home, "t3").at(-1);
  expect(e.type).toBe("action_fail");
  expect(e.action).toBe("run");
});

test("malformed stdin still exits 0 and writes nothing harmful", async () => {
  const home = makeHome();
  const proc = Bun.spawn(["bash", new URL("../../adapters/claude-code/hooks/on-tool.sh", import.meta.url).pathname], {
    stdin: Buffer.from("not json"),
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe", stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(stdout).toBe("");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/tool.test.ts`
Expected: FAIL — `on-tool.sh` does not exist.

- [ ] **Step 3: Write `on-tool.sh`**

Create `adapters/claude-code/hooks/on-tool.sh`:
```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true                 # slurp stdin, no cat spawn

IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
repo="$(resolve_repo "$sid" "$cwd")"

line="$(printf '%s' "$input" | jq -c --arg source "$SOURCE" --arg repo "$repo" '
  ({ "Edit":"edit","MultiEdit":"edit","Write":"write","Bash":"run",
     "Read":"read","Grep":"search","Glob":"search","Task":"delegate" }[.tool_name] // "other") as $a |
  { ts:(now|todate), source:$source, session_id:(.session_id // "unknown"),
    type:(if .hook_event_name=="PostToolUseFailure" then "action_fail" else "action" end),
    action:$a, native:(.tool_name // "unknown") }
  + (if $repo != "" then {repo:$repo} else {} end)
  + (if (.tool_input.file_path // "") != "" then {file: .tool_input.file_path} else {} end)
' 2>/dev/null)"
[ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
exit 0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/adapters/tool.test.ts`
Expected: PASS (12 cases).

- [ ] **Step 5: Commit**

```bash
git add adapters/claude-code/hooks/on-tool.sh test/adapters/tool.test.ts
git commit -m "feat(adapter): on-tool hook with action mapping + failure handling"
```

---

## Task 4: `on-session-start.sh` (git repo + cache)

**Files:**
- Create: `adapters/claude-code/hooks/on-session-start.sh`
- Test: `test/adapters/session-start.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/adapters/session-start.test.ts`:
```ts
import { test, expect } from "bun:test";
import { runHook, journalLines, repoCache, makeHome, basename } from "../helpers";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("session_start: git repo resolved, cached, fields present", async () => {
  const home = makeHome();
  const gitdir = mkdtempSync(join(tmpdir(), "cq-gitrepo-"));
  Bun.spawnSync(["git", "init", gitdir]);

  const { code, stdout } = await runHook("on-session-start.sh",
    { session_id: "s1", cwd: gitdir, hook_event_name: "SessionStart", source: "startup", model: "claude-sonnet-4-6" },
    home);

  expect(code).toBe(0);
  expect(stdout).toBe("");

  const e = journalLines(home, "s1").at(-1);
  expect(e.type).toBe("session_start");
  expect(e.repo).toBe(basename(gitdir));
  expect(e.start).toBe("startup");
  expect(e.model).toBe("claude-sonnet-4-6");
  expect(e.cwd).toBe(gitdir);

  expect(repoCache(home, "s1")).toBe(basename(gitdir)); // cache written
});

test("session_start: non-git cwd falls back to basename", async () => {
  const home = makeHome();
  const { code } = await runHook("on-session-start.sh",
    { session_id: "s2", cwd: "/tmp/cq-not-a-repo", hook_event_name: "SessionStart", source: "resume" }, home);
  expect(code).toBe(0);
  const e = journalLines(home, "s2").at(-1);
  expect(e.repo).toBe("cq-not-a-repo");
  expect(e.start).toBe("resume");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/session-start.test.ts`
Expected: FAIL — `on-session-start.sh` does not exist.

- [ ] **Step 3: Write `on-session-start.sh`**

Create `adapters/claude-code/hooks/on-session-start.sh`:
```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd start model < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // "", .source // "", .model // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
mkdir -p "$RPG_HOME/journal" 2>/dev/null

# ONE git call per session; cache repo for every later event (D5/D6).
top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
if [ -n "$top" ]; then repo="${top##*/}"; else repo="${cwd##*/}"; fi
[ -n "$repo" ] && printf '%s' "$repo" > "$RPG_HOME/journal/$sid.repo" 2>/dev/null

line="$(jq -nc --arg source "$SOURCE" --arg sid "$sid" --arg repo "$repo" \
  --arg cwd "$cwd" --arg start "$start" --arg model "$model" '
  {ts:(now|todate), source:$source, session_id:$sid, type:"session_start"}
  + (if $repo !="" then {repo:$repo}   else {} end)
  + (if $cwd  !="" then {cwd:$cwd}     else {} end)
  + (if $start!="" then {start:$start} else {} end)
  + (if $model!="" then {model:$model} else {} end)' 2>/dev/null)"
[ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
exit 0
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/adapters/session-start.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add adapters/claude-code/hooks/on-session-start.sh test/adapters/session-start.test.ts
git commit -m "feat(adapter): on-session-start hook (git repo + cache + fields)"
```

---

## Task 5: `on-stop.sh` + `on-session-end.sh`

**Files:**
- Create: `adapters/claude-code/hooks/on-stop.sh`
- Create: `adapters/claude-code/hooks/on-session-end.sh`
- Test: `test/adapters/lifecycle.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/adapters/lifecycle.test.ts`:
```ts
import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome } from "../helpers";

test("on-stop emits turn_end", async () => {
  const home = makeHome();
  const { code, stdout } = await runHook("on-stop.sh",
    { session_id: "l1", cwd: "/tmp/cq-test-proj", hook_event_name: "Stop" }, home);
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "l1").at(-1).type).toBe("turn_end");
});

test("on-session-end emits session_end", async () => {
  const home = makeHome();
  const { code } = await runHook("on-session-end.sh",
    { session_id: "l2", cwd: "/tmp/cq-test-proj", hook_event_name: "SessionEnd" }, home);
  expect(code).toBe(0);
  expect(journalLines(home, "l2").at(-1).type).toBe("session_end");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/lifecycle.test.ts`
Expected: FAIL — scripts do not exist.

- [ ] **Step 3: Write `on-stop.sh`**

Create `adapters/claude-code/hooks/on-stop.sh`:
```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true
emit_simple turn_end
exit 0
```

- [ ] **Step 4: Write `on-session-end.sh`**

Create `adapters/claude-code/hooks/on-session-end.sh`:
```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true
emit_simple session_end
exit 0
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/adapters/lifecycle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add adapters/claude-code/hooks/on-stop.sh adapters/claude-code/hooks/on-session-end.sh test/adapters/lifecycle.test.ts
git commit -m "feat(adapter): on-stop + on-session-end hooks"
```

---

## Task 6: `settings.snippet.json`

**Files:**
- Create: `adapters/claude-code/settings.snippet.json`
- Test: `test/adapters/settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/adapters/settings.test.ts`:
```ts
import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const snippet = JSON.parse(
  readFileSync(join(import.meta.dir, "../../adapters/claude-code/settings.snippet.json"), "utf8"),
);

test("declares all six hook events", () => {
  const h = snippet.hooks;
  for (const ev of ["SessionStart", "UserPromptSubmit", "PostToolUse", "PostToolUseFailure", "Stop", "SessionEnd"]) {
    expect(h[ev]).toBeDefined();
  }
});

test("PostToolUse has the tool-list matcher; PostToolUseFailure has none", () => {
  expect(snippet.hooks.PostToolUse[0].matcher).toBe("Edit|MultiEdit|Write|Bash|Read|Grep|Glob|Task");
  expect(snippet.hooks.PostToolUseFailure[0].matcher).toBeUndefined();
});

test("commands point at the hooks/ scripts under ~/.agentrpg", () => {
  const cmd = snippet.hooks.PostToolUse[0].hooks[0].command;
  expect(cmd).toBe("~/.agentrpg/adapters/claude-code/hooks/on-tool.sh");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/settings.test.ts`
Expected: FAIL — file not found.

- [ ] **Step 3: Write `settings.snippet.json`**

Create `adapters/claude-code/settings.snippet.json`:
```json
{
  "hooks": {
    "SessionStart":       [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-session-start.sh" } ] } ],
    "UserPromptSubmit":   [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-prompt.sh" } ] } ],
    "PostToolUse":        [ { "matcher": "Edit|MultiEdit|Write|Bash|Read|Grep|Glob|Task", "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-tool.sh" } ] } ],
    "PostToolUseFailure": [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-tool.sh" } ] } ],
    "Stop":               [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-stop.sh" } ] } ],
    "SessionEnd":         [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-session-end.sh" } ] } ]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/adapters/settings.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add adapters/claude-code/settings.snippet.json test/adapters/settings.test.ts
git commit -m "feat(adapter): settings.snippet.json hooks block"
```

---

## Task 7: `tools/inspect.ts` (verification)

**Files:**
- Create: `tools/inspect.ts`
- Test: `test/tools/inspect.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/tools/inspect.test.ts`:
```ts
import { test, expect } from "bun:test";
import { summarize, loadEvents } from "../../tools/inspect";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

function seed(home: string) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s1.ndjson"),
    [
      `{"ts":"2026-06-11T00:00:00Z","source":"claude-code","session_id":"s1","type":"session_start","repo":"commit-quest"}`,
      `{"ts":"2026-06-11T00:00:01Z","source":"claude-code","session_id":"s1","type":"action","action":"edit","repo":"commit-quest","file":"a.ts"}`,
      `not valid json`, // must be skipped
    ].join("\n") + "\n");
  writeFileSync(join(dir, "s2.ndjson"),
    `{"ts":"2026-06-11T00:00:02Z","source":"claude-code","session_id":"s2","type":"prompt","repo":"pos"}\n`);
}

test("loadEvents skips malformed lines and counts sessions by file", () => {
  const home = makeHome();
  seed(home);
  const { events, sessions } = loadEvents(home);
  expect(events.length).toBe(3); // 2 from s1 (1 skipped) + 1 from s2
  expect(sessions).toBe(2);
});

test("summarize reports totals and groupings", () => {
  const home = makeHome();
  seed(home);
  const out = summarize(home);
  expect(out).toContain("events: 3");
  expect(out).toContain("sessions: 2");
  expect(out).toContain("edit: 1");
  expect(out).toContain("commit-quest: 2");
});

test("empty home summarizes to zeros", () => {
  const home = makeHome();
  const out = summarize(home);
  expect(out).toContain("events: 0");
  expect(out).toContain("sessions: 0");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/tools/inspect.test.ts`
Expected: FAIL — cannot find module `../../tools/inspect`.

- [ ] **Step 3: Write `tools/inspect.ts`**

Create `tools/inspect.ts`:
```ts
// Read the journal and print a verification summary. Read-only.
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { isNormalizedEvent, type INormalizedEvent } from "../core/events";

const HOME = process.env.AGENTRPG_HOME || join(process.env.HOME ?? "", ".agentrpg");

export function loadEvents(home: string): { events: INormalizedEvent[]; sessions: number } {
  const dir = join(home, "journal");
  if (!existsSync(dir)) return { events: [], sessions: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith(".ndjson"));
  const events: INormalizedEvent[] = [];
  for (const f of files) {
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const o = JSON.parse(t);
        if (isNormalizedEvent(o)) events.push(o);
      } catch {
        /* skip malformed */
      }
    }
  }
  return { events, sessions: files.length };
}

function countBy(events: INormalizedEvent[], key: keyof INormalizedEvent): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of events) {
    const v = e[key];
    if (v != null) m[String(v)] = (m[String(v)] ?? 0) + 1;
  }
  return m;
}

function fmt(m: Record<string, number>): string {
  const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`);
  return rows.length ? rows.join("\n") : "  (none)";
}

export function summarize(home: string): string {
  const { events, sessions } = loadEvents(home);
  const last10 = events
    .slice(-10)
    .map((e) => `  ${e.ts} ${e.source} ${e.type}${e.action ? ":" + e.action : ""} ${e.repo ?? "-"} ${e.file ?? ""}`.trimEnd())
    .join("\n");
  return [
    `events: ${events.length}  sessions: ${sessions}`,
    `by type:`, fmt(countBy(events, "type")),
    `by action:`, fmt(countBy(events, "action")),
    `by source:`, fmt(countBy(events, "source")),
    `by repo:`, fmt(countBy(events, "repo")),
    `last 10:`, last10 || "  (none)",
  ].join("\n");
}

if (import.meta.main) {
  console.log(summarize(HOME));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/tools/inspect.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/inspect.ts test/tools/inspect.test.ts
git commit -m "feat(tools): inspect.ts journal summary"
```

---

## Task 8: `tools/install.sh`

**Files:**
- Create: `tools/install.sh`
- Test: `test/tools/install.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/tools/install.test.ts`:
```ts
import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { lstatSync, existsSync, readFileSync } from "fs";
import { join } from "path";

const INSTALL = new URL("../../tools/install.sh", import.meta.url).pathname;

async function runInstall(home: string, args: string[]) {
  const proc = Bun.spawn(["bash", INSTALL, ...args], {
    env: { ...process.env, AGENTRPG_HOME: home },
    stdout: "pipe", stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const code = await proc.exited;
  return { stdout, code };
}

test("--link symlinks adapters/tools and sets up the home", async () => {
  const home = makeHome();
  const { code, stdout } = await runInstall(home, ["--link"]);
  expect(code).toBe(0);
  expect(lstatSync(join(home, "adapters")).isSymbolicLink()).toBe(true);
  expect(existsSync(join(home, "adapters/claude-code/hooks/on-tool.sh"))).toBe(true); // resolves through link
  expect(existsSync(join(home, "journal"))).toBe(true);
  expect(existsSync(join(home, "config.json"))).toBe(true);
  expect(stdout).toContain("Merge this");
});

test("copy mode copies real files (not symlinks)", async () => {
  const home = makeHome();
  const { code } = await runInstall(home, []);
  expect(code).toBe(0);
  expect(lstatSync(join(home, "adapters")).isSymbolicLink()).toBe(false);
  expect(existsSync(join(home, "tools/inspect.ts"))).toBe(true);
});

test("does not overwrite an existing config.json", async () => {
  const home = makeHome();
  const cfg = join(home, "config.json");
  Bun.write(cfg, `{"custom":true}`);
  await runInstall(home, ["--link"]);
  expect(JSON.parse(readFileSync(cfg, "utf8")).custom).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/tools/install.test.ts`
Expected: FAIL — `install.sh` does not exist.

- [ ] **Step 3: Write `tools/install.sh`**

Create `tools/install.sh`:
```bash
#!/usr/bin/env bash
# Deploy Commit Quest to $AGENTRPG_HOME. --link = symlink (dev), default = copy (prod).
set -euo pipefail
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"   # repo root (tools/ is one level down)
MODE="copy"; [ "${1:-}" = "--link" ] && MODE="link"

mkdir -p "$RPG_HOME/journal"

deploy() {  # $1 = dir name under repo root
  local src="$SRC/$1" dst="$RPG_HOME/$1"
  rm -rf "$dst"; mkdir -p "$(dirname "$dst")"
  if [ "$MODE" = "link" ]; then ln -s "$src" "$dst"; else cp -R "$src" "$dst"; fi
}

deploy adapters
deploy tools
deploy core

# config: copy default only if absent — never overwrite the user's tuning.
[ -f "$RPG_HOME/config.json" ] || cp "$SRC/config/default.json" "$RPG_HOME/config.json"

# hook scripts must be executable (run via `command` in settings.json).
chmod +x "$SRC"/adapters/claude-code/hooks/*.sh 2>/dev/null || true
if [ "$MODE" = "copy" ]; then chmod +x "$RPG_HOME"/adapters/claude-code/hooks/*.sh 2>/dev/null || true; fi

echo "Installed to $RPG_HOME (mode: $MODE)"
echo "Merge this into ~/.claude/settings.json:"
cat "$SRC/adapters/claude-code/settings.snippet.json"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/tools/install.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/install.sh test/tools/install.test.ts
git commit -m "feat(tools): install.sh (--link dev / copy prod)"
```

---

## Task 9: Integration smoke test + README

**Files:**
- Create: `test/integration/session.test.ts`
- Create: `adapters/claude-code/README.md`
- Create: `README.md`

- [ ] **Step 1: Write the integration test (simulate a full session)**

Create `test/integration/session.test.ts`:
```ts
import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome } from "../helpers";
import { summarize } from "../../tools/inspect";

test("a simulated session produces a coherent journal", async () => {
  const home = makeHome();
  const sid = "sess";
  const cwd = "/tmp/cq-test-proj";

  await runHook("on-session-start.sh", { session_id: sid, cwd, hook_event_name: "SessionStart", source: "startup" }, home);
  await runHook("on-prompt.sh", { session_id: sid, cwd, hook_event_name: "UserPromptSubmit", prompt: "build x" }, home);
  await runHook("on-tool.sh", { session_id: sid, cwd, tool_name: "Read", hook_event_name: "PostToolUse" }, home);
  await runHook("on-tool.sh", { session_id: sid, cwd, tool_name: "Edit", tool_input: { file_path: "a.ts" }, hook_event_name: "PostToolUse" }, home);
  await runHook("on-tool.sh", { session_id: sid, cwd, tool_name: "Bash", hook_event_name: "PostToolUseFailure" }, home);
  await runHook("on-stop.sh", { session_id: sid, cwd, hook_event_name: "Stop" }, home);
  await runHook("on-session-end.sh", { session_id: sid, cwd, hook_event_name: "SessionEnd" }, home);

  const types = journalLines(home, sid).map((e) => e.type);
  expect(types).toEqual([
    "session_start", "prompt", "action", "action", "action_fail", "turn_end", "session_end",
  ]);

  const out = summarize(home);
  expect(out).toContain("events: 7");
  expect(out).toContain("sessions: 1");
});
```

- [ ] **Step 2: Run integration test to verify it passes**

Run: `bun test test/integration/session.test.ts`
Expected: PASS (the scripts already exist).

- [ ] **Step 3: Run the FULL suite**

Run: `bun test`
Expected: all tests PASS across every file.

- [ ] **Step 4: Write `adapters/claude-code/README.md`**

Create `adapters/claude-code/README.md`:
```markdown
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
```

- [ ] **Step 5: Write top-level `README.md`**

Create `README.md`:
```markdown
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

## Known limitations
- `--continue`/`--resume` replays recorded hook stdout and does not re-run hooks, so
  resumed spans may be sparse. (Hooks emit no stdout, so no stale data is injected.)
- `config.json` is inert in Phase 0 (placeholder for later phases).

See `docs/` for the full design, spec, and structure.
```

- [ ] **Step 6: Commit**

```bash
git add test/integration/session.test.ts adapters/claude-code/README.md README.md
git commit -m "test: end-to-end session smoke + docs (README)"
```

---

## Task 10: Manual real-session verification (not automated)

This confirms the Definition of Done item that fixtures can't cover: a real CC session.

- [ ] **Step 1: Install and wire hooks**

Run `tools/install.sh --link`, then merge the printed snippet into `~/.claude/settings.json`.

- [ ] **Step 2: Run one real Claude Code session**

In any project, start CC, send a prompt that causes a few edits/reads/bash calls, then end the session.

- [ ] **Step 3: Inspect the journal**

Run: `bun ~/.agentrpg/tools/inspect.ts`
Expected: a `session_start`, one `prompt` per prompt, `action`/`action_fail` per tool call,
`turn_end` per stop, `session_end`; correct `source`, `type`, `action`, `repo`.

- [ ] **Step 4: Confirm zero impact**

Confirm the session showed no hook output and behaved normally. Spot-check
`~/.agentrpg/journal/<sid>.ndjson`: every line is valid JSON and < 4 KB.

- [ ] **Step 5: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to merge/PR `feat/phase0-journal`.

---

## Self-Review notes (already applied)

- **Spec coverage:** event schema (Task 1), all 6 hook→event mappings incl. session_start
  + source field D3 (Tasks 2–5), matcher asymmetry D4 (Task 6), repo-every-line via
  cache D5 (Tasks 2–4), perf one-jq/now|todate/git-once D6 (Tasks 3–4), safety rules
  exit-0/no-stdout/<4KB (asserted in every adapter test + Task 10), inspect (Task 7),
  install --link/copy D1 (Task 8), TDD fixtures §9, DoD §10 (Tasks 9–10), known
  limitations §11 (README).
- **No placeholders:** every code step contains complete, runnable content.
- **Type/name consistency:** `summarize`/`loadEvents`, `isNormalizedEvent`, `resolve_repo`/
  `emit_simple`, env `AGENTRPG_HOME`/`RPG_SOURCE`, field names (`start`, `native`, `repo`)
  match across tasks and the spec.
