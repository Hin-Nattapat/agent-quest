# Phase 6.1 — Usage / Stats Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fifth read-only nav panel (📊 Usage) that renders a usage dashboard — repos conquered, tool mix, command tally, totals — from the stats already on `state.json`.

**Architecture:** App-only, presentational. Two pure `view.ts` helpers (`cmdLabel`, `byCountDesc`) are unit-tested; a `UsagePanel` component renders four sections from `state.stats`; the existing `PanelId`/`nav-bar`/`panel-overlay` pattern wires it up. No `core`/reducer change; realtime is inherited from the existing state feed.

**Tech Stack:** Bun + TypeScript, `bun test`, React 19 (Vite), plain CSS.

**Spec:** `docs/superpowers/specs/2026-06-14-commit-quest-phase6-1-usage-panel-design.md`

---

## Context for the implementer

- **`app/src/` FE style:** arrow `const` components, string enums (PascalCase members), `core` imported **type-only**, no `any`, braces on every if/else, kebab-case files. Run tests: `cd app && bun test 2>&1 | grep -E "pass|fail"` — never `tail`.
- `IState.stats` already types everything (no reducer change): `prompts`, `sessions`, `actions: Record<string,number>`, `by_repo: Record<string, IGroupStat>` (`IGroupStat = { xp: number; sessions: number }`), `cmds?: Record<string,number>`, `action_fails?`, `boss_defeated?`, `boss_fled?`. `IState.streak?.best_days` exists too.
- The panel pattern (from 3.6): `app/src/panels.ts` (`PanelId` enum) → `nav-bar.tsx` (`BUTTONS` array) → `panel-overlay.tsx` (`TITLES` map + a `activePanel === PanelId.X ? <XPanel/> : null` line) → a presentational `*-panel.tsx` reading `IState`. Existing CSS classes `panel-body`, `panel-head`, `panel-empty` are reusable.
- `CmdTag` values (core/events.ts): `git_rebase_onto`, `git_rebase_i`, `cherry_pick`, `force_push`, `bisect`, `reflog`, `stash`, `pr_merge`, `cowboy`, `test_run`.

---

## Task 1: Pure view helpers `cmdLabel` + `byCountDesc`

**Files:**
- Modify: `app/src/view.ts`
- Test: `app/src/view.test.ts`

- [ ] **Step 1: Add failing tests** — append to `app/src/view.test.ts`. Add `cmdLabel, byCountDesc` to the existing `import { … } from "./view";` line, then add:

```ts
test("cmdLabel maps known CmdTags and Title-Cases unknown ones", () => {
  expect(cmdLabel("force_push")).toBe("Force Pushes");
  expect(cmdLabel("test_run")).toBe("Test Runs");
  expect(cmdLabel("cherry_pick")).toBe("Cherry-Picks");
  expect(cmdLabel("foo_bar")).toBe("Foo Bar"); // unknown → Title Case
});

test("byCountDesc sorts entries by value descending", () => {
  expect(byCountDesc({ a: 1, b: 3, c: 2 })).toEqual([
    ["b", 3],
    ["c", 2],
    ["a", 1],
  ]);
  expect(byCountDesc({})).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && bun test src/view.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `cmdLabel`/`byCountDesc` not exported.

- [ ] **Step 3: Implement in `app/src/view.ts`** — append at the end of the file:

```ts
const CMD_LABELS: Record<string, string> = {
  git_rebase_onto: "Rebase Onto",
  git_rebase_i: "Interactive Rebase",
  cherry_pick: "Cherry-Picks",
  force_push: "Force Pushes",
  bisect: "Bisects",
  reflog: "Reflog Dives",
  stash: "Stashes",
  pr_merge: "PR Merges",
  cowboy: "Cowboy Commits",
  test_run: "Test Runs",
};

// Readable label for a CmdTag value; unknown tags fall back to Title Case of the snake_case key.
export const cmdLabel = (tag: string): string => {
  const known = CMD_LABELS[tag];
  if (known) {
    return known;
  }
  return tag
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// Entries of a count record sorted by value descending (Array.sort is stable, so ties keep order).
export const byCountDesc = (rec: Record<string, number>): [string, number][] => {
  return Object.entries(rec).sort((a, b) => b[1] - a[1]);
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd app && bun test src/view.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add app/src/view.ts app/src/view.test.ts
git commit -m "feat(app): cmdLabel + byCountDesc view helpers for the usage panel"
```

---

## Task 2: `PanelId.Usage` + `UsagePanel` component

**Files:**
- Modify: `app/src/panels.ts`
- Create: `app/src/components/usage-panel.tsx`

- [ ] **Step 1: Add the enum member to `app/src/panels.ts`**

```ts
export enum PanelId {
  Hero = "hero",
  Talents = "talents",
  Items = "items",
  Codex = "codex",
  Usage = "usage",
}
```

- [ ] **Step 2: Create `app/src/components/usage-panel.tsx`**

```tsx
import type { IState } from "../../../core/state";
import { cmdLabel, byCountDesc } from "../view";

interface IProps {
  state: IState;
}

const UsagePanel = (props: IProps) => {
  const { state } = props;
  const stats = state.stats;
  const repos = Object.entries(stats.by_repo ?? {}).sort((a, b) => b[1].xp - a[1].xp);
  const tools = byCountDesc(stats.actions ?? {});
  const maxTool = Math.max(1, ...tools.map(([, n]) => n));
  const cmds = byCountDesc(stats.cmds ?? {});
  const totalActions = tools.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="panel-body usage-panel">
      <section className="usage-section">
        <div className="panel-head">⚔ Realms Conquered</div>
        {repos.length === 0 ? (
          <div className="panel-empty">No realms yet…</div>
        ) : (
          <ul className="repo-list">
            {repos.map(([name, g]) => (
              <li key={name} className="repo-row">
                <span className="repo-name">{name}</span>
                <span className="repo-stat">
                  {g.xp.toLocaleString()} xp · {g.sessions} sessions
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="usage-section">
        <div className="panel-head">🛠 Tool Mix</div>
        <ul className="tool-list">
          {tools.map(([name, n]) => (
            <li key={name} className="tool-row">
              <span className="tool-name">{name}</span>
              <span className="tool-bar">
                <i style={{ width: `${(n / maxTool) * 100}%` }} />
              </span>
              <span className="tool-count">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="usage-section">
        <div className="panel-head">📜 Command Tally</div>
        {cmds.length === 0 ? (
          <div className="panel-empty">No notable deeds logged…</div>
        ) : (
          <ul className="cmd-list">
            {cmds.map(([tag, n]) => (
              <li key={tag} className="cmd-row">
                <span className="cmd-name">{cmdLabel(tag)}</span>
                <span className="cmd-count">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="usage-section">
        <div className="panel-head">📊 Totals</div>
        <dl className="usage-totals">
          <div>
            <dt>Prompts</dt>
            <dd>{stats.prompts}</dd>
          </div>
          <div>
            <dt>Sessions</dt>
            <dd>{stats.sessions}</dd>
          </div>
          <div>
            <dt>Actions</dt>
            <dd>{totalActions}</dd>
          </div>
          <div>
            <dt>Fails</dt>
            <dd>{stats.action_fails ?? 0}</dd>
          </div>
          <div>
            <dt>🐉 Bosses</dt>
            <dd>
              {stats.boss_defeated ?? 0} / {stats.boss_fled ?? 0}
            </dd>
          </div>
          <div>
            <dt>🔥 Best streak</dt>
            <dd>{state.streak?.best_days ?? 0}d</dd>
          </div>
        </dl>
      </section>
    </div>
  );
};

export default UsagePanel;
```

- [ ] **Step 3: Type-check + suite (component compiles; not yet routed)**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` — expect no output.
Run: `cd app && bun test 2>&1 | grep -E "pass|fail"` — expect all pass.

- [ ] **Step 4: Commit**

```bash
git add app/src/panels.ts app/src/components/usage-panel.tsx
git commit -m "feat(app): PanelId.Usage + UsagePanel dashboard (by-repo/tools/cmds/totals)"
```

---

## Task 3: Wire the nav button + overlay route

**Files:**
- Modify: `app/src/components/nav-bar.tsx`
- Modify: `app/src/components/panel-overlay.tsx`

- [ ] **Step 1: Add the 5th nav button in `nav-bar.tsx`**

Add `{ id: PanelId.Usage, label: "Usage" }` as the last entry of the `BUTTONS` array:

```ts
const BUTTONS: { id: PanelId; label: string }[] = [
  { id: PanelId.Hero, label: "Hero" },
  { id: PanelId.Talents, label: "Talents" },
  { id: PanelId.Items, label: "Items" },
  { id: PanelId.Codex, label: "Codex" },
  { id: PanelId.Usage, label: "Usage" },
];
```

- [ ] **Step 2: Route the panel in `panel-overlay.tsx`**

(a) Add the import near the other panel imports:
```ts
import UsagePanel from "./usage-panel";
```
(b) Add the title to the `TITLES` map:
```ts
  [PanelId.Usage]: "Usage",
```
(c) Add the render line after the Talents line:
```tsx
        {activePanel === PanelId.Usage ? <UsagePanel state={state} /> : null}
```

- [ ] **Step 3: Type-check + full suite + grep**

Run: `cd app && bunx tsc --noEmit 2>&1 | grep -E "error TS" | head` — expect no output.
Run: `cd app && bun test 2>&1 | grep -E "pass|fail"` — expect all pass, 0 fail.
Run: `grep -n "PanelId.Usage" app/src/components/nav-bar.tsx app/src/components/panel-overlay.tsx` — expect a match in each.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/nav-bar.tsx app/src/components/panel-overlay.tsx
git commit -m "feat(app): wire Usage nav button + overlay route"
```

---

## Task 4: Usage panel CSS

**Files:**
- Modify: `app/src/styles.css`

- [ ] **Step 1: Append the usage-panel styles**

Add near the other panel styles (after the codex/deed rules; search for `.deed-list` and add after that block, or append before the `@media (prefers-reduced-motion: reduce)` block):

```css
/* ── usage / stats panel (6.1) ── */
.usage-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.usage-section {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.repo-list,
.tool-list,
.cmd-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.repo-row,
.cmd-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
}
.repo-name,
.cmd-name {
  color: var(--text);
}
.repo-stat,
.cmd-count,
.tool-count {
  color: var(--dim);
  white-space: nowrap;
}
.tool-row {
  display: grid;
  grid-template-columns: 64px 1fr 36px;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.tool-name {
  color: var(--text);
}
.tool-bar {
  height: 8px;
  background: var(--panel-dark);
  border: 1px solid var(--ink);
  border-radius: 2px;
  overflow: hidden;
}
.tool-bar > i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--teal), var(--gold-soft));
}
.tool-count {
  text-align: right;
}
.usage-totals {
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 12px;
}
.usage-totals > div {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}
.usage-totals dt {
  color: var(--dim);
}
.usage-totals dd {
  margin: 0;
  color: var(--text);
}
```

- [ ] **Step 2: Build sanity**

Run: `cd app && bun test 2>&1 | grep -E "pass|fail"` — expect all pass (CSS isn't tested; confirms nothing broke).
Run: `grep -c "usage-panel\|usage-section\|tool-bar\|usage-totals" app/src/styles.css` — expect 4 or more.

- [ ] **Step 3: Commit**

```bash
git add app/src/styles.css
git commit -m "feat(app): usage panel styles (repo list, tool bars, cmd tally, totals)"
```

- [ ] **Step 4: Visual verification (report, do not automate)**

Report for the human: rebuild + reload (`cd app/extension && npm run build:all`, then reload the panel / reinstall the vsix), open the **Usage** button → four sections populate from the live state (Realms by repo, Tool Mix bars, Command Tally, Totals); Esc/X/backdrop close.

---

## Self-Review

**Spec coverage:**
- `cmdLabel` + `byCountDesc` (pure, tested) → Task 1. ✅
- `PanelId.Usage` + `UsagePanel` 4 sections (Realms/Tool Mix/Command Tally/Totals) → Task 2. ✅
- Nav 5th button + overlay title + route → Task 3. ✅
- Styles (repo list, tool bars, cmd tally, totals grid) → Task 4. ✅
- Read-only, no core change; reads `state.stats` + `state.streak` with `?? {}` / `?? 0` guards → Task 2. ✅
- Empty states (no realms / no deeds) + divide-by-zero guard (`Math.max(1, …)`) → Task 2. ✅
- Realtime inherited (panel reads the `state` prop, re-renders on feed push) → no work needed. ✅
- Testing: pure helpers (Task 1); panel verified visually (Task 4). ✅

**Placeholder scan:** none — every step has full code.

**Type consistency:** `cmdLabel(tag: string): string` and `byCountDesc(rec: Record<string, number>): [string, number][]` are defined in Task 1 and consumed identically in Task 2 (`byCountDesc(stats.actions)`, `byCountDesc(stats.cmds ?? {})`, `cmdLabel(tag)`). `by_repo` entries are `IGroupStat` (`{ xp, sessions }`), sorted inline by `xp` (not via `byCountDesc`, which is for `Record<string, number>`). `PanelId.Usage` is added in Task 2 and referenced in Task 3 (`nav-bar` BUTTONS, `panel-overlay` TITLES + route). CSS class names (`usage-panel`, `usage-section`, `repo-list`, `repo-row`, `repo-name`, `repo-stat`, `tool-list`, `tool-row`, `tool-name`, `tool-bar`, `tool-count`, `cmd-list`, `cmd-row`, `cmd-name`, `cmd-count`, `usage-totals`) match the component markup in Task 2.
