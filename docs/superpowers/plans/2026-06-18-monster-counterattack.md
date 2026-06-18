# Monster Counter-Attack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After the hero strikes, a random still-alive mob attacks back (its own attack animation + a hand-made impact VFX on the hero, who flinches), with the impact delayed to the attack's contact frame so the trade looks smooth.

**Architecture:** Pure cosmetic, view-only. Add a deterministic random-alive picker to `combat.ts`; extend the scene director with a per-slot `attackSlot`, a `heroHits` effect list, a contact-windup delay on both sides, and a counter-attack scheduled after each hero strike. A small `.hero-hit` CSS impact at the hero anchor. No `core`/transport/reducer change.

**Tech Stack:** Bun + React 19 + TS + CSS; `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-18-monster-counterattack-design.md`

**Branch:** `feat/monster-counterattack` (off main; spec already committed there).

**Conventions** (`app/CLAUDE.md`): arrow-const; `interface I*`; **string enums**; no `any`; braces on every if/else; no multi-line/nested ternaries; comments explain WHY; Prettier; one component per file `export default`. Tests `bun test`.

**Run:** app tests `cd app && bun test 2>&1 | grep -E "pass|fail"`; typecheck `cd app && bun run typecheck 2>&1 | tail -2`.

**Key existing code:**
- `combat.ts`: `hashInt(n)` (module-scope, used by `packSize`), `firstAlive(pack)`, `packCleared(pack)`, `monsterAnim({dying, attacking, hurt})`.
- `use-scene-director.ts`: `advance(wantStrike)` strikes the front mob (`firstAlive`) and pulses; `monAttack` bool set only on `beats.hurt`; mobs rendered with `attacking: isTarget && monAttack`; `EFFECT_MS=320`, `MON_MS={hurt:360,attack:500,die:600}`, `HERO_MS={attack:280,hurt:500,celebrate:1200}`, `CAST_MS=600`, `TICK_MS=250`. `later(fn,ms)` + `pulse(set,ms)` + `addEffect(slot,kind)` + `addFloater(kind,text)` helpers; `seqRef` monotonic id; `dirRef.current.pack` is the live pack.
- `scene-phase.ts`: `STRIKE_THROTTLE_MS=1600`.
- `battle-scene.tsx`: renders `Monster` per mob, `<HitEffects effects={scene.effects}/>`, `Hero`, gated on `!encounter`.

---

## File Structure

- `app/src/combat.ts` — add `randAlive(pack, seed)` (Task 1).
- `app/src/use-scene-director.ts` — `attackSlot` + `heroHits` + contact windup + counter scheduling (Task 2).
- `app/src/components/hero-hit.tsx` — new tiny effect-layer component (Task 3).
- `app/src/components/battle-scene.tsx` — render the hero-hit layer (Task 3).
- `app/src/styles.css` — `.hero-hit` impact + reduced-motion (Task 3).
- Browser verification (Task 4).

---

## Task 1: `randAlive` — deterministic random alive-mob picker

**Files:**
- Modify: `app/src/combat.ts`
- Test: `app/src/combat.test.ts`

- [ ] **Step 1: Add failing tests** — append to `app/src/combat.test.ts` (it already imports from `./combat` with `test`/`expect` from "bun:test"; add `randAlive` to the import):

```ts
test("randAlive returns -1 for a cleared pack", () => {
  expect(randAlive([0, 0, 0], 1)).toBe(-1);
  expect(randAlive([], 1)).toBe(-1);
});

test("randAlive only ever returns an alive index", () => {
  const pack = [0, 3, 0, 2]; // alive: 1 and 3
  for (let seed = 0; seed < 50; seed++) {
    const idx = randAlive(pack, seed);
    expect([1, 3]).toContain(idx);
  }
});

test("randAlive is stable for a fixed (pack, seed) and varies by seed", () => {
  const pack = [3, 3, 3];
  expect(randAlive(pack, 7)).toBe(randAlive(pack, 7));
  const picks = new Set([0, 1, 2, 3, 4, 5].map(s => randAlive(pack, s)));
  expect(picks.size).toBeGreaterThan(1); // not always the same slot
});
```

- [ ] **Step 2: Run — expect FAIL** (`randAlive` undefined).

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Implement in `app/src/combat.ts`.** `hashInt` is already a module-scope const above `packSize`. Add `randAlive` next to `firstAlive`/`packCleared` (after `hashInt` so it's in scope):

```ts
// Deterministic pick among the still-alive pack slots (no Math.random — matches packSize/hashInt).
// Returns -1 if the pack is empty or fully cleared.
export const randAlive = (pack: number[], seed: number): number => {
  const alive: number[] = [];
  pack.forEach((h, i) => {
    if (h > 0) {
      alive.push(i);
    }
  });
  if (alive.length === 0) {
    return -1;
  }
  return alive[hashInt(seed) % alive.length];
};
```

- [ ] **Step 4: Run — expect PASS + full suite green.**

Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test src/combat.test.ts 2>&1 | grep -E "pass|fail"` and `bun test 2>&1 | grep -E "pass|fail" | tail -1`.

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/combat.ts app/src/combat.test.ts
git commit -m "feat(app): randAlive — deterministic random alive-mob picker"
```

---

## Task 2: Director — attackSlot + heroHits + contact windup + counter-attack

**Files:**
- Modify: `app/src/use-scene-director.ts`

No new unit test (director is React-stateful; covered by Task 4 browser verify). `randAlive` is unit-tested in Task 1.

- [ ] **Step 1: Imports.** Add `randAlive` and `packCleared` to the existing `./combat` import (which already has `firstAlive`, `monsterAnim`, etc.).

- [ ] **Step 2: Add constants** next to the existing timing constants (after `TICK_MS`):

```ts
const COUNTER_DELAY_MS = 800; // mob bites back mid-throttle (STRIKE_THROTTLE_MS 1600) → alternation
const CONTACT_MS = 180; // delay the impact to the attacker's contact frame, not its windup → smooth
const HERO_HIT_MS = 360; // clears the .hero-hit class; matches its CSS keyframe
```

- [ ] **Step 3: Swap `monAttack` → `attackSlot` + add `heroHits`.** Replace the state line `const [monAttack, setMonAttack] = useState(false);` with:

```ts
  const [attackSlot, setAttackSlot] = useState<number | null>(null);
  const [heroHits, setHeroHits] = useState<number[]>([]);
```

- [ ] **Step 4: Add `addHeroHit` helper** right after `addEffect`:

```ts
  const addHeroHit = () => {
    const id = nextId();
    setHeroHits(h => [...h, id]);
    later(() => setHeroHits(h => h.filter(x => x !== id)), HERO_HIT_MS);
  };
  // A mob plays its attack frames; CONTACT_MS later its blow connects → hero-hit VFX + flinch.
  const counterAttack = () => {
    const idx = randAlive(dirRef.current.pack, seqRef.current);
    if (idx < 0) {
      return;
    }
    setAttackSlot(idx);
    later(() => setAttackSlot(null), MON_MS.attack);
    later(() => {
      addHeroHit();
      pulse(setHeroHurt, HERO_MS.hurt);
    }, CONTACT_MS);
  };
```

- [ ] **Step 5: Contact windup + counter in `advance`.** Replace the strike body — currently:

```ts
        const style = styleRef.current;
        const ranged = isRanged(style);
        pulse(setAttacking, ranged ? CAST_MS : HERO_MS.attack);
        addEffect(idx, effectKindFor(style));
        if (next.pack[idx] <= 0) {
          setDyingSlot(idx);
          later(() => setDyingSlot(null), MON_MS.die);
        } else {
          pulse(setMonHurt, MON_MS.hurt);
        }
```

with (attack animation at t=0; the impact + the mob reaction land CONTACT_MS later; then schedule the counter if mobs remain):

```ts
        const style = styleRef.current;
        const ranged = isRanged(style);
        pulse(setAttacking, ranged ? CAST_MS : HERO_MS.attack);
        // Land the blow on the hero's contact frame, not the windup, so the trade reads smoothly.
        later(() => {
          addEffect(idx, effectKindFor(style));
          if (next.pack[idx] <= 0) {
            setDyingSlot(idx);
            later(() => setDyingSlot(null), MON_MS.die);
          } else {
            pulse(setMonHurt, MON_MS.hurt);
          }
        }, CONTACT_MS);
        if (!packCleared(next.pack)) {
          later(counterAttack, COUNTER_DELAY_MS);
        }
```

- [ ] **Step 6: Failure bite via the new path.** In the real-state-diff effect, the `beats.hurt` block is currently:

```ts
    if (beats.hurt) {
      pulse(setHeroHurt, HERO_MS.hurt);
      pulse(setMonAttack, MON_MS.attack);
      addFloater(FloaterKind.Hurt, "");
    }
```

Replace with (front mob bites; impact + flinch on contact; keep the floater):

```ts
    if (beats.hurt) {
      const idx = firstAlive(dirRef.current.pack);
      if (idx >= 0) {
        setAttackSlot(idx);
        later(() => setAttackSlot(null), MON_MS.attack);
      }
      later(() => {
        addHeroHit();
        pulse(setHeroHurt, HERO_MS.hurt);
      }, CONTACT_MS);
      addFloater(FloaterKind.Hurt, "");
    }
```

- [ ] **Step 7: Mob render uses `attackSlot`.** In the `mobs` map, the `monsterAnim` call currently passes `attacking: isTarget && monAttack`. Change to `attacking: attackSlot === i` (any chosen mob, not just the front target). The `isTarget` var stays for `hurt: isTarget && monHurt` (the hero's blow always hits the front mob).

- [ ] **Step 8: Add `heroHits` to the view.** Add `heroHits: number[];` to `ISceneView`, and include `heroHits` in the returned object: `return { phase: dir.phase, hero, mobs, floaters, effects, heroHits };`.

- [ ] **Step 9: Typecheck + suite.** Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -3` (clean — no `monAttack`/`setMonAttack` references remain) and `bun test 2>&1 | grep -E "pass|fail" | tail -1`. Prettier: `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/use-scene-director.ts 2>&1 | tail -1`.

- [ ] **Step 10: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/use-scene-director.ts
git commit -m "feat(app): director — random mob counter-attack + contact windup"
```

---

## Task 3: Hero-hit VFX — component + render + CSS

**Files:**
- Create: `app/src/components/hero-hit.tsx`
- Modify: `app/src/components/battle-scene.tsx`, `app/src/styles.css`

- [ ] **Step 1: Create `app/src/components/hero-hit.tsx`** (mirror of `hit-effect.tsx`, anchored at the hero):

```tsx
interface IProps {
  hits: number[];
}

// Hand-made impact flashes at the hero anchor when a mob's counter-attack connects (no art).
const HeroHits = (props: IProps) => {
  const { hits } = props;
  return (
    <div className="hero-hits" aria-hidden="true">
      {hits.map(id => (
        <span key={id} className="hero-hit" />
      ))}
    </div>
  );
};

export default HeroHits;
```

- [ ] **Step 2: Render it in `app/src/components/battle-scene.tsx`.** Add the import `import HeroHits from "./hero-hit";` and, next to `{!encounter && <HitEffects effects={scene.effects} />}`, add:

```tsx
      {!encounter && <HeroHits hits={scene.heroHits} />}
```

- [ ] **Step 3: Add CSS** in `app/src/styles.css`, right after the `.hit-effects`/`.hit-effect` block (search `.hit-effects`). The hero sits at `left:22%; bottom:18%`; anchor the impact over its upper body:

```css
/* Mob counter-attack impact on the hero — hand-made, no art. Anchored over the hero (.hero). */
.hero-hits {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.hero-hit {
  position: absolute;
  left: 22%;
  bottom: 26%;
  width: 16cqh;
  height: 16cqh;
  transform: translate(-50%, 50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    #ffe9e0 0%,
    #e8694d 36%,
    #b83a2acc 56%,
    transparent 74%
  );
  filter: drop-shadow(0 0 5px #d4502e);
  animation: hero-hit 0.36s ease-out forwards;
}
@keyframes hero-hit {
  0% {
    opacity: 0;
    transform: translate(-50%, 50%) scale(0.4);
  }
  35% {
    opacity: 1;
    transform: translate(-50%, 50%) scale(1.05);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, 50%) scale(1.5);
  }
}
```

- [ ] **Step 4: Reduced-motion.** Find the `@media (prefers-reduced-motion: reduce)` block that lists `.hit-effect`/`.m-attack` (around the `.hit-effect,` selector near line ~1766). Add `.hero-hit,` to that selector group so it gets the same `animation: none`/brief treatment as the other effects (match exactly what the existing effects do there — likely `animation: none;` or a short fade).

- [ ] **Step 5: Typecheck + suite + Prettier.** Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -2` (clean) and `bun test 2>&1 | grep -E "pass|fail" | tail -1`. Then `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/hero-hit.tsx app/src/components/battle-scene.tsx app/src/styles.css 2>&1 | tail -1`.

- [ ] **Step 6: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/hero-hit.tsx app/src/components/battle-scene.tsx app/src/styles.css
git commit -m "feat(app): hero-hit impact VFX layer for mob counter-attacks"
```

---

## Task 4: Browser verification

Controller (browser). Confirms the trade-blows loop + smoothness + no regression.

- [ ] **Step 1: Build + serve a farming fixture** (any line that has mob attack frames — use mage T1 → grassland, whose mob has idle+attack):

```bash
cd /Users/calypso/Project/Ottery/commit-quest/app
pkill -f "bun server.ts" 2>/dev/null; sleep 0.3
npm run build 2>&1 | tail -1
FAKE="$CLAUDE_JOB_DIR/tmp/fakecounter"; mkdir -p "$FAKE"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
cat > "$FAKE/state.json" <<JSON
{ "version":1,"updated_at":"$NOW","xp_total":300,"level":4,"xp_in_level":10,"xp_to_next":100,
  "stats":{"prompts":20,"actions":{"edit":10},"sessions":3,"by_source":{},"by_repo":{},"boss_defeated":0,"boss_fled":0},
  "class":{"line":"mage","tier":1,"form":"Backend Mage","icon":"⚔","branch":null,"affinity":{"mage":0.8,"ranger":0.1,"rogue":0.05,"sage":0.05}},
  "last_event":{"ts":"$NOW","type":"post_tool"},"inventory":[],"recent":[],"cosmetics":{} }
JSON
AGENTRPG_HOME="$FAKE" AGENTRPG_PORT=7194 nohup bun server.ts > "$CLAUDE_JOB_DIR/tmp/serve-counter.log" 2>&1 &
sleep 1.3; echo "serve $(curl -s -o /dev/null -w '%{http_code}' http://localhost:7194/)"
```

- [ ] **Step 2: Observe** (Playwright at `http://localhost:7194`, resize ~920×300). Keep the fixture fresh (`last_event.ts` < 60s — refresh with python3 if it goes stale) and sample over ~14s via rAF, recording: did `.hero-hit` appear; did a `.monster.m-attack` or a mob whose `background-image` switched to `…/attack/…` appear; did the hero get `hero-hurt`; were **different** mob slots seen attacking across the window. Expected: hero strikes (zap on a mob) **and** mobs counter (hero-hit on the hero) alternate; the hero-hit appears shortly after a mob starts attacking (contact windup), not instantly; ≥2 distinct slots attack over time. Screenshot. Kill the server + remove artifacts (`rm -rf app/.playwright-mcp .playwright-mcp`).

- [ ] **Step 3: Final sweep.** Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun test 2>&1 | grep -E "pass|fail" | tail -1` (0 fail) and `cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -1`. If Prettier changed tracked files, `git add -A && git commit -m "style: prettier"`.

---

## Task 5: Monster nameplate — name label above the HP bar

The `.monster-unit` already shows a `.monster-hp` bar but no name. Add the realm monster name (`scene.monster`, e.g. "Storm Archon") above it so each mob reads as a named creature. Pure UI.

**Files:**
- Modify: `app/src/components/monster.tsx`, `app/src/styles.css`

- [ ] **Step 1: Add the label in `app/src/components/monster.tsx`.** The unit currently is:

```tsx
    <div className="monster-unit mob-spawn" style={slotPos(slot)}>
      <div className="monster-hp">
        <i style={{ width: `${hpPct}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme}${animClass}${artClass}`}
        style={bg}
        aria-label={scene.monster}
      />
    </div>
```

Add a name label as the first child (the `.monster-unit` is a centered flex column, so it stacks name → hp → sprite, top to bottom):

```tsx
    <div className="monster-unit mob-spawn" style={slotPos(slot)}>
      <span className="monster-name">{scene.monster}</span>
      <div className="monster-hp">
        <i style={{ width: `${hpPct}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme}${animClass}${artClass}`}
        style={bg}
        aria-label={scene.monster}
      />
    </div>
```

- [ ] **Step 2: Add CSS** in `app/src/styles.css`, immediately before the `.monster-hp` block (search `.monster-hp {`):

```css
/* Mob nameplate above the HP bar — readable over any battle scene via a hard text-shadow. */
.monster-name {
  font-family: "Pixelify Sans", monospace;
  font-size: 7cqh;
  line-height: 1;
  color: var(--text);
  text-shadow:
    0 1px 2px #000,
    0 0 3px #000;
  white-space: nowrap;
  letter-spacing: 0.3px;
}
```

- [ ] **Step 3: Typecheck + Prettier.** Run: `cd /Users/calypso/Project/Ottery/commit-quest/app && bun run typecheck 2>&1 | tail -2` (clean) and `cd /Users/calypso/Project/Ottery/commit-quest && npx prettier --write app/src/components/monster.tsx app/src/styles.css 2>&1 | tail -1`. (Visual check folded into Task 4's browser pass — confirm the name renders above each mob's HP bar and is legible over the scene; if the front-mob slot crowds the name, that's acceptable for now.)

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add app/src/components/monster.tsx app/src/styles.css
git commit -m "feat(app): mob nameplate — show monster name above the HP bar"
```

> Run order: Task 5 lands before Task 4's browser verification so that pass can eyeball the nameplate + HP bar alongside the counter-attack loop.

## Self-Review (completed)

**Spec coverage:** Random mob, no Math.random → Task 1 (`randAlive`, hash-based) + Task 2 (`counterAttack` seeds with `seqRef`). Counter after each non-clearing strike → Task 2 Step 5. Per-slot `attackSlot` → Task 2 Steps 3/7. Hand-made hero-hit VFX + flinch → Tasks 2 (`addHeroHit` + `setHeroHurt`) + 3 (`.hero-hit`). Contact windup both sides → Task 2 Step 5 (hero→mob) + Steps 4/6 (`CONTACT_MS` before hero-hit). Cosmetic only (no state) → no reducer/transport touched. Fallback (no attack frames → m-attack; cleared → no counter via `randAlive` -1) → preserved. Testing → Task 1 unit + Task 4 browser.

**Placeholder scan:** None. Every code step shows complete code. Task 3 Step 4 references the existing reduced-motion selector by its known location (`.hit-effect,` ~line 1766) and says to mirror the existing treatment — an intentional "match what's there", not a placeholder.

**Type consistency:** `attackSlot: number | null`, `heroHits: number[]`, `addHeroHit`, `counterAttack`, `randAlive(pack, seed)`, `COUNTER_DELAY_MS`/`CONTACT_MS`/`HERO_HIT_MS`, `ISceneView.heroHits`, `HeroHits`/`hits` prop, `.hero-hit` — consistent across tasks. `monAttack`/`setMonAttack` are fully removed in Task 2 (Steps 3/7); typecheck in Step 9 catches any stray reference.
