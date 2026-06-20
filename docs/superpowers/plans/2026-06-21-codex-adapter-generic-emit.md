# Codex Adapter + Generic Emit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Codex CLI adapter and a shared, agent-agnostic `generic/emit.sh`, with the existing claude-code adapter converged onto it — a second agent flows through the same journal → reducer → state with zero changes to `core/`.

**Architecture:** Per-agent hooks (bash) parse THAT agent's stdin JSON, map event + tool names to the normalized contract, then call `adapters/generic/emit.sh`, which knows only `core/events.ts` and appends one `INormalizedEvent` NDJSON line. claude-code is refactored to use the same emitter (DRY).

**Tech Stack:** bash + jq (hooks, hot path), Bun + TypeScript (tests). No new runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-21-codex-adapter-generic-emit-design.md`

## Global Constraints

- Runtime deps = **jq + bun only**. No npm runtime packages.
- Hooks: **never write stdout**; **always `exit 0`**; **append-only, one file per session** (`$RPG_HOME/journal/{session_id}.ndjson`); **build JSON with jq** (`--arg`/object construction), never string-concat; **keep each line < 4 KB** (never inline prompt/command/patch text); be light (no network, no reducer; at most one `git` call per session).
- `$RPG_HOME` resolves as `${AGENTRPG_HOME:-$HOME/.agentrpg}`.
- Enum string values in `core/events.ts` ARE the wire strings — emit them verbatim (`session_start`, `action`, `action_fail`, `turn_end`, `prompt`, `edit`, `write`, `run`, `read`, `search`, `delegate`, `other`, and the `CmdTag` values).
- `kebab-case` file names. Arrow-const style is for TS source; bash hooks follow the existing hook style.
- Agent-awareness lives ONLY in `adapters/`. `emit.sh` must never reference an agent's payload shape, event names, or tool names.
- No `any` in tests; reuse `core/events.ts` types and the existing `test/helpers.ts`.

---

## File Structure

- `adapters/generic/emit.sh` — **create**: flag-driven emitter (build + repo-resolve + append).
- `adapters/generic/README.md` — **create**: emit CLI reference.
- `test/helpers.ts` — **modify**: add `adapterHookPath`, `runHookAt`, `runEmit`.
- `test/adapters/generic-emit.test.ts` — **create**: emit.sh tests.
- `adapters/claude-code/hooks/_common.sh` — **modify**: `emit_simple` delegates to `emit.sh`; drop `resolve_repo`.
- `adapters/claude-code/hooks/on-tool.sh` — **modify**: extract fields, call `emit.sh`.
- `adapters/claude-code/hooks/on-session-start.sh` — **modify**: extract fields, call `emit.sh`.
- `adapters/codex/hooks/_common.sh` — **create**: shared header (`SOURCE=codex`, `$EMIT` path).
- `adapters/codex/hooks/on-session-start.sh` — **create**.
- `adapters/codex/hooks/on-prompt.sh` — **create**.
- `adapters/codex/hooks/on-stop.sh` — **create**.
- `adapters/codex/hooks/on-tool.sh` — **create**.
- `adapters/codex/config.snippet.toml` — **create**.
- `adapters/codex/README.md` — **create**.
- `test/adapters/codex-session.test.ts` — **create**.
- `test/adapters/codex-tool.test.ts` — **create**.

claude-code's `on-prompt.sh` / `on-stop.sh` / `on-session-end.sh` already call `emit_simple`, so refactoring `emit_simple` updates them with no per-file change. The installer symlinks/copies the whole `adapters/` dir, so `adapters/codex` and `adapters/generic` deploy automatically — no installer change.

---

## Task 1: Generic emitter (`emit.sh`) + test helpers

**Files:**
- Create: `adapters/generic/emit.sh`
- Modify: `test/helpers.ts`
- Test: `test/adapters/generic-emit.test.ts`

**Interfaces:**
- Produces: `emit.sh` CLI — `emit.sh --type <T> --session <sid> [--source <id>] [--cwd <p>] [--repo <r>] [--start <s>] [--model <m>] [--action <a>] [--native <n>] [--cmd <c>] [--file <f>]`. Appends one NDJSON line to `$AGENTRPG_HOME/journal/<sid>.ndjson`; resolves+caches repo from `--cwd` when `--repo` absent and no cache; emits `cwd`/`start`/`model` only for `--type session_start`; omits empty optional fields; exits 0 always.
- Produces (test helpers): `runEmit(args: string[], home: string, extraEnv?) => {stdout,stderr,code}`; `adapterHookPath(adapter, name)`; `runHookAt(adapter, name, input, home, extraEnv?) => {stdout,stderr,code}`.
- Consumes: `core/events.ts` `isNormalizedEvent`, `EventType`, `AgentAction`.

- [ ] **Step 1: Add test helpers**

Add to `test/helpers.ts` (after the existing `runHook`):

```ts
export const adapterHookPath = (adapter: string, name: string) =>
  join(REPO_ROOT, "adapters", adapter, "hooks", name);

export async function runHookAt(
  adapter: string,
  name: string,
  input: object,
  home: string,
  extraEnv: Record<string, string> = {},
) {
  const proc = Bun.spawn(["bash", adapterHookPath(adapter, name)], {
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

export async function runEmit(
  args: string[],
  home: string,
  extraEnv: Record<string, string> = {},
) {
  const proc = Bun.spawn(["bash", join(REPO_ROOT, "adapters/generic/emit.sh"), ...args], {
    env: { ...process.env, AGENTRPG_HOME: home, ...extraEnv },
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  return { stdout, stderr, code };
}
```

- [ ] **Step 2: Write the failing test**

Create `test/adapters/generic-emit.test.ts`:

```ts
import { test, expect } from "bun:test";
import { runEmit, journalLines, repoCache, makeHome, basename } from "../helpers";
import { isNormalizedEvent, EventType, AgentAction } from "../../core/events";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("emits a valid prompt event with default source", async () => {
  const home = makeHome();
  const { code, stdout } = await runEmit(
    ["--type", "prompt", "--session", "e1", "--cwd", "/tmp/cq-not-a-repo"],
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "e1").at(-1);
  expect(isNormalizedEvent(e)).toBe(true);
  expect(e.type).toBe(EventType.Prompt);
  expect(e.source).toBe("claude-code"); // default
  expect(e.repo).toBe("cq-not-a-repo"); // basename fallback
});

test("--source overrides the adapter id", async () => {
  const home = makeHome();
  await runEmit(["--type", "prompt", "--session", "e2", "--source", "codex"], home);
  expect(journalLines(home, "e2").at(-1).source).toBe("codex");
});

test("session_start resolves + caches a git repo and carries cwd/start/model", async () => {
  const home = makeHome();
  const gitdir = mkdtempSync(join(tmpdir(), "cq-gitrepo-"));
  Bun.spawnSync(["git", "init", gitdir]);
  await runEmit(
    ["--type", "session_start", "--session", "e3", "--cwd", gitdir,
     "--start", "startup", "--model", "claude-opus-4-8"],
    home,
  );
  const e = journalLines(home, "e3").at(-1);
  expect(e.type).toBe(EventType.SessionStart);
  expect(e.repo).toBe(basename(gitdir));
  expect(e.cwd).toBe(gitdir);
  expect(e.start).toBe("startup");
  expect(e.model).toBe("claude-opus-4-8");
  expect(repoCache(home, "e3")).toBe(basename(gitdir));
});

test("action carries action/native/cmd/file; omits empty optionals", async () => {
  const home = makeHome();
  await runEmit(
    ["--type", "action", "--session", "e4", "--repo", "demo",
     "--action", "run", "--native", "Bash", "--cmd", "force_push"],
    home,
  );
  const e = journalLines(home, "e4").at(-1);
  expect(e.type).toBe(EventType.Action);
  expect(e.action).toBe(AgentAction.Run);
  expect(e.native).toBe("Bash");
  expect(e.cmd).toBe("force_push");
  expect(e.file).toBeUndefined();
  expect(e.cwd).toBeUndefined(); // cwd only on session_start
});

test("a cached repo is reused without --cwd", async () => {
  const home = makeHome();
  await runEmit(["--type", "session_start", "--session", "e5", "--repo", "cached-repo"], home);
  await runEmit(["--type", "prompt", "--session", "e5"], home);
  expect(journalLines(home, "e5").at(-1).repo).toBe("cached-repo");
});

test("missing --type writes nothing and exits 0", async () => {
  const home = makeHome();
  const { code, stdout } = await runEmit(["--session", "e6"], home);
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "e6").length).toBe(0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/adapters/generic-emit.test.ts`
Expected: FAIL (emit.sh does not exist).

- [ ] **Step 4: Write `adapters/generic/emit.sh`**

```bash
#!/usr/bin/env bash
# Generic, agent-agnostic emitter. Builds one INormalizedEvent (core/events.ts) NDJSON line and
# appends it. Knows the normalized contract only — never an agent's payload, events, or tool names.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"

type="" sid="" source="${RPG_SOURCE:-claude-code}" repo="" cwd="" start="" model=""
action="" native="" cmd="" file=""
while [ $# -gt 0 ]; do
  case "$1" in
    --type)    type="$2";   shift 2;;
    --session) sid="$2";    shift 2;;
    --source)  source="$2"; shift 2;;
    --repo)    repo="$2";   shift 2;;
    --cwd)     cwd="$2";    shift 2;;
    --start)   start="$2";  shift 2;;
    --model)   model="$2";  shift 2;;
    --action)  action="$2"; shift 2;;
    --native)  native="$2"; shift 2;;
    --cmd)     cmd="$2";    shift 2;;
    --file)    file="$2";   shift 2;;
    *) shift;;
  esac
done
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0
mkdir -p "$RPG_HOME/journal" 2>/dev/null

# Repo: --repo wins; else the session cache; else ONE git call from --cwd, then cache it.
if [ -z "$repo" ]; then
  cache="$RPG_HOME/journal/$sid.repo"
  if [ -f "$cache" ]; then
    repo="$(<"$cache")"
  elif [ -n "$cwd" ]; then
    top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)"
    if [ -n "$top" ]; then repo="${top##*/}"; else repo="${cwd##*/}"; fi
    [ -n "$repo" ] && printf '%s' "$repo" > "$cache" 2>/dev/null
  fi
fi

line="$(jq -nc \
  --arg source "$source" --arg sid "$sid" --arg type "$type" --arg repo "$repo" \
  --arg cwd "$cwd" --arg start "$start" --arg model "$model" \
  --arg action "$action" --arg native "$native" --arg cmd "$cmd" --arg file "$file" '
  {ts:(now|todate), source:$source, session_id:$sid, type:$type}
  + (if $repo  !="" then {repo:$repo}     else {} end)
  + (if $action!="" then {action:$action} else {} end)
  + (if $native!="" then {native:$native} else {} end)
  + (if $cmd   !="" then {cmd:$cmd}       else {} end)
  + (if $file  !="" then {file:$file}     else {} end)
  + (if $type=="session_start" and $cwd  !="" then {cwd:$cwd}     else {} end)
  + (if $type=="session_start" and $start!="" then {start:$start} else {} end)
  + (if $type=="session_start" and $model!="" then {model:$model} else {} end)
' 2>/dev/null)"
[ -n "$line" ] && printf '%s\n' "$line" >> "$RPG_HOME/journal/$sid.ndjson" 2>/dev/null
exit 0
```

- [ ] **Step 5: Make it executable**

Run: `chmod +x adapters/generic/emit.sh`

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test test/adapters/generic-emit.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add adapters/generic/emit.sh test/helpers.ts test/adapters/generic-emit.test.ts
git commit -m "feat(adapters): generic agent-agnostic emit.sh"
```

---

## Task 2: Converge claude-code onto `emit.sh`

**Files:**
- Modify: `adapters/claude-code/hooks/_common.sh`
- Modify: `adapters/claude-code/hooks/on-tool.sh`
- Modify: `adapters/claude-code/hooks/on-session-start.sh`
- Test: `test/adapters/*.test.ts` (existing — regression guard, unchanged)

**Interfaces:**
- Consumes: `emit.sh` (Task 1).
- Produces: identical journal output to before; `$EMIT` and `SOURCE` available to claude-code hooks via `_common.sh`.

- [ ] **Step 1: Run existing claude-code tests to confirm the green baseline**

Run: `bun test test/adapters/tool.test.ts test/adapters/session-start.test.ts test/adapters/prompt.test.ts test/adapters/lifecycle.test.ts`
Expected: PASS (baseline before refactor).

- [ ] **Step 2: Rewrite `_common.sh` to delegate to `emit.sh`**

Replace the whole file with:

```bash
#!/usr/bin/env bash
# Shared helpers. Sourced by claude-code hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="${RPG_SOURCE:-claude-code}"
EMIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)/emit.sh"

# emit_simple TYPE — uses global $input. For prompt / turn_end / session_end.
emit_simple() {
  local sid cwd
  IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
    | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
  [ -z "$sid" ] && sid="unknown"
  "$EMIT" --type "$1" --source "$SOURCE" --session "$sid" --cwd "$cwd"
}
```

(`resolve_repo` is gone — `emit.sh` owns repo resolution.)

- [ ] **Step 3: Rewrite `on-session-start.sh`**

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd start model < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // "", .source // "", .model // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$start" ] && args+=(--start "$start")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
exit 0
```

- [ ] **Step 4: Rewrite `on-tool.sh`**

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd type action native cmd file < <(printf '%s' "$input" | jq -r '
  ({ "Edit":"edit","MultiEdit":"edit","Write":"write","Bash":"run",
     "Read":"read","Grep":"search","Glob":"search","Task":"delegate" }[.tool_name] // "other") as $a |
  (.tool_input.command // "") as $c |
  (if .tool_name == "Bash" then
     (if   ($c|test("git\\s+rebase\\b.*--onto")) then "git_rebase_onto"
      elif ($c|test("git\\s+rebase\\b.*(-i|--interactive)")) then "git_rebase_i"
      elif ($c|test("git\\s+cherry-pick")) then "cherry_pick"
      elif ($c|test("git\\s+push\\b.*(--force|-f\\b)")) then "force_push"
      elif ($c|test("git\\s+bisect")) then "bisect"
      elif ($c|test("git\\s+reflog")) then "reflog"
      elif ($c|test("git\\s+stash")) then "stash"
      elif ($c|test("gh\\s+pr\\s+merge")) then "pr_merge"
      elif ($c|test("git\\s+(push|merge)\\b.*\\b(main|master|prod|production|uat)\\b")) then "cowboy"
      elif ($c|test("(bun|npm|pnpm|yarn)\\s+(run\\s+)?test|pytest|go\\s+test|jest|vitest|cargo\\s+test|mocha|rspec")) then "test_run"
      else "" end)
   else "" end) as $cmd |
  (if .hook_event_name=="PostToolUseFailure" then "action_fail" else "action" end) as $type |
  [(.session_id // "unknown"), (.cwd // ""), $type, $a,
   (.tool_name // "unknown"), $cmd, (.tool_input.file_path // "")] | @tsv
' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0

args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
[ -n "$cmd" ]  && args+=(--cmd "$cmd")
[ -n "$file" ] && args+=(--file "$file")
"$EMIT" "${args[@]}"
exit 0
```

- [ ] **Step 5: Run the existing claude-code tests to verify behavior is unchanged**

Run: `bun test test/adapters/tool.test.ts test/adapters/session-start.test.ts test/adapters/prompt.test.ts test/adapters/lifecycle.test.ts`
Expected: PASS (same as the Step 1 baseline).

- [ ] **Step 6: Run the full suite**

Run: `bun test`
Expected: PASS (no regressions anywhere).

- [ ] **Step 7: Commit**

```bash
git add adapters/claude-code/hooks/_common.sh adapters/claude-code/hooks/on-session-start.sh adapters/claude-code/hooks/on-tool.sh
git commit -m "refactor(adapters): converge claude-code hooks onto generic emit.sh"
```

---

## Task 3: Codex session + prompt + stop hooks

**Files:**
- Create: `adapters/codex/hooks/_common.sh`
- Create: `adapters/codex/hooks/on-session-start.sh`
- Create: `adapters/codex/hooks/on-prompt.sh`
- Create: `adapters/codex/hooks/on-stop.sh`
- Test: `test/adapters/codex-session.test.ts`

**Interfaces:**
- Consumes: `emit.sh` (Task 1); test helper `runHookAt` (Task 1).
- Produces: codex hooks that emit `session_start` (with `source`→start, model, repo from cwd), `prompt`, `turn_end`, all with `source: "codex"`.

- [ ] **Step 1: Write the failing test**

Create `test/adapters/codex-session.test.ts`:

```ts
import { test, expect } from "bun:test";
import { runHookAt, journalLines, repoCache, makeHome, basename } from "../helpers";
import { EventType } from "../../core/events";
import { mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

test("codex SessionStart: repo resolved + cached, start/model/cwd present, source=codex", async () => {
  const home = makeHome();
  const gitdir = mkdtempSync(join(tmpdir(), "cq-gitrepo-"));
  Bun.spawnSync(["git", "init", gitdir]);
  const { code, stdout } = await runHookAt(
    "codex",
    "on-session-start.sh",
    {
      session_id: "x1",
      cwd: gitdir,
      hook_event_name: "SessionStart",
      source: "startup",
      model: "gpt-5-codex",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "x1").at(-1);
  expect(e.type).toBe(EventType.SessionStart);
  expect(e.source).toBe("codex");
  expect(e.repo).toBe(basename(gitdir));
  expect(e.start).toBe("startup");
  expect(e.model).toBe("gpt-5-codex");
  expect(repoCache(home, "x1")).toBe(basename(gitdir));
});

test("codex UserPromptSubmit -> prompt (source=codex)", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "codex",
    "on-prompt.sh",
    { session_id: "x2", cwd: "/tmp/cq-not-a-repo", hook_event_name: "UserPromptSubmit", prompt: "hi" },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "x2").at(-1);
  expect(e.type).toBe(EventType.Prompt);
  expect(e.source).toBe("codex");
});

test("codex Stop -> turn_end", async () => {
  const home = makeHome();
  await runHookAt(
    "codex",
    "on-stop.sh",
    { session_id: "x3", cwd: "/tmp/cq-not-a-repo", hook_event_name: "Stop" },
    home,
  );
  expect(journalLines(home, "x3").at(-1).type).toBe(EventType.TurnEnd);
});

test("codex prompt: malformed stdin still exits 0 with no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    ["bash", new URL("../../adapters/codex/hooks/on-prompt.sh", import.meta.url).pathname],
    {
      stdin: Buffer.from("not json"),
      env: { ...process.env, AGENTRPG_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  const stdout = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(stdout).toBe("");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/codex-session.test.ts`
Expected: FAIL (codex hooks do not exist).

- [ ] **Step 3: Write `adapters/codex/hooks/_common.sh`**

```bash
#!/usr/bin/env bash
# Shared helpers for the Codex adapter. Sourced by codex hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="codex"
EMIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)/emit.sh"
```

- [ ] **Step 4: Write `adapters/codex/hooks/on-session-start.sh`**

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd start model < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // "", .source // "", .model // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$start" ] && args+=(--start "$start")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
exit 0
```

- [ ] **Step 5: Write `adapters/codex/hooks/on-prompt.sh`**

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type prompt --source "$SOURCE" --session "$sid" --cwd "$cwd"
exit 0
```

- [ ] **Step 6: Write `adapters/codex/hooks/on-stop.sh`**

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type turn_end --source "$SOURCE" --session "$sid" --cwd "$cwd"
exit 0
```

- [ ] **Step 7: Make hooks executable**

Run: `chmod +x adapters/codex/hooks/*.sh`

- [ ] **Step 8: Run test to verify it passes**

Run: `bun test test/adapters/codex-session.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add adapters/codex/hooks/_common.sh adapters/codex/hooks/on-session-start.sh adapters/codex/hooks/on-prompt.sh adapters/codex/hooks/on-stop.sh test/adapters/codex-session.test.ts
git commit -m "feat(adapters): codex session/prompt/stop hooks"
```

---

## Task 4: Codex tool hook (mapping + apply_patch + failure)

**Files:**
- Create: `adapters/codex/hooks/on-tool.sh`
- Test: `test/adapters/codex-tool.test.ts`

**Interfaces:**
- Consumes: `emit.sh` (Task 1); `_common.sh` (Task 3); `runHookAt` (Task 1).
- Produces: `action` / `action_fail` events with `action` mapped from Codex `tool_name`; `apply_patch` → `write` (pure `*** Add File:`) or `edit`, with `--file` from the patch header; Bash → `run` + `CmdTag`; failure inferred from `tool_response`.

- [ ] **Step 1: Write the failing test**

Create `test/adapters/codex-tool.test.ts`:

```ts
import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

const base = { cwd: "/tmp/cq-test-proj", hook_event_name: "PostToolUse" };

test.each([
  ["apply_patch", { patch: "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** End Patch" }, "edit", "src/a.ts"],
  ["apply_patch", { patch: "*** Begin Patch\n*** Add File: src/new.ts\n+export const x = 1;\n*** End Patch" }, "write", "src/new.ts"],
])("apply_patch maps to %s#%s", async (tool, tool_input, action, file) => {
  const home = makeHome();
  const sid = `p-${action}`;
  const { code, stdout } = await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: sid, tool_name: tool, tool_input },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, sid).at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe(action);
  expect(e.native).toBe("apply_patch");
  expect(e.file).toBe(file);
});

test.each([
  ["shell", "run"],
  ["exec", "run"],
  ["read", "read"],
  ["WebSearch", "search"],
  ["mcp__github__list_issues", "other"],
  ["something_else", "other"],
])("maps tool %s -> action %s", async (tool, action) => {
  const home = makeHome();
  const { code } = await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: "m1", tool_name: tool },
    home,
  );
  expect(code).toBe(0);
  const e = journalLines(home, "m1").at(-1);
  expect(e.action).toBe(action);
  expect(e.native).toBe(tool);
});

test("shell command classifies cmd (force_push) and never stores the raw command", async () => {
  const home = makeHome();
  const command = "git push --force origin secret-branch";
  await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: "c1", tool_name: "shell", tool_input: { command } },
    home,
  );
  const e = journalLines(home, "c1").at(-1);
  expect(e.action).toBe("run");
  expect(e.cmd).toBe("force_push");
});

test("tool_response error -> action_fail", async () => {
  const home = makeHome();
  await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: "f1", tool_name: "shell", tool_input: { command: "ls" }, tool_response: { error: "boom" } },
    home,
  );
  expect(journalLines(home, "f1").at(-1).type).toBe("action_fail");
});

test("tool_response non-zero exit_code -> action_fail", async () => {
  const home = makeHome();
  await runHookAt(
    "codex",
    "on-tool.sh",
    { ...base, session_id: "f2", tool_name: "shell", tool_input: { command: "false" }, tool_response: { exit_code: 1 } },
    home,
  );
  expect(journalLines(home, "f2").at(-1).type).toBe("action_fail");
});

test("malformed stdin still exits 0 with no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    ["bash", new URL("../../adapters/codex/hooks/on-tool.sh", import.meta.url).pathname],
    { stdin: Buffer.from("not json"), env: { ...process.env, AGENTRPG_HOME: home }, stdout: "pipe", stderr: "pipe" },
  );
  const stdout = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(stdout).toBe("");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/codex-tool.test.ts`
Expected: FAIL (on-tool.sh does not exist).

- [ ] **Step 3: Write `adapters/codex/hooks/on-tool.sh`**

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd type action native cmd file < <(printf '%s' "$input" | jq -r '
  (.tool_name // "") as $t |
  # apply_patch: read the patch text field-agnostically; markers drive action + file.
  (.tool_input.patch // .tool_input.input // .tool_input.changes // (.tool_input | tostring)) as $patch |
  (.tool_input.command // "") as $c |
  (if   $t == "apply_patch" then
        (if ($patch|test("\\*\\*\\* Add File:")) and (($patch|test("\\*\\*\\* (Update|Delete) File:"))|not)
         then "write" else "edit" end)
   elif ($t|test("^(bash|shell|exec|local_shell)$";"i")) then "run"
   elif ($t|test("^(read|read_file)$";"i")) then "read"
   elif ($t|test("websearch|web_search";"i")) then "search"
   else "other" end) as $a |
  (if ($t|test("^(bash|shell|exec|local_shell)$";"i")) then
     (if   ($c|test("git\\s+rebase\\b.*--onto")) then "git_rebase_onto"
      elif ($c|test("git\\s+rebase\\b.*(-i|--interactive)")) then "git_rebase_i"
      elif ($c|test("git\\s+cherry-pick")) then "cherry_pick"
      elif ($c|test("git\\s+push\\b.*(--force|-f\\b)")) then "force_push"
      elif ($c|test("git\\s+bisect")) then "bisect"
      elif ($c|test("git\\s+reflog")) then "reflog"
      elif ($c|test("git\\s+stash")) then "stash"
      elif ($c|test("gh\\s+pr\\s+merge")) then "pr_merge"
      elif ($c|test("git\\s+(push|merge)\\b.*\\b(main|master|prod|production|uat)\\b")) then "cowboy"
      elif ($c|test("(bun|npm|pnpm|yarn)\\s+(run\\s+)?test|pytest|go\\s+test|jest|vitest|cargo\\s+test|mocha|rspec")) then "test_run"
      else "" end)
   else "" end) as $cmd |
  (if $t == "apply_patch" then
     (($patch | capture("\\*\\*\\* (Add|Update|Delete|Move to) File: (?<p>[^\\n]+)").p) // "" | gsub("^\\s+|\\s+$";""))
   else (.tool_input.file_path // "") end) as $file |
  (if ((.tool_response.error // "") != "")
      or ((.tool_response.exit_code // 0) != 0)
      or ((.tool_response.success) == false)
   then "action_fail" else "action" end) as $type |
  [(.session_id // "unknown"), (.cwd // ""), $type, $a, $t, $cmd, $file] | @tsv
' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0

args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
[ -n "$cmd" ]  && args+=(--cmd "$cmd")
[ -n "$file" ] && args+=(--file "$file")
"$EMIT" "${args[@]}"
exit 0
```

- [ ] **Step 4: Make it executable**

Run: `chmod +x adapters/codex/hooks/on-tool.sh`

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/adapters/codex-tool.test.ts`
Expected: PASS. If the `apply_patch` file/path capture fails, the captured `e.file` assertion pinpoints it — adjust the `capture(...)` regex (e.g. the path char class) until green; do not change the test expectations.

- [ ] **Step 6: Run the full suite**

Run: `bun test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add adapters/codex/hooks/on-tool.sh test/adapters/codex-tool.test.ts
git commit -m "feat(adapters): codex tool hook (action mapping, apply_patch, failure)"
```

---

## Task 5: Config snippet + READMEs

**Files:**
- Create: `adapters/codex/config.snippet.toml`
- Create: `adapters/codex/README.md`
- Create: `adapters/generic/README.md`

**Interfaces:**
- Consumes: the codex hooks (Tasks 3-4), `emit.sh` (Task 1).
- Produces: user-facing install snippet + docs. No code; verified by a presence test.

- [ ] **Step 1: Write the failing test**

Append to `test/adapters/codex-session.test.ts`:

```ts
import { existsSync, readFileSync } from "fs";
import { join } from "path";

test("codex config snippet wires all four hooks", () => {
  const root = join(import.meta.dir, "../../adapters/codex");
  expect(existsSync(join(root, "README.md"))).toBe(true);
  const toml = readFileSync(join(root, "config.snippet.toml"), "utf8");
  for (const h of ["on-session-start.sh", "on-prompt.sh", "on-tool.sh", "on-stop.sh"]) {
    expect(toml).toContain(h);
  }
  for (const e of ["SessionStart", "UserPromptSubmit", "PostToolUse", "Stop"]) {
    expect(toml).toContain(e);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/codex-session.test.ts`
Expected: FAIL (snippet/README missing).

- [ ] **Step 3: Write `adapters/codex/config.snippet.toml`**

```toml
# Agent Quest — Codex adapter hooks.
# Paste into ~/.codex/config.toml (or ~/.codex/hooks.json equivalent). The installer deploys the
# adapter to ~/.agentrpg/adapters/codex; emit.sh resolves automatically from there.

[[hooks.SessionStart]]
matcher = "startup|resume"
[[hooks.SessionStart.hooks]]
type = "command"
command = "~/.agentrpg/adapters/codex/hooks/on-session-start.sh"

[[hooks.UserPromptSubmit]]
[[hooks.UserPromptSubmit.hooks]]
type = "command"
command = "~/.agentrpg/adapters/codex/hooks/on-prompt.sh"

[[hooks.PostToolUse]]
matcher = "apply_patch|shell|exec|local_shell|read|read_file|WebSearch"
[[hooks.PostToolUse.hooks]]
type = "command"
command = "~/.agentrpg/adapters/codex/hooks/on-tool.sh"

[[hooks.Stop]]
[[hooks.Stop.hooks]]
type = "command"
command = "~/.agentrpg/adapters/codex/hooks/on-stop.sh"
```

- [ ] **Step 4: Write `adapters/codex/README.md`**

```markdown
# Codex adapter

Maps OpenAI Codex CLI hook events to Agent Quest's normalized journal via `../generic/emit.sh`.

## Install

1. Install Agent Quest (deploys this adapter to `~/.agentrpg/adapters/codex`).
2. Paste `config.snippet.toml` into `~/.codex/config.toml`.
3. Start a Codex session — events append to `~/.agentrpg/journal/<session_id>.ndjson`.

## Event mapping

| Codex hook | event | notes |
|---|---|---|
| `SessionStart` | `session_start` | `source`→start, `model`, repo from `cwd` |
| `UserPromptSubmit` | `prompt` | prompt text is NOT stored |
| `PostToolUse` | `action` / `action_fail` | failure inferred from `tool_response` |
| `Stop` | `turn_end` | |

Tool → action: `apply_patch`→`write` (pure new file) or `edit`; `shell`/`exec`/`bash`→`run`
(+ git/test command tag); `read`→`read`; `WebSearch`→`search`; `mcp__*` and others→`other`.

## Known approximations (refine against a real payload)

- Failure is heuristic: `tool_response.error`, non-zero `exit_code`, or `success == false`.
- `apply_patch` patch text is read field-agnostically (`patch`/`input`/`changes`/whole input).
- No `SessionEnd` hook in Codex; no statusline (the companion app renders from `state.json`).
```

- [ ] **Step 5: Write `adapters/generic/README.md`**

```markdown
# Generic emit

`emit.sh` is the agent-agnostic emitter. Every adapter's hooks parse their own payload, then call it
to append one normalized event (`core/events.ts`) to `~/.agentrpg/journal/<session_id>.ndjson`. It
knows the contract only — never an agent's payload, event names, or tool names.

## Usage

    emit.sh --type <session_start|prompt|action|action_fail|turn_end|session_end> --session <sid> \
            [--source <id>] [--cwd <path>] [--repo <name>] [--start <s>] [--model <m>] \
            [--action <edit|write|run|read|search|delegate|other>] [--native <tool>] \
            [--cmd <CmdTag>] [--file <path>]

- `--source` defaults to `$RPG_SOURCE`, else `claude-code`.
- Repo: `--repo` wins; else the session cache; else one `git` call from `--cwd`, then cached.
- `cwd`/`start`/`model` are emitted only for `session_start`. Empty optionals are omitted.

Adding an agent = a new `adapters/<agent>/` parsing layer that calls this — no change here. Cursor and
Copilot CLI both use command hooks, so the same pattern applies (see the design spec appendix).
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test test/adapters/codex-session.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the full suite + formatter**

Run: `bun test && bun run format`
Expected: PASS; formatter clean.

- [ ] **Step 8: Commit**

```bash
git add adapters/codex/config.snippet.toml adapters/codex/README.md adapters/generic/README.md test/adapters/codex-session.test.ts
git commit -m "docs(adapters): codex config snippet + codex/generic READMEs"
```

---

## Final verification

- [ ] Run `bun test` — full suite green (existing + new emit/codex tests).
- [ ] Run `bun run format:check` (or `bun run format`) — clean.
- [ ] Confirm `adapters/generic/emit.sh` and `adapters/codex/hooks/*.sh` are executable (`ls -l`).
- [ ] Open a PR from a `feat/codex-adapter` branch into `main` (branch protection requires it).
- [ ] Close issue #6 referencing the PR.
