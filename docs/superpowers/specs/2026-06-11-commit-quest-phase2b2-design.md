# Commit Quest — Phase 2b.2 Design (base class passive)

> Second half of Phase 2b (epic #3). Builds on 2b.1 (class identity). Adds the **base class
> passive** — an XP multiplier on the line's signals, scaling per tier. See
> [[phase2-decomposition]]. Full game design: `docs/claude-code-rpg-design.md` §6.2–§6.4.
> Conventions: `CLAUDE.md`.

---

## 1. What 2b.2 proves

Picking a class makes XP from that line's signals worth more (`+20→50%` by tier), so a
classed character levels faster than a Novice. The rate lives in `config.json` — **tunable
after seeing how fast levels actually rise, without touching code.**

## 2. Locked decisions (brainstorm 2026-06-11)

| # | Topic | Decision |
|---|---|---|
| C1 | Scope | **Base passive only.** A single per-tier XP multiplier on the line's signals. Specialist passives and §6.4 balance (EV-matching, floor, pity, auto-tune) are out → a later checkpoint. |
| C2 | Application model | **Sequential causal fold.** Process events in `ts` order, tracking running XP; each event's multiplier uses the tier derived from the running level *before* that event. No global circularity, fully idempotent. |
| C3 | Rates | `basePct(tier)` = `+20/30/40/50%` at T1/2/3/4 (T4 same for both branches; branch only matters for the deferred specialist). **In `config.json`, tunable.** |
| C4 | Signals | The passive multiplies XP from the **same signals affinity uses** (`lineForEvent` reused from `affinity.ts`). No second definition. |
| C5 | "Active" simplification | The passive applies to line-signals **from the point running-level first reaches Lv.5**, using the **current** `profile.line` across all history (retroactive-from-Lv.5). No selection-timestamp tracking (deferred). Respec recomputes with the new line. |

## 3. Application model (the sequential fold)

Replaces the reducer's plain XP sum. Events are sorted by `ts`, then folded once:

```
sorted = events sorted by Date.parse(ts) ascending (stable; ties keep load order)
line   = profile.line ?? null
running = 0
for e in sorted:
  base     = xpFor(e, weights)
  level    = levelFor(running, difficulty)             // from XP accrued so far (causal)
  tier     = (line != null && level >= 5) ? tierForLevel(level) : 0
  isSignal = line != null && lineForEvent(e) === line
  mult     = (isSignal && tier >= 1) ? 1 + basePct(tier, passive) : 1
  gained   = base * mult
  running += gained
  // attribute `gained` (multiplied) to by_source[e.source] and by_repo[e.repo]
  // counts / sessions / dates: as before (order-independent, computed in this same loop)
xp_total = round(running)
```

- **No circularity:** event `i`'s tier depends only on events `< i`.
- **Idempotent:** stable sort + deterministic fold → same result every run.
- **Novice (no line) → `mult = 1` for every event → `xp_total` equals the old plain sum.**
  Phase 1/2a behavior and tests are unchanged; only a classed character's XP changes.
- `running`/group xp are floats internally; rounded to integers on output.
- `levelFor` is called per event (O(n·cap)); fine for a throttled CLI reduce.

`affinity` (unordered), `streak`, and `achievements` are computed as in 2a/2b.1.

## 4. Rates — `config.passive` (tunable)

`basePct(tier, rates)` reads a tier→fraction map; default baked in `core/xp.ts`:

```jsonc
"passive": { "1": 0.2, "2": 0.3, "3": 0.4, "4": 0.5 }   // config.json may override
```
`basePct(0)` and any missing tier → `0`. Like `DEFAULT_WEIGHTS`, the default lives in code so
a stale `config.json` still works; `config.json.passive` overrides per tier.

## 5. `state.json`

- `xp_total` now includes the passive (for a classed character).
- `class` gains `base_passive_pct` — the current tier's rate (e.g. `0.4`) for the HUD / `rpg
  status` / app.

```jsonc
"class": { "line": "mage", "tier": 3, "form": "Infra Archmage", "icon": "⚔", "branch": null,
           "affinity": { … }, "advancement_pending": null, "base_passive_pct": 0.4 }
```

## 6. HUD / CLI

- **HUD: no change.** The passive is felt through faster leveling; the form/level already show.
- **`rpg status`** adds a line: `passive: +40% (Infra Archmage)` (from `base_passive_pct`).

## 7. Components

| File | Change |
|---|---|
| `core/xp.ts` | `TPassiveRates`, `DEFAULT_PASSIVE`, `basePct(tier, rates?)` |
| `core/affinity.ts` | export `lineForEvent` (was the private `lineOf`) |
| `core/classes.ts` | `IClassState` gains `base_passive_pct` |
| `core/config.ts` | `IConfig.passive?` + merge `config.json.passive` over `DEFAULT_PASSIVE` |
| `config/default.json` | document the `passive` block |
| `core/reduce.ts` | sequential causal fold (sort + per-event multiplier + multiplied group xp); set `base_passive_pct` |
| `tools/rpg.ts` | `status` prints the passive line |

`core/` imports stay within `core/`. Dependency rule unchanged.

## 8. Testing (TDD)

- **`core/xp.test.ts`** — `basePct`: `0→0`, `1→0.2`, `4→0.5`, missing tier `→0`, override via a custom rates map.
- **`core/reduce.test.ts`** —
  - **Novice unchanged:** with no profile, `xp_total` equals the plain `Σ xpFor` (a regression guard).
  - **Passive boosts:** with a line set and line-signal events past Lv.5, `xp_total` exceeds the
    plain sum; a **hand-computed micro-case** using a tuned `difficulty` (so Lv.5 is reached in a
    few events) and a round `passive` rate verifies the exact multiplied total.
  - **Order independence of inputs:** the same events shuffled produce the same `xp_total` (the
    reducer sorts by `ts`).
  - **Idempotent:** two reduces give the same state.
  - **`base_passive_pct`** is set from the resolved tier.
- **`tools/rpg.test.ts`** — `status` output contains the `passive:` line once a class is set.

## 9. Definition of done

1. `bun test` green; `bunx tsc --noEmit` clean; `bun run format:check` clean.
2. `reduce` of a classed fixture multiplies line-signal XP per the sequential model; a Novice
   journal is byte-identical to before.
3. Deployed: after `rpg class <line>`, the level/XP rises faster on the line's work; `rpg
   status` shows the passive %. (Rates are then tuned in `config.json` as desired.)

## 10. Out of scope (→ later)

- **Specialist passives** (per-branch: combos, session-end ×2, infra-touch, …).
- **§6.4 balance:** EV-matching, floor/pity, auto-tune from observed frequency.
- **Selection-time tracking** (exact journal point a class/tier was chosen) and branch-specific
  base rates.
- Loot, secret classes → 2c. Prestige/season → post-launch.
