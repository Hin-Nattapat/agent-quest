# Phase 3.7 — T4 Realm Mapping design

> **Status:** design approved 2026-06-14. Plan: `docs/superpowers/plans/`.
> Turns the single generic "Secret Realm" T4 scene into **13 distinct realms** — one per
> class-branch (8 main: line×branch) and one per secret class (5) — each with its own boss as the
> ambient monster. App-only, behind the existing CSS/sprite seam. Art (PixelLab realm tilesets +
> boss sprites) lands later; this checkpoint ships CSS-gradient + emoji placeholders.

## Goal

When a hero reaches T4 and has chosen a branch, the scene "moves worlds" to their realm: the sky
gradient and the ambient monster reflect the realm + its boss (e.g. a Mage who branched `a` lands in
**Skyforge Aether** facing the **Storm Archon**). Secret-class heroes land in their unique realm.
T1–T3 scenes are unchanged (shared grassland / forest / dungeon).

## Constraints

- **App-only.** No `core/` or reducer change. `state.class` already carries `line`, `tier`, and
  `branch` — `sceneFor` reads them directly.
- **Behind the sprite seam.** `sceneFor` returns a semantic `{ theme, label, monster }`; the visual
  is a `.scene-<theme>` CSS gradient + a `.monster-<theme>` emoji placeholder. Real PixelLab realm
  art / boss sprites slot in later by swapping CSS, no logic change.
- **Idempotent / pure.** `sceneFor` and the new `realmFor` are pure functions of their inputs.
- **Match-the-file style.** `app/src/scene.ts` uses `export function` (not arrow-const) and
  `PascalCase` enum members — keep that.

## Architecture

```
state.class { line, tier, branch }
        │
        ▼
sceneFor(tier, line?, branch?) ──► IScene { theme: SceneTheme, label, monster }
   tier <= 3 → shared grassland/forest/dungeon (unchanged)
   tier >= 4 → realmFor(line, branch)
                 secret line (branch null)      → REALMS[line]          (5)
                 main line + branch a|b         → REALMS[`${line}_${branch}`] (8)
                 main line, branch null (pre-pick) → ASCENDANT fallback
        │
        ▼
scene-view  className={`scene scene-${theme}`}  +  ambient <Monster> = scene.monster
styles.css  .scene-<theme> .sky { background: <gradient> }  ·  .monster-<theme>::after { content: <emoji> }
```

## The 13 realms

`line` values are the `ClassLine` / `SecretLine` enum strings; `branch` is `"a" | "b"`. The map key
is the **line value** for secret lines and **`${line}_${branch}`** for main lines. Source:
`docs/reference/art-prompts.md §7.2–7.3`. Theme key = realm name in `snake_case`.

### Main lines (8) — key `${line}_${branch}`

| key | theme | label | monster (boss) | palette |
|---|---|---|---|---|
| `mage_a` | `skyforge_aether` | Skyforge Aether | Storm Archon | purple + gold electric |
| `mage_b` | `circuit_catacombs` | Circuit Catacombs | The Kernel Lich | deep purple + toxic green |
| `ranger_a` | `aurora_flux` | Aurora Flux | Prism Wisp | teal + rainbow shimmer |
| `ranger_b` | `geometric_sanctum` | Geometric Sanctum | The Grid Warden | teal + blueprint-blue + white |
| `rogue_a` | `quantum_rift` | Quantum Rift | The Heisenbug | coral + glitch-magenta |
| `rogue_b` | `noir_crime_scene` | Noir Crime Scene | The Phantom Culprit | noir black-grey + coral |
| `sage_a` | `oracles_athenaeum` | Oracle's Athenaeum | The Domain Sphinx | amber gold + parchment |
| `sage_b` | `conductors_nexus` | Conductor's Nexus | The Orchestration Construct | amber + gold + threads |

### Secret lines (5) — key `${line}`

| key | theme | label | monster (boss) | palette |
|---|---|---|---|---|
| `maestro` | `grand_concert_vault` | Grand Concert Vault | The Living Symphony | radiant gold |
| `night_owl` | `midnight_roost` | Midnight Roost | The Eclipse Owl | deep indigo + moonlight silver |
| `ascetic` | `silent_summit` | Silent Summit | The Stone Guardian | pale stone white |
| `gremlin` | `glitch_pit` | The Glitch Pit | The Chaos Gremlin King | glitch green |
| `trickster` | `fools_mirage` | Fool's Mirage | The Jester Mirage | rainbow harlequin |

### Fallback — main line at T4, no branch yet

A main-line hero can hit T4 (`tier >= 4`) the instant before they pick a branch
(`branch === null`). That key (`mage`, `ranger`, …) is **not** in the map. `realmFor` returns the
neutral **Ascendant Realm**:

| theme | label | monster |
|---|---|---|
| `ascendant` | Ascendant Realm | Realm Guardian |

One neutral theme (not four line-tinted variants) — branch pick is usually immediate, so this is a
brief transient. `realmFor` also returns Ascendant when `line === null` (defensive; T4 implies a
line in practice).

## Components

| File | Responsibility | New/Mod |
|---|---|---|
| `app/src/scene.ts` | **rename** `SecretRealm = "secret_realm"` → `Ascendant = "ascendant"` (it was the only T4 theme; now the fallback); add the 13 realm keys; `IScene` unchanged; `sceneFor(tier, line?, branch?)`; new pure `realmFor(line, branch)` + `REALMS` record + `ASCENDANT` const | Modify |
| `app/src/scene.test.ts` | replace the `SecretRealm` T4 assertions; T1–T3 unchanged; add each realm key + secret + pre-branch fallback + null-line | Modify |
| `app/src/components/scene-view.tsx:28` | pass `state.class?.line, state.class?.branch` to `sceneFor` | Modify |
| `app/src/view.ts:78` | `areaLabel` passes `line, branch` to `sceneFor` | Modify |
| `app/src/styles.css` | **rename** the existing `.scene-secret_realm` / `.monster-secret_realm` rules → `.scene-ascendant` / `.monster-ascendant` (reuse that gradient as the neutral Ascendant look); add 13 `.scene-<realm> .sky` gradient placeholders (palette per table) + 13 `.monster-<realm>::after` emoji placeholders | Modify |
| `docs/reference/art-prompts.md §7.4` | mark the `sceneFor(tier,line,branch)` mapping note **done (3.7)** | Modify |

## `scene.ts` shape

```ts
export enum SceneTheme {
  // T1–T3 (unchanged)
  Grassland = "grassland",
  Forest = "forest",
  Dungeon = "dungeon",
  // T4 main-line realms
  SkyforgeAether = "skyforge_aether",
  CircuitCatacombs = "circuit_catacombs",
  AuroraFlux = "aurora_flux",
  GeometricSanctum = "geometric_sanctum",
  QuantumRift = "quantum_rift",
  NoirCrimeScene = "noir_crime_scene",
  OraclesAthenaeum = "oracles_athenaeum",
  ConductorsNexus = "conductors_nexus",
  // T4 secret-class realms
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
  monster: string;
}

// keyed by line value (secret) or `${line}_${branch}` (main)
const REALMS: Record<string, IScene> = { /* 13 entries */ };
const ASCENDANT: IScene = { theme: SceneTheme.Ascendant, label: "Ascendant Realm", monster: "Realm Guardian" };

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
  // T1–T3 unchanged …
}
```

`line`/`branch` are typed `string | null` (not the core enums) to keep `scene.ts` free of a
`core/classes` import — the app already passes the raw `state.class` string values, and the keys are
plain strings. Secret-line keys (`night_owl`, etc.) and main keys (`mage_a`) never collide.

## Data flow & error handling

- T1–T3: `line`/`branch` ignored — identical scenes to today.
- Old `state.json` (no `branch`, pre-T4): `tier <= 3` path, no realm logic touched.
- Unknown / future key (a new line not yet in `REALMS`): `?? ASCENDANT` — graceful neutral realm,
  never a crash or blank theme.
- Missing CSS for a theme: the `.sky` falls back to the base scene background; `.monster-<theme>`
  with no emoji shows the default monster placeholder. No layout break.

## Testing

`bun test app/src/scene.test.ts`:

- **T1–T3 unchanged:** `sceneFor(0..3)` themes + a monster name (regression guard).
- **Main realms:** `sceneFor(4, "mage", "a").theme === SkyforgeAether` and `.monster === "Storm
  Archon"`; spot-check all 8 keys (theme + boss monster).
- **Secret realms:** `sceneFor(4, "night_owl", null).theme === MidnightRoost` / monster `"The
  Eclipse Owl"`; spot-check all 5.
- **Pre-branch fallback:** `sceneFor(4, "mage", null).theme === Ascendant`, monster `"Realm
  Guardian"`.
- **Null line:** `sceneFor(4, null, null).theme === Ascendant`.
- **`realmFor` direct:** key building (`mage` + `a` → `mage_a`; secret → bare line) + unknown key →
  Ascendant.
- **Scene/CSS visual:** verified in the VS Code panel — each realm sky gradient + boss emoji renders
  (manual, behind the seam).

## Scope / non-goals

- **Placeholders only.** CSS gradients + emoji stand in for PixelLab realm tilesets and 64×64 boss
  sprites (gen order per art-prompts §7.4 — sprites later).
- **No animation.** Monster-approach walk + up-class world-transition are **Phase 3.8** (next
  checkpoint), not here. The realm just renders statically when T4 is reached.
- **Boss-encounter unchanged.** The existing boss-encounter overlay (right-slot foe) is orthogonal;
  this only changes the *ambient* monster + scene theme.
- **No reducer/core change.** `state.class` already carries everything `sceneFor` needs.
