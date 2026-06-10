# Commit Quest — Phase 0 Design (refined)

> Refined Phase 0 spec. Supersedes `commit-quest-build-spec.md` for implementation.
> Full game design (all phases, Thai) lives in `claude-code-rpg-design.md`.
> This document folds in the review fixes and the brainstorm decisions (2026-06-10).

---

## 1. What Phase 0 proves

Normalized events flow into an append-only journal with correct fields, from a real
Claude Code session. **No XP, levels, classes, loot, statusline, or app yet** — those
consume the journal later and must not be blocked by Phase 0 choices.

The seam:

```
agents ──(adapters)──► append-only journal (NDJSON) ──(reducer)──► state.json ──► HUD / app
                        ▲ Phase 0 builds this and the CC adapter      ▲ later phases
```

- **Adapters** = the only part that knows a specific agent. CC is the first.
- **Journal** = append-only NDJSON, one file per session. Race-safe without locks.
- Everything after the journal is agent-agnostic and **out of scope here**.

---

## 2. Locked decisions

### 2.1 From the original spec (unchanged)

| Decision | Value |
|---|---|
| Hook scripts language | bash + jq (hot path) |
| Reducer / inspect / importer / bridge | Bun + TypeScript |
| Home directory | `~/.agentrpg` (override via `$AGENTRPG_HOME`) |
| XP scope | global character + per-repo / per-source stats |
| First adapter | Claude Code (hooks for live; JSONL backfill later) |
| Dependencies | `jq` and `bun` only. No npm packages. |

### 2.2 From the 2026-06-10 review + brainstorm (new)

| # | Topic | Decision | Why |
|---|---|---|---|
| D1 | Dev/deploy model | **repo = source of truth; `install.sh --link` symlinks `~/.agentrpg/adapters` → repo for dev; plain `install.sh` copies for prod** | edit-in-repo dev loop, version controlled; no re-install per edit |
| D2 | Event ordering | **Rely on append order within a session file; `ts` stays second-precision UTC** | the only order-sensitive logic (fail→recover) is intra-session; append order = chronological. macOS `date` has no `%N`; a seq counter would add hot-path I/O and isn't race-safe |
| D3 | `session_start` | **Emit on every `SessionStart` firing, include the firing reason as `start`. Reducer counts sessions by distinct `session_id` (= journal file), not by counting `session_start` lines** | keeps events raw; `session_start` is a reliable "a session happened" marker even if `SessionEnd` never fires; carries `model` for later |
| D4 | Matcher | **`PostToolUseFailure` has NO matcher (catch all failures); `PostToolUse` keeps the tool-list matcher** | failures are a rare, valuable signal (Rogue/Gremlin "failure recovered"); the success/fail asymmetry for non-listed tools is harmless (reducer keys off `action`) |
| D5 | `repo` logging | **Write `repo` on every event line** (option ก). Computed once via `git` at `SessionStart`, cached to `journal/{sid}.repo`, read per-event via bash `$(<file)` (no process spawn) | every line is self-contained (grep/debug), reducer stays trivial, robust if the first line is missing; ~1–3 MB/month overhead is negligible |
| D6 | Performance | **One-or-two `jq` calls per event, ~2–3 process spawns total (~5–8 ms). No `date` (use jq `now\|todate`). `git` runs once per session, never in the per-tool hot path** | PostToolUse blocks the turn until the hook returns; must be light |

> Hook events verified against current CC docs (2026-06-10): `PostToolUseFailure`,
> `StopFailure`, `SessionStart`/`SessionEnd` all exist; `PostToolUse` stdin carries
> `session_id`, `cwd`, `tool_name`, `tool_input`, `tool_response`, `hook_event_name`;
> `~` expands in shell-form `command` (no `args`). The original reference impl's event
> names were correct.

---

## 3. Normalized event (one NDJSON line)

```jsonc
{
  "ts": "2026-06-10T08:30:01Z",   // UTC ISO8601, second precision (jq now|todate)
  "source": "claude-code",         // adapter id (= $RPG_SOURCE)
  "session_id": "abc123",
  "type": "action",                // session_start | prompt | action | action_fail | turn_end | session_end
  "repo": "commit-quest",          // every line (D5); omitted only if undeterminable
  "action": "edit",                // type=action/action_fail only
  "native": "Edit",                // raw tool name, type=action/action_fail only
  "file": "src/app/page.tsx"       // optional, when tool_input.file_path present
}
```

`session_start` lines additionally carry: `cwd`, `start` (startup|resume|clear|compact),
`model` — each only when present.

**Hard constraint:** keep every line **< 4096 bytes** (PIPE_BUF) so concurrent appends
stay atomic (§6). Do **not** store prompt text or full bash commands in Phase 0.

Reducer computes XP from `action`, never from `native`. Events stay raw.

---

## 4. Mappings

### 4.1 Native tool → abstract action

| native `tool_name` | `action` |
|---|---|
| `Edit`, `MultiEdit` | `edit` |
| `Write` | `write` |
| `Bash` | `run` |
| `Read` | `read` |
| `Grep`, `Glob` | `search` |
| `Task` | `delegate` |
| (anything else) | `other` |

### 4.2 CC hook event → script → emitted event

| CC hook event | matcher | script | emits `type` |
|---|---|---|---|
| `SessionStart` | — | `on-session-start.sh` | `session_start` (+ git repo, writes cache) |
| `UserPromptSubmit` | — | `on-prompt.sh` | `prompt` |
| `PostToolUse` | `Edit\|MultiEdit\|Write\|Bash\|Read\|Grep\|Glob\|Task` | `on-tool.sh` | `action` |
| `PostToolUseFailure` | — (catch all, D4) | `on-tool.sh` | `action_fail` |
| `Stop` | — | `on-stop.sh` | `turn_end` |
| `SessionEnd` | — | `on-session-end.sh` | `session_end` |

---

## 5. File layout (D1)

Source lives in the git repo; `install.sh` deploys to `$AGENTRPG_HOME`. The repo layout
is authoritative in `docs/reference/project-structure.md`; Phase 0 fills only this subset:

```
commit-quest/                              # repo = source of truth
├── core/
│   └── events.ts                          # normalized event schema = THE CONTRACT
├── adapters/claude-code/
│   ├── hooks/
│   │   ├── _common.sh                     # sourced helpers: resolve_repo(), emit_simple()
│   │   ├── on-session-start.sh            # SessionStart -> session_start (computes+caches repo)
│   │   ├── on-prompt.sh                   # UserPromptSubmit -> prompt
│   │   ├── on-tool.sh                     # PostToolUse/Failure -> action/action_fail
│   │   ├── on-stop.sh                     # Stop -> turn_end
│   │   └── on-session-end.sh             # SessionEnd -> session_end
│   ├── settings.snippet.json             # hooks block to merge into ~/.claude/settings.json
│   └── README.md
├── config/default.json                    # placeholder (NOT read in Phase 0 — see §9)
├── tools/
│   ├── inspect.ts                         # Bun: read journal, print summary
│   └── install.sh                         # --link (dev, symlink) | default (prod, copy)
└── test/adapters/claude-code/fixtures/    # recorded hook stdin JSON for TDD (§9)

$AGENTRPG_HOME (~/.agentrpg)               # runtime (mirrors source)
├── adapters/claude-code/hooks/            # symlink (dev) or copy (prod)
├── tools/inspect.ts
├── config.json
└── journal/
    ├── {session_id}.ndjson                # append-only event log
    └── {session_id}.repo                  # cached repo name (one git call per session)
```

---

## 6. Safety rules (non-negotiable)

1. **Never write to stdout.** `UserPromptSubmit` / `SessionStart` stdout is injected into
   the model context. Everything goes to the journal file only.
2. **Always `exit 0`.** `exit 2` blocks the agent. Wrap risky work so the script can't fail the turn.
3. **Fast & light.** Read stdin once, parse with `jq`, append one line. No network, no reducer.
   `git` only at `SessionStart`. ~2–3 spawns / event (D6).
4. **Append-only, per session.** `journal/{session_id}.ndjson`. Never touch other sessions' files.
5. **Build JSON with `jq`** (`--arg` / object construction) for safe escaping. Never string-concat JSON.
6. **Line < 4096 bytes** so concurrent `>>` (O_APPEND) stays atomic — the basis of lock-free
   concurrency (§8). No long prompt/command payloads.

---

## 7. Reference implementation

### 7.1 `_common.sh` (sourced — adds no process)

```bash
#!/usr/bin/env bash
# Shared helpers. Sourced by the simple hook scripts. No shebang execution.
RPG_HOME="${AGENTRPG_HOME:-$HOME/.agentrpg}"
SOURCE="${RPG_SOURCE:-claude-code}"

# resolve_repo SID CWD -> prints repo name.
# Reads the per-session cache via $(<file) (bash builtin, no spawn) on hit.
# On miss (e.g. SessionStart hook didn't fire) self-heals with ONE git call AND
# writes the cache, so only the first event of such a session ever pays for git.
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

### 7.2 `on-tool.sh` (hot path)

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true              # slurp stdin without spawning cat

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

### 7.3 `on-session-start.sh` (the only script that calls git)

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true

IFS=$'\t' read -r sid cwd start model < <(printf '%s' "$input" \
  | jq -r '[.session_id // "unknown", .cwd // "", .source // "", .model // ""] | @tsv' 2>/dev/null)
[ -z "$sid" ] && sid="unknown"
mkdir -p "$RPG_HOME/journal" 2>/dev/null

# ONE git call per session; cache for all later events (D5/D6)
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

### 7.4 `on-prompt.sh` / `on-stop.sh` / `on-session-end.sh`

```bash
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")" && pwd)"; . "$DIR/_common.sh"
IFS= read -rd '' input || true
emit_simple prompt        # on-stop.sh: emit_simple turn_end ; on-session-end.sh: emit_simple session_end
exit 0
```

### 7.5 `settings.snippet.json` (merge into `~/.claude/settings.json`)

```json
{
  "hooks": {
    "SessionStart":        [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-session-start.sh" } ] } ],
    "UserPromptSubmit":    [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-prompt.sh" } ] } ],
    "PostToolUse":         [ { "matcher": "Edit|MultiEdit|Write|Bash|Read|Grep|Glob|Task", "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-tool.sh" } ] } ],
    "PostToolUseFailure":  [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-tool.sh" } ] } ],
    "Stop":                [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-stop.sh" } ] } ],
    "SessionEnd":          [ { "hooks": [ { "type": "command", "command": "~/.agentrpg/adapters/claude-code/hooks/on-session-end.sh" } ] } ]
  }
}
```

### 7.6 `tools/install.sh`

- `install.sh --link` — symlink `~/.agentrpg/adapters` and `~/.agentrpg/tools` → the repo
  dirs (dev loop: edit in repo, no re-install). `chmod +x` the scripts.
- `install.sh` (default) — copy `adapters/`, `tools/` into `$AGENTRPG_HOME`, `chmod +x`.
- Both: create `$AGENTRPG_HOME/journal/`, copy `config/default.json` → `config.json` if
  absent (never overwrite), print the resolved settings snippet to merge.
- Reference the idempotent settings-merge approach in pixel-agents'
  `claudeHookInstaller.ts` (see `docs/reference/pixel-agents.md`).

### 7.7 `tools/inspect.ts` (Bun — verification)

Read every `*.ndjson` in `$AGENTRPG_HOME/journal`, parse lines (skip malformed), print:
- total event count and number of session files (= distinct sessions, D3)
- counts grouped by `type`, `action`, `source`, `repo`
- last 10 events (`ts`, `source`, `type[:action]`, `repo`, `file`)

---

## 8. Concurrency (why it is lock-free)

- **Different sessions** (multiple CC windows / accounts / CC+Codex) → different
  `session_id` → different files → no contention.
- **Same session, parallel tools / subagents** → same file, but single `>>` writes of
  lines < `PIPE_BUF` (4096 B) are **atomic** on macOS/Linux → no interleaving/corruption.
  This is why §6 rule 6 (line < 4 KB) is mandatory.
- `state.json` is produced by a single reducer that folds all journals (idempotent;
  recompute from raw events). Sessions counted by distinct `session_id`.

> To verify at implementation time: whether subagent (`Task`) tool calls fire hooks with
> the parent `session_id` (same file, atomic-append case) or a separate id (separate file).
> Both are safe.

---

## 9. Testing strategy (TDD)

Hook scripts are pure stdin→file transforms — test them without launching CC:

1. **Unit (fixtures):** feed a recorded hook JSON to a script via stdin, assert the appended
   journal line. Cover every mapping: edit/write/run/read/search/delegate/other, `action`
   vs `action_fail`, `session_start` fields, `prompt`/`turn_end`/`session_end`, and the
   repo cache hit/miss paths.

   ```bash
   echo '{"session_id":"t1","cwd":"/tmp","tool_name":"Edit","tool_input":{"file_path":"a.ts"},"hook_event_name":"PostToolUse"}' \
     | AGENTRPG_HOME=/tmp/rpg-test on-tool.sh
   # assert /tmp/rpg-test/journal/t1.ndjson last line: type=action, action=edit, native=Edit, file=a.ts
   ```

2. **Invariants:** every emitted line is valid JSON; no script writes to stdout; every
   script exits 0 even on malformed input; lines stay < 4096 B.
3. **`inspect.ts`** summary matches a known fixture journal.
4. **Smoke (last):** one real CC session, confirm journal looks right and the session is
   visibly unaffected.

Write tests first, per red-green-refactor.

---

## 10. Definition of done

1. `install.sh` (and `--link`) places files in `$AGENTRPG_HOME`, scripts executable.
2. After merging the snippet and running one real CC session:
   - `journal/<session_id>.ndjson` exists with one line per session-start / prompt / tool /
     stop / session-end.
   - Each line is valid JSON with correct `source`, `type`, `action` (mapped), `repo`.
3. `bun ~/.agentrpg/tools/inspect.ts` prints a correct summary.
4. Hooks produce **no** visible output in the session and never error it.
5. Unit fixture tests (§9) pass.

---

## 11. Known limitations (acceptable for Phase 0)

- **Resume/compact replay:** `--continue`/`--resume` replays previously recorded hook
  stdout and does not re-run hooks, so events for the replayed span are not regenerated.
  Live capture is accurate; resumed spans may be sparse. (Our hooks emit no stdout, so no
  stale data is injected.)
- **`config.json` is inert** in Phase 0 (`AGENTRPG_HOME`/`RPG_SOURCE` come from env). It is
  a placeholder for later phases; README states this.
- **Mid-session `cwd` change** keeps the repo cached from session start until the next
  `SessionStart` firing. Rare; acceptable.

---

## 12. Out of scope (later phases)

XP weights & level curve, classes / up-class / secret classes, loot, achievements,
statusline HUD, companion app (Pixel Agents fork), backfill importer, generic emit,
second adapter. Events stay raw and complete so the reducer (a separate consumer) is not
blocked. See `claude-code-rpg-design.md` §5–§13.
```

