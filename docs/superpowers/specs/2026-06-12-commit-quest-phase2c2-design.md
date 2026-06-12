# Commit Quest — Phase 2c.2 Design (secret classes)

> Second half of Phase 2c (epic #3). Builds on 2b.1 (class identity), 2b.2 (base passive),
> 2c.1 (loot). Adds **secret classes** — lines that never appear in the normal pick/branch menu,
> unlocked by hidden achievements (or one easter egg), then equipped via respec.
> Full game design: `docs/claude-code-rpg-design.md` §6.5. Conventions: `CLAUDE.md`.

---

## 1. What 2c.2 proves

A player who hits a rare, hidden milestone **unlocks a secret class** and can respec into it.
Secret classes use the same `class` schema and the same base-passive ladder as the main lines,
but never appear in the Lv.5 pick menu, have **no Tier-4 branch**, and carry a distinct
identity (icon + forms). Unlocks are **balanced for the mid-to-late game** — gated behind a
level floor plus a substantial activity threshold, all tunable in `config.json`.

## 2. Locked decisions (brainstorm 2026-06-12)

| # | Topic | Decision |
|---|---|---|
| D1 | Scope | **Secret-class mechanic only.** Git/command achievements + the adapter `cmd`-tag are a separate checkpoint (2c.3). |
| D2 | Representation | **Code enum + registry** (`SecretLine` + `SECRET_TREE`), mirroring `ClassLine`/`CLASS_TREE`. `config.json` tunes rates/thresholds, not the class set. Fully data-driven (add-via-config) secret classes are deferred. |
| D3 | Roster | **Five**: Maestro, Night Owl, The Ascetic, The Gremlin, The Trickster (easter egg). |
| D4 | Passive | Reuse the base-passive ladder (`basePct` + `config.passive`) on a **narrow thematic signal** per secret. The **signature gimmicks** (e.g. Maestro scaling with concurrent agents) are deferred. The Trickster is cosmetic-only (passive 0). |
| D5 | Balance | Every unlock is **mid-to-late game**: a level floor (Lv.20–25) **and** a real activity threshold. Thresholds live in the (config-overridable) achievement registry. The Trickster easter egg is ungated (cosmetic, no power). |
| D6 | Idempotency | Every unlock condition is **monotonic** — counts, distinct sets, or a latched seal — so unlocks never disappear on recompute. |

## 3. The roster

`forms` are `[T1, T2, T3, T4]` (no branch). Icons and form names are flavor.

| Secret | icon | unlock | passive signal (laddered +20→50%) |
|---|---|---|---|
| **Maestro** | 🎼 | `maestro`: `distinct_source ≥ 3` **and** `level ≥ 25` | XP from `delegate` (subagent calls) |
| **Night Owl** | 🦉 | `night_owl`: `night_actions ≥ 60` **and** `level ≥ 20` | XP from actions at night (local 00:00–04:00) |
| **The Ascetic** | 🧘 | `the_ascetic`: `ascetic_seal` (ever `level ≥ 25` while run-ratio `< 0.2`) | XP from `read` + `edit` |
| **The Gremlin** | 👺 | `the_gremlin`: `failures_recovered ≥ 40` **and** `level ≥ 20` | XP from `action_fail` |
| **The Trickster** | ✦ | easter egg `rpg xyzzy` (sets `profile.xyzzy`) | none — cosmetic (passive 0) |

Form names (`SecretForm`, added to the `ClassForm` enum):

- Maestro: Conductor · Maestro · Virtuoso · Grand Symphony
- Night Owl: Night Owl · Moonlighter · Nocturne · Eclipse
- The Ascetic: Initiate · Ascetic · Hermit · Enlightened
- The Gremlin: Imp · Gremlin · Poltergeist · Chaos Daemon
- The Trickster: Prankster · Trickster · Illusionist · Archfool

## 4. Unlock flow (idempotent)

```
reduce:
  earned achievements  ─┐
                        ├─►  unlocked_secret_classes  =
  profile.xyzzy ─► Trickster ─┘   { def.reward.unlocks_class for each earned def } ∪ { Trickster if xyzzy }
```

- `IAchievementDef.reward.unlocks_class` (field already exists) is typed `SecretLine`.
- A secret stays unlocked because its achievement gates on **monotonic facts** (counts,
  `distinct_source`, or the latched `ascetic_seal`). `profile.xyzzy` is sticky player input.
- The reducer never writes the profile; `xyzzy` is set by the `rpg` tool (player input, like
  `line`/`title`), so `reduce` stays pure.

## 5. Three new fold-derived signals

All computed in the existing **sequential causal fold** (2b.2), one pass over `ts`-sorted events:

1. **`night_actions`** — count of `action`/`action_fail` events whose **local hour ∈ [0, 4)**
   (via a new `eventLocalHour`, reusing `streak.ts`'s timezone logic). Monotonic.
2. **`failures_recovered`** — track an `action_fail` as *pending* per `(session_id, action)`;
   when a later **successful action of the same kind in the same session** arrives, increment
   and clear the pending mark. Monotonic; order-dependent (hence in the fold).
3. **`ascetic_seal`** (0/1) — **latched** true the first time the running `level ≥ 25` **and**
   `runs / actions_total < 0.2` (computed from the running counts before this event). Once set,
   stays set — making the otherwise non-monotonic run-ratio gate monotonic.

These are stored on `state.stats` (`night_actions`, `failures_recovered`, `ascetic_seal`) and
surfaced through `facts()` for the achievement registry.

## 6. Passive signal dispatch

`isPassiveSignal(line, event)` replaces the inline `lineForEvent(e) === line` test in the fold:

- **Main line** (`ClassLine`): `lineForEvent(event) === line` (unchanged).
- **Secret line** (`SecretLine`): a per-secret predicate —
  - Maestro → `event.action === Delegate`
  - Night Owl → `event` is an action **and** `isNight(event.ts)`
  - The Ascetic → `event.action === Read || event.action === Edit`
  - The Gremlin → `event.type === ActionFail`
  - The Trickster → `false`

The multiplier itself (`1 + basePct(tier, config.passive)`) and the rest of the fold are
unchanged. Secret passives are narrow by design, so a secret is never strictly stronger than a
main line — honoring §6.4 (respec is never a downgrade) without being must-have.

## 7. Class resolution for secret lines

`profile.line: ClassLine | SecretLine` (alias `TLine`). The class helpers branch on `isSecret`:

- `formFor(line, tier, branch)` — secret: `SECRET_TREE[line].forms[clamp(tier - 1, 0, 3)]`
  (Novice at tier 0); main: unchanged.
- `iconFor(line)` — secret: `SECRET_TREE[line].icon`.
- `advancementPending(line, level, branch)` — secret lines **never** pend a branch (no T4 split)
  and are not offered at the Lv.5 menu, so a secret line yields `null`.
- `tier` is computed from the **current level** exactly as for a respec (§6.3), so equipping a
  secret late lands at the matching tier and its passive ladder — never a downgrade.

## 8. `state.json` / `profile.json`

- `state.stats.night_actions`, `state.stats.failures_recovered`, `state.stats.ascetic_seal`.
- `state.unlocked_secret_classes?: SecretLine[]` (sorted, deduped).
- `state.class.line` may be a `SecretLine`; `branch` stays `null`; `base_passive_pct` as usual.
- `profile.xyzzy?: boolean`.

## 9. CLI (`tools/rpg.ts`)

- **`rpg secrets`** — list unlocked secret classes; show still-locked ones as `???` with a broad
  hint (from the achievement `desc`). Reads `state.unlocked_secret_classes`.
- **`rpg class <secret>`** — equipping a secret is allowed **only if it is unlocked** (main lines
  keep the Lv.5 rule). Writes `profile.line`, refreshes state.
- **`rpg xyzzy`** — easter egg: sets `profile.xyzzy = true`, persists, prints a playful line.
  Unlocks The Trickster.

## 10. HUD

**No change.** Secret classes render through the existing `icon + form` path (🎼/🦉/🧘/👺/✦ + the
tier form). Hidden achievements already display as `???` until earned (the `hidden` flag).

## 11. Components

| File | Change |
|---|---|
| `core/classes.ts` | `SecretLine` enum, secret `ClassForm` members, `SECRET_TREE`, `TLine`, `isSecret`; `formFor`/`iconFor`/`advancementPending` handle secrets |
| `core/affinity.ts` | `isPassiveSignal(line, event)` (main via `lineForEvent`, secret predicates) |
| `core/streak.ts` | `eventLocalHour(ts)` + `isNight(ts)` (reuse the offset logic) |
| `core/achievements.ts` | `facts`: `night_actions`/`failures_recovered`/`ascetic_seal`; new hidden unlock achievements `maestro`/`night_owl`/`the_ascetic`/`the_gremlin`; `reward.unlocks_class: SecretLine` |
| `core/reduce.ts` | count the three signals in the fold; `isPassiveSignal` for the multiplier; assemble `unlocked_secret_classes` (earned ∪ xyzzy) |
| `core/state.ts` / `core/profile.ts` | new fields; widen `line` to `TLine` |
| `tools/rpg.ts` | `secrets`, secret-aware `class`, `xyzzy` |

`core/` imports stay within `core/`. No adapter / hook changes.

## 12. Balance (tunable)

Default thresholds (mid-to-late; override per-key via `config.json`'s `achievements`):

| unlock | level floor | activity |
|---|---|---|
| Maestro | 25 | 3 distinct sources |
| Night Owl | 20 | 60 night actions |
| The Ascetic | 25 (in the seal) | run-ratio < 0.2 sustained to Lv.25 |
| The Gremlin | 20 | 40 recovered failures |

The existing `polyglot` (3 sources, points) is left as-is and does **not** unlock a class; the
level-gated `maestro` achievement is the unlocker. Tune any threshold without code by overriding
that achievement's `cond` in `config.json`.

## 13. Testing (TDD)

- **`core/classes.test.ts`** — secret `formFor` (4 forms, Novice at tier 0, no branch even at
  Lv.50), `iconFor`, `isSecret`, `advancementPending` returns `null` for a secret at Lv.50.
- **`core/affinity.test.ts`** — `isPassiveSignal`: Maestro↔delegate, Night Owl↔night action,
  Ascetic↔read/edit, Gremlin↔action_fail, Trickster↔never; main lines unchanged.
- **`core/streak.test.ts`** — `eventLocalHour`/`isNight` at the 00:00 and 04:00 boundaries.
- **`core/achievements.test.ts`** — facts expose the three signals; `maestro` needs *both* the
  source count and the level floor (fails with only one).
- **`core/reduce.test.ts`** —
  - `night_actions`/`failures_recovered`/`ascetic_seal` computed from a fixture (recovery = a
    fail then a same-kind success in one session; seal latches at Lv.25 low-ratio).
  - earned `maestro` → `unlocked_secret_classes` contains Maestro; `profile.xyzzy` → Trickster.
  - **balance:** the same source-rich journal at low level does **not** unlock Maestro.
  - secret base passive multiplies its signal (a hand-checked micro-case, à la 2b.2).
  - **unlock monotonic:** reducing twice (and after more events) keeps an unlocked class unlocked.
  - Novice / main-class results unchanged.
- **`tools/rpg.test.ts`** — `rpg class <secret>` is rejected when locked, accepted when unlocked;
  `rpg xyzzy` unlocks the Trickster; `rpg secrets` lists unlocked and `???` for locked.

## 14. Definition of done

1. `bun test` green; `bunx tsc --noEmit` clean; `bun run format:check` clean.
2. A fixture that earns an unlock resolves the secret into `unlocked_secret_classes`; equipping it
   via `rpg class` renders its icon/form in the HUD; a low-level source-rich journal stays locked.
3. Deployed: `rpg secrets` shows locked `???`; `rpg xyzzy` unlocks the Trickster on the real home.

## 15. Out of scope (→ later)

- **Signature gimmicks** (Maestro per-concurrent-agent scaling, Night Owl glow, etc.).
- **Git/command achievements** + the adapter `cmd`-tag, `test`-pass XP, the PR-merged loot
  trigger (the 2c.3 "command-aware" checkpoint).
- **Config-defined** secret classes (a fully data-driven class system).
- Prestige / season resets.
