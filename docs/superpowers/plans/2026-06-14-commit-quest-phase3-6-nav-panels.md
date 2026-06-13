# Phase 3.6 — Functional Nav Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Hero / Talents / Items / Codex sidebar buttons open real view-only overlay panels, fed by display data the reducer denormalizes into `state.json`.

**Architecture:** The reducer adds display fields to `state.json` (inventory `name`/`kind`/`equipped`, `class.tree`, `achievements.earned_detail`/`total`) so the app stays a pure consumer. `scene-view` holds `useState<PanelId | null>`; the nav buttons set it; a `PanelOverlay` renders the active panel over the scene with X / Esc / backdrop close.

**Tech Stack:** Bun + TypeScript (core, tests), React 19 + Vite (`app/`), CSS. Tests: `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-14-commit-quest-phase3-6-nav-panels-design.md`

---

## File Structure

| File | Responsibility | New/Mod |
|---|---|---|
| `core/classes.ts` | `IClassTree` + `classTree(line)` helper | Modify |
| `core/loot.ts` | `IInventoryItem` display fields (`name`/`kind`/`equipped`) | Modify |
| `core/state.ts` | `IEarnedAchievement` + `IClassState.tree` + `IAchievementsState.earned_detail`/`total` | Modify |
| `core/reduce.ts` | enrich inventory, set `class.tree`, build `earned_detail` + `total` | Modify |
| `app/src/panels.ts` | `PanelId` enum | Create |
| `app/src/components/hero-panel.tsx` | hero sheet | Create |
| `app/src/components/items-panel.tsx` | inventory grid | Create |
| `app/src/components/codex-panel.tsx` | deeds list | Create |
| `app/src/components/talents-panel.tsx` | class tree | Create |
| `app/src/components/panel-overlay.tsx` | window chrome + X + Esc + routing | Create |
| `app/src/components/nav-bar.tsx` | enabled buttons → `onOpen(panel)` | Modify |
| `app/src/components/sidebar.tsx` | forward `onOpen` | Modify |
| `app/src/components/scene-view.tsx` | hold `activePanel`; render `PanelOverlay` | Modify |
| `app/src/styles.css` | overlay window, grid, bars, close | Modify |

---

### Task 1: `classTree` helper (core/classes.ts)

**Files:**
- Modify: `core/classes.ts`
- Test: `test/core/classes.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/core/classes.test.ts` (check its imports; it imports from `../../core/classes`):

```ts
import { classTree, ClassLine, SecretLine } from "../../core/classes";

test("classTree gives 3 forms + branches for a main line, 4 + none for secret, undefined for null", () => {
  const mage = classTree(ClassLine.Mage);
  expect(mage?.forms.length).toBe(3);
  expect(mage?.branches?.a).toBe("Cloud Summoner");
  expect(mage?.branches?.b).toBe("Kernel Lich");

  const trick = classTree(SecretLine.Trickster);
  expect(trick?.forms.length).toBe(4);
  expect(trick?.branches).toBeUndefined();

  expect(classTree(null)).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/classes.test.ts`
Expected: FAIL — `classTree is not a function`.

- [ ] **Step 3: Implement**

In `core/classes.ts`, add the type (near `IClassDef`) and the helper (near `isSecret`, which already exists). `TLine`, `ClassLine`, `SecretLine`, `CLASS_TREE`, `SECRET_TREE`, `isSecret` are already defined in this file.

```ts
export interface IClassTree {
  forms: string[]; // tier forms (3 main, 4 secret)
  branches?: { a: string; b: string }; // T4 forms (main lines only)
}

export const classTree = (line: TLine | null): IClassTree | undefined => {
  if (line === null) {
    return undefined;
  }
  if (isSecret(line)) {
    return { forms: [...SECRET_TREE[line].forms] };
  }
  return {
    forms: [...CLASS_TREE[line].forms],
    branches: { ...CLASS_TREE[line].branches },
  };
};
```

Also add `tree?: IClassTree;` to the `IClassState` interface (in this file, after `base_passive_pct: number;`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/classes.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify + commit**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail`; `bunx tsc --noEmit` → clean.

```bash
git add core/classes.ts test/core/classes.test.ts
git commit -m "feat(core): classTree helper + IClassTree + IClassState.tree"
```

---

### Task 2: Reducer denormalization

**Files:**
- Modify: `core/loot.ts`, `core/state.ts`, `core/reduce.ts`
- Test: `test/core/reduce.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `test/core/reduce.test.ts` (it has `evd`, `cfgA` = `{ weights, difficulty, achievements: DEFAULT_ACHIEVEMENTS }`, and imports `reduce`). Add an `IProfile` import:

```ts
import type { IProfile } from "../../core/profile";

test("reduce denormalizes class.tree + achievements.earned_detail + total (idempotent)", () => {
  const events = [evd("2026-06-11", { type: "action", action: "edit" })]; // earns first_blood
  const profile = { line: "mage" } as unknown as IProfile;
  const s = reduce({ events, config: cfgA, today: "2026-06-11", profile });

  expect(s.class?.tree?.forms.length).toBe(3);
  expect(s.class?.tree?.branches).toBeDefined();

  const fb = s.achievements?.earned_detail?.find(d => d.id === "first_blood");
  expect(fb?.name).toBe("First Blood");
  expect(typeof fb?.desc).toBe("string");
  expect(s.achievements?.total).toBeGreaterThan(0);

  expect(reduce({ events, config: cfgA, today: "2026-06-11", profile }).achievements?.earned_detail).toEqual(
    s.achievements?.earned_detail,
  );
});

test("reduce enriches inventory items with name/kind", () => {
  const events = [
    evd("2026-06-11", { session_id: "s1", type: "action", action: "edit" }),
    evd("2026-06-11", { session_id: "s1", type: "session_end" }),
  ];
  const s = reduce({ events, config: cfgA, today: "2026-06-11" });
  for (const item of s.inventory ?? []) {
    expect(typeof item.name).toBe("string");
    expect(typeof item.kind).toBe("string");
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `s.class.tree` undefined.

- [ ] **Step 3: Add the types**

In `core/loot.ts`, extend `IInventoryItem`:
```ts
export interface IInventoryItem {
  id: string;
  rarity: Rarity;
  count: number;
  name?: string;
  kind?: LootKind;
  equipped?: boolean;
}
```

In `core/state.ts`, add the earned-achievement type and the two fields. Add:
```ts
export interface IEarnedAchievement {
  id: string;
  name: string;
  desc: string;
  points: number;
}
```
Then inside `interface IAchievementsState`, after `progress: Record<string, number>;`, add:
```ts
  earned_detail?: IEarnedAchievement[];
  total?: number;
```

- [ ] **Step 4: Wire the reducer**

In `core/reduce.ts`:

(a) Add `classTree` to the existing `./classes` import (which already imports `tierForLevel, formFor, iconFor, advancementPending, SecretLine, type IClassState`):
```ts
import {
  tierForLevel,
  formFor,
  iconFor,
  advancementPending,
  classTree,
  SecretLine,
  type IClassState,
} from "./classes";
```

(b) In the `classState` object literal, add `tree`:
```ts
    base_passive_pct: basePct(classTier, config.passive),
    tree: classTree(line),
```

(c) Replace the `const inventory = rollInventory({ … });` line with an enriched version:
```ts
  const inventoryRaw = rollInventory({ triggers, lootTable, dropTables });
  const inventory = inventoryRaw.map(item => ({
    ...item,
    name: lootTable[item.id]?.name,
    kind: lootTable[item.id]?.kind,
    equipped: item.id === profile?.title || item.id === profile?.theme,
  }));
```

(d) In the return section (after `const registry = config.achievements ?? {};` and the `const achievements = evaluateAchievements(...)` line), build the denormalized achievements and return them. Find:
```ts
  return {
    ...prelim,
    achievements,
    cosmetics,
    unlocked_secret_classes: unlocked,
  };
```
Replace with:
```ts
  const earned_detail = achievements.earned.map(id => ({
    id,
    name: registry[id]?.name ?? id,
    desc: registry[id]?.desc ?? "",
    points: registry[id]?.points ?? 0,
  }));
  return {
    ...prelim,
    achievements: { ...achievements, earned_detail, total: Object.keys(registry).length },
    cosmetics,
    unlocked_secret_classes: unlocked,
  };
```

(Read `core/reduce.ts` first to place these exactly; `registry`, `achievements`, `profile`, `lootTable` are all already in scope at these points.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (new + all existing reduce tests).

- [ ] **Step 6: Full suite + root tsc**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail` (NOT `tail`).
Run: `bunx tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
git add core/loot.ts core/state.ts core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): denormalize inventory/class-tree/achievement display for panels"
```

---

### Task 3: Hero + Items panels

**Files:**
- Create: `app/src/panels.ts`
- Create: `app/src/components/hero-panel.tsx`
- Create: `app/src/components/items-panel.tsx`

- [ ] **Step 1: Create `app/src/panels.ts`**

```ts
export enum PanelId {
  Hero = "hero",
  Talents = "talents",
  Items = "items",
  Codex = "codex",
}
```

- [ ] **Step 2: Create `app/src/components/hero-panel.tsx`**

```tsx
import type { IState } from "../../../core/state";
import { displayName } from "../view";

interface IProps {
  state: IState;
}

const LINES = ["mage", "ranger", "rogue", "sage"];

const HeroPanel = (props: IProps) => {
  const { state } = props;
  const klass = state.class;
  const aff = klass?.affinity ?? {};
  const stats = state.stats;
  const totalActions = Object.values(stats.actions).reduce((a, b) => a + b, 0);

  return (
    <div className="panel-body hero-panel">
      <div className="hero-id">
        <span className="sprite panel-portrait" aria-hidden="true" />
        <div>
          <b className="hp-name">{displayName(state)}</b>
          {state.cosmetics?.title ? (
            <div className="hp-title">the {state.cosmetics.title}</div>
          ) : null}
          <div className="hp-class">
            {klass?.form ?? "Novice"}
            {klass && klass.tier > 0 ? ` · T${klass.tier}` : ""}
          </div>
          <div className="hp-lvl">
            Lv.{state.level} · +{Math.round((klass?.base_passive_pct ?? 0) * 100)}% passive
          </div>
        </div>
      </div>

      <div className="panel-head">Affinity</div>
      <div className="aff-bars">
        {LINES.map(l => {
          const pct = Math.round((aff[l] ?? 0) * 100);
          return (
            <div key={l} className="aff-row">
              <span className="aff-label">{l}</span>
              <div className="aff-bar">
                <i style={{ width: `${pct}%` }} />
              </div>
              <span className="aff-pct">{pct}%</span>
            </div>
          );
        })}
      </div>

      <div className="panel-head">Stats</div>
      <div className="hp-stats">
        <span>📝 {stats.prompts} prompts</span>
        <span>⚙ {totalActions} actions</span>
        <span>🕑 {stats.sessions} sessions</span>
        <span>
          🐉 {stats.boss_defeated ?? 0} slain · {stats.boss_fled ?? 0} fled
        </span>
        <span>🔥 {state.streak?.best_days ?? 0}d best streak</span>
      </div>
    </div>
  );
};

export default HeroPanel;
```

- [ ] **Step 3: Create `app/src/components/items-panel.tsx`**

```tsx
import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const KIND_ICON: Record<string, string> = { title: "👑", theme: "🎨", skin: "👕" };

const ItemsPanel = (props: IProps) => {
  const { state } = props;
  const inv = state.inventory ?? [];

  return (
    <div className="panel-body items-panel">
      <div className="panel-head">Inventory · {inv.length} items</div>
      {inv.length === 0 ? (
        <div className="panel-empty">No loot yet…</div>
      ) : (
        <div className="item-grid">
          {inv.map(item => (
            <div
              key={item.id}
              className={`item-slot rarity-${item.rarity}${item.equipped ? " equipped" : ""}`}
            >
              <span className="item-icon">{KIND_ICON[item.kind ?? "title"] ?? "❔"}</span>
              <span className="item-count">×{item.count}</span>
              <span className="item-name">{item.name ?? item.id}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItemsPanel;
```

- [ ] **Step 4: Typecheck**

Run: `cd app && npx tsc --noEmit` → clean (then `cd ..`). (Unused until Task 5.)

- [ ] **Step 5: Commit**

```bash
git add app/src/panels.ts app/src/components/hero-panel.tsx app/src/components/items-panel.tsx
git commit -m "feat(app): PanelId + hero/items panels"
```

---

### Task 4: Codex + Talents panels

**Files:**
- Create: `app/src/components/codex-panel.tsx`
- Create: `app/src/components/talents-panel.tsx`

- [ ] **Step 1: Create `app/src/components/codex-panel.tsx`**

```tsx
import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const CodexPanel = (props: IProps) => {
  const { state } = props;
  const ach = state.achievements;
  const earned = ach?.earned_detail ?? [];
  const total = ach?.total ?? earned.length;
  const locked = Math.max(0, total - earned.length);

  return (
    <div className="panel-body codex-panel">
      <div className="panel-head">
        Deeds · {earned.length} / {total} · {ach?.points ?? 0} pts
      </div>
      {earned.length === 0 ? (
        <div className="panel-empty">No deeds yet…</div>
      ) : (
        <ul className="deed-list">
          {earned.map(d => (
            <li key={d.id} className="deed-row">
              <div className="deed-top">
                <b className="deed-name">{d.name}</b>
                <span className="deed-pts">{d.points} pts</span>
              </div>
              <div className="deed-desc">{d.desc}</div>
            </li>
          ))}
          {locked > 0 ? (
            <li className="deed-row deed-locked">??? · {locked} hidden</li>
          ) : null}
        </ul>
      )}
    </div>
  );
};

export default CodexPanel;
```

- [ ] **Step 2: Create `app/src/components/talents-panel.tsx`**

```tsx
import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const TalentsPanel = (props: IProps) => {
  const { state } = props;
  const klass = state.class;
  const tree = klass?.tree;
  const tier = klass?.tier ?? 0;
  const branch = klass?.branch ?? null;

  if (!tree) {
    return (
      <div className="panel-body talents-panel">
        <div className="panel-empty">Choose a class (`rpg class …`)</div>
      </div>
    );
  }

  return (
    <div className="panel-body talents-panel">
      <div className="panel-head">{klass?.icon} Talent Tree</div>
      <div className="tree-line">
        {tree.forms.map((form, i) => {
          const t = i + 1;
          const cls = t === tier ? " current" : t < tier ? " past" : "";
          return (
            <span key={form} className={`tree-node${cls}`}>
              T{t} · {form}
            </span>
          );
        })}
      </div>
      {tree.branches ? (
        <div className="tree-branch-group">
          <div className="panel-head">Tier 4 Branch</div>
          <div className="tree-branches">
            <span className={`tree-node${branch === "a" ? " current" : ""}`}>
              a · {tree.branches.a}
            </span>
            <span className={`tree-node${branch === "b" ? " current" : ""}`}>
              b · {tree.branches.b}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TalentsPanel;
```

Note: the `t === tier ? " current" : t < tier ? " past" : ""` is a simple one-line value ternary (allowed); keep it on one line.

- [ ] **Step 3: Typecheck**

Run: `cd app && npx tsc --noEmit` → clean (then `cd ..`).

- [ ] **Step 4: Commit**

```bash
git add app/src/components/codex-panel.tsx app/src/components/talents-panel.tsx
git commit -m "feat(app): codex (deeds) + talents (class tree) panels"
```

---

### Task 5: Overlay + nav wiring

**Files:**
- Create: `app/src/components/panel-overlay.tsx`
- Modify: `app/src/components/nav-bar.tsx`
- Modify: `app/src/components/sidebar.tsx`
- Modify: `app/src/components/scene-view.tsx`

- [ ] **Step 1: Create `app/src/components/panel-overlay.tsx`**

```tsx
import { useEffect } from "react";
import type { IState } from "../../../core/state";
import { PanelId } from "../panels";
import HeroPanel from "./hero-panel";
import ItemsPanel from "./items-panel";
import CodexPanel from "./codex-panel";
import TalentsPanel from "./talents-panel";

interface IProps {
  activePanel: PanelId | null;
  state: IState;
  onClose: () => void;
}

const TITLES: Record<PanelId, string> = {
  [PanelId.Hero]: "Hero",
  [PanelId.Talents]: "Talents",
  [PanelId.Items]: "Items",
  [PanelId.Codex]: "Codex",
};

const PanelOverlay = (props: IProps) => {
  const { activePanel, state, onClose } = props;

  useEffect(() => {
    if (!activePanel) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activePanel, onClose]);

  if (!activePanel) {
    return null;
  }

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <div className="panel-window" onClick={e => e.stopPropagation()}>
        <div className="panel-titlebar">
          <span>{TITLES[activePanel]}</span>
          <button className="panel-close" type="button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {activePanel === PanelId.Hero ? <HeroPanel state={state} /> : null}
        {activePanel === PanelId.Items ? <ItemsPanel state={state} /> : null}
        {activePanel === PanelId.Codex ? <CodexPanel state={state} /> : null}
        {activePanel === PanelId.Talents ? <TalentsPanel state={state} /> : null}
      </div>
    </div>
  );
};

export default PanelOverlay;
```

- [ ] **Step 2: Replace `app/src/components/nav-bar.tsx`**

```tsx
import { PanelId } from "../panels";

interface IProps {
  onOpen: (panel: PanelId) => void;
}

const BUTTONS: { id: PanelId; label: string }[] = [
  { id: PanelId.Hero, label: "Hero" },
  { id: PanelId.Talents, label: "Talents" },
  { id: PanelId.Items, label: "Items" },
  { id: PanelId.Codex, label: "Codex" },
];

const NavBar = (props: IProps) => {
  const { onOpen } = props;
  return (
    <div className="nav-bar">
      {BUTTONS.map(b => (
        <button key={b.id} className="nav-btn" type="button" onClick={() => onOpen(b.id)}>
          {b.label}
        </button>
      ))}
    </div>
  );
};

export default NavBar;
```

- [ ] **Step 3: Replace `app/src/components/sidebar.tsx`**

```tsx
import type { IState } from "../../../core/state";
import type { PanelId } from "../panels";
import ActivityLog from "./activity-log";
import NavBar from "./nav-bar";

interface IProps {
  state: IState;
  onOpen: (panel: PanelId) => void;
}

const Sidebar = (props: IProps) => {
  const { state, onOpen } = props;
  return (
    <div className="sidebar">
      <ActivityLog state={state} />
      <NavBar onOpen={onOpen} />
    </div>
  );
};

export default Sidebar;
```

- [ ] **Step 4: Wire `app/src/components/scene-view.tsx`**

Add the imports and the panel state. The current file imports React-less; add `useState`. The final file:

```tsx
import { useState } from "react";
import type { IState } from "../../../core/state";
import { sceneFor } from "../scene";
import { ActivityState } from "../activity";
import { PanelId } from "../panels";
import { useEncounter } from "../use-encounter";
import { useCombat } from "../use-combat";
import Hero from "./hero";
import Monster from "./monster";
import BossEncounter from "./boss-encounter";
import PortraitFrame from "./portrait-frame";
import AreaTag from "./area-tag";
import ActivityBar from "./activity-bar";
import FloatingText from "./floating-text";
import PanelOverlay from "./panel-overlay";
import Sidebar from "./sidebar";

interface IProps {
  state: IState;
  activity: ActivityState;
}

const SceneView = (props: IProps) => {
  const { state, activity } = props;
  const [panel, setPanel] = useState<PanelId | null>(null);
  const encounter = useEncounter(state);
  const combat = useCombat(state, activity);
  const scene = sceneFor(state.class?.tier ?? 0);
  const line = state.class?.line ?? "novice";

  return (
    <div className="companion">
      <div className={`scene scene-${scene.theme}`}>
        <div className="sky" aria-hidden="true" />
        {activity !== ActivityState.Rest && !encounter && (
          <Monster scene={scene} anim={combat.monster} hp={combat.hpFraction} />
        )}
        <Hero line={line} anim={combat.hero} />
        <FloatingText floaters={combat.floaters} />
        {encounter && <BossEncounter encounter={encounter} />}
        <PortraitFrame state={state} />
        <AreaTag label={scene.label} />
        <ActivityBar activity={activity} />
        <PanelOverlay activePanel={panel} state={state} onClose={() => setPanel(null)} />
      </div>
      <Sidebar state={state} onOpen={setPanel} />
    </div>
  );
};

export default SceneView;
```

- [ ] **Step 5: Typecheck + build**

Run: `cd app && npx tsc --noEmit && npm run build` → clean; bundle builds (then `cd ..`).

- [ ] **Step 6: Full suite**

Run: `bun test 2>&1 | grep -E "pass|fail"` → `0 fail`.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/panel-overlay.tsx app/src/components/nav-bar.tsx app/src/components/sidebar.tsx app/src/components/scene-view.tsx
git commit -m "feat(app): nav opens panel overlays (X/Esc/backdrop close)"
```

---

### Task 6: Panel styles + verification

**Files:**
- Modify: `app/src/styles.css`

- [ ] **Step 1: Append the panel styles**

Add to the end of `app/src/styles.css` (before the `@media (prefers-reduced-motion: reduce)` block):

```css
/* ── nav panels (overlay over the scene) ── */
.nav-btn {
  cursor: pointer;
  opacity: 1;
}
.nav-btn:hover {
  background: var(--panel-2);
  color: var(--text);
}
.panel-backdrop {
  position: absolute;
  inset: 0;
  background: #0a0712cc;
  display: grid;
  place-items: center;
  z-index: 20;
}
.panel-window {
  width: min(78%, 560px);
  max-height: 88%;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 3px solid var(--gold);
  box-shadow:
    inset 0 0 0 2px var(--panel-dark),
    0 0 0 2px var(--ink);
  border-radius: 3px;
}
.panel-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  font-family: var(--font-display);
  font-size: 16px;
  color: var(--gold-soft);
  border-bottom: 2px solid var(--ink);
}
.panel-close {
  font-family: "Press Start 2P", monospace;
  font-size: 10px;
  color: var(--text);
  background: #c0392b;
  border: 2px solid var(--ink);
  border-radius: 3px;
  padding: 3px 6px;
  cursor: pointer;
}
.panel-body {
  padding: 10px 12px;
  overflow-y: auto;
  font-size: 13px;
}
.panel-head {
  font-family: "Press Start 2P", monospace;
  font-size: 8px;
  letter-spacing: 1px;
  color: var(--dim);
  margin: 10px 0 6px;
}
.panel-empty {
  color: var(--dim);
  padding: 8px 0;
}

/* hero panel */
.hero-id {
  display: flex;
  gap: 10px;
  align-items: center;
}
.panel-portrait {
  position: static;
  width: 52px;
  height: 52px;
  font-size: 32px;
  background: var(--panel-2);
  border: 2px solid var(--ink);
}
.panel-portrait::after {
  content: "🧙";
}
.hp-name {
  font-family: var(--font-display);
  font-size: 18px;
}
.hp-title {
  font-family: var(--font-display);
  font-style: italic;
  font-size: 12px;
  color: var(--gold-soft);
}
.hp-class {
  font-size: 12px;
  color: var(--teal);
}
.hp-lvl {
  font-size: 12px;
  color: var(--dim);
}
.aff-bars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.aff-row {
  display: grid;
  grid-template-columns: 56px 1fr 38px;
  gap: 8px;
  align-items: center;
  font-size: 12px;
}
.aff-bar {
  height: 10px;
  border: 2px solid var(--ink);
  background: #1d1830;
}
.aff-bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(180deg, #69b09c, #3c7e6c);
}
.aff-pct {
  text-align: right;
  color: var(--dim);
}
.hp-stats {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 12px;
}

/* items grid */
.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
}
.item-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px 5px;
  background: var(--panel-2);
  border: 2px solid var(--ink);
  border-radius: 3px;
}
.item-slot.equipped {
  border-color: var(--gold);
  box-shadow: 0 0 0 2px var(--gold-soft);
}
.item-icon {
  font-size: 24px;
}
.item-count {
  position: absolute;
  top: 2px;
  right: 4px;
  font-size: 10px;
  color: var(--dim);
}
.item-name {
  font-size: 10px;
  text-align: center;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.rarity-common {
  border-bottom: 3px solid #b3ad9c;
}
.rarity-rare {
  border-bottom: 3px solid #6f9fcf;
}
.rarity-epic {
  border-bottom: 3px solid #b491cf;
}
.rarity-legendary {
  border-bottom: 3px solid #cf9f4e;
}

/* codex deeds */
.deed-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.deed-row {
  padding: 6px 8px;
  background: var(--panel-2);
  border: 2px solid var(--ink);
  border-radius: 3px;
}
.deed-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.deed-name {
  color: var(--gold-soft);
}
.deed-pts {
  color: var(--dim);
  font-size: 11px;
  white-space: nowrap;
}
.deed-desc {
  font-size: 11px;
  color: var(--dim);
  margin-top: 2px;
}
.deed-locked {
  color: var(--dim);
  text-align: center;
}

/* talents tree */
.tree-line,
.tree-branches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.tree-node {
  padding: 6px 9px;
  font-size: 12px;
  background: var(--panel-2);
  border: 2px solid var(--ink);
  border-radius: 3px;
  color: var(--dim);
}
.tree-node.past {
  color: var(--text);
}
.tree-node.current {
  border-color: var(--gold);
  color: var(--gold-soft);
  box-shadow: inset 0 0 0 1px var(--gold);
}
```

- [ ] **Step 2: Build + format**

Run: `cd app && npm run build` → succeeds (then `cd ..`).
Run: `bun run format`.

- [ ] **Step 3: Full verification (all packages)**

Run:
```bash
bun test 2>&1 | grep -E "pass|fail"      # 0 fail (NOT tail)
bunx tsc --noEmit                         # root
cd app && npx tsc --noEmit && cd ..       # app
cd app/extension && npm run typecheck && cd ../..  # extension
bun run format:check                      # clean
```

- [ ] **Step 4: Refresh state + manual smoke**

Run: `bun tools/rpg.ts status` (regenerates `state.json` with the new denorm fields).
Then in `app/extension` run ▶️ → "Commit Quest: Open Companion". Click each nav button — a pixel window opens over the scene: **Hero** (affinity bars + stats), **Items** (loot grid, equipped ring), **Codex** (earned deeds + descriptions), **Talents** (class tree, current tier highlighted). X / Esc / clicking the dim backdrop closes it.

- [ ] **Step 5: Commit**

```bash
git add app/src/styles.css
git commit -m "style(app): nav panel overlays — window, item grid, affinity/tree"
```

---

## Self-Review

**1. Spec coverage**
- Core denorm: `classTree`/`IClassTree`/`tree` (Task 1); inventory `name`/`kind`/`equipped`, `earned_detail`/`total` (Task 2). ✓
- 4 panels: Hero/Items (Task 3), Codex/Talents (Task 4). ✓
- Overlay + nav wiring (X/Esc/backdrop, one at a time, read-only) → Task 5. ✓
- Styles → Task 6. ✓
- Read-only (no equip), Codex=achievements, Talents=own line, graceful empties → Tasks 3–6. ✓
- Idempotency + denorm tests → Tasks 1, 2. ✓

**2. Placeholder scan:** no TBD/TODO; every code step has full code; commands have expected output. ✓

**3. Type consistency:** `IClassTree`/`classTree` (Task 1) used in reduce (Task 2) + read as `state.class.tree` (Task 4); `IInventoryItem.name/kind/equipped` (Task 2) read in items-panel (Task 3); `IEarnedAchievement`/`earned_detail`/`total` (Task 2) read in codex-panel (Task 4); `PanelId` (Task 3) consumed by nav-bar/sidebar/panel-overlay/scene-view (Tasks 5); panel components' `IProps { state }` match the overlay's usage. ✓
