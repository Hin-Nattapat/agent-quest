# Multi-agent Values (first cut) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface per-source activity on the single shared hero — a Hero-panel "Sources" breakdown, the active source in the HUD and companion — read-only over `stats.by_source`, shown only when ≥2 agents have contributed.

**Architecture:** No game-logic change. Add one read-side field (`last_event.source`) and two pure display helpers, then wire four small views. The single global hero is unchanged; multi-agent is pure presentation.

**Tech Stack:** TypeScript on Bun; React 19 (companion); `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-21-multi-agent-values-design.md`

## Global Constraints

- Runtime deps = **jq + bun only**. No new npm packages.
- The **app (React) may import at runtime only** the `core/state` type and the `core/events` contract module — never other `core` runtime code (app/CLAUDE.md). `sourceLabel` therefore lives in `core/events.ts` (the whitelisted contract module, also freely importable by the Bun HUD), NOT in a new core module.
- The HUD (`hud/`) and app must NOT import each other.
- TS rules: arrow-consts (not `function`), `interface I*` / `type T*`, **no `any`** in tests, braces on every `if`/`else`, no clever ternaries, kebab-case filenames.
- Gate every multi-agent view on `Object.keys(state.stats.by_source).length >= 2`.
- `titleCase` in `app/src/view.ts` splits on `_` only, so it mangles hyphenated ids (`claude-code` → `Claude-code`) — do not use it for source labels; use the new `sourceLabel`.
- Run `bun run format` before each commit; prettier must be clean.

---

## File Structure

- `core/state.ts` — **modify**: `last_event` gains `source: string`.
- `core/reduce.ts` — **modify** (line ~404): include `source` when building `last_event`.
- `core/events.ts` — **modify**: add `sourceLabel(source)`.
- `app/src/view.ts` — **modify**: add `sourceBreakdown(bySource)` + `ISourceShare`.
- `hud/statusline.ts` — **modify**: append the active-source segment.
- `app/src/components/hero-panel.tsx` — **modify**: add the "Sources" section.
- `app/src/components/portrait-frame.tsx` — **modify**: add the active-source chip.
- Tests: `test/core/reduce.test.ts` (update), `test/core/events.test.ts` (create), `app/src/view.test.ts` (extend), `test/hud/statusline-integration.test.ts` (extend).

---

## Task 1: Core — `last_event.source`

**Files:**
- Modify: `core/state.ts`
- Modify: `core/reduce.ts`
- Test: `test/core/reduce.test.ts` (update the existing `last_event` test)

**Interfaces:**
- Produces: `state.last_event` is now `{ ts: string; type: EventType; source: string }`.

- [ ] **Step 1: Update the existing `last_event` test to expect `source` (RED)**

In `test/core/reduce.test.ts`, the test `"last_event is the latest event by ts (or undefined when empty)"` asserts the latest event (the `session_end` at `2026-06-11T12:05:00Z`, source `claude-code`). Update its `.toEqual(...)`:

```ts
  expect(reduce({ events: evs, config: cfg, today: "2026-06-11" }).last_event).toEqual({
    ts: "2026-06-11T12:05:00Z",
    type: EventType.SessionEnd,
    source: "claude-code",
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `last_event` is missing `source`.

- [ ] **Step 3: Add `source` to the `last_event` type**

In `core/state.ts`, change:

```ts
  last_event?: { ts: string; type: EventType };
```
to:
```ts
  last_event?: { ts: string; type: EventType; source: string };
```

- [ ] **Step 4: Populate `source` in the reducer**

In `core/reduce.ts` (the `last_event` build, ~line 404), change:

```ts
    prelim.last_event = { ts: lastEv.ts, type: lastEv.type };
```
to:
```ts
    prelim.last_event = { ts: lastEv.ts, type: lastEv.type, source: lastEv.source };
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `bun test`
Expected: PASS (no other test asserts `last_event`'s exact shape).

- [ ] **Step 7: Commit**

```bash
bun run format
git add core/state.ts core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): record source on last_event"
```

---

## Task 2: Display helpers — `sourceLabel` + `sourceBreakdown`

**Files:**
- Modify: `core/events.ts`
- Modify: `app/src/view.ts`
- Test: `test/core/events.test.ts` (create), `app/src/view.test.ts` (extend)

**Interfaces:**
- Produces: `sourceLabel(source: string): string` (from `core/events`).
- Produces: `sourceBreakdown(bySource: Record<string, { xp: number; sessions: number }>): ISourceShare[]` and `interface ISourceShare { source: string; xp: number; pct: number; }` (from `app/src/view`).

- [ ] **Step 1: Write the failing test for `sourceLabel`**

Create `test/core/events.test.ts`:

```ts
import { test, expect } from "bun:test";
import { sourceLabel } from "../../core/events";

test("sourceLabel humanizes adapter source ids", () => {
  expect(sourceLabel("claude-code")).toBe("Claude Code");
  expect(sourceLabel("codex")).toBe("Codex");
  expect(sourceLabel("cursor")).toBe("Cursor");
});
```

- [ ] **Step 2: Write the failing test for `sourceBreakdown`**

Append to `app/src/view.test.ts` (add `sourceBreakdown` to the existing `from "./view"` import):

```ts
test("sourceBreakdown: shares sorted desc by xp, integer pct, 0 when no xp", () => {
  expect(sourceBreakdown({})).toEqual([]);
  expect(
    sourceBreakdown({
      "claude-code": { xp: 30, sessions: 1 },
      codex: { xp: 70, sessions: 2 },
    }),
  ).toEqual([
    { source: "codex", xp: 70, pct: 70 },
    { source: "claude-code", xp: 30, pct: 30 },
  ]);
  expect(
    sourceBreakdown({ b: { xp: 0, sessions: 0 }, a: { xp: 0, sessions: 0 } }),
  ).toEqual([
    { source: "a", xp: 0, pct: 0 },
    { source: "b", xp: 0, pct: 0 },
  ]);
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `bun test test/core/events.test.ts app/src/view.test.ts`
Expected: FAIL — `sourceLabel` / `sourceBreakdown` not exported.

- [ ] **Step 4: Implement `sourceLabel` in `core/events.ts`**

Append to `core/events.ts`:

```ts
// Human label for an adapter source id ("claude-code" → "Claude Code", "codex" → "Codex").
// Splits on - and _ (titleCase in the app splits on _ only, so it cannot be reused here).
export const sourceLabel = (source: string): string =>
  source
    .split(/[-_]/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
```

- [ ] **Step 5: Implement `sourceBreakdown` in `app/src/view.ts`**

Append to `app/src/view.ts`:

```ts
export interface ISourceShare {
  source: string;
  xp: number;
  pct: number;
}

// Per-source XP shares of the hero's total, highest first (ties broken by source name). pct is an
// integer percent; every share is 0 when no XP has been earned yet.
export const sourceBreakdown = (
  bySource: Record<string, { xp: number; sessions: number }>,
): ISourceShare[] => {
  const total = Object.values(bySource).reduce((sum, group) => sum + group.xp, 0);
  return Object.entries(bySource)
    .map(([source, group]) => ({
      source,
      xp: group.xp,
      pct: total === 0 ? 0 : Math.round((group.xp / total) * 100),
    }))
    .sort((a, b) => b.xp - a.xp || a.source.localeCompare(b.source));
};
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun test test/core/events.test.ts app/src/view.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
bun run format
git add core/events.ts test/core/events.test.ts app/src/view.ts app/src/view.test.ts
git commit -m "feat: sourceLabel + sourceBreakdown display helpers"
```

---

## Task 3: HUD statusline — active-source segment

**Files:**
- Modify: `hud/statusline.ts`
- Test: `test/hud/statusline-integration.test.ts` (extend)

**Interfaces:**
- Consumes: `sourceLabel` (Task 2), `state.last_event.source` (Task 1), `state.stats.by_source`.

- [ ] **Step 1: Write the failing test**

Append to `test/hud/statusline-integration.test.ts`:

```ts
test("statusline shows the active source only when >= 2 sources", async () => {
  const seed = (home: string, bySource: object, lastSource: string | null) => {
    writeFileSync(
      join(home, "state.json"),
      JSON.stringify({
        version: 1,
        updated_at: "t",
        xp_total: 224,
        level: 5,
        xp_in_level: 0,
        xp_to_next: 167,
        stats: { prompts: 0, actions: {}, sessions: 0, by_source: bySource, by_repo: {} },
        ...(lastSource
          ? { last_event: { ts: "t", type: "prompt", source: lastSource } }
          : {}),
      }),
    );
  };
  const run = async (home: string) => {
    const proc = Bun.spawn(["bun", SCRIPT], {
      stdin: Buffer.from(JSON.stringify({ model: { display_name: "M" } })),
      env: { ...process.env, AGENTRPG_HOME: home },
      stdout: "pipe",
      stderr: "pipe",
    });
    const out = await new Response(proc.stdout).text();
    expect(await proc.exited).toBe(0);
    return out;
  };

  const multi = makeHome();
  seed(multi, { "claude-code": { xp: 100, sessions: 1 }, codex: { xp: 50, sessions: 1 } }, "codex");
  expect(await run(multi)).toContain("via Codex");

  const solo = makeHome();
  seed(solo, { "claude-code": { xp: 100, sessions: 1 } }, "claude-code");
  expect(await run(solo)).not.toContain("via");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test test/hud/statusline-integration.test.ts`
Expected: FAIL — "via Codex" not present.

- [ ] **Step 3: Import `sourceLabel`**

In `hud/statusline.ts`, add to the imports near the top (alongside the existing `../core/...` imports):

```ts
import { sourceLabel } from "../core/events";
```

- [ ] **Step 4: Build and append the active-source segment**

In `hud/statusline.ts`, immediately after the line that defines `bag`:

```ts
  const bag = bagCount > 0 ? ` 🎒${bagCount}` : "";
```
add:
```ts
  const bySource = state.stats?.by_source ?? {};
  const via =
    Object.keys(bySource).length >= 2 && state.last_event?.source
      ? ` · via ${sourceLabel(state.last_event.source)}`
      : "";
```
Then append `${via}` to the end of the `left` string (after `${bag}`):
```ts
  const left =
    `${coloredName} · ${label}${pending}  ` +
    `Lv.${state.level} ${coloredBar}${maxed} ${Math.round(pct * 100)}%${fire}${bag}${via}`;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun test test/hud/statusline-integration.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
bun run format
git add hud/statusline.ts test/hud/statusline-integration.test.ts
git commit -m "feat(hud): show the active source when multiple agents are used"
```

---

## Task 4: Companion — Hero-panel "Sources" + portrait chip

**Files:**
- Modify: `app/src/components/hero-panel.tsx`
- Modify: `app/src/components/portrait-frame.tsx`

**Interfaces:**
- Consumes: `sourceBreakdown` (Task 2, from `../view`), `sourceLabel` (Task 2, from `../../../core/events`), `state.stats.by_source`, `state.last_event.source` (Task 1).

This task is presentational glue over already-tested helpers; its gate is a clean `tsc` (no render test harness exists in the repo). Verify visually in the companion if convenient.

- [ ] **Step 1: Add imports to `hero-panel.tsx`**

In `app/src/components/hero-panel.tsx`, the existing imports are:

```ts
import type { IState } from "../../../core/state";
import { displayName, spriteStyle } from "../view";
import { heroPortrait } from "../sprites";
```
Change the `../view` import and add the events import:
```ts
import type { IState } from "../../../core/state";
import { displayName, spriteStyle, sourceBreakdown } from "../view";
import { sourceLabel } from "../../../core/events";
import { heroPortrait } from "../sprites";
```

- [ ] **Step 2: Add the "Sources" section**

In `app/src/components/hero-panel.tsx`, the render returns a `.hero-cols` div containing two `<section className="hero-col">` blocks (Affinity, Stats). Immediately after the closing `</section>` of the **Stats** block (still inside `.hero-cols`), add:

```tsx
        {Object.keys(stats.by_source).length >= 2 ? (
          <section className="hero-col">
            <div className="panel-head">Sources</div>
            <div className="aff-bars">
              {sourceBreakdown(stats.by_source).map(share => (
                <div key={share.source} className="aff-row">
                  <span className="aff-label">{sourceLabel(share.source)}</span>
                  <div className="aff-bar">
                    <i style={{ width: `${share.pct}%` }} />
                  </div>
                  <span className="aff-pct">{share.pct}%</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}
```
(`stats` is the existing `const stats = state.stats;` local; `.aff-*` classes are reused from the Affinity block — no new CSS.)

- [ ] **Step 3: Add the active-source chip to `portrait-frame.tsx`**

In `app/src/components/portrait-frame.tsx`, add the events import near the top:

```ts
import { sourceLabel } from "../../../core/events";
```
Then in the `.pf-chips` block (which renders the streak / items / mult chips), add as the last chip:

```tsx
          {Object.keys(state.stats.by_source).length >= 2 && state.last_event?.source ? (
            <span className="chip chip-source">via {sourceLabel(state.last_event.source)}</span>
          ) : null}
```

- [ ] **Step 4: Typecheck both app builds**

Run: `cd app && bunx tsc --noEmit && cd extension && bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run the full suite + formatter**

Run: `cd /Users/calypso/Project/Ottery/agent-quest && bun test && bun run format`
Expected: PASS; prettier clean.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/hero-panel.tsx app/src/components/portrait-frame.tsx
git commit -m "feat(app): per-source breakdown in the hero panel + active-source chip"
```

---

## Final verification

- [ ] `bun test` — full suite green (incl. updated reduce test, new events/view/statusline tests).
- [ ] `cd app && bunx tsc --noEmit` and `cd app/extension && bunx tsc --noEmit` — clean.
- [ ] `bun run format:check` (or `bun run format`) — clean.
- [ ] Open a PR from `feat/multi-agent-values` into `main` (branch protection requires it; merge as a **merge commit**).
