# Cursor Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Cursor (1.7+) adapter — a thin per-agent hook layer that parses Cursor hook payloads and calls the existing `adapters/generic/emit.sh` to append normalized journal events.

**Architecture:** Each Cursor hook (JSON on stdin) → a bash+jq script in `adapters/cursor/hooks/` → one `emit.sh` call. No change to `emit.sh` or `core/`; `--source cursor` is a free string the reducer already buckets into `stats.by_source`. Mirrors the proven Codex adapter (`adapters/codex/`).

**Tech Stack:** bash 3.2, `jq`, Bun (`bun test`). No npm runtime deps.

## Global Constraints

Copied verbatim from the spec + CLAUDE.md §4. Every task implicitly includes these:

- **Hook safety (non-negotiable):** never write stdout; always `exit 0`; append-only to one `journal/<sid>.ndjson`; build JSON with `jq` (`--arg`), never string-concat; keep lines < 4 KB (no prompt/command text inline); no network; no reducer.
- **STX separator:** parse multiple jq outputs with `IFS=$'\002' read ...` against a jq `... | join("")` so empty middle fields survive `IFS` read on bash 3.2.
- **Session key = `conversation_id`** on every hook (`--session`); `sessionStart`/`sessionEnd` own `session_id` is ignored. Exception: `on-subagent.sh` uses `.conversation_id // .parent_conversation_id` (subagentStart carries only the parent id).
- **Event wire strings** (from `core/events.ts`, never invent new): `session_start`, `prompt`, `action`, `action_fail`, `turn_end`, `session_end`. **Action wire strings:** `edit`, `write`, `run`, `read`, `search`, `delegate`, `other`.
- **`--source` value is exactly `cursor`.**
- **Never store prompt or raw command text** — shell commands pass through `cmd_tag` (a `CmdTag`), never the literal command.
- **kebab-case** filenames. Tests avoid explicit `any` (prefer typed shapes).
- Each hook script header is exactly:
  ```sh
  #!/usr/bin/env bash
  DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
  IFS= read -rd '' input || true
  ```

---

### Task 1: Scaffold (`_common.sh`) + `on-session-start.sh`

Establishes the adapter dir and the session-start hook. `sessionStart` has no `cwd` — the working dir is `workspace_roots[0]`; `model` is a common field. emit emits `cwd`/`model` only for `session_start` and derives+caches `repo` from `cwd`.

**Files:**
- Create: `adapters/cursor/hooks/_common.sh`
- Create: `adapters/cursor/hooks/on-session-start.sh`
- Test: `test/adapters/cursor-session.test.ts`

**Interfaces:**
- Consumes: `adapters/generic/emit.sh` CLI — `emit.sh --type session_start --source cursor --session <id> --cwd <path> [--model <m>]`.
- Produces: `_common.sh` exports (when sourced) `RPG_HOME`, `SOURCE="cursor"`, `EMIT` (absolute path to `generic/emit.sh`). Hook reads stdin var `input`. Journal key = `conversation_id`.

- [ ] **Step 1: Write the failing test**

Create `test/adapters/cursor-session.test.ts`:

```ts
import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

test("sessionStart -> session_start keyed on conversation_id; cwd from workspace_roots[0]; model emitted; own session_id ignored", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-session-start.sh",
    {
      conversation_id: "conv-1",
      session_id: "sess-ignored",
      workspace_roots: ["/tmp/cq-cursor-proj"],
      model: "claude-4",
      hook_event_name: "sessionStart",
    },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "sess-ignored")).toHaveLength(0);
  const e = journalLines(home, "conv-1").at(-1);
  expect(e.type).toBe("session_start");
  expect(e.source).toBe("cursor");
  expect(e.model).toBe("claude-4");
  expect(e.cwd).toBe("/tmp/cq-cursor-proj");
  expect(e.repo).toBe("cq-cursor-proj");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/cursor-session.test.ts`
Expected: FAIL (script does not exist → non-zero exit / empty journal).

- [ ] **Step 3: Create `_common.sh`**

```sh
#!/usr/bin/env bash
# Shared helpers for the Cursor adapter. Sourced by cursor hook scripts — not executed directly.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="cursor"
EMIT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../generic" && pwd)/emit.sh"
```

- [ ] **Step 4: Create `on-session-start.sh`**

```sh
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

# STX (\x02) separator so IFS-read preserves empty fields (e.g. empty model).
IFS=$'\002' read -r sid cwd model < <(printf '%s' "$input" \
  | jq -rj '[.conversation_id // "unknown", (.workspace_roots[0] // ""), .model // ""] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type session_start --source "$SOURCE" --session "$sid" --cwd "$cwd")
[ -n "$model" ] && args+=(--model "$model")
"$EMIT" "${args[@]}"
exit 0
```

- [ ] **Step 5: Make scripts executable**

Run: `chmod +x adapters/cursor/hooks/*.sh`

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test test/adapters/cursor-session.test.ts`
Expected: PASS (1 test).

- [ ] **Step 7: Commit**

```bash
git add adapters/cursor/hooks/_common.sh adapters/cursor/hooks/on-session-start.sh test/adapters/cursor-session.test.ts
git commit -m "feat(cursor): add adapter scaffold and session_start hook"
```

---

### Task 2: Lifecycle hooks — `on-prompt.sh`, `on-stop.sh`, `on-session-end.sh`

Three near-identical hooks that parse only `conversation_id` and emit one event each. `beforeSubmitPrompt` carries the prompt text — it is never read.

**Files:**
- Create: `adapters/cursor/hooks/on-prompt.sh`
- Create: `adapters/cursor/hooks/on-stop.sh`
- Create: `adapters/cursor/hooks/on-session-end.sh`
- Test: `test/adapters/cursor-session.test.ts` (append)

**Interfaces:**
- Consumes: `_common.sh` (`SOURCE`, `EMIT`); `emit.sh --type <prompt|turn_end|session_end> --source cursor --session <id>`.
- Produces: events `prompt` (from `beforeSubmitPrompt`), `turn_end` (from `stop`), `session_end` (from `sessionEnd`).

- [ ] **Step 1: Write the failing tests** (append to `test/adapters/cursor-session.test.ts`)

```ts
test("beforeSubmitPrompt -> prompt; prompt text not stored", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-prompt.sh",
    { conversation_id: "c-p", prompt: "do the SECRET thing", hook_event_name: "beforeSubmitPrompt" },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "c-p").at(-1);
  expect(e.type).toBe("prompt");
  expect(e.source).toBe("cursor");
  expect(JSON.stringify(e)).not.toContain("SECRET");
});

test("stop -> turn_end", async () => {
  const home = makeHome();
  await runHookAt("cursor", "on-stop.sh", { conversation_id: "c-s", status: "completed", hook_event_name: "stop" }, home);
  expect(journalLines(home, "c-s").at(-1).type).toBe("turn_end");
});

test("sessionEnd -> session_end keyed on conversation_id", async () => {
  const home = makeHome();
  await runHookAt(
    "cursor",
    "on-session-end.sh",
    { conversation_id: "c-e", session_id: "sess-ignored", reason: "closed", hook_event_name: "sessionEnd" },
    home,
  );
  expect(journalLines(home, "sess-ignored")).toHaveLength(0);
  expect(journalLines(home, "c-e").at(-1).type).toBe("session_end");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/adapters/cursor-session.test.ts`
Expected: the 3 new tests FAIL (scripts missing); Task 1 test still passes.

- [ ] **Step 3: Create `on-prompt.sh`**

```sh
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\002' read -r sid < <(printf '%s' "$input" \
  | jq -rj '[.conversation_id // "unknown"] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type prompt --source "$SOURCE" --session "$sid"
exit 0
```

- [ ] **Step 4: Create `on-stop.sh`**

```sh
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\002' read -r sid < <(printf '%s' "$input" \
  | jq -rj '[.conversation_id // "unknown"] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type turn_end --source "$SOURCE" --session "$sid"
exit 0
```

- [ ] **Step 5: Create `on-session-end.sh`**

```sh
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\002' read -r sid < <(printf '%s' "$input" \
  | jq -rj '[.conversation_id // "unknown"] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
"$EMIT" --type session_end --source "$SOURCE" --session "$sid"
exit 0
```

- [ ] **Step 6: Make scripts executable + run tests**

Run: `chmod +x adapters/cursor/hooks/*.sh && bun test test/adapters/cursor-session.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add adapters/cursor/hooks/on-prompt.sh adapters/cursor/hooks/on-stop.sh adapters/cursor/hooks/on-session-end.sh test/adapters/cursor-session.test.ts
git commit -m "feat(cursor): add prompt, stop, and session_end hooks"
```

---

### Task 3: Tool hook — `on-tool.sh` (`postToolUse` / `postToolUseFailure`)

One script wired to both tool hooks. Type comes from `hook_event_name` (`postToolUseFailure` → `action_fail`, else `action`). Tool → action map per spec §5.5; shell commands run through `cmd_tag` (the raw command is never stored); `--native` preserves the raw `tool_name`.

**Files:**
- Create: `adapters/cursor/hooks/on-tool.sh`
- Test: `test/adapters/cursor-tool.test.ts`

**Interfaces:**
- Consumes: `_common.sh`; `adapters/generic/cmd-tag.jq` (the `cmd_tag(command)` jq function, loaded via `jq -L <generic-dir> 'include "cmd-tag";'`); `emit.sh --type <action|action_fail> --source cursor --session <id> --cwd <path> --action <a> --native <tool> [--cmd <CmdTag>] [--file <path>]`.
- Produces: `action` / `action_fail` events with `action` ∈ {edit, write, run, read, search, other}.

- [ ] **Step 1: Write the failing tests**

Create `test/adapters/cursor-tool.test.ts`:

```ts
import { test, expect } from "bun:test";
import { runHookAt, journalLines, makeHome } from "../helpers";

const base = { cwd: "/tmp/cq-cursor-tool", hook_event_name: "postToolUse" };

test.each([
  ["edit_file", "edit"],
  ["search_replace", "edit"],
  ["apply_patch", "edit"],
  ["write", "write"],
  ["create_file", "write"],
  ["run_terminal_cmd", "run"],
  ["shell", "run"],
  ["read_file", "read"],
  ["list_dir", "read"],
  ["codebase_search", "search"],
  ["grep_search", "search"],
  ["web_search", "search"],
  ["mcp__github__list_issues", "other"],
  ["totally_unknown", "other"],
])("maps tool %s -> action %s (native preserved)", async (tool, action) => {
  const home = makeHome();
  const sid = `t-${tool}`;
  const { code } = await runHookAt(
    "cursor",
    "on-tool.sh",
    { ...base, conversation_id: sid, tool_name: tool },
    home,
  );
  expect(code).toBe(0);
  const e = journalLines(home, sid).at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe(action);
  expect(e.native).toBe(tool);
});

test("edit captures file_path", async () => {
  const home = makeHome();
  await runHookAt(
    "cursor",
    "on-tool.sh",
    { ...base, conversation_id: "t-file", tool_name: "edit_file", tool_input: { file_path: "src/a.ts" } },
    home,
  );
  expect(journalLines(home, "t-file").at(-1).file).toBe("src/a.ts");
});

test("run_terminal_cmd classifies cmd (force_push) and never stores the raw command", async () => {
  const home = makeHome();
  await runHookAt(
    "cursor",
    "on-tool.sh",
    {
      ...base,
      conversation_id: "t-cmd",
      tool_name: "run_terminal_cmd",
      tool_input: { command: "git push --force origin secret-branch" },
    },
    home,
  );
  const e = journalLines(home, "t-cmd").at(-1);
  expect(e.action).toBe("run");
  expect(e.cmd).toBe("force_push");
  expect(JSON.stringify(e)).not.toContain("secret-branch");
});

test("postToolUseFailure -> action_fail (action still derived)", async () => {
  const home = makeHome();
  await runHookAt(
    "cursor",
    "on-tool.sh",
    {
      conversation_id: "t-fail",
      cwd: "/tmp/cq-cursor-tool",
      hook_event_name: "postToolUseFailure",
      tool_name: "edit_file",
      tool_input: { file_path: "src/b.ts" },
      error_message: "boom",
    },
    home,
  );
  const e = journalLines(home, "t-fail").at(-1);
  expect(e.type).toBe("action_fail");
  expect(e.action).toBe("edit");
});

test("malformed stdin still exits 0 with no stdout", async () => {
  const home = makeHome();
  const proc = Bun.spawn(
    ["bash", new URL("../../adapters/cursor/hooks/on-tool.sh", import.meta.url).pathname],
    { stdin: Buffer.from("not json"), env: { ...process.env, AGENTRPG_HOME: home }, stdout: "pipe", stderr: "pipe" },
  );
  const stdout = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  expect(stdout).toBe("");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test test/adapters/cursor-tool.test.ts`
Expected: FAIL (script missing).

- [ ] **Step 3: Create `on-tool.sh`**

```sh
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
LIB="$(cd "$DIR/../../generic" && pwd)"
IFS= read -rd '' input || true

# STX (\x02) separator so IFS-read preserves empty middle fields (e.g. empty cmd).
IFS=$'\002' read -r sid cwd type action native cmd file < <(printf '%s' "$input" | jq -L "$LIB" -rj '
  include "cmd-tag";
  (.tool_name // "") as $t |
  ($t|test("^(run_terminal_cmd|shell|bash|exec)$";"i")) as $isShell |
  (if   ($t|test("^(edit_file|search_replace|apply_patch)$";"i")) then "edit"
   elif ($t|test("^(write|create_file)$";"i")) then "write"
   elif $isShell then "run"
   elif ($t|test("^(read_file|list_dir)$";"i")) then "read"
   elif ($t|test("^(codebase_search|grep_search|file_search|web_search)$";"i")) then "search"
   else "other" end) as $a |
  (if $isShell then cmd_tag(.tool_input.command // "") else "" end) as $cmd |
  (.tool_input.file_path // "") as $file |
  (if (.hook_event_name // "") == "postToolUseFailure" then "action_fail" else "action" end) as $type |
  [(.conversation_id // "unknown"), (.cwd // ""), $type, $a, $t, $cmd, $file] | join("")
' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
[ -z "$type" ] && exit 0

args=(--type "$type" --source "$SOURCE" --session "$sid" --cwd "$cwd" --action "$action" --native "$native")
[ -n "$cmd" ]  && args+=(--cmd "$cmd")
[ -n "$file" ] && args+=(--file "$file")
"$EMIT" "${args[@]}"
exit 0
```

- [ ] **Step 4: Make executable + run tests**

Run: `chmod +x adapters/cursor/hooks/on-tool.sh && bun test test/adapters/cursor-tool.test.ts`
Expected: PASS (all rows + 4 named tests).

- [ ] **Step 5: Commit**

```bash
git add adapters/cursor/hooks/on-tool.sh test/adapters/cursor-tool.test.ts
git commit -m "feat(cursor): add tool hook (postToolUse + postToolUseFailure)"
```

---

### Task 4: Subagent hook — `on-subagent.sh` (`subagentStart` → delegate)

`subagentStart` carries only `parent_conversation_id` (no `conversation_id`), so the session key falls back to it (Fix 1). Maps to an `action` event with `action=delegate`; `native` = `subagent_type`.

**Files:**
- Create: `adapters/cursor/hooks/on-subagent.sh`
- Test: `test/adapters/cursor-session.test.ts` (append)

**Interfaces:**
- Consumes: `_common.sh`; `emit.sh --type action --source cursor --session <id> --action delegate [--native <subagent_type>]`.
- Produces: `action`/`delegate` event keyed on `conversation_id // parent_conversation_id`.

- [ ] **Step 1: Write the failing test** (append to `test/adapters/cursor-session.test.ts`)

```ts
test("subagentStart -> action/delegate keyed on parent_conversation_id when conversation_id absent", async () => {
  const home = makeHome();
  const { code, stdout } = await runHookAt(
    "cursor",
    "on-subagent.sh",
    { parent_conversation_id: "parent-1", subagent_type: "code-searcher", hook_event_name: "subagentStart" },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  const e = journalLines(home, "parent-1").at(-1);
  expect(e.type).toBe("action");
  expect(e.action).toBe("delegate");
  expect(e.native).toBe("code-searcher");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/cursor-session.test.ts`
Expected: the new test FAILS; the earlier 4 still pass.

- [ ] **Step 3: Create `on-subagent.sh`**

```sh
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\002' read -r sid native < <(printf '%s' "$input" \
  | jq -rj '[(.conversation_id // .parent_conversation_id // "unknown"), .subagent_type // ""] | join("")' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"

args=(--type action --source "$SOURCE" --session "$sid" --action delegate)
[ -n "$native" ] && args+=(--native "$native")
"$EMIT" "${args[@]}"
exit 0
```

- [ ] **Step 4: Make executable + run tests**

Run: `chmod +x adapters/cursor/hooks/on-subagent.sh && bun test test/adapters/cursor-session.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add adapters/cursor/hooks/on-subagent.sh test/adapters/cursor-session.test.ts
git commit -m "feat(cursor): add subagent hook (delegate)"
```

---

### Task 5: Config snippet + README + config validation test

`~/.cursor/hooks.json` is one JSON object (cannot be appended like Codex's TOML), so the README documents a `jq` merge. A test parses the snippet and asserts every referenced script exists — proving Fix 2 (both tool hooks point at `on-tool.sh`) and that no event references a missing script.

**Files:**
- Create: `adapters/cursor/config.snippet.json`
- Create: `adapters/cursor/README.md`
- Test: `test/adapters/cursor-config.test.ts`

**Interfaces:**
- Consumes: the six hook scripts created in Tasks 1–4 (`on-session-start.sh`, `on-prompt.sh`, `on-tool.sh`, `on-subagent.sh`, `on-stop.sh`, `on-session-end.sh`).
- Produces: nothing consumed by later tasks (final task).

- [ ] **Step 1: Write the failing test**

Create `test/adapters/cursor-config.test.ts`:

```ts
import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../..");
const PREFIX = "~/.agentrpg/adapters/cursor/";

interface IHookEntry {
  command: string;
}
interface IConfig {
  version: number;
  hooks: Record<string, IHookEntry[]>;
}

test("config.snippet.json is version 1 and references only existing hook scripts", () => {
  const cfg = JSON.parse(
    readFileSync(join(ROOT, "adapters/cursor/config.snippet.json"), "utf8"),
  ) as IConfig;
  expect(cfg.version).toBe(1);
  const commands = Object.values(cfg.hooks)
    .flat()
    .map(h => h.command);
  expect(commands.length).toBeGreaterThan(0);
  for (const command of commands) {
    expect(command.startsWith(PREFIX)).toBe(true);
    const rel = command.slice(PREFIX.length);
    expect(existsSync(join(ROOT, "adapters/cursor", rel))).toBe(true);
  }
});

test("both postToolUse and postToolUseFailure map to the single on-tool.sh", () => {
  const cfg = JSON.parse(
    readFileSync(join(ROOT, "adapters/cursor/config.snippet.json"), "utf8"),
  ) as IConfig;
  expect(cfg.hooks.postToolUse[0].command).toBe(cfg.hooks.postToolUseFailure[0].command);
  expect(cfg.hooks.postToolUse[0].command.endsWith("on-tool.sh")).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/adapters/cursor-config.test.ts`
Expected: FAIL (snippet missing).

- [ ] **Step 3: Create `config.snippet.json`**

```json
{
  "version": 1,
  "hooks": {
    "sessionStart": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-session-start.sh" }],
    "beforeSubmitPrompt": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-prompt.sh" }],
    "postToolUse": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-tool.sh" }],
    "postToolUseFailure": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-tool.sh" }],
    "subagentStart": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-subagent.sh" }],
    "stop": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-stop.sh" }],
    "sessionEnd": [{ "command": "~/.agentrpg/adapters/cursor/hooks/on-session-end.sh" }]
  }
}
```

- [ ] **Step 4: Create `README.md`**

````markdown
# Cursor adapter

Maps Cursor (1.7+) agent hooks to Agent Quest's normalized journal via `../generic/emit.sh`.

## Install

1. Install Agent Quest (deploys this adapter to `~/.agentrpg/adapters/cursor`).
2. Merge `config.snippet.json` into `~/.cursor/hooks.json`. `hooks.json` is a single JSON object, so
   **merge** rather than paste:
   ```sh
   # first time (no existing file):
   cp adapters/cursor/config.snippet.json ~/.cursor/hooks.json
   # merging into an existing file:
   jq -s '.[0] * .[1]' ~/.cursor/hooks.json adapters/cursor/config.snippet.json > /tmp/cursor-hooks.json \
     && mv /tmp/cursor-hooks.json ~/.cursor/hooks.json
   ```
   If Cursor does not expand `~` in `command`, replace it with the absolute path to your home dir.
3. Start a Cursor agent session — events append to `~/.agentrpg/journal/<conversation_id>.ndjson`.

## Event mapping

| Cursor hook | event | notes |
|---|---|---|
| `sessionStart` | `session_start` | session=`conversation_id`, `model`, cwd=`workspace_roots[0]` |
| `beforeSubmitPrompt` | `prompt` | prompt text is NOT stored |
| `postToolUse` | `action` | tool→action map below |
| `postToolUseFailure` | `action_fail` | same action derivation, type forced fail |
| `subagentStart` | `action` (`delegate`) | session=`conversation_id` // `parent_conversation_id` |
| `stop` | `turn_end` | |
| `sessionEnd` | `session_end` | |

Tool → action: `edit_file`/`search_replace`/`apply_patch`→`edit`; `write`/`create_file`→`write`;
`run_terminal_cmd`/`shell`/`bash`/`exec`→`run` (+ git/test command tag); `read_file`/`list_dir`→`read`;
`codebase_search`/`grep_search`/`file_search`/`web_search`→`search`; `mcp__*` and others→`other`.

## Known approximations (refine against a real payload)

- Tool names and the `tool_input` field layout (`command`/`file_path`) are best-guess; `--native`
  preserves the raw `tool_name` for any mismatch.
- The raw shell command and prompt text are never stored — only a `CmdTag` from `cmd_tag`.
- No Cursor statusline (the companion app renders from `state.json`).
````

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/adapters/cursor-config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add adapters/cursor/config.snippet.json adapters/cursor/README.md test/adapters/cursor-config.test.ts
git commit -m "feat(cursor): add hooks.json snippet, README, and config test"
```

---

### Task 6: Full-suite + formatting verification

Confirms the new adapter doesn't regress the suite and meets formatting/type gates.

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `bun test`
Expected: all tests pass (existing + the new `cursor-*` tests).

- [ ] **Step 2: Type-check**

Run: `bunx tsc --noEmit 2>&1 | grep -E "cursor|adapters" || echo "no cursor type errors"`
Expected: `no cursor type errors` (pre-existing unrelated `test/core/*` errors may remain — do not fix them here).

- [ ] **Step 3: Format**

Run: `bun run format`
Expected: formatter rewrites any unformatted new `.ts` files; re-run `bun test` if anything changed.

- [ ] **Step 4: Commit any formatting changes**

```bash
git add -A
git commit -m "style(cursor): apply prettier to adapter tests" || echo "nothing to format"
```
