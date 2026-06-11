# Commit Quest — Phase 2c.1 Design (loot)

> First half of 2c (epic #3). Cosmetic loot drops + equip. Builds on 2a (streak/achievements)
> and 2b (class). 2c.2 (secret classes) follows; together they close epic #3. See
> [[phase2-decomposition]]. Full game design: `docs/claude-code-rpg-design.md` §7.1–§7.3.
> Conventions: `CLAUDE.md`.

---

## 1. What 2c.1 proves

Doing certain things drops **cosmetic loot** (random but idempotent), collected in an
inventory; an equipped **title** and **HUD theme** change the statusline immediately. Skins
are collected for the Phase 3 companion app.

## 2. Locked decisions (brainstorm 2026-06-11)

| # | Topic | Decision |
|---|---|---|
| L1 | Randomness | **Seeded RNG per trigger** — each trigger's seed comes from stable journal identity, so a recompute yields the same drop. Tiny `hashStr` + `mulberry32`, no library. |
| L2 | Item kinds | **Cosmetic only:** `title` (equipped, shown by name in the HUD), `theme` (equipped, ANSI colors on the XP bar), `skin` (collected; used by the Phase 3 app, no terminal effect). No buffs. |
| L3 | Triggers | Only what the existing journal can detect: **clean session** (a `session_end` with no `action_fail`), **level-up** (per level 2..current), **streak milestone** (`best_days` ≥ 7/30/100). refactor-size / test / PR triggers are deferred (no signal). |
| L4 | Equip scope | `rpg title`/`rpg theme` equip an **owned** item (in inventory). Skins are not equippable in 2c.1 (Phase 3). Equipped ids live in `profile.json`; the reducer resolves them into `state.cosmetics`. |
| L5 | Every trigger drops | A trigger always yields one item (rarity varies by its drop table) — no "nothing" outcome, to keep it simple. |
| L6 | HUD layout | **Two groups, space-between:** game stats on the **left**, CC monitor on the **right** (incl. CC `rate_limits` 5h/7d). Right-aligns the CC group when `COLUMNS` is known (CC ≥ 2.1.153); **falls back** to the current single line `{left}  \|  {right}` otherwise. |

## 3. Seeded RNG — `core/rng.ts`

- `hashStr(s): number` — cyrb53 string hash.
- `mulberry32(seed): () => number` — PRNG → values in `[0, 1)`.
- `seededRng(seedStr): () => number` = `mulberry32(hashStr(seedStr))`.

Determinism: the same seed string always produces the same sequence → the same drop on every
recompute.

## 4. Loot table — `core/loot.ts`

```ts
enum Rarity { Common="common", Rare="rare", Epic="epic", Legendary="legendary" }
enum LootKind { Title="title", Theme="theme", Skin="skin" }
interface ILootItem { id: string; name: string; rarity: Rarity; kind: LootKind; value?: string }
interface IInventoryItem { id: string; rarity: Rarity; count: number }
```
- `title.name` = the equipped label; `theme.value` = an ANSI SGR code (e.g. `"36"`); `skin` =
  app sprite key (unused in the terminal).
- `LOOT_TABLE` (≈18 items, every rarity populated so `pickItem` always has a pool — legendary
  matters for streak100): e.g. titles `Rookie`/`Codeweaver`/`Archmage`/`The Legendary`; themes
  `Forest(32)`/`Neon(36)`/`Matrix(92)`/`Golden(33)`; skins `Hoodie Dev`/`Cyber Ninja`/`Golden Armor`.
- `DROP_TABLES: Record<string, Array<{ rarity; weight }>>` — per trigger:
  - `clean`: 0.70 common / 0.25 rare / 0.05 epic
  - `levelup`: 0.60 / 0.30 / 0.08 / 0.02
  - `streak7`: 0.70 rare / 0.25 epic / 0.05 legendary
  - `streak30`: 0.80 epic / 0.20 legendary
  - `streak100`: 1.0 legendary
- `rollDrop(trigger, lootTable, dropTables): string | null` — `seededRng(trigger.seed)` →
  weighted `rollRarity` → `pickItem` from that rarity's pool (both rolls share the one PRNG).
- `rollInventory(triggers, lootTable, dropTables): IInventoryItem[]` — roll each trigger, count
  by id, return sorted by id (stable).
- `resolveCosmetics(profile, inventory, lootTable): { title, theme_color }` — an equipped id
  only resolves if **owned** and the right kind; title → its `name`, theme → its `value`.

All defaults live in code (like `DEFAULT_ACHIEVEMENTS`); `config.json` may override `loot` and
`drops`.

## 5. Triggers in the reducer

During the fold, track per session `{ hasFail, hasEnd }`. After the fold:

```
triggers = []
for each session sid: if hasEnd[sid] && !hasFail[sid] -> { table:"clean",   seed:`clean:${sid}` }
for L in 2..level:                                       -> { table:"levelup", seed:`level:${L}` }
if best_days >= 7:                                        -> { table:"streak7",   seed:"streak:7" }
if best_days >= 30:                                       -> { table:"streak30",  seed:"streak:30" }
if best_days >= 100:                                      -> { table:"streak100", seed:"streak:100" }
inventory = rollInventory(triggers, config.loot ?? LOOT_TABLE, config.drops ?? DROP_TABLES)
```

Each trigger's seed is independent of order, and `rollInventory` sorts → fully deterministic
and order-independent.

## 6. `state.json`

```jsonc
"inventory": [ { "id": "neon_theme", "rarity": "rare", "count": 1 },
               { "id": "rookie_title", "rarity": "common", "count": 2 } ],
"cosmetics": { "title": "Codeweaver", "theme_color": "36" }   // resolved from profile + ownership
```
Both optional on `IState`. `profile.json` gains `title?` and `theme?` (equipped item ids).

## 7. HUD — left (game) / right (CC monitor), space-between

`renderHud(state, tail, cols = 0)` builds two groups and lays them out:

```
LEFT  (game): {name}{ the {title}}? · {icon}{form}{ ✨}?  Lv.N {bar←ANSI theme} {pct}%{ 🔥streak}{ 🎒count}
RIGHT (CC):   {model}  $cost  ·  ctx {ctx}%{  ·  5h {x}%}?{  ·  7d {y}%}?
```

- **Title / theme / bag (loot):** `the {title}` only when `cosmetics.title` is set; the XP bar
  is wrapped in `\x1b[{theme_color}m … \x1b[0m` when a theme is equipped; `🎒{n}` (total
  inventory count) shows only when `n > 0`.
- **CC session limits:** `tail` gains `five_hour?`/`seven_day?` from
  `rate_limits.{five_hour,seven_day}.used_percentage` (Pro/Max only, may be `null` → that
  segment is omitted).
- **Layout:** `cols` is the terminal width (`COLUMNS`, set by CC ≥ 2.1.153; `main` passes
  `Number(process.env.COLUMNS) || 0`). If `cols > visibleWidth(left) + visibleWidth(right) + 1`,
  pad between the groups with spaces so the CC group hugs the right edge (space-between).
  Otherwise **fall back** to the current single line `{left}  |  {right}`.
- `visibleWidth` strips ANSI SGR codes (`\x1b[…m`) before measuring; emoji width is approximated
  by JS string length (minor drift, cosmetic).
- With no cosmetics/inventory/rate-limits and `cols = 0`, the output equals the current
  single-line HUD → **existing HUD tests pass unchanged.**

## 8. CLI — `tools/rpg.ts`

| command | effect / validation |
|---|---|
| `rpg inventory` | list owned items grouped by rarity (id, name, count) |
| `rpg title <id>` | equip a title; error if the id is not **owned** or not a `title` |
| `rpg theme <id>` | equip a theme; error if not owned or not a `theme` |

`status` also prints the equipped title/theme.

## 9. Components

| File | Change |
|---|---|
| `core/rng.ts` | new — `hashStr`, `mulberry32`, `seededRng` |
| `core/loot.ts` | new — enums, `ILootItem`/`IInventoryItem`, `LOOT_TABLE`, `DROP_TABLES`, `rollDrop`, `rollInventory`, `resolveCosmetics` |
| `core/profile.ts` | `IProfile` gains `title?`, `theme?` |
| `core/state.ts` | optional `inventory?`, `cosmetics?` |
| `core/config.ts` | `IConfig.loot?`, `IConfig.drops?` + merge |
| `core/reduce.ts` | per-session fail/end tracking → triggers → `rollInventory`; `resolveCosmetics` |
| `hud/statusline.ts` | title prefix, themed bar, 🎒 count; left/right space-between via `cols` + `visibleWidth`; CC `rate_limits` (5h/7d) in `ITail` + `main` |
| `tools/rpg.ts` | `inventory` / `title` / `theme` commands; `status` shows equips |

## 10. Testing (TDD)

- **`core/rng.test.ts`** — `seededRng` deterministic (same seed → same value), values in `[0,1)`, different seeds differ.
- **`core/loot.test.ts`** — `rollDrop` deterministic per seed; `streak100` always yields a `Legendary` item; `rollInventory` aggregates duplicate seeds into counts and sorts; `resolveCosmetics` maps an owned title/theme and returns `null` for unowned/wrong-kind.
- **`core/reduce.test.ts`** — with a zero-weight config (no level-up/streak noise): a clean session drops one item, a session containing an `action_fail` drops nothing; loot is idempotent (two reduces equal); equipped cosmetics resolve only when owned.
- **`hud/statusline.test.ts`** — title prefix, ANSI-themed bar, and `🎒{n}` appear when set; CC
  `5h`/`7d` segments show when present and are omitted when null; a wide `cols` right-aligns the
  CC group (space-between), `cols = 0` falls back to the single line; absent state + `cols = 0`
  leaves the line unchanged.
- **`tools/rpg.test.ts`** — `inventory` lists; `title`/`theme` equip an owned item and reject an unowned one.

## 11. Definition of done

1. `bun test` green; `bunx tsc --noEmit` + `bun run format:check` clean.
2. Loot drops are deterministic and idempotent; a clean session / level-up / streak milestone
   each produce drops per the tables; `rpg title`/`theme` change the HUD.
3. Deployed: real journal yields an inventory; equipping a title/theme is visible in the
   statusline.

## 12. Out of scope (→ later)

- **Buff items** (timed XP multipliers) — stateful/time-dependent.
- **Skin equip** (companion app, Phase 3).
- **refactor-size / test / PR triggers** — need signals we don't capture (command-aware checkpoint).
- **Secret classes** → 2c.2. Trading/gifting cosmetics; achievement-title equip.
