# Commit Quest — Phase 2a Design (streak + achievements)

> First sub-checkpoint of Phase 2 (epic #3). Builds on Phase 1 (reducer/state/statusline).
> See [[phase2-decomposition]]. Full game design: `docs/claude-code-rpg-design.md` §4.2, §7.
> Conventions: `CLAUDE.md`.

---

## 1. What 2a proves

The reducer also folds the journal into a **daily streak** and an **achievement** tally, both
pure and idempotent, and the statusline shows 🔥 streak. No classes/loot/secret classes yet.

```
journal ──(reduce)──► state.json{ ...P1, streak, achievements } ──► HUD "Lv.5 ███░░ 72% 🔥5d | …"
```

## 2. Locked decisions (brainstorm 2026-06-11)

| # | Topic | Decision |
|---|---|---|
| A1 | Streak day boundary | **Local timezone.** `eventLocalDate(ts)` converts each UTC `ts` to the machine's local `YYYY-MM-DD`; the only TZ-dependent code. `computeStreak` is pure over date keys. |
| A2 | HUD | **Add `🔥{current}d` only** (hidden when current = 0). Achievement count lives in `state.json` for inspect/the app — not the HUD. |
| A3 | Achievement conditions | **Core set:** `stat` (gte/lt), `distinct` (source/repo), composite `all`/`any`. `streak` conditions use the `streak_best` fact. |
| A4 | Rewards in 2a | **`points` + `title` (cosmetic) only.** The evaluator ignores `loot_roll`/`unlocks_class` gracefully (their systems arrive in 2b/2c). |
| A5 | Idempotency | All gating facts are **monotonic** (counts, level, distinct, `streak_best`, xp) so a single evaluation against the final state is stable. Streak conditions must use `streak_best`, never `current_days` (which can drop), so achievements never un-earn. |
| A6 | `earned` shape | **id list only** (no per-achievement `at` timestamp in 2a — a deterministic earn-time needs crossing-event tracking; defer until the app needs a timeline). |
| A7 | Git / command achievements | **Deferred** — they need a command-classification signal the journal lacks. Backlog: `docs/reference/command-aware-achievements.md`. |

## 3. Streak model (`core/streak.ts`)

```
eventLocalDate(ts) -> "YYYY-MM-DD"   // new Date(ts) + local getFullYear/Month/Date, zero-padded
localTodayKey()    -> "YYYY-MM-DD"   // same on new Date()

computeStreak(dateKeys: string[], today: string) -> { current_days, best_days, last_active }
  unique+sorted ascending; empty -> { 0, 0, "" }
  best_days   = longest run where adjacent keys differ by exactly 1 day
  last_active = max(dateKeys)
  gap         = days(today) - days(last_active)        // days(k) = epoch of k @ 00:00:00Z / 86400000
  current_days = gap > 1 ? 0 : (run length ending at last_active)   // missed a full day -> broken
```

Every event's date counts (any activity makes the day active). `days()` parses the date key
as UTC midnight so the run math is TZ-neutral (the local-ness already happened in `eventLocalDate`).

## 4. Achievements model (`core/achievements.ts`)

```ts
type TCond =
  | { stat: string; gte?: number; lt?: number }
  | { distinct: "source" | "repo"; gte: number }
  | { all: TCond[] }
  | { any: TCond[] };

interface IAchievementDef {
  name: string;
  desc: string;
  cond: TCond;
  points: number;
  reward?: { title?: string; loot_roll?: string; unlocks_class?: string }; // 2a uses title only
  hidden?: boolean;
}

evaluateAchievements(state, registry: Record<string, IAchievementDef>)
  -> { earned: string[]; points: number; progress: Record<string, number> }
```

**Facts** derived from `state` (all monotonic):
`xp_total · level · prompts · sessions · actions_total (Σ actions) · edits · writes · runs ·
reads · searches · delegates · streak_best (= state.streak.best_days) · distinct_source ·
distinct_repo (= Object.keys(by_source|by_repo).length)`.

- `stat`: `v = facts[cond.stat] ?? 0`; pass if `(gte==null || v>=gte) && (lt==null || v<lt)`.
- `distinct`: `v = distinct_source|distinct_repo`; pass if `v >= gte`.
- `all`/`any`: every / some sub-cond.
- `earned` = registry ids whose `cond` passes. `points` = Σ `points` of earned.
- `progress` = for each **unearned** achievement whose `cond` is a single `{stat,gte}` or
  `{distinct,gte}`, the current fact value (for a bar). Composite / `lt` conds are skipped.
- Unknown reward keys (`loot_roll`, `unlocks_class`) are read but **not acted on** in 2a (A4).
- 2a registry uses **gte only** (A5 permanence); `lt` stays supported for future event-style defs.

## 5. Starter registry (25 — `DEFAULT_ACHIEVEMENTS` in `core/achievements.ts`)

> Baked in code (like Phase 1's `DEFAULT_WEIGHTS`) so achievements work even with a stale
> deployed `config.json`; `config.json.achievements` may override per id.

Rewards are cosmetic (`points` + optional `title`). `points` is a collection score, separate
from XP.

**Milestone** — `first_blood` (actions_total≥1, +5, *Rookie*) · `tooling_up` (actions_total≥1000,
+10) · `tool_master` (actions_total≥10000, +25, *Veteran*) · `wordsmith` (prompts≥500, +10) ·
`level_10` (level≥10, +15) · `level_25` (level≥25, +30, *Adept*) · `century` (sessions≥100, +20) ·
`refactor_slayer` (edits≥1000, +15, *Refactor Slayer*) · `shell_wizard` (runs≥1000, +15,
*Shell Wizard*) · `bookworm` (reads≥2000, +10).

**Streak** (use `streak_best`) — `week_warrior` (≥7, +15, *Consistent*) · `monthly_grind`
(≥30, +30, *Dedicated*) · `unbroken` (≥100, +50, *Unstoppable*).

**Exploration** — `wanderer` (distinct_repo≥5, +15, *Explorer*) · `globetrotter`
(distinct_repo≥20, +25) · `polyglot` (distinct_source≥3, +25, **hidden**; gains
`unlocks_class: maestro` in 2c).

**Composite** — `well_rounded` (all: edits≥100, runs≥100, reads≥100, prompts≥100; +20,
*Full-Stack*).

**Gag / endgame** — `bash_goblin` (runs≥5000, +20, *Goblin*) · `keyboard_archaeologist`
(reads≥5000, +15) · `yak_shaver` (sessions≥200, +20, *Yak Shaver*) · `delegator_supreme`
(delegates≥100, +15, *Overlord*) · `leet` (xp_total≥1337, +13, **hidden**) · `the_grind`
(actions_total≥50000, +50, *Machine*) · `cant_stop` (level≥50, +50, *Maxed*) · `talk_is_cheap`
(all: prompts≥2000, delegates≥50; +20, *Manager*).

> The long-tail entries (`tool_master`, `the_grind`, `unbroken`, `cant_stop`) are the
> post-Lv.50 longevity layer. Prestige/season is a separate future lever (design §5.2,
> decision #10) — not 2a.

## 6. `state.json` additions

```jsonc
"streak": { "current_days": 5, "best_days": 21, "last_active": "2026-06-11" },
"achievements": {
  "earned": ["first_blood", "tooling_up"],
  "points": 15,
  "progress": { "tool_master": 1240, "wanderer": 3 }   // unearned single-stat/distinct only
}
```
Both optional in `IState` (forward-compat with a pre-2a `state.json`).

## 7. Components

| File | Change |
|---|---|
| `core/streak.ts` | new — `eventLocalDate`, `localTodayKey`, `computeStreak` |
| `core/achievements.ts` | new — `IAchievementDef`, `TCond`, `evaluateAchievements`, `DEFAULT_ACHIEVEMENTS` (the 25) |
| `core/state.ts` | add `IAchievementsState` + optional `streak?`, `achievements?` |
| `core/config.ts` | `IConfig.achievements?` — merge `config.json.achievements` over `DEFAULT_ACHIEVEMENTS` |
| `core/reduce.ts` | `reduce(events, config, today?)` — also build streak + evaluate achievements |
| `config/default.json` | unchanged (registry default lives in code; `config.json` may override) |
| `hud/statusline.ts` | `renderHud` inserts `🔥{n}d` after the XP % when `streak.current_days >= 1` |
| `tools/inspect.ts` | print a streak + achievement-points line (cheap, useful) |

`core/` imports only within `core/`. Dependency rule unchanged.

## 8. Reducer change

`reduce(events, config, today?: string)`:
- During the existing fold, also collect `eventLocalDate(e.ts)` into a Set.
- After stats: `const ref = today ?? last_active; streak = computeStreak([...dates], ref)`.
  When `today` is omitted (pure call), streak is computed relative to the last active day
  (always "alive") — deterministic, no clock. `reduceToFile` passes `localTodayKey()`.
- `achievements = evaluateAchievements({ ...statsState, streak }, config.achievements)`.
- Add `streak`, `achievements` to the returned state.

`reduceToFile` → `reduce(events, loadConfig(home), localTodayKey())`. Existing Phase 1
`reduce(events, cfg)` calls keep working (today defaults).

## 9. HUD

`renderHud(state, tail)` — between the XP `%` and the ` | ` separator, insert
` 🔥${state.streak.current_days}d` when `state.streak?.current_days >= 1`; otherwise nothing.

Example: `Lv.5 ███████░░░ 72% 🔥5d  |  Opus 4.8  $0.42  ·  ctx 8%`

## 10. Testing (TDD)

- **`core/streak.test.ts`** — `computeStreak`: a 3-day run, a broken streak (gap > 1 → current 0
  while best survives), `best > current`, empty input; `eventLocalDate` returns `YYYY-MM-DD`.
- **`core/achievements.test.ts`** — `evaluateAchievements` over a fixture state + small registry:
  earned set, summed points, `progress` for unearned single-stat, `distinct`, `streak_best`
  gate, `all`/`any` composite, and that an unknown `unlocks_class` reward is ignored.
- **`core/reduce.test.ts`** — extend: dated events across 2 consecutive days → `streak.best_days
  == 2`; crossing a milestone threshold earns it; passing an explicit `today` with a gap breaks
  `current_days`.
- **`hud/statusline.test.ts`** — `renderHud` shows `🔥5d` when current ≥ 1 and hides it at 0.
- **`tools/inspect.test.ts`** — summary includes the streak/points line.

## 11. Definition of done

1. `bun test` green; `bunx tsc --noEmit` clean.
2. `reduce` of a dated fixture journal yields correct `streak` + `achievements`.
3. `renderHud` shows/hides 🔥 correctly.
4. Deployed: a real session's `state.json` has a sensible `streak` and earns `first_blood`
   (and others by the real stats); the HUD shows 🔥 when active today.

## 12. Out of scope

- **Git / command-based achievements** → `docs/reference/command-aware-achievements.md` (needs
  a command-classification signal; a later "command-aware" checkpoint).
- `ratio` and per-session computed-event conditions; secret-class gags (Night Owl, Ascetic,
  `/rpg xyzzy`) → 2c.
- Per-achievement `at` timestamp; unlock toasts; achievement count in the HUD.
- Classes, loot, XP multipliers, prestige/season.
