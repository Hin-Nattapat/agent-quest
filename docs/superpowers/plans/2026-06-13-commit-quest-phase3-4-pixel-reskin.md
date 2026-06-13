# Phase 3.4 — Pixel-MMORPG UI Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the VS Code companion into a retro pixel-MMORPG, two-column panel (scene + portrait frame + activity bar on the left; activity log + nav on the right), driven by real state plus a new reducer-owned `recent` timeline.

**Architecture:** One small, idempotent core addition (`recent: ITimelineEntry[]` built during the fold from event-anchored milestones), pure `view.ts` formatters, and presentational React components styled by `styles.css` (the art-swap surface; sprites stay emoji placeholders). Renderer talks to state via the existing `ITransport`; nothing in the transport/host changes.

**Tech Stack:** Bun + TypeScript (core, tests), React 19 + Vite (`app/`), CSS (pixel chrome). Tests: `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-13-commit-quest-phase3-4-pixel-reskin-design.md`

---

## File Structure

| File | Responsibility | New/Mod |
|---|---|---|
| `core/timeline.ts` | `TimelineKind`, `ITimelineEntry`, `TIMELINE_MAX`, pure `pushTimeline` | Create |
| `core/state.ts` | add `recent?: ITimelineEntry[]` to `IState` | Modify |
| `core/reduce.ts` | build `recent` during the fold (level-up / advance / boss / boss-loot) | Modify |
| `test/core/timeline.test.ts` | `pushTimeline` cap/order | Create |
| `test/core/reduce.test.ts` | timeline selection + idempotency | Modify |
| `app/src/view.ts` | `formatTimeline`, `passiveMultiplier`, `areaLabel`, `TTimelineTone` | Modify |
| `app/src/view.test.ts` | formatter + mapping tests | Modify |
| `app/src/components/portrait-frame.tsx` | portrait + name + level + class·tier + XP bar + chips | Create |
| `app/src/components/activity-bar.tsx` | "Currently: …" pill | Create |
| `app/src/components/activity-log.tsx` | renders `state.recent` rows | Create |
| `app/src/components/nav-bar.tsx` | 4 placeholder buttons | Create |
| `app/src/components/sidebar.tsx` | wraps activity-log + nav-bar | Create |
| `app/src/components/scene-view.tsx` | two-column layout; mounts the above | Modify |
| `app/src/components/{hud,xp-bar,streak-badge,achievement-count,class-badge,title-tag}.tsx` | folded into portrait-frame | Delete |
| `app/src/styles.css` | pixel chrome + fonts + night-sky scene | Modify |

---

### Task 1: `core/timeline.ts` + `recent` on `IState`

**Files:**
- Create: `core/timeline.ts`
- Modify: `core/state.ts`
- Test: `test/core/timeline.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/timeline.test.ts`:

```ts
import { test, expect } from "bun:test";
import {
  pushTimeline,
  TimelineKind,
  TIMELINE_MAX,
  type ITimelineEntry,
} from "../../core/timeline";

const mk = (n: number): ITimelineEntry => ({
  kind: TimelineKind.LevelUp,
  detail: String(n),
  ts: "t",
});

test("pushTimeline appends, keeps newest last, caps at TIMELINE_MAX", () => {
  let list: ITimelineEntry[] = [];
  for (let i = 1; i <= TIMELINE_MAX + 3; i++) {
    list = pushTimeline(list, mk(i));
  }
  expect(list.length).toBe(TIMELINE_MAX);
  expect(list[list.length - 1].detail).toBe(String(TIMELINE_MAX + 3));
  expect(list[0].detail).toBe(String(4)); // first 3 dropped
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/timeline.test.ts`
Expected: FAIL — cannot find module `../../core/timeline`.

- [ ] **Step 3: Create `core/timeline.ts`**

```ts
export enum TimelineKind {
  LevelUp = "level_up",
  Advance = "advance", // tier/form evolution (also a new area)
  BossDefeated = "boss_defeated",
  BossFled = "boss_fled",
  Loot = "loot", // boss drops (rolled at the boss event, so time-anchored)
}

export interface ITimelineEntry {
  kind: TimelineKind;
  detail: string; // new level, form name, or boss-loot item name
  rarity?: string; // loot only — drives the tag/tone
  ts: string; // source event timestamp (ordering)
}

export const TIMELINE_MAX = 12;

// Append one milestone, keeping only the last TIMELINE_MAX (newest last).
export const pushTimeline = (
  list: ITimelineEntry[],
  entry: ITimelineEntry,
): ITimelineEntry[] => {
  const next = [...list, entry];
  if (next.length > TIMELINE_MAX) {
    return next.slice(next.length - TIMELINE_MAX);
  }
  return next;
};
```

- [ ] **Step 4: Add `recent` to `IState`**

In `core/state.ts`, add the import and the field. After the existing `import type { EventType } from "./events";` line add:

```ts
import type { ITimelineEntry } from "./timeline";
```

Inside `interface IState`, after the `last_event?: …;` line add:

```ts
  recent?: ITimelineEntry[];
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/timeline.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add core/timeline.ts core/state.ts test/core/timeline.test.ts
git commit -m "feat(core): recent[] timeline type + pushTimeline helper"
```

---

### Task 2: Build `recent` in the reducer

**Files:**
- Modify: `core/reduce.ts`
- Test: `test/core/reduce.test.ts`

The reducer pushes a milestone whenever, **during the fold**, the level crosses up, the class tier crosses up, or a boss is resolved at an `action` event (with its boss-table drop rolled inline for the loot label).

- [ ] **Step 1: Write the failing test**

Append to `test/core/reduce.test.ts`:

```ts
import { TimelineKind } from "../../core/timeline";

const cfgBoss = {
  weights: DEFAULT_WEIGHTS,
  difficulty: DEFAULT_DIFFICULTY,
  boss_rate: 1, // every action spawns a boss (deterministic for the test)
  boss_flee_rate: 0, // never flees -> always defeated + drops
};

test("reduce records level-up + boss + loot milestones, idempotently", () => {
  const events = [
    ev({ type: "action", action: "edit" }),
    ev({ type: "action", action: "write" }),
    ev({ type: "action", action: "run" }),
  ];
  const s = reduce({ events, config: cfgBoss });
  const kinds = (s.recent ?? []).map(r => r.kind);
  expect(kinds).toContain(TimelineKind.BossDefeated);
  expect(kinds).toContain(TimelineKind.Loot);
  expect(kinds).toContain(TimelineKind.LevelUp);

  const s2 = reduce({ events, config: cfgBoss });
  expect(s2.recent).toEqual(s.recent); // idempotent
});

test("no boss spawns -> no boss/loot milestones", () => {
  const cfgNoBoss = {
    weights: DEFAULT_WEIGHTS,
    difficulty: DEFAULT_DIFFICULTY,
    boss_rate: 0,
  };
  const s = reduce({
    events: [ev({ type: "action", action: "edit" }), ev({ type: "prompt" })],
    config: cfgNoBoss,
  });
  const kinds = (s.recent ?? []).map(r => r.kind);
  expect(kinds).not.toContain(TimelineKind.BossDefeated);
  expect(kinds).not.toContain(TimelineKind.Loot);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `s.recent` is `undefined`, so `kinds` is empty and `toContain` fails.

- [ ] **Step 3: Add the imports**

In `core/reduce.ts`, add `rollDrop` to the existing `loot` import (it currently imports `rollInventory, resolveCosmetics, …`):

```ts
import {
  rollInventory,
  rollDrop,
  resolveCosmetics,
  LOOT_TABLE,
  DROP_TABLES,
  DEFAULT_BOSS_RATE,
  DEFAULT_BOSS_FLEE_RATE,
  type ITrigger,
} from "./loot";
```

Add a new import line for the timeline:

```ts
import { TimelineKind, pushTimeline, type ITimelineEntry } from "./timeline";
```

- [ ] **Step 4: Hoist loot tables + add timeline trackers before the fold loop**

In `reduce`, the line `const branch = profile?.branch ?? null;` currently sits *after* the loop. Move it up next to `const line = profile?.line ?? null;`. Then, just before `let running = 0;`, add:

```ts
  const lootTable = config.loot ?? LOOT_TABLE;
  const dropTables = config.drops ?? DROP_TABLES;
  let recent: ITimelineEntry[] = [];
  let prevLevel = levelFor(0, config.difficulty); // level at 0 xp (= 1)
  let prevTier = 0;
```

Then, later in the file, **delete** the now-duplicate declarations: the old `const branch = profile?.branch ?? null;` (after the loop) and the old `const lootTable = config.loot ?? LOOT_TABLE;` (after the loop). The `rollInventory` call below already references `dropTables`/`lootTable`; update its `dropTables:` argument to use the hoisted `dropTables` const:

```ts
  const inventory = rollInventory({ triggers, lootTable, dropTables });
```

- [ ] **Step 5: Detect level-up + advance after `running += gained;`**

In the fold loop, immediately after the line `running += gained;`, add:

```ts
    const newLevel = levelFor(running, config.difficulty);
    if (newLevel > prevLevel) {
      for (let lv = prevLevel + 1; lv <= newLevel; lv++) {
        recent = pushTimeline(recent, {
          kind: TimelineKind.LevelUp,
          detail: String(lv),
          ts: e.ts,
        });
      }
      prevLevel = newLevel;
    }
    const newTier = line != null && newLevel >= 5 ? tierForLevel(newLevel) : 0;
    if (newTier > prevTier) {
      recent = pushTimeline(recent, {
        kind: TimelineKind.Advance,
        detail: formFor({ line, tier: newTier, branch }),
        ts: e.ts,
      });
      prevTier = newTier;
    }
```

- [ ] **Step 6: Record boss milestones in the existing boss block**

Find the boss block inside the loop and extend it so it reads:

```ts
    if (e.type === EventType.Action) {
      bossOrdinal++;
      if (seededRng(`boss:${bossOrdinal}`)() < bossRate) {
        if (seededRng(`bossflee:${bossOrdinal}`)() < bossFleeRate) {
          bossFled++;
          recent = pushTimeline(recent, {
            kind: TimelineKind.BossFled,
            detail: "",
            ts: e.ts,
          });
        } else {
          bossDefeated++;
          bossTriggers.push({ table: "boss", seed: `bossloot:${bossOrdinal}` });
          recent = pushTimeline(recent, {
            kind: TimelineKind.BossDefeated,
            detail: "",
            ts: e.ts,
          });
          const dropId = rollDrop({
            trigger: { table: "boss", seed: `bossloot:${bossOrdinal}` },
            lootTable,
            dropTables,
          });
          if (dropId && lootTable[dropId]) {
            recent = pushTimeline(recent, {
              kind: TimelineKind.Loot,
              detail: lootTable[dropId].name,
              rarity: lootTable[dropId].rarity,
              ts: e.ts,
            });
          }
        }
      }
    }
```

- [ ] **Step 7: Put `recent` on the state**

In the `prelim` object literal, add `recent,` (e.g. right after `inventory,`):

```ts
    inventory,
    recent,
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (new timeline tests + all existing reduce tests still green).

- [ ] **Step 9: Full suite + root typecheck**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail` (do NOT use `tail`).
Run: `bunx tsc --noEmit` → clean.

- [ ] **Step 10: Commit**

```bash
git add core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): build recent[] timeline during the fold (level/advance/boss/loot)"
```

---

### Task 3: View formatters (`view.ts`)

**Files:**
- Modify: `app/src/view.ts`
- Test: `app/src/view.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `app/src/view.test.ts` (it already imports from `./view`; add the new names to that import and add `TimelineKind`):

```ts
import { formatTimeline, passiveMultiplier, areaLabel } from "./view";
import { TimelineKind } from "../../core/timeline";
import type { IState } from "../../core/state";

const asState = (o: object): IState => o as unknown as IState;

test("formatTimeline maps each kind to label/tag/tone", () => {
  expect(formatTimeline({ kind: TimelineKind.LevelUp, detail: "21", ts: "t" })).toEqual({
    label: "Level up! → 21",
    tag: "LVL",
    tone: "gold",
  });
  expect(
    formatTimeline({ kind: TimelineKind.Loot, detail: "Arcane Staff", rarity: "rare", ts: "t" }),
  ).toEqual({ label: "Loot: Arcane Staff", tag: "RARE", tone: "rare" });
  expect(formatTimeline({ kind: TimelineKind.BossFled, detail: "", ts: "t" }).tag).toBe("FLED");
  expect(formatTimeline({ kind: TimelineKind.Advance, detail: "Infra Archmage", ts: "t" })).toEqual({
    label: "Became Infra Archmage",
    tag: "CLASS",
    tone: "teal",
  });
});

test("passiveMultiplier = 1 + base_passive_pct, one decimal", () => {
  expect(passiveMultiplier(asState({ class: { base_passive_pct: 0.3 } }))).toBe("1.3");
  expect(passiveMultiplier(asState({}))).toBe("1.0");
});

test("areaLabel comes from the tier scene", () => {
  expect(areaLabel(asState({ class: { tier: 1 } }))).toBe("Grassland outside town");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test app/src/view.test.ts`
Expected: FAIL — `formatTimeline is not a function`.

- [ ] **Step 3: Implement the helpers**

Append to `app/src/view.ts` (it already imports `IState`; add the two new imports at the top):

```ts
import { TimelineKind, type ITimelineEntry } from "../../core/timeline";
import { sceneFor } from "./scene";

export type TTimelineTone =
  | "gold"
  | "teal"
  | "green"
  | "red"
  | "common"
  | "rare"
  | "epic"
  | "legendary";

export interface ITimelineDisplay {
  label: string;
  tag: string;
  tone: TTimelineTone;
}

export function formatTimeline(entry: ITimelineEntry): ITimelineDisplay {
  if (entry.kind === TimelineKind.LevelUp) {
    return { label: `Level up! → ${entry.detail}`, tag: "LVL", tone: "gold" };
  }
  if (entry.kind === TimelineKind.Advance) {
    return { label: `Became ${entry.detail}`, tag: "CLASS", tone: "teal" };
  }
  if (entry.kind === TimelineKind.BossDefeated) {
    return { label: "Defeated a boss", tag: "BOSS", tone: "green" };
  }
  if (entry.kind === TimelineKind.BossFled) {
    return { label: "A boss fled", tag: "FLED", tone: "red" };
  }
  const rarity = entry.rarity ?? "common";
  return {
    label: `Loot: ${entry.detail}`,
    tag: rarity.toUpperCase(),
    tone: rarity as TTimelineTone,
  };
}

export function passiveMultiplier(state: IState): string {
  const pct = state.class?.base_passive_pct ?? 0;
  return (1 + pct).toFixed(1);
}

export function areaLabel(state: IState): string {
  return sceneFor(state.class?.tier ?? 0).label;
}
```

- [ ] **Step 4: Run test + app typecheck**

Run: `bun test app/src/view.test.ts` → PASS.
Run: `cd app && npx tsc --noEmit` → clean (then `cd ..`).

- [ ] **Step 5: Commit**

```bash
git add app/src/view.ts app/src/view.test.ts
git commit -m "feat(app): timeline formatter + passive-multiplier + area-label helpers"
```

---

### Task 4: Portrait frame component

**Files:**
- Create: `app/src/components/portrait-frame.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { IState } from "../../../core/state";
import { displayName, passiveMultiplier, xpPercent } from "../view";

interface IProps {
  state: IState;
}

const PortraitFrame = (props: IProps) => {
  const { state } = props;
  const tier = state.class?.tier ?? 0;
  const form = state.class?.form ?? "Novice";
  const days = state.streak?.current_days ?? 0;
  const total = state.xp_in_level + state.xp_to_next;

  return (
    <div className="portrait-frame">
      <div className="portrait">
        <span className="sprite portrait-face" aria-hidden="true" />
        <span className="lvl-badge">{state.level}</span>
      </div>
      <div className="portrait-body">
        <div className="pf-top">
          <b className="pf-name">{displayName(state)}</b>
          <span className="pf-class">
            {form}
            {tier > 0 ? ` · T${tier}` : ""}
          </span>
        </div>
        <div className="xpbar">
          <i style={{ width: `${xpPercent(state)}%` }} />
          <span>
            XP {state.xp_in_level} / {total}
          </span>
        </div>
        <div className="pf-chips">
          {days > 0 ? <span className="chip chip-streak">🔥 {days}d</span> : null}
          <span className="chip chip-mult">{passiveMultiplier(state)}x</span>
        </div>
      </div>
    </div>
  );
};

export default PortraitFrame;
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit` → clean (then `cd ..`). (The component is unused until Task 7 wires it; typecheck confirms the props/imports.)

- [ ] **Step 3: Commit**

```bash
git add app/src/components/portrait-frame.tsx
git commit -m "feat(app): portrait-frame component (name/level/class/xp/streak/mult)"
```

---

### Task 5: Activity bar, activity log, nav bar, sidebar

**Files:**
- Create: `app/src/components/activity-bar.tsx`
- Create: `app/src/components/activity-log.tsx`
- Create: `app/src/components/nav-bar.tsx`
- Create: `app/src/components/sidebar.tsx`

- [ ] **Step 1: Create `activity-bar.tsx`**

```tsx
import { ActivityState } from "../activity";

interface IProps {
  activity: ActivityState;
}

const LABELS: Record<ActivityState, string> = {
  [ActivityState.Farming]: "Farming",
  [ActivityState.Idle]: "Idle",
  [ActivityState.Rest]: "Resting",
};

const ActivityBar = (props: IProps) => {
  const { activity } = props;
  return (
    <div className={`activity-bar activity-${activity}`}>
      <span className="activity-dot" /> Currently: {LABELS[activity]}
    </div>
  );
};

export default ActivityBar;
```

- [ ] **Step 2: Create `activity-log.tsx`**

```tsx
import type { IState } from "../../../core/state";
import { formatTimeline } from "../view";

interface IProps {
  state: IState;
}

const ActivityLog = (props: IProps) => {
  const { state } = props;
  const entries = state.recent ?? [];

  return (
    <div className="activity-log panel">
      <div className="log-head">Activity Log</div>
      {entries.length === 0 ? (
        <div className="log-empty">No deeds yet…</div>
      ) : (
        <ul className="log-list">
          {entries
            .slice()
            .reverse()
            .map((entry, i) => {
              const f = formatTimeline(entry);
              return (
                <li key={i} className={`log-row tone-${f.tone}`}>
                  <span className="log-dot" />
                  <span className="log-label">{f.label}</span>
                  <span className="log-tag">{f.tag}</span>
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
};

export default ActivityLog;
```

- [ ] **Step 3: Create `nav-bar.tsx`**

```tsx
const BUTTONS = ["Hero", "Talents", "Items", "Codex"];

const NavBar = () => {
  return (
    <div className="nav-bar">
      {BUTTONS.map(label => (
        <button key={label} className="nav-btn" type="button" disabled>
          {label}
        </button>
      ))}
    </div>
  );
};

export default NavBar;
```

- [ ] **Step 4: Create `sidebar.tsx`**

```tsx
import type { IState } from "../../../core/state";
import ActivityLog from "./activity-log";
import NavBar from "./nav-bar";

interface IProps {
  state: IState;
}

const Sidebar = (props: IProps) => {
  const { state } = props;
  return (
    <div className="sidebar">
      <ActivityLog state={state} />
      <NavBar />
    </div>
  );
};

export default Sidebar;
```

- [ ] **Step 5: Typecheck**

Run: `cd app && npx tsc --noEmit` → clean (then `cd ..`).

- [ ] **Step 6: Commit**

```bash
git add app/src/components/activity-bar.tsx app/src/components/activity-log.tsx app/src/components/nav-bar.tsx app/src/components/sidebar.tsx
git commit -m "feat(app): activity-bar, activity-log, nav-bar, sidebar components"
```

---

### Task 6: Two-column layout + remove the old HUD pieces

**Files:**
- Modify: `app/src/components/scene-view.tsx`
- Delete: `app/src/components/{hud,xp-bar,streak-badge,achievement-count,class-badge,title-tag}.tsx`

- [ ] **Step 1: Replace `scene-view.tsx`**

```tsx
import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import { useEncounter } from "../use-encounter";
import Hero from "./hero";
import Monster from "./monster";
import BossEncounter from "./boss-encounter";
import PortraitFrame from "./portrait-frame";
import ActivityBar from "./activity-bar";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const encounter = useEncounter(state);
  const scene = sceneFor(state.class?.tier ?? 0);
  const line = state.class?.line ?? "novice";

  return (
    <div className="companion">
      <div className={`scene scene-${scene.theme}`}>
        <div className="sky" aria-hidden="true" />
        {activity !== ActivityState.Rest && <Monster scene={scene} />}
        <Hero line={line} activity={activity} />
        {encounter && <BossEncounter encounter={encounter} />}
        <PortraitFrame state={state} />
        <ActivityBar activity={activity} />
      </div>
      <Sidebar state={state} />
    </div>
  );
};

export default SceneView;
```

- [ ] **Step 2: Delete the folded-in components**

```bash
git rm app/src/components/hud.tsx app/src/components/xp-bar.tsx app/src/components/streak-badge.tsx app/src/components/achievement-count.tsx app/src/components/class-badge.tsx app/src/components/title-tag.tsx
```

(If any of those files do not exist, drop them from the command — the set to remove is whatever the old `Hud` composed. Verify none are still imported: `grep -rn "hud\|xp-bar\|streak-badge\|achievement-count\|class-badge\|title-tag" app/src` should return nothing after this task.)

- [ ] **Step 3: Typecheck + build**

Run: `cd app && npx tsc --noEmit && npm run build` → clean; `dist/assets/app.js` rebuilt (then `cd ..`).
Run: `grep -rn "from \"./hud\"\|/xp-bar\|/streak-badge\|/achievement-count\|/class-badge\|/title-tag" app/src` → no matches.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/scene-view.tsx
git commit -m "feat(app): two-column companion layout; fold old HUD into portrait-frame"
```

---

### Task 7: Pixel chrome styles

**Files:**
- Modify: `app/src/styles.css`

Replace the file with the stylesheet below. It keeps the existing animation keyframes (hero-bob/sway, boss-hit/flee, toast-rise) and adds the pixel chrome + two-column layout + night-sky scene. Fonts load from Google Fonts via `@import`.

- [ ] **Step 1: Overwrite `app/src/styles.css`**

```css
@import url("https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600;700&family=Press+Start+2P&display=swap");

:root {
  --gold: #f0c040;
  --panel: #4a2d7a;
  --panel-dark: #2a1a40;
  --ink: #1a0f2e;
  --text: #ece4f7;
  --dim: #a99bc8;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: "Pixelify Sans", system-ui, sans-serif;
  color: var(--text);
  background: #0e0a18;
  image-rendering: pixelated;
}

.loading {
  display: grid;
  place-items: center;
  height: 100vh;
  font-family: "Pixelify Sans", monospace;
  color: var(--dim);
}

/* ── two-column companion ── */
.companion {
  display: flex;
  gap: 8px;
  height: 100vh;
  padding: 8px;
}

/* ── scene (left) ── */
.scene {
  position: relative;
  flex: 1;
  min-width: 0;
  border: 3px solid var(--gold);
  border-radius: 4px;
  overflow: hidden;
  box-shadow: inset 0 0 0 2px var(--ink);
  background-color: #16331f;
}
.sky {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(2px 2px at 20% 18%, #fff8, transparent),
    radial-gradient(2px 2px at 70% 28%, #fff6, transparent),
    radial-gradient(2px 2px at 45% 12%, #fff7, transparent),
    radial-gradient(circle at 82% 20%, #f3eecf 0 9px, transparent 10px),
    linear-gradient(180deg, #1a1640 0%, #2a2456 55%, #234a2b 66%, #1a3a22 100%);
}
.scene-grassland .sky {
  background:
    radial-gradient(2px 2px at 20% 18%, #fff8, transparent),
    radial-gradient(circle at 82% 20%, #f3eecf 0 9px, transparent 10px),
    linear-gradient(180deg, #1a1640, #2a2456 55%, #2e5d2b 66%, #1f3f1a);
}
.scene-forest .sky {
  background: linear-gradient(180deg, #0c1d12, #16331f 60%, #0c1d12);
}
.scene-dungeon .sky {
  background: linear-gradient(180deg, #141019, #2a2230 60%, #141019);
}
.scene-secret_realm .sky {
  background: linear-gradient(180deg, #15102a, #3a2c54 60%, #15102a);
}

.sprite {
  position: absolute;
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  font-size: 40px;
}
.hero {
  left: 30%;
  bottom: 12%;
}
.hero::after {
  content: "🧙";
}
.hero-farming {
  animation: hero-bob 0.5s steps(2) infinite;
}
.hero-idle {
  animation: hero-sway 2.4s ease-in-out infinite;
}
.hero-rest {
  opacity: 0.85;
}
.hero-rest::after {
  content: "🧙";
  filter: grayscale(0.4);
}
.monster {
  right: 20%;
  bottom: 14%;
  font-size: 34px;
}
.monster-grassland::after {
  content: "🟢";
}
.monster-forest::after {
  content: "👻";
}
.monster-dungeon::after {
  content: "👹";
}
.monster-secret_realm::after {
  content: "👑";
}
@keyframes hero-bob {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-6px);
  }
}
@keyframes hero-sway {
  0%,
  100% {
    transform: translateX(0);
  }
  50% {
    transform: translateX(4px);
  }
}

/* ── pixel panel chrome ── */
.panel {
  background: var(--panel);
  border: 3px solid var(--gold);
  box-shadow:
    inset 0 0 0 2px var(--panel-dark),
    0 0 0 2px var(--ink);
  border-radius: 3px;
}

/* ── portrait frame (overlay top-left of scene) ── */
.portrait-frame {
  position: absolute;
  top: 10px;
  left: 10px;
  display: flex;
  gap: 8px;
  padding: 6px;
  max-width: 320px;
  background: var(--panel);
  border: 3px solid var(--gold);
  box-shadow:
    inset 0 0 0 2px var(--panel-dark),
    0 0 0 2px var(--ink);
  border-radius: 3px;
}
.portrait {
  position: relative;
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  background: var(--panel-dark);
  border: 2px solid var(--ink);
  font-size: 30px;
}
.portrait-face::after {
  content: "🧙";
}
.lvl-badge {
  position: absolute;
  left: -10px;
  bottom: -10px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: #3a2456;
  border: 3px solid var(--gold);
  font-weight: 700;
  font-size: 12px;
  text-shadow: 1px 1px 0 #000;
}
.portrait-body {
  flex: 1;
  min-width: 0;
}
.pf-top {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  align-items: baseline;
}
.pf-name {
  font-size: 15px;
  letter-spacing: 0.5px;
}
.pf-class {
  font-size: 11px;
  color: var(--gold);
  white-space: nowrap;
}
.xpbar {
  position: relative;
  height: 13px;
  margin-top: 5px;
  border: 2px solid var(--ink);
  background: #241636;
}
.xpbar > i {
  display: block;
  height: 100%;
  background: linear-gradient(180deg, #ffe06a, #e0a020);
  transition: width 500ms ease;
}
.xpbar > span {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  text-shadow: 1px 1px 0 #000;
}
.pf-chips {
  margin-top: 5px;
  display: flex;
  gap: 4px;
}
.chip {
  padding: 1px 6px;
  border-radius: 9px;
  font-size: 10px;
  border: 1px solid var(--ink);
  background: var(--panel-dark);
}
.chip-streak {
  color: #ff9a6a;
}
.chip-mult {
  color: var(--gold);
}

/* ── activity bar (bottom-center of scene) ── */
.activity-bar {
  position: absolute;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  font-size: 12px;
  background: #1d1730dd;
  border: 2px solid var(--gold);
  border-radius: 12px;
  white-space: nowrap;
}
.activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6ad06a;
}
.activity-idle .activity-dot {
  background: var(--gold);
}
.activity-rest .activity-dot {
  background: #8a8a8a;
}

/* ── sidebar (right) ── */
.sidebar {
  width: 240px;
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.activity-log {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 8px;
}
.log-head {
  font-family: "Press Start 2P", monospace;
  font-size: 9px;
  letter-spacing: 1px;
  color: var(--gold);
  padding-bottom: 6px;
}
.log-empty {
  color: var(--dim);
  font-size: 12px;
}
.log-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  min-height: 0;
}
.log-row {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  gap: 6px;
  align-items: center;
  padding: 3px 0;
  font-size: 12px;
}
.log-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}
.log-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.log-tag {
  font-family: "Press Start 2P", monospace;
  font-size: 7px;
  color: var(--dim);
}
.tone-gold {
  color: var(--gold);
}
.tone-teal {
  color: #5fe0c8;
}
.tone-green {
  color: #6ad06a;
}
.tone-red {
  color: #ff6a6a;
}
.tone-common {
  color: #cfcfcf;
}
.tone-rare {
  color: #5fa8ff;
}
.tone-epic {
  color: #c06aff;
}
.tone-legendary {
  color: #ffb84a;
}

/* ── nav buttons ── */
.nav-bar {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  flex: none;
}
.nav-btn {
  font-family: "Pixelify Sans", monospace;
  font-size: 12px;
  color: var(--text);
  padding: 8px 0;
  background: var(--panel);
  border: 2px solid var(--gold);
  box-shadow: inset 0 0 0 2px var(--panel-dark);
  border-radius: 3px;
  cursor: not-allowed;
  opacity: 0.7;
}

/* ── boss encounter (kept from 3.2b) ── */
.boss-encounter {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
.boss-encounter .boss {
  position: static;
  width: 96px;
  height: 96px;
  font-size: 64px;
}
.boss-encounter .boss::after {
  content: "🐉";
}
.boss-defeated .boss {
  animation: boss-hit 0.5s steps(2) 8;
}
.boss-fled .boss {
  animation: boss-flee 1s ease-in forwards;
}
@keyframes boss-hit {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(5px);
  }
}
@keyframes boss-flee {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(120px);
    opacity: 0;
  }
}
.loot-toast {
  position: absolute;
  bottom: 30%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
  animation: toast-rise 0.6s ease-out;
}
.loot-item {
  background: #1d1730e0;
  border: 2px solid var(--gold);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 12px;
}
@keyframes toast-rise {
  from {
    transform: translate(-50%, 12px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}
```

- [ ] **Step 2: Build + format**

Run: `cd app && npm run build` → succeeds (then `cd ..`).
Run: `bun run format` → formats; CSS is Prettier-owned.

- [ ] **Step 3: Commit**

```bash
git add app/src/styles.css
git commit -m "style(app): pixel-MMORPG chrome — panels, fonts, night-sky scene, sidebar"
```

---

### Task 8: Full verification + visual smoke

- [ ] **Step 1: Build everything**

Run:
```bash
cd app && npm run build && cd extension && npm run build && cd ../..
```
Expected: `app/dist/assets/app.js` + `app.css` and `app/extension/dist/extension.js` all build clean.

- [ ] **Step 2: Tests + typecheck (every package)**

Run:
```bash
bun test 2>&1 | grep -E "pass|fail"      # 0 fail (do NOT use tail)
bunx tsc --noEmit                         # root
cd app && npx tsc --noEmit && cd ..       # app
cd app/extension && npm run typecheck && cd ../..  # extension
bun run format && bun run format:check    # clean
```
Expected: all green/clean.

- [ ] **Step 3: Manual visual smoke (Extension Development Host)**

In `app/extension`, press the green Run ▶️ (or `fn+F5`) → in the dev host run *"Commit Quest: Open Companion"*. The **COMMIT QUEST** panel should now show: two columns — left a night-sky scene with the gold-framed portrait (name/level/class·T/XP bar/streak·mult), hero + monster, and a "Currently: …" pill; right the **Activity Log** (recent level-up/boss/loot rows, newest first) and the four disabled nav buttons. Resize the panel to confirm the layout holds.

- [ ] **Step 4: Restore the demo `config.json` if needed**

The reducer change is covered by tests; no runtime config change is required. If `~/.agentrpg/config.json` was set to a high `boss_rate` for testing, restore it: `cp config/default.json ~/.agentrpg/config.json`.

---

## Self-Review

**1. Spec coverage**
- `recent` timeline type + reducer build (event-anchored kinds) → Tasks 1, 2. ✓
- View formatters (`formatTimeline`/`passiveMultiplier`/`areaLabel`) → Task 3. ✓
- Components: portrait-frame, activity-bar, activity-log, nav-bar, sidebar → Tasks 4, 5. ✓
- Two-column layout + remove old HUD pieces → Task 6. ✓
- Pixel chrome + fonts + night-sky scene in `styles.css` → Task 7. ✓
- Real-vs-placeholder mapping (name/class·T/level/XP/streak/mult/area/activity real; sprites emoji) → Tasks 3–7. ✓
- Idempotency + selection tests → Task 2; formatter/mapping tests → Task 3; pushTimeline cap → Task 1. ✓
- Non-goals (real sprites, nav panels, T4 realm/walk/transition) → untouched. ✓

**2. Placeholder scan:** no TBD/TODO; every code step has complete code; commands have expected output. The one conditional (Task 6 delete list) names the exact files and gives a grep to confirm. ✓

**3. Type consistency:** `TimelineKind`/`ITimelineEntry`/`TIMELINE_MAX`/`pushTimeline` (Task 1) used identically in reduce (Task 2) and view (Task 3); `ITimelineDisplay`/`TTimelinetone` from view consumed by activity-log (Task 5); `IState.recent` set in reduce and read in components; `passiveMultiplier`/`xpPercent`/`displayName`/`areaLabel` signatures match across view and components. ✓
