# Phase 3.4 — Pixel-MMORPG UI Reskin (companion panel) design

> **Status:** design approved 2026-06-13. Plan: `docs/superpowers/plans/`.
> Builds on 3.3 (the bottom-panel `WebviewView`). Reskins the companion from the plain HUD into a
> retro 2D-MMORPG look, in a two-column landscape layout sized to the wide/short VS Code panel.
> Reference: the user's Claude-design mockup (two columns: scene + portrait frame on the left,
> activity log + nav on the right).

## Goal

Turn the companion into a **retro pixel-MMORPG interface**: a left **scene** with an overlaid
**portrait/status frame** and a bottom **activity indicator**, plus a right **sidebar** with an
**ACTIVITY LOG** and four placeholder **nav buttons** — all in pixel chrome (pixel font,
gold-bordered purple panels). Every value is real game state except the sprites (emoji/CSS
placeholders now; PixelLab sprites drop in behind the CSS seam later per `art-prompts.md`).

## Architecture & the one core change

Everything is presentational in `app/` **except one small, idempotent reducer addition**: the
ACTIVITY LOG needs event *history*, which `state.json` lacks today (it has only `last_event`). The
reducer will keep a rolling list of recent **milestone** events.

```
journal (NDJSON) ──► core/reduce ──► state.json{ …, recent: ITimelineEntry[] } ──► app renderer
```

The reducer recomputes `recent` from the journal on every fold, so it stays **idempotent** (same
journal → same `recent`). Display strings are NOT in core — the reducer stores structured entries;
the app's `view.ts` formats them.

## Data: `recent` timeline (core)

### Types (`core/timeline.ts`, new)

```ts
export enum TimelineKind {
  LevelUp = "level_up",
  Advance = "advance", // tier/form evolution (a new area too)
  BossDefeated = "boss_defeated",
  BossFled = "boss_fled",
  Loot = "loot", // boss drops (rolled at the boss event, so it is time-anchored)
}

export interface ITimelineEntry {
  kind: TimelineKind;
  detail: string; // the variable noun: new level, form name, item name (boss loot)
  rarity?: string; // loot only — drives the tag/tone
  ts: string; // source event timestamp (ordering)
}

export const TIMELINE_MAX = 12; // keep the last N milestones
```

`core/state.ts` gains `recent?: ITimelineEntry[]` on `IState`.

### Selection rules — all anchored to an event during the fold

These are detectable **with the current event's `ts`** during the single fold pass, so the timeline
is correctly time-ordered and idempotent. The reducer pushes one entry per transition (oldest→newest)
and keeps the last `TIMELINE_MAX`:

| Trigger (during fold, at event `e`) | kind | detail | rarity |
|---|---|---|---|
| `levelFor(running)` crosses to a higher level | `LevelUp` | new level (e.g. `"21"`) | — |
| the class `tier` crosses to a higher tier (form/area changes) | `Advance` | new form name | — |
| a boss is **defeated** at this `action` event | `BossDefeated` | `""` (view → "Defeated a boss") | — |
| → and its boss-table drop, rolled inline at the same event | `Loot` | item display name (loot table) | item rarity |
| a boss **flees** at this `action` event | `BossFled` | `""` (view → "A boss fled") | — |

**Architecture note (why this set):** level/tier/boss transitions occur *inside* the fold loop and
carry `e.ts`. Non-boss loot (levelup/clean/streak triggers) and achievements are computed *after* the
loop from aggregate state with no per-event timestamp, so they cannot be time-ordered cleanly — they
are **out of scope** for the timeline. Non-boss loot still accrues to `inventory` (future Items
panel) and still pops the scene `loot-toast`; the design mockup's log shows exactly this set
(level-up / boss / loot / area), no achievements.

**Not logged:** ordinary `action` XP gains (far too frequent) — those surface as the floating "+N
XP" number in the scene, not the log.

### View formatting (`app/src/view.ts`, pure)

`formatTimeline(entry): { label: string; tag: string; tone: TTimelineTone }` maps kind→display:

| kind | label | tag | tone |
|---|---|---|---|
| LevelUp | `Level up! → {detail}` | `LVL` | gold |
| Advance | `Became {detail}` | `CLASS` | teal |
| BossDefeated | `Defeated a boss` | `BOSS` | green |
| BossFled | `A boss fled` | `FLED` | red |
| Loot | `Loot: {detail}` | `{rarity}` (upper) | by rarity |

## Layout (two columns, fit the wide/short panel)

```
┌──────────────────────────────────────────────┬───────────────────┐
│  SCENE (flex-grow)                            │  SIDEBAR (~280px) │
│   ┌─[portrait frame overlay, top-left]        │  ACTIVITY LOG     │
│   │ 🧙 NAME  LVL· class·T · XP bar · 7d 1.3x  │   • entry … tag   │
│   night sky · moon · stars · grass            │   • entry … tag   │
│   hero 🧙   +N XP(float)   monster 🟢          │   (scrolls)       │
│   ┌─[● Currently: Farming]──(bottom-center)    │  ────────────     │
│                                                │ [Hero][Talents]   │
│                                                │ [Items][Codex]    │
└──────────────────────────────────────────────┴───────────────────┘
```

- The scene is the existing `SceneView` content (hero/monster/boss-encounter/loot-toast) with an
  upgraded pixel background (night-sky gradient + moon + scattered stars/grass tufts in `styles.css`).
- Sidebar is a fixed-width pixel panel; the log scrolls when entries exceed the short panel height;
  nav buttons pinned at the bottom.
- Responsive: short panels keep the portrait frame + activity bar inside the scene; the sidebar
  stays usable down to the panel's min height.

## Components (presentational, per `app/CLAUDE.md` body-order)

| File | Responsibility | New/Mod |
|---|---|---|
| `app/src/components/scene-view.tsx` | two-column layout: scene (left) + `Sidebar` (right); mounts portrait frame + activity bar over the scene | Modify |
| `app/src/components/portrait-frame.tsx` | portrait + name + LVL badge + class·tier + XP bar + streak/mult chips (replaces `hud.tsx`) | Create |
| `app/src/components/activity-bar.tsx` | "● Currently: {Farming/Idle/Rest}" pill (uses `useActivity`) | Create |
| `app/src/components/sidebar.tsx` | wraps `ActivityLog` + `NavBar` in the right panel | Create |
| `app/src/components/activity-log.tsx` | renders `state.recent` rows via `formatTimeline` | Create |
| `app/src/components/nav-bar.tsx` | four placeholder buttons (disabled, visual only) | Create |
| `app/src/components/hud.tsx` + `xp-bar.tsx` + `*-badge.tsx` + `title-tag.tsx` | markup reimplemented inside `portrait-frame`; old files deleted | Remove |
| `app/src/view.ts` | add `formatTimeline`, `passiveMultiplier(state)` (= `1 + base_passive_pct`), `areaLabel(state)` (= `sceneFor(tier).label`) | Modify |
| `app/src/styles.css` | pixel chrome: fonts, gold/purple panels, bars, buttons, night-sky scene | Modify |

Hero/monster/boss remain emoji-CSS placeholders. `boss-encounter.tsx` / `loot-toast.tsx` keep
working inside the new scene.

## Real-vs-placeholder mapping

| UI element | Source | Real? |
|---|---|---|
| name | `state.name` | ✅ |
| class · tier | `state.class.form` · `T{state.class.tier}` | ✅ |
| level (badge) | `state.level` | ✅ |
| XP bar / numbers | `state.xp_in_level` / `state.xp_to_next` | ✅ |
| streak chip | `state.streak.current_days` → `{n}d` | ✅ |
| multiplier chip | `1 + state.class.base_passive_pct` → `{x}x` (Calypso 1.3x, T4 1.5x) | ✅ |
| area label | `sceneFor(state.class.tier).label` | ✅ |
| activity ("Currently: …") | `useActivity` (existing) | ✅ |
| ACTIVITY LOG | `state.recent` (new) | ✅ |
| portrait / hero / monster / boss | emoji + CSS | ⛔ placeholder (PixelLab later) |
| nav buttons | static | ⛔ placeholder (panels later) |

## Styling

- **Fonts:** `Pixelify Sans` (body/labels) + `Press Start 2P` (small caps tags) — loaded once.
- **Chrome:** purple panels (`#4a2d7a`-ish) with a thick gold border + inset bevel; bars with a dark
  inset track; tag chips; pixel buttons. All in `styles.css` (the existing art-swap surface).
- **Scene:** night-sky vertical gradient + a moon + scattered star/grass dots; grass band at the
  bottom with a dotted horizon. `image-rendering: pixelated` where it helps.

## Error handling

- `state.recent` absent/empty → the log shows an empty state ("No deeds yet…"); everything else
  renders from existing fields.
- A malformed/missing `class` → defaults already handled by existing helpers (novice/tier 0).
- The reducer never throws on journal gaps; `recent` simply reflects whatever milestones exist.

## Testing

- **`core/timeline.ts`** (bun): `appendTimeline` keeps ≤ `TIMELINE_MAX`, newest-last, and is a pure
  function of its inputs.
- **`core/reduce.ts`** (bun): folding a fixture journal yields the expected `recent` (level-up +
  loot + boss + achievement entries, ordered); **idempotency** — folding twice gives identical
  `recent`; ordinary actions do NOT produce entries.
- **`app/src/view.ts`** (bun): `formatTimeline` for each kind (label/tag/tone); `passiveMultiplier`
  and `areaLabel` mapping.
- **Components:** presentational — verified visually in the VS Code panel (per `app/CLAUDE.md`).

## Scope / non-goals (later checkpoints)

- **Real PixelLab sprites** (hero/monster/boss/portrait) — drop in behind the CSS seam later.
- **Functional nav panels** (Hero/Talents/Items/Codex) — placeholder now.
- **T4 realm mapping**, **monster-approach walk**, **up-class world-transition** — separate
  checkpoints.
