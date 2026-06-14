# Phase 3.7 — T4 Realm Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single generic T4 "Secret Realm" scene with 13 distinct realms (8 main line×branch + 5 secret-class), each showing its boss as the ambient monster.

**Architecture:** App-only, behind the existing sprite seam. `sceneFor(tier, line?, branch?)` keeps T1–T3 unchanged and delegates T4 to a new pure `realmFor(line, branch)` that looks up a `REALMS` record (keyed by `${line}_${branch}` for main lines, bare `line` for secret lines) and falls back to a neutral `ASCENDANT` scene. CSS gradients + emoji are placeholders for PixelLab art later.

**Tech Stack:** Bun + TypeScript, `bun test`, React 19 (Vite), plain CSS.

**Spec:** `docs/superpowers/specs/2026-06-14-commit-quest-phase3-7-realm-mapping-design.md`

---

## Context for the implementer

- `app/src/scene.ts` is **app-only** and uses `export function` (not arrow-const) + `PascalCase` enum members. **Match that style** — do NOT convert to arrow-const, and do NOT import from `core/`.
- `state.class` shape (from `core/classes.ts` `IClassState`, consumed type-only): `line: TLine | null` (string values like `"mage"`, `"night_owl"`), `tier: number`, `branch: "a" | "b" | null`.
- The `Monster` component (`app/src/components/monster.tsx:18`) already renders `className={\`... monster-${scene.theme} ...\`}` and shows `scene.monster` as the name — so returning the right `{ theme, monster }` from `sceneFor` is all the wiring the monster needs. No `monster.tsx` change.
- Run tests with `cd app && bun test src/scene.test.ts` (the app has its own workspace). Use `bun test 2>&1 | grep -E "pass|fail"` to read results — never `tail`.

---

## Task 1: Realm mapping in `scene.ts`

**Files:**
- Modify: `app/src/scene.ts`
- Test: `app/src/scene.test.ts`

- [ ] **Step 1: Replace the test file with realm coverage**

Replace the entire contents of `app/src/scene.test.ts` with:

```ts
import { test, expect } from "bun:test";
import { sceneFor, realmFor, SceneTheme } from "./scene";

test("sceneFor T1-T3 unchanged", () => {
  expect(sceneFor(0).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(1).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(2).theme).toBe(SceneTheme.Forest);
  expect(sceneFor(2).monster).toBe("Error Wraith");
  expect(sceneFor(3).theme).toBe(SceneTheme.Dungeon);
});

test("sceneFor T4 main lines map to realm + boss", () => {
  expect(sceneFor(4, "mage", "a")).toEqual({
    theme: SceneTheme.SkyforgeAether,
    label: "Skyforge Aether",
    monster: "Storm Archon",
  });
  expect(sceneFor(4, "mage", "b").monster).toBe("The Kernel Lich");
  expect(sceneFor(4, "ranger", "a").theme).toBe(SceneTheme.AuroraFlux);
  expect(sceneFor(4, "ranger", "b").monster).toBe("The Grid Warden");
  expect(sceneFor(4, "rogue", "a").theme).toBe(SceneTheme.QuantumRift);
  expect(sceneFor(4, "rogue", "b").monster).toBe("The Phantom Culprit");
  expect(sceneFor(4, "sage", "a").theme).toBe(SceneTheme.OraclesAthenaeum);
  expect(sceneFor(4, "sage", "b").monster).toBe("The Orchestration Construct");
});

test("sceneFor T4 secret classes map to realm + boss", () => {
  expect(sceneFor(4, "maestro", null).monster).toBe("The Living Symphony");
  expect(sceneFor(4, "night_owl", null)).toEqual({
    theme: SceneTheme.MidnightRoost,
    label: "Midnight Roost",
    monster: "The Eclipse Owl",
  });
  expect(sceneFor(4, "ascetic", null).theme).toBe(SceneTheme.SilentSummit);
  expect(sceneFor(4, "gremlin", null).monster).toBe("The Chaos Gremlin King");
  expect(sceneFor(4, "trickster", null).theme).toBe(SceneTheme.FoolsMirage);
});

test("sceneFor T4 main line before branch pick falls back to Ascendant", () => {
  expect(sceneFor(4, "mage", null)).toEqual({
    theme: SceneTheme.Ascendant,
    label: "Ascendant Realm",
    monster: "Realm Guardian",
  });
  expect(sceneFor(5, "sage", null).theme).toBe(SceneTheme.Ascendant);
});

test("sceneFor T4 with no line falls back to Ascendant", () => {
  expect(sceneFor(4, null, null).theme).toBe(SceneTheme.Ascendant);
  expect(sceneFor(4).theme).toBe(SceneTheme.Ascendant);
});

test("realmFor builds keys and falls back on unknown", () => {
  expect(realmFor("mage", "a").theme).toBe(SceneTheme.SkyforgeAether);
  expect(realmFor("gremlin", null).theme).toBe(SceneTheme.GlitchPit);
  expect(realmFor("future_line", "a").theme).toBe(SceneTheme.Ascendant);
  expect(realmFor(null, null).theme).toBe(SceneTheme.Ascendant);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && bun test src/scene.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: FAIL — `realmFor` is not exported and the new `SceneTheme` members don't exist.

- [ ] **Step 3: Rewrite `app/src/scene.ts`**

Replace the entire contents of `app/src/scene.ts` with:

```ts
export enum SceneTheme {
  Grassland = "grassland",
  Forest = "forest",
  Dungeon = "dungeon",
  // T4 main-line realms (key: `${line}_${branch}`)
  SkyforgeAether = "skyforge_aether",
  CircuitCatacombs = "circuit_catacombs",
  AuroraFlux = "aurora_flux",
  GeometricSanctum = "geometric_sanctum",
  QuantumRift = "quantum_rift",
  NoirCrimeScene = "noir_crime_scene",
  OraclesAthenaeum = "oracles_athenaeum",
  ConductorsNexus = "conductors_nexus",
  // T4 secret-class realms (key: line)
  GrandConcertVault = "grand_concert_vault",
  MidnightRoost = "midnight_roost",
  SilentSummit = "silent_summit",
  GlitchPit = "glitch_pit",
  FoolsMirage = "fools_mirage",
  // T4 main-line pre-branch fallback
  Ascendant = "ascendant",
}

export interface IScene {
  theme: SceneTheme;
  label: string;
  monster: string; // semantic name; the placeholder/sprite visual lives in styles.css
}

// Keyed by `${line}_${branch}` for main lines and by the bare line for secret classes.
// Secret-line keys (e.g. "night_owl") and main keys (e.g. "mage_a") never collide.
const REALMS: Record<string, IScene> = {
  mage_a: { theme: SceneTheme.SkyforgeAether, label: "Skyforge Aether", monster: "Storm Archon" },
  mage_b: { theme: SceneTheme.CircuitCatacombs, label: "Circuit Catacombs", monster: "The Kernel Lich" },
  ranger_a: { theme: SceneTheme.AuroraFlux, label: "Aurora Flux", monster: "Prism Wisp" },
  ranger_b: { theme: SceneTheme.GeometricSanctum, label: "Geometric Sanctum", monster: "The Grid Warden" },
  rogue_a: { theme: SceneTheme.QuantumRift, label: "Quantum Rift", monster: "The Heisenbug" },
  rogue_b: { theme: SceneTheme.NoirCrimeScene, label: "Noir Crime Scene", monster: "The Phantom Culprit" },
  sage_a: { theme: SceneTheme.OraclesAthenaeum, label: "Oracle's Athenaeum", monster: "The Domain Sphinx" },
  sage_b: { theme: SceneTheme.ConductorsNexus, label: "Conductor's Nexus", monster: "The Orchestration Construct" },
  maestro: { theme: SceneTheme.GrandConcertVault, label: "Grand Concert Vault", monster: "The Living Symphony" },
  night_owl: { theme: SceneTheme.MidnightRoost, label: "Midnight Roost", monster: "The Eclipse Owl" },
  ascetic: { theme: SceneTheme.SilentSummit, label: "Silent Summit", monster: "The Stone Guardian" },
  gremlin: { theme: SceneTheme.GlitchPit, label: "The Glitch Pit", monster: "The Chaos Gremlin King" },
  trickster: { theme: SceneTheme.FoolsMirage, label: "Fool's Mirage", monster: "The Jester Mirage" },
};

const ASCENDANT: IScene = {
  theme: SceneTheme.Ascendant,
  label: "Ascendant Realm",
  monster: "Realm Guardian",
};

export function realmFor(line: string | null, branch: string | null): IScene {
  if (!line) {
    return ASCENDANT;
  }
  const key = branch ? `${line}_${branch}` : line;
  return REALMS[key] ?? ASCENDANT;
}

export function sceneFor(tier: number, line?: string | null, branch?: string | null): IScene {
  if (tier >= 4) {
    return realmFor(line ?? null, branch ?? null);
  }
  if (tier === 3) {
    return {
      theme: SceneTheme.Dungeon,
      label: "The Deep Dungeon",
      monster: "Dungeon Brute",
    };
  }
  if (tier === 2) {
    return {
      theme: SceneTheme.Forest,
      label: "Whispering Forest",
      monster: "Error Wraith",
    };
  }
  return {
    theme: SceneTheme.Grassland,
    label: "Grassland outside town",
    monster: "Bug Slime",
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && bun test src/scene.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: PASS — all realm, secret, fallback, and `realmFor` assertions green.

- [ ] **Step 5: Commit**

```bash
git add app/src/scene.ts app/src/scene.test.ts
git commit -m "feat(app): map T4 to 13 realms + boss; Ascendant fallback"
```

---

## Task 2: Pass `line`/`branch` from the consumers

**Files:**
- Modify: `app/src/components/scene-view.tsx:28`
- Modify: `app/src/view.ts:78`
- Test: `app/src/view.test.ts`

- [ ] **Step 1: Add an `areaLabel` realm assertion to `app/src/view.test.ts`**

`view.test.ts` already imports `areaLabel` and defines `const asState = (o: object): IState => o as unknown as IState;`, plus an existing test at line 72:

```ts
test("areaLabel comes from the tier scene", () => {
  expect(areaLabel(asState({ class: { tier: 1 } }))).toBe("Grassland outside town");
});
```

Immediately **after** that test, add a new one (reuse the existing `asState` helper, no new imports):

```ts
test("areaLabel reflects the T4 realm for the chosen branch", () => {
  expect(areaLabel(asState({ class: { tier: 4, line: "mage", branch: "a" } }))).toBe("Skyforge Aether");
  expect(areaLabel(asState({ class: { tier: 4, line: "mage", branch: null } }))).toBe("Ascendant Realm");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && bun test src/view.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: FAIL — `areaLabel` still calls `sceneFor` with tier only, so the branch-`a` case returns "Ascendant Realm" instead of the expected "Skyforge Aether".

- [ ] **Step 3: Update `areaLabel` in `app/src/view.ts`**

Change line 78 from:

```ts
  return sceneFor(state.class?.tier ?? 0).label;
```

to:

```ts
  return sceneFor(state.class?.tier ?? 0, state.class?.line, state.class?.branch).label;
```

- [ ] **Step 4: Update the scene in `app/src/components/scene-view.tsx`**

Change line 28 from:

```ts
  const scene = sceneFor(state.class?.tier ?? 0);
```

to:

```ts
  const scene = sceneFor(state.class?.tier ?? 0, state.class?.line, state.class?.branch);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && bun test src/view.test.ts 2>&1 | grep -E "pass|fail|error"`
Expected: PASS.

- [ ] **Step 6: Run the full app test suite to confirm no regressions**

Run: `cd app && bun test 2>&1 | grep -E "pass|fail|error"`
Expected: all pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
git add app/src/view.ts app/src/view.test.ts app/src/components/scene-view.tsx
git commit -m "feat(app): feed line/branch into sceneFor for realm scenes"
```

---

## Task 3: Realm CSS placeholders + art-prompts note

**Files:**
- Modify: `app/src/styles.css` (scene `.sky` gradients ~line 91; monster `::after` ~line 162)
- Modify: `docs/reference/art-prompts.md` (§7.4)

No test (presentational placeholders behind the sprite seam; verified visually in the panel).

- [ ] **Step 1: Rename the `secret_realm` sky rule to `ascendant` and add the 13 realm gradients**

In `app/src/styles.css`, replace this rule:

```css
.scene-secret_realm .sky {
  background: linear-gradient(180deg, #161227, #322a4a 60%, #161227);
}
```

with (the old gradient is reused as the neutral Ascendant look, followed by the 13 realm placeholders):

```css
.scene-ascendant .sky {
  background: linear-gradient(180deg, #161227, #322a4a 60%, #161227);
}
.scene-skyforge_aether .sky {
  background: linear-gradient(180deg, #2a1a4a, #4a3a78 55%, #6b5aa0);
}
.scene-circuit_catacombs .sky {
  background: linear-gradient(180deg, #14081f, #241433 60%, #0f2a14);
}
.scene-aurora_flux .sky {
  background: linear-gradient(180deg, #08201f, #0f3a44 50%, #1a5a55);
}
.scene-geometric_sanctum .sky {
  background: linear-gradient(180deg, #0c2230, #14506b 60%, #2a7a8c);
}
.scene-quantum_rift .sky {
  background: linear-gradient(180deg, #1f0a18, #3a1430 55%, #5a1a3a);
}
.scene-noir_crime_scene .sky {
  background: linear-gradient(180deg, #0c0c10, #1c1c24 60%, #2a2230);
}
.scene-oracles_athenaeum .sky {
  background: linear-gradient(180deg, #2a1f0c, #4a3a18 55%, #6b5a2a);
}
.scene-conductors_nexus .sky {
  background: linear-gradient(180deg, #241a08, #443414 60%, #6b5520);
}
.scene-grand_concert_vault .sky {
  background: linear-gradient(180deg, #2a200a, #554216 55%, #806020);
}
.scene-midnight_roost .sky {
  background: linear-gradient(180deg, #0a0e24, #1a2048 60%, #2a3060);
}
.scene-silent_summit .sky {
  background: linear-gradient(180deg, #2a2e34, #4a525c 55%, #6b7480);
}
.scene-glitch_pit .sky {
  background: linear-gradient(180deg, #0a1f0e, #143a1c 60%, #1a5a28);
}
.scene-fools_mirage .sky {
  background: linear-gradient(180deg, #2a0a2a, #4a144a 50%, #6a1a5a);
}
```

- [ ] **Step 2: Rename the `secret_realm` monster emoji to `ascendant` and add the 13 boss emojis**

In `app/src/styles.css`, replace this rule:

```css
.monster-secret_realm::after {
  content: "👑";
}
```

with:

```css
.monster-ascendant::after {
  content: "👑";
}
.monster-skyforge_aether::after {
  content: "⚡";
}
.monster-circuit_catacombs::after {
  content: "💀";
}
.monster-aurora_flux::after {
  content: "🌈";
}
.monster-geometric_sanctum::after {
  content: "🛡️";
}
.monster-quantum_rift::after {
  content: "🌀";
}
.monster-noir_crime_scene::after {
  content: "🕵️";
}
.monster-oracles_athenaeum::after {
  content: "🦁";
}
.monster-conductors_nexus::after {
  content: "🤖";
}
.monster-grand_concert_vault::after {
  content: "🎼";
}
.monster-midnight_roost::after {
  content: "🦉";
}
.monster-silent_summit::after {
  content: "🗿";
}
.monster-glitch_pit::after {
  content: "👺";
}
.monster-fools_mirage::after {
  content: "🃏";
}
```

- [ ] **Step 3: Mark the §7.4 mapping note done in `docs/reference/art-prompts.md`**

Find this line in §7.4:

```
- **3.2c** จะ map `sceneFor(tier=4, line, branch)` → theme key ของแดน (เช่น `skyforge_aether`) — โค้ดอ้าง theme key, art เสียบหลัง CSS seam
```

Replace it with:

```
- **3.7 ✅** map `sceneFor(tier=4, line, branch)` → theme key ของแดน (เช่น `skyforge_aether`) ครบ 13 แดน — โค้ดอ้าง theme key, art เสียบหลัง CSS seam (ตอนนี้เป็น gradient + emoji placeholder)
```

- [ ] **Step 4: Verify the build still compiles and full suite passes**

Run: `cd app && bun test 2>&1 | grep -E "pass|fail|error"`
Expected: all pass, 0 fail. (CSS isn't tested, but this confirms nothing broke.)

Optionally confirm there are no leftover `secret_realm` references:

Run: `grep -rn "secret_realm\|SecretRealm" app/src`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add app/src/styles.css docs/reference/art-prompts.md
git commit -m "feat(app): 13 realm sky gradients + boss emoji placeholders"
```

---

## Self-Review

**Spec coverage:**
- `sceneFor(tier, line?, branch?)` + T1–T3 unchanged → Task 1. ✅
- 13 realms (8 main keyed `${line}_${branch}`, 5 secret keyed by line) + boss as monster → Task 1 `REALMS`. ✅
- `ASCENDANT` fallback (main pre-branch, null line, unknown key) → Task 1 `realmFor`. ✅
- `SecretRealm` → `Ascendant` rename (enum + CSS) → Task 1 + Task 3. ✅
- Consumers pass `line`/`branch` → Task 2 (`scene-view.tsx`, `view.ts`). ✅
- 13 `.scene-<theme>` gradients + 13 `.monster-<theme>` emoji + rename → Task 3. ✅
- art-prompts §7.4 note → Task 3. ✅
- Testing (T1–T3 regression, all realms, secret, pre-branch, null, `realmFor`) → Task 1 + Task 2. ✅

**Placeholder scan:** none — every code step has full content.

**Type consistency:** `sceneFor(tier: number, line?: string | null, branch?: string | null)` and `realmFor(line: string | null, branch: string | null)` signatures match across the test, the implementation, and both consumer call sites. `SceneTheme` member names match between `scene.ts`, `scene.test.ts`, and the `.scene-<value>` / `.monster-<value>` CSS class strings.
