# Commit Quest — Phase 3.2b Design (boss encounters & loot)

> Third slice of Phase 3. 3.2a gave the AFK farming scene. 3.2b makes the hero **fight rate-based
> bosses that drop loot** — a classic idle-game encounter model that replaces the (rejected)
> "action_fail = boss" idea. The boss is a **seeded reducer mechanic** (idempotent loot), the app
> **visualises** it. Conventions: `CLAUDE.md` + `app/CLAUDE.md`. Design §10.3.

---

## 1. What 3.2b proves

While the agent works (farming), bosses appear at a **rate**; most are slain and **drop loot**, some
**flee** (no drop) — and the companion animates the encounter (boss → battle → defeated+loot / fled).
The drops are real (seeded, idempotent inventory in the reducer); the animation is the app's view.

## 2. Why not `action_fail`

`action_fail` was rejected as the boss trigger: it can't see business/logic defects, fires constantly
during healthy TDD (red→green), is gameable (fail on purpose), and would carry meaning it can't
support. Instead the boss is a **rate-based random encounter** — genre-appropriate, ungameable
(seeded), decoupled from "failure," and gives the boss a real purpose (loot).

## 3. Locked decisions (brainstorm 2026-06-13)

| # | Topic | Decision |
|---|---|---|
| H1 | Trigger | **Rate-based**, per `action` event, seeded. Not tied to `action_fail`. |
| H2 | Two rates | `boss_rate` (spawn, default **0.02**) × `boss_flee_rate` (default **0.2**). Effective loot ≈ `boss_rate × (1 − flee_rate)`. A slain boss rolls the **`boss` drop table** (better odds than clean/levelup). |
| H3 | Where | The roll is a **reducer mechanic** (seeded, idempotent), extending the 2c.1 loot pipeline. The app only visualises. |
| H4 | Flee must be visible | A fled boss adds no inventory, so the reducer exposes **`stats.boss_defeated` / `stats.boss_fled`** (cumulative counts). The app diffs them to animate every outcome. |
| H5 | Pacing | The app gives each encounter a **minimum battle duration** (~4.5 s) so a real drop never "flashes". |
| H6 | Scope | 3.2b = the boss-loot mechanic + its visual (incl. the loot-drop animation). **Up-class world-transition, monster-approach, and branch realms move to 3.2c.** Boss visuals reuse the placeholder/CSS-skeleton approach. |

## 4. Reducer mechanic (`core/`)

Per **`action`** event in the fold (action successes — farming), with a stable per-action ordinal:

```
bossOrdinal++  (count of action events so far)
spawn  = seededRng("boss:"      + bossOrdinal)() < boss_rate
flee   = seededRng("bossflee:"  + bossOrdinal)() < boss_flee_rate     // only if spawn
if spawn && flee   -> bossFled++
if spawn && !flee  -> bossDefeated++ ; push { table: "boss", seed: "bossloot:" + bossOrdinal }
```

- `seededRng` is the 2c.1 PRNG (cyrb53 + mulberry32) — deterministic, so the whole thing is
  **idempotent** (same journal → same bosses, flees, and drops).
- The boss triggers join the existing `clean`/`levelup`/`streak` triggers in `rollInventory`.
- `boss_rate` / `boss_flee_rate` default in code (`DEFAULT_BOSS_RATE = 0.02`,
  `DEFAULT_BOSS_FLEE_RATE = 0.2`), overridable via `config.json`.
- `core/loot.ts` `DROP_TABLES.boss` (default): `common 0.4 · rare 0.35 · epic 0.2 · legendary 0.05`
  (richer than `clean`); `config.json.drops.boss` may override.

**State additions (`core/state.ts`):** `stats.boss_defeated?: number`, `stats.boss_fled?: number`.

## 5. App — visualise the encounter (diff-driven)

```ts
// app/src/game-events.ts (pure, tested)
export enum GameEventType {
  BossDefeated = "boss_defeated",
  BossFled = "boss_fled",
}
export interface IGameEvent { type: GameEventType; items: string[]; }

// emits one event per outcome whose count grew since the previous state; loot items = inventory delta
export function diffStates(prev: IState | null, next: IState): IGameEvent[] { … }
```

- **`use-game-events.ts`** — a hook holding the previous `IState` in a ref; on each new state it runs
  `diffStates`, enqueues the events, and exposes the **current** encounter to render (with a
  min-duration timer so each plays ≥ 4.5 s; a short queue handles back-to-back bosses).
- **Components (CSS skeleton, §3.2a G7):** `components/boss-encounter.tsx` (the monster slot becomes
  a boss 🐉, hero battles, then a `defeated`/`fled` outcome) + `components/loot-toast.tsx` (the dropped
  item(s) slide in). All visuals live in `styles.css` — placeholders now, PixelLab realm bosses (§7 of
  `art-prompts.md`) swap in by editing CSS.
- `scene-view.tsx` renders the boss-encounter layer above the ambient mob when an encounter is active.

## 6. Components

| File | Change |
|---|---|
| `core/state.ts` | `stats.boss_defeated?`, `stats.boss_fled?` |
| `core/config.ts` + `config/default.json` | `boss_rate?`, `boss_flee_rate?`, `drops.boss` |
| `core/loot.ts` | `DROP_TABLES.boss` (default) |
| `core/reduce.ts` | per-action seeded spawn→flee→loot roll; count defeated/fled; push boss triggers |
| `app/src/game-events.ts` | `GameEventType` + `diffStates` (pure) |
| `app/src/use-game-events.ts` | prev-ref diff + encounter queue + min-duration timer |
| `app/src/components/{boss-encounter,loot-toast}.tsx` | encounter + drop visuals (skeleton) |
| `app/src/components/scene-view.tsx` | mount the boss-encounter layer |
| `app/src/styles.css` | boss + flee + loot-drop animations (art surface) |

`core/` imports stay within `core/`; the app imports only `IState` (+ the events contract).

## 7. Testing

- **`core/reduce.test.ts`** — with a tuned config: `boss_rate 0` → `boss_defeated`/`boss_fled` = 0, no
  boss loot; `boss_rate 1, flee 0` → every action defeats a boss and drops a `boss`-table item;
  `boss_rate 1, flee 1` → all fled, inventory unchanged by bosses; **idempotent** (two reduces equal);
  boss drops are **additive** to the existing clean/levelup triggers.
- **`core/loot.test.ts`** — `DROP_TABLES.boss` exists and rolls a valid item.
- **`core/config.test.ts`** — `boss_rate`/`boss_flee_rate`/`drops.boss` default and override.
- **`app/src/game-events.test.ts`** — `diffStates`: `boss_defeated` +1 → `[BossDefeated]` with the new
  inventory item(s); `boss_fled` +1 → `[BossFled]`; no change → `[]`; `prev = null` → `[]`.
- **Manual (UI):** open the app; during activity a boss occasionally appears, battles ≥ 4.5 s, then
  either drops loot (toast) or flees; counts and inventory match.

## 8. Definition of done

1. `bun test` green (core + new `app/*.test.ts`); root + `tsc -p app` clean; `format:check` clean;
   `vite build` succeeds.
2. A journal reduces to a deterministic set of boss defeats/flees and boss-table drops; re-reducing is
   identical; `boss_rate 0` leaves state byte-identical to before this phase.
3. The live app animates boss encounters (defeated + loot / fled) driven only by the state diff.

## 9. Out of scope (→ 3.2c / later)

- **3.2c:** up-class **world-transition**, **monster-approach** walk, branch (T4 a/b) secret realms.
- **Boss-kill XP** and tier-scaled / realm-specific boss art (PixelLab §7) — drop in behind the seam.
- Multi-character; leaderboard.
