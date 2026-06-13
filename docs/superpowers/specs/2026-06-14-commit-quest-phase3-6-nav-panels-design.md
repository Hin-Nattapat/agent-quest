# Phase 3.6 — Functional Nav Panels design

> **Status:** design approved 2026-06-14. Plan: `docs/superpowers/plans/`.
> Makes the placeholder Hero / Talents / Items / Codex buttons open real **view-only** panels over
> the scene, fed by display data the reducer denormalizes into `state.json` (so the app stays a pure
> consumer). Pixel-MMORPG style, fits the bottom VS Code panel.

## Goal

Click a sidebar nav button → a pixel window overlays the scene showing real data: the hero sheet
(class/affinity/stats), the inventory grid (loot owned + equipped), the deeds codex (achievements),
and the class talent tree. Close with X / Esc / click-outside. One panel at a time.

## Constraints

- **Read-only.** The app consumes `state.json`; it has no write path. Panels **view** only — equipping
  a title/theme still happens via the `rpg` CLI. No interactive mutation.
- **App is a pure state consumer.** Per the seam, the app imports `IState` type-only and never runtime
  game logic. So the display metadata the panels need (item names, achievement descriptions, the class
  tree) is **denormalized into `state.json` by the reducer**, exactly like `recent[]` already is.

## Architecture

```
reducer (has config + profile) ──► state.json {
    inventory[i] += { name, kind, equipped }
    class += { tree }
    achievements += { earned_detail[] }
  } ──► app panels (pure render)
nav button click ──► scene-view useState<TPanelId|null> ──► <PanelOverlay> over the scene
```

## Core denormalization (reducer)

The reducer already loads the loot table, the achievement registry, and the profile, and resolves
display names for `recent[]`. It extends three state shapes:

### `core/loot.ts` — `IInventoryItem`
```ts
export interface IInventoryItem {
  id: string;
  rarity: Rarity;
  count: number;
  name?: string; // resolved display name (loot table)
  kind?: LootKind; // title | theme | skin
  equipped?: boolean; // matches the equipped title/theme id in the profile
}
```
The reducer enriches each rolled inventory item: `name`/`kind` from `lootTable[id]`, and
`equipped = id === profile?.title || id === profile?.theme`.

### `core/classes.ts` — `IClassTree` + `IClassState.tree`
```ts
export interface IClassTree {
  forms: string[]; // tier forms (3 for main lines, 4 for secret lines)
  branches?: { a: string; b: string }; // T4 branch forms (main lines only)
}
```
A pure helper `classTree(line: TLine | null): IClassTree | undefined` builds it: main line →
`{ forms: CLASS_TREE[line].forms (as display strings), branches: CLASS_TREE[line].branches }`;
secret line → `{ forms: SECRET_TREE[line].forms }` (no branches); `null` → `undefined`.
`IClassState` gains `tree?: IClassTree`; the reducer sets it from the player's line.

### `core/state.ts` — `IAchievementsState.earned_detail`
```ts
export interface IEarnedAchievement {
  id: string;
  name: string;
  desc: string;
  points: number;
}
// IAchievementsState gains:
  earned_detail?: IEarnedAchievement[];
```
The reducer maps each earned id through the registry (`{ name, desc, points }`) — ordered by the
earned list. (Locked achievements are NOT included, to avoid spoiling secret unlocks.)

All three are **idempotent** (pure functions of config + journal + profile → same output).

## The four panels (overlay windows; pixel frame + gold border + X)

Each is a presentational component reading only `IState`.

- **🧑 Hero** (no denorm — state already has it): portrait + name + equipped title; class `form · T{tier}`
  (+ branch); level + XP bar; **affinity** — 4 bars (mage / ranger / rogue / sage, `%`); passive
  `+{base_passive_pct*100}%`; key stats (prompts, total actions, sessions, 🐉 `boss_defeated` /
  `boss_fled`, 🔥 best streak).
- **🎒 Items** — a grid of slots, each colored by `rarity`, with a kind icon (👑 title / 🎨 theme /
  👕 skin), the `×count`, the item `name` under it, and a gold ring when `equipped`. Header:
  `Inventory · {distinct} items`. Empty state: "No loot yet…".
- **🏆 Codex** — a scrollable list of earned deeds: `name`, `desc`, and `· {points} pts`, tone-tagged.
  Header: `Deeds · {earned} / {total registry} · {points} pts`; a trailing `??? · {locked} hidden`
  row teases what's left without spoilers.
- **🌳 Talents** — the player's own line tree: `T1 → T2 → T3` forms (current tier highlighted, future
  dimmed) then `T4` branches `a` / `b` (the chosen branch highlighted; both shown dimmed if not yet
  chosen). Secret lines render as a straight 4-form line (no branches).

## Components

| File | Responsibility | New/Mod |
|---|---|---|
| `core/loot.ts` | `IInventoryItem` display fields | Modify |
| `core/classes.ts` | `IClassTree` + `classTree(line)` helper | Modify |
| `core/state.ts` | `IEarnedAchievement` + `earned_detail` | Modify |
| `core/reduce.ts` | enrich inventory, set `class.tree`, build `earned_detail` | Modify |
| `app/src/panels.ts` | `TPanelId` enum (Hero/Talents/Items/Codex) | Create |
| `app/src/components/nav-bar.tsx` | enabled buttons → `onOpen(panel)` | Modify |
| `app/src/components/panel-overlay.tsx` | window chrome + X + Esc + routes to the active panel | Create |
| `app/src/components/hero-panel.tsx` | hero sheet | Create |
| `app/src/components/items-panel.tsx` | inventory grid | Create |
| `app/src/components/codex-panel.tsx` | deeds list | Create |
| `app/src/components/talents-panel.tsx` | class tree | Create |
| `app/src/components/sidebar.tsx` | forward `onOpen` to NavBar | Modify |
| `app/src/components/scene-view.tsx` | hold `activePanel` state; render `<PanelOverlay>` | Modify |
| `app/src/styles.css` | overlay window, grid, bars, close button | Modify |

The Hero panel maps `state.class?.affinity` (a `Record<line, 0..1>`) inline over the fixed line order
`[mage, ranger, rogue, sage]` — no new `view.ts` helper is needed.

State lift: `scene-view` owns `const [panel, setPanel] = useState<TPanelId | null>(null)`, passes
`setPanel` down through `Sidebar` → `NavBar`, and renders `<PanelOverlay activePanel={panel}
onClose={() => setPanel(null)} state={state} />` inside the scene. The overlay closes on its X
button, `Escape`, and a click on its backdrop.

## Data flow & error handling

- Panels read only `state.*`; nothing fetches or mutates.
- Missing denorm fields (old `state.json` before this ships) → panels show graceful empties
  (`name ?? id`, `tree` absent → "No class yet", `earned_detail ?? []`).
- No class chosen (`line === null`) → Talents shows "Choose a class (`rpg class …`)"; Hero shows
  Novice.
- Empty inventory / no deeds → teaching empty states.
- The overlay is `position: absolute` inside the scene; `Escape` is handled by a keydown listener
  mounted only while a panel is open.

## Testing

- **`classTree`** (bun): main line → 3 forms + branches; secret line → 4 forms, no branches; null →
  undefined.
- **`core/reduce.ts`** (bun): inventory items carry `name`/`kind`/`equipped` (equipped matches the
  profile's title/theme); `class.tree` matches the line; `achievements.earned_detail` lists earned
  `{id,name,desc,points}` and excludes locked; **idempotent** (fold twice → identical).
- **`view.ts`** helper (bun) if added.
- **Panels / overlay / nav**: presentational + interaction — verified visually in the VS Code panel
  (open each panel, Esc/X/backdrop close, equipped ring, current-tier highlight).

## Scope / non-goals

- **No equipping from the app** (read-only; `rpg` CLI keeps that).
- **Codex = achievements**, not a monster/realm bestiary.
- **Talents = the player's own line**, not all four lines (affinity across lines already shows in
  Hero).
- No realm mapping, sprites, or animation work (separate checkpoints).
