# Commit Quest — Phase 1 Design (reducer + statusline)

> Spec for Phase 1. Builds on Phase 0 (the journal). Roadmap epic #2.
> Full game design: `docs/claude-code-rpg-design.md` §5 (XP/level), §9 (statusline).
> Conventions: `CLAUDE.md`. Structure: `docs/reference/project-structure.md`.

---

## 1. What Phase 1 proves

The journal folds into a single `state.json`, and a terminal statusline renders live
**level + XP** from it during a real Claude Code session. This proves the
`reduce → state → HUD` pipeline. No classes, loot, achievements, or streak yet — those
consume `state.json` later.

```
journal/*.ndjson ──(reduce.ts)──► state.json ──(statusline.ts)──► "Lv.5 ███████░░░ 72%  |  Opus 4.8  $0.42"
                                       ▲ throttle ≤2s, full re-reduce, idempotent
```

Per [[phase-scoping-tight-checkpoints]]: Phase 1 is a tight, testable checkpoint. Defer
everything whose consumer lives in a later phase.

## 2. Locked decisions (from brainstorm 2026-06-11)

| # | Topic | Decision | Why |
|---|---|---|---|
| P1 | Branch | Phase 0 merged to `main`; Phase 1 on `feat/phase1-reducer` off `main` | clean, not stacked |
| P2 | Reducer trigger | **statusline calls a throttled full re-reduce** (skip if `state.json` younger than 2 s); reads the whole journal each time, idempotent | decision §5 of the design; journal is small in Phase 1. Incremental cursor / daemon deferred to Phase 3 |
| P3 | Streak | **Deferred to Phase 2** (its consumers — streak loot, achievements, Night Owl — live there) | keep Phase 1 focused on the core loop |
| P4 | Statusline tail | **model + cost + context %** — `model.display_name`, `cost.total_cost_usd`, `context_window.used_percentage` (a number, may be `null` early in a session and after `/compact` → fall back to `0`, per the CC docs' `// 0` convention) | §9.1/§9.2 |
| P5 | `other` action weight | **1** | any tracked-but-unmapped tool use earns a little |
| P6 | XP multipliers | **none in Phase 1** — `xp_total` is the raw weighted event sum | buffs/class/streak multipliers are Phase 2+ |
| P7 | `action_fail` / `session_start` XP | **0** | failing isn't rewarded; failure-recovered (+15) is deferred to Phase 2. Starting a session isn't XP |

**Constraint carried from Phase 0:** journal lines have no `lines_added`/`tokens`, so the
lines bonus (§5.1), token XP, and `test`-detection (needs command text we don't store) are
**not computable here** — deferred to backfill (§12) / later phases.

## 3. XP / level model

All numbers live in `config.json` (tunable without code); defaults are baked into `core/`.

### 3.1 Weights (`config.xp.weights`)

| event | weight |
|---|---|
| `prompt` | 5 |
| action `edit` / `write` | 4 |
| action `run` | 3 |
| action `read` / `search` | 1 |
| action `delegate` | 8 |
| action `other` | 1 |
| `turn_end` | 10 |
| `session_end` | 20 |
| `session_start`, `action_fail` | 0 (P7) |

`xpFor(event)`: `session_start`/`action_fail` → 0; `prompt`/`turn_end`/`session_end` →
`weights[type]`; `action` → `weights[action]`.

### 3.2 Curve (`config.difficulty`)

`curve_k = 7`, `curve_exp = 2.5`, `level_cap = 50`.

```
xpForLevel(L) = round(curve_k * (L-1)^curve_exp)   // cumulative XP to REACH level L
             // L1=0, L2=7, L3=40, L5=224, L50=117649
levelFor(xp)  = highest L in 1..cap with xpForLevel(L) <= xp   // always >= 1 (L1=0)
```

`levelProgress(xp)` returns `{ level, xp_in_level, xp_to_next, pct }`:

```
level = levelFor(xp)
if level >= cap:  xp_in_level = xp - xpForLevel(cap); xp_to_next = 0;            pct = 1
else:             floor = xpForLevel(level); ceil = xpForLevel(level+1);
                  xp_in_level = xp - floor; xp_to_next = ceil - xp; pct = (xp-floor)/(ceil-floor)
```

> `cum(50) ≈ 118k` here vs the design's ballpark 124k — within tolerance, config-tunable.
> `levelFor` is implemented as a loop over 1..cap (exact, avoids float-inverse boundary bugs).

## 4. `state.json` (Phase 1 subset — forward-compatible)

```jsonc
{
  "version": 1,
  "updated_at": "2026-06-11T08:30:05Z",
  "xp_total": 1234,
  "level": 5,
  "xp_in_level": 120,
  "xp_to_next": 380,
  "stats": {
    "prompts": 40,
    "actions": { "edit": 10, "run": 8, "read": 30, "search": 4, "delegate": 2, "write": 3, "other": 1 },
    "sessions": 6,
    "by_source": { "claude-code": { "xp": 1234, "sessions": 6 } },
    "by_repo":   { "commit-quest": { "xp": 800, "sessions": 4 }, "pos": { "xp": 434, "sessions": 2 } }
  }
}
```

- `stats.actions` counts **successful** `action` events only (not `action_fail`).
- `stats.sessions` = distinct `session_id` (D3).
- `by_source[s].xp` / `by_repo[r].xp` = summed `xpFor` for events of that source/repo;
  `.sessions` = distinct `session_id` within that group. Events with no `repo` are skipped
  from `by_repo` only.
- No `class`/`streak`/`inventory`/`buffs`/`titles`/`achievements` (Phase 2+). Later phases
  add keys; consumers must tolerate their absence.

## 5. Components

| File | Responsibility |
|---|---|
| `core/journal.ts` | `loadEvents(home): { events: INormalizedEvent[]; sessions: number }` — extracted from `inspect.ts` so `reduce` and `inspect` share one reader (`sessions` = journal file count) |
| `core/xp.ts` | `DEFAULT_WEIGHTS`, `DEFAULT_DIFFICULTY`, `xpFor(event, weights)`, `xpForLevel(L, diff)`, `levelFor(xp, diff)`, `levelProgress(xp, diff)` |
| `core/config.ts` | `loadConfig(home)` — deep-merge `config.json` over defaults → `{ weights, difficulty }`; fall back to defaults on missing/invalid |
| `core/state.ts` | `IState`, `IGroupStat` |
| `core/reduce.ts` | `reduce(events, config?): IState` (pure, no clock), `reduceToFile(home)` (stamps `updated_at`, atomic write), `reduceThrottled(home, maxAgeMs=2000)` |
| `hud/statusline.ts` | read CC stdin → `reduceThrottled(home)` → read `state.json` → `renderHud(state, tail)` → print one line. `renderHud` is a pure exported fn |
| `inspect.ts` | refactor to import `loadEvents` from `core/journal.ts` (no behavior change) |

Dependency rule holds: `core/` imports only within `core/`; `hud/` reads `state.json` +
calls `core/reduce`. Nothing imports an adapter.

## 6. Reducer behavior

- **`reduce(events, config)`** — pure: one pass summing `xpFor`, counting `stats`,
  accumulating `by_source`/`by_repo` (xp + distinct-session sets), then
  `levelProgress(xp_total)`. Returns `IState` **without** `updated_at` (set at write time)
  → deterministic and unit-testable.
- **`reduceToFile(home)`** — `loadEvents(home)` → `reduce` → add `updated_at` (current ISO)
  + `version` → write to `state.json` **atomically** (write `state.json.tmp`, then rename)
  so a concurrent statusline never reads a half-written file.
- **`reduceThrottled(home, maxAgeMs = 2000)`** — if `state.json` exists and
  `now - mtime < maxAgeMs`, return without recomputing; else `reduceToFile`. This is the
  statusline's entry point (P2).

## 7. Statusline behavior

`hud/statusline.ts`:

1. Slurp CC JSON from stdin; extract `model.display_name`, `cost.total_cost_usd`,
   `context_window.used_percentage`.
2. `reduceThrottled(home)`.
3. Read `state.json`; if missing/invalid, use a zero-state fallback (`Lv.1`, empty bar).
4. `renderHud(state, { model, cost })` → print **one line to stdout** (statusline stdout
   IS the HUD — unlike hooks).
5. Wrap everything in try/catch; on any error print a safe minimal line and `exit 0`
   (never break the user's prompt).

**`renderHud(state, tail)` (pure)** — `tail = { model, cost, ctx }`:
```
Lv.{level} {bar} {pct}%  |  {model}  ${cost}  ·  ctx {ctxPct}%
```
- `pct` (0..1) = `xp_to_next == 0 ? 1 : xp_in_level / (xp_in_level + xp_to_next)`
  (recomputed from `state`; `state.json` stores no `pct`).
- `bar` = 10 cells: `filled = round(pct*10)` → `"█"*filled + "░"*(10-filled)`. At
  `level >= cap` (`xp_to_next == 0`): full bar + ` MAX`.
- percent shown = `round(pct*100)`.
- `cost` = `tail.cost == null ? "0.00" : tail.cost.toFixed(2)`.
- `model` = `tail.model || "?"`.
- `ctxPct` = `tail.ctx == null ? 0 : round(tail.ctx)` — the `ctx` label distinguishes the
  context-window percentage from the XP-bar percentage.

Example: `Lv.5 ███████░░░ 72%  |  Opus 4.8  $0.42  ·  ctx 8%`

## 8. Install / settings

- `settings.snippet.json` gains a top-level `statusLine`:
  ```json
  "statusLine": { "type": "command", "command": "bun ~/.agentrpg/hud/statusline.ts", "padding": 0 }
  ```
- `install.sh` `deploy` list gains `hud` (and keeps `core`, `adapters`, `tools`).
- The settings merge: append `hooks` (as in Phase 0) **and set** `.statusLine` from the
  snippet. Back up first (as in Phase 0). If the user already has a `statusLine`, warn and
  keep a backup before replacing (their old value is recoverable from the `.bak`).

## 9. Testing (TDD)

- **`core/xp.test.ts`** — `xpFor` per event/action incl. the 0 cases (P7); `xpForLevel`
  values (L1=0, L2=7, L5=224); `levelFor` boundaries (xp 0→1, 6→1, 7→2, huge→50);
  `levelProgress` fields incl. the cap case.
- **`core/reduce.test.ts`** — `reduce(fixtureEvents)` → asserted `xp_total`, `level`,
  `stats.actions`, `stats.sessions` (distinct id), `by_source`, `by_repo` (incl. repo-less
  event skipped from `by_repo`).
- **`core/journal.test.ts`** — `loadEvents` skips malformed, reads multiple files (port of
  the existing inspect coverage).
- **`core/reduce.throttle.test.ts`** — `reduceThrottled` writes `state.json`; a second call
  within the window does not rewrite (mtime unchanged); after the window it rewrites.
- **`hud/statusline.test.ts`** — `renderHud` for a normal state, null cost (`$0.00`), null
  context (`ctx 0%`), a non-integer `ctx` (rounded), and max level (full bar + `MAX`); plus
  an integration test spawning `statusline.ts` with a realistic CC stdin (incl.
  `context_window.used_percentage`) + a seeded `home`, asserting the printed line and
  `exit 0`.

Prefer testing the pure functions directly; spawn the script only for the one integration
case.

## 10. Definition of done

1. `bun test` green; `bunx tsc --noEmit` clean.
2. `reduce` of a fixture journal yields the correct `state.json`.
3. `renderHud` produces the specced line (incl. null/max cases).
4. After `install.sh --link` + merging the snippet, a real CC session shows a statusline
   `Lv.N … %  |  model  $cost` whose level/XP **increases** as you work; `state.json`
   updates (throttled).
5. Hooks still emit nothing to the session (Phase 0 unaffected).

## 11. Out of scope (later phases)

classes / up-class · loot · achievements · **streak** · buffs / titles · XP multipliers ·
level-up flash (§9.3) · `test` / lines / token XP · failure-recovered bonus · daemon /
incremental reduce · companion app. `state.json` stays forward-compatible so these slot in
without reshaping it.
