# Combat Juice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the side-view scene combat read as a real fight — continuous snappy dash-jabs with recoil + hit feedback, and a staggered FF2 mob formation instead of a flat row.

**Architecture:** App-only, presentational, behind the sprite seam. The director's 250ms tick drives strikes (paced by the existing 700ms throttle) so combat no longer waits on XP-push latency. Mob layout moves from right-only `slotRight` to `slotPos → {right, bottom}` consumed by `Monster` + `HitEffects`. Snappy CSS keyframes with durations synced to `HERO_MS`/`MON_MS`; all gated by the existing reduced-motion block.

**Tech Stack:** React 19 + Vite + TS (`app/`), `bun test`. Visual verification via `npm run serve` (port 7070, reads `~/.agentrpg/state.json`) + browser at a short-wide viewport.

**Spec:** `docs/superpowers/specs/2026-06-15-combat-juice-design.md`

---

## Context for the implementer

- The scene director `app/src/use-scene-director.ts` owns the strike fan-out and a low-frequency tick. `const HERO_MS = { attack: 400, hurt: 500, celebrate: 1200 }`, `const MON_MS = { hurt: 300, attack: 500, die: 600 }`, `const TICK_MS = 250`. The tick currently does `setInterval(() => advance(false), TICK_MS)`. `advance(wantStrike)` calls `stepDirector` then fans out CSS pulses only when a strike actually lands.
- `stepDirector` (`app/src/scene-phase.ts`) strikes only when `wantStrike && now - lastStrikeAt >= STRIKE_THROTTLE_MS` (700). Pure + already tested in `app/src/scene-phase.test.ts` — do not change its logic.
- `app/src/mob-slots.ts` exports `slotRight(slot)` returning a `right` % string; both `Monster` and `HitEffects` import it so the slash lands on its mob. `.monster-unit` has a fixed `bottom: 24%` in CSS; `Monster` overrides `right` inline.
- `.hero-attack` / `.m-hurt` CSS keyframe durations MUST match `HERO_MS.attack` / `MON_MS.hurt` (the file comments say so) or the sprite snaps/leaks. The reduced-motion block (`@media (prefers-reduced-motion: reduce)`) already lists `.hero-attack`, `.m-hurt`, `.m-die`, `.hit-effect`, `.mob-spawn`.
- Run tests: `bun test <file> 2>&1 | grep -E "pass|fail"` (never `tail`). `bun run format` before commit. App typecheck: `cd app && bun run typecheck`.

---

## Task 1: FF2 formation — `slotPos {right, bottom}`

**Files:**
- Modify: `app/src/mob-slots.ts`
- Modify: `app/src/components/monster.tsx`
- Modify: `app/src/components/hit-effect.tsx`
- Modify: `app/src/styles.css` (`.monster-unit` drops fixed `bottom`)
- Test: `app/src/mob-slots.test.ts` (create)

- [ ] **Step 1: Write the failing test** — create `app/src/mob-slots.test.ts`:

```ts
import { test, expect } from "bun:test";
import { slotPos } from "./mob-slots";

test("slotPos gives each pack slot a distinct staggered position; clamps out of range", () => {
  const a = slotPos(0);
  const b = slotPos(1);
  const c = slotPos(2);
  for (const p of [a, b, c]) {
    expect(typeof p.right).toBe("string");
    expect(typeof p.bottom).toBe("string");
  }
  // staggered: the three bottoms are all different (not a flat row)
  expect(new Set([a.bottom, b.bottom, c.bottom]).size).toBe(3);
  // slot 0 is the front-most (lowest bottom %)
  expect(parseFloat(a.bottom)).toBeLessThan(parseFloat(c.bottom));
  // out of range clamps to the last slot
  expect(slotPos(9)).toEqual(c);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test app/src/mob-slots.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `slotPos` is not exported.

- [ ] **Step 3: Replace `mob-slots.ts`** with the formation source:

```ts
// FF2-style staggered formation for up to 3 ambient pack mobs (slot 0 = front, struck first).
// The hit-effect layer reuses these so a slash lands on its mob — keep it the single source.
export interface ISlotPos {
  right: string;
  bottom: string;
}

const MOB_SLOTS: ISlotPos[] = [
  { right: "13%", bottom: "20%" }, // front
  { right: "22%", bottom: "30%" }, // mid
  { right: "16%", bottom: "42%" }, // back
];

export const slotPos = (slot: number): ISlotPos => {
  return MOB_SLOTS[slot] ?? MOB_SLOTS[MOB_SLOTS.length - 1];
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test app/src/mob-slots.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS.

- [ ] **Step 5: Apply `slotPos` in `monster.tsx`** — change the import + wrapper style:

```tsx
import { slotPos } from "../mob-slots";
```
and the wrapper element from `style={{ right: slotRight(slot) }}` to:
```tsx
<div className="monster-unit mob-spawn" style={slotPos(slot)}>
```

- [ ] **Step 6: Apply `slotPos` in `hit-effect.tsx`** — change the import + slash style:

```tsx
import { slotPos } from "../mob-slots";
```
and the span from `style={{ right: slotRight(e.slot) }}` to:
```tsx
<span key={e.id} className="hit-effect" style={slotPos(e.slot)} />
```

- [ ] **Step 7: Drop the fixed `bottom` from `.monster-unit` and `.hit-effect`** in `app/src/styles.css`.
In `.monster-unit { position:absolute; right:18%; bottom:24%; … }` remove the `right: 18%;` and `bottom: 24%;` lines (now set inline). In `.hit-effect { … bottom: 30%; … }` remove the `bottom: 30%;` line (now inline). Leave every other property.

- [ ] **Step 8: Verify the app still builds + typechecks**

Run: `cd app && bun run typecheck 2>&1 | tail -2`
Expected: no errors. Then `cd .. && bun test app/src/mob-slots.test.ts 2>&1 | grep -E "pass|fail"` → PASS.

- [ ] **Step 9: Format + commit**

```bash
bun run format
git add app/src/mob-slots.ts app/src/mob-slots.test.ts app/src/components/monster.tsx app/src/components/hit-effect.tsx app/src/styles.css
git commit -m "feat(app): FF2 staggered mob formation (per-slot right+bottom)"
```

---

## Task 2: Snappy dash-jab + stronger mob hurt

**Files:**
- Modify: `app/src/styles.css` (`hero-attack`, `m-hurt` keyframes)
- Modify: `app/src/use-scene-director.ts` (`HERO_MS.attack`, `MON_MS.hurt` to match)

- [ ] **Step 1: Replace the `hero-attack` keyframe + rule** in `app/src/styles.css`.
Change:
```css
.hero-attack {
  animation: hero-attack 0.4s ease-out;
}
```
to:
```css
.hero-attack {
  animation: hero-attack 0.28s cubic-bezier(0.85, 0, 0.15, 1);
}
```
and change the `@keyframes hero-attack { … }` block to:
```css
@keyframes hero-attack {
  0% {
    transform: translateX(0);
  }
  45% {
    transform: translateX(40px); /* fast forward */
  }
  55% {
    transform: translateX(40px); /* impact hold */
  }
  78% {
    transform: translateX(-5px); /* recoil */
  }
  100% {
    transform: translateX(0);
  }
}
```

- [ ] **Step 2: Strengthen the `m-hurt` keyframe + rule** in `app/src/styles.css`.
Change:
```css
.m-hurt {
  animation: m-hurt 0.3s steps(2) 1;
}
```
to:
```css
.m-hurt {
  animation: m-hurt 0.36s ease-out 1;
}
```
and change the `@keyframes m-hurt { … }` block to:
```css
@keyframes m-hurt {
  0% {
    transform: translateX(0);
    filter: none;
  }
  30% {
    transform: translateX(7px) scale(0.92);
    filter: brightness(2.2) saturate(0.4);
  }
  100% {
    transform: translateX(0);
    filter: none;
  }
}
```

- [ ] **Step 3: Sync the JS durations** in `app/src/use-scene-director.ts`.
Change `const HERO_MS = { attack: 400, hurt: 500, celebrate: 1200 };` to `attack: 280`:
```ts
const HERO_MS = { attack: 280, hurt: 500, celebrate: 1200 };
```
Change `const MON_MS = { hurt: 300, attack: 500, die: 600 };` to `hurt: 360`:
```ts
const MON_MS = { hurt: 360, attack: 500, die: 600 };
```

- [ ] **Step 4: Typecheck + format**

Run: `cd app && bun run typecheck 2>&1 | tail -2` → no errors. `cd .. && bun run format 2>&1 | tail -1`.

- [ ] **Step 5: Commit**

```bash
git add app/src/styles.css app/src/use-scene-director.ts
git commit -m "feat(app): snappy dash-jab + flinch/flash mob hit feedback"
```

---

## Task 3: Continuous strikes (kill the lag)

**Files:**
- Modify: `app/src/use-scene-director.ts` (the tick)

- [ ] **Step 1: Drive strikes from the tick** in `app/src/use-scene-director.ts`.
Find the low-frequency tick effect:
```ts
  useEffect(() => {
    const id = setInterval(() => advance(false), TICK_MS);
    return () => clearInterval(id);
    // advance closes over `activity`; re-arm when it changes so transitions read fresh activity.
  }, [activity]);
```
Change `advance(false)` to `advance(true)`:
```ts
  useEffect(() => {
    // advance(true) lets Engage strike on the throttle cadence instead of waiting for an XP push,
    // so the fight is continuous; stepDirector's STRIKE_THROTTLE_MS still paces it.
    const id = setInterval(() => advance(true), TICK_MS);
    return () => clearInterval(id);
    // advance closes over `activity`; re-arm when it changes so transitions read fresh activity.
  }, [activity]);
```

- [ ] **Step 2: Full suite (nothing regressed)**

Run: `bun test 2>&1 | grep -E "pass|fail"` → 0 fail (the pure `scene-phase`/`combat` tests are unchanged; this is hook wiring).

- [ ] **Step 3: Commit**

```bash
git add app/src/use-scene-director.ts
git commit -m "feat(app): drive combat strikes from the tick so farming reads continuous"
```

---

## Final verification (browser)

- [ ] **Build + serve + screenshot at a short-wide panel**

```bash
cd app && npm run build
AGENTRPG_PORT=7171 npm run serve   # background; reads ~/.agentrpg/state.json
```
Open `http://localhost:7171/` at ~1500×440, confirm: the pack stands in a staggered cluster (not a row); while activity is Farming the hero jabs continuously with a snappy forward+recoil; struck mobs flinch + flash and the slash lands on the front mob. Toggle OS reduced-motion → animations go static, formation stays.

- [ ] **Rebuild the extension** so the user sees it in VS Code:

```bash
cd app/extension && npm run reinstall 2>&1 | grep -E "DONE|successfully"
```

---

## Self-Review

**Spec coverage:**
- Continuous strikes / lag fix → Task 3 (tick `advance(true)`). ✅
- Snappy dash-jab + recoil + mob flinch/flash; durations synced → Task 2. ✅
- FF2 formation (`slotPos {right,bottom}`, Monster + HitEffects, drop fixed bottoms) → Task 1. ✅
- Reduced-motion already covers the new keyframes (same selectors) → no change needed; noted in final verify. ✅
- Deferred (idle-walk, camera) / no new art / no combat-model change → honored (no such files touched). ✅

**Placeholder scan:** none — every step has concrete code. Formation percentages are real starting values (the spec allows browser tuning; the test only asserts they're distinct + ordered, so tuning won't break it).

**Type consistency:** `slotPos` returns `ISlotPos { right, bottom }`; `Monster` and `HitEffects` both spread it into `style`; `mob-slots.ts` no longer exports `slotRight`, and both consumers are updated in Task 1 (no dangling import). `HERO_MS.attack = 280` ↔ `hero-attack 0.28s`; `MON_MS.hurt = 360` ↔ `m-hurt 0.36s`.
