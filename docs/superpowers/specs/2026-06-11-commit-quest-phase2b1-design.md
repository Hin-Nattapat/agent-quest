# Commit Quest — Phase 2b.1 Design (class identity)

> First half of Phase 2b (epic #3). Builds on 2a (reducer/state/statusline + streak/achievements).
> Identity only — **no XP passives** (those are 2b.2). See [[phase2-decomposition]].
> Full game design: `docs/claude-code-rpg-design.md` §6. Conventions: `CLAUDE.md`.

---

## 1. What 2b.1 proves

The player can **name their character** and **pick a class** (line), and the statusline shows
`{name} · {icon}{form}  Lv.N …`. Class identity is resolved by the reducer from the player's
choices + their level. **XP is unchanged** — class passives (the mechanical layer) are 2b.2.

```
profile.json {name, line, branch}  ──(rpg CLI writes)──┐
journal ───────────────────────────────────────────────┤─► reduce ─► state.json{ name, class{line,tier,form,affinity,advancement_pending} }
                                                          └─ tier←level · form←line+tier · affinity←journal
                                                                         ▼
                                  HUD:  "Gandalf · ⚔ Infra Archmage  Lv.30 ███░░ 72% 🔥5d  |  Opus  $0.42  · ctx 8%"
```

## 2. Locked decisions (brainstorm 2026-06-11)

| # | Topic | Decision |
|---|---|---|
| B1 | Player-command channel | **A CLI tool** (`tools/rpg.ts`) writes a player-owned **`profile.json`**, then refreshes `state.json`. Player choices live in `profile.json` (the reducer never overwrites it); the reducer *reads* it. |
| B2 | Scope | **Identity only.** Name + line selection + tier/form display + affinity suggestion. **No passives / no XP change.** Specialist/branch-EV/floor/pity/auto-tune (§6.4) and secret classes (2c) are out. |
| B3 | Advancement model | **Command only at real choices:** `rpg class <line>` at Lv.5, `rpg branch <a\|b>` at Lv.50 (locks). Tiers 2 & 3 are **automatic** (form name follows level — no empty "confirm" button while there's no passive payoff). `rpg respec` before Lv.50. |
| B4 | Class resolution | The **reducer resolves** the class block (line + level → tier + form + pending) into `state.json`, so HUD/inspect/app read one file. `reduce(events, config, today?, profile?)`. |
| B5 | Affinity | Computed by the reducer from the journal using the data we have (action kinds + file extensions); a normalized hint, not exact. `prompt` length / command text are unavailable → proxied. |

## 3. `profile.json` (player-owned; the reducer never writes it)

```jsonc
{ "name": "Gandalf", "line": "mage", "branch": null }
```
- `name?`, `line?` (`mage|ranger|rogue|sage`), `branch?` (`a|b`) — all optional/null until set.
- Lives at `$AGENTRPG_HOME/profile.json`. Created on first `rpg` command; missing = all-null.

## 4. Class tree (`CLASS_TREE` in `core/classes.ts`, from §6.2)

`ClassLine` is a string enum (`Mage="mage"`, …). Each line: an icon + 3 tier forms + 2 branch forms.

| line | icon | T1 | T2 | T3 | T4-a | T4-b |
|---|---|---|---|---|---|---|
| mage | ⚔ | Backend Mage | Server Sorcerer | Infra Archmage | Cloud Summoner | Kernel Lich |
| ranger | 🏹 | Frontend Ranger | UI Sharpshooter | Pixel Hunter | Motion Trickster | Design Warden |
| rogue | 🗡 | Debugger Rogue | Bug Assassin | Stack Stalker | Heisenbug Hunter | Forensics Shadow |
| sage | 📖 | Architect Sage | System Oracle | Pattern Magus | Domain Prophet | Orchestration Master |

Helpers (pure):
- `tierForLevel(level)`: `<5 → 0` · `5–14 → 1` · `15–29 → 2` · `30–49 → 3` · `≥50 → 4`.
- `formFor(line, tier, branch)`: `tier 0` or `line==null` → `"Novice"`; `tier 1–3` → `forms[tier-1]`;
  `tier 4` → `branches[branch]` if chosen, else `forms[2]` (the T3 form) until a branch is picked.
- `iconFor(line)`: the line icon, or `""` for Novice.

## 5. Affinity (`core/affinity.ts`, pure)

`computeAffinity(events): Record<ClassLine, number>` — tally a line per event, then normalize to
proportions (all-zero when no signals). One event maps to at most one line, in this order:

| signal | line |
|---|---|
| `action delegate` | sage |
| `action_fail` (any) | rogue |
| `action run` | mage |
| `action read` / `search` | rogue |
| `action edit`/`write`, file ext `.go .sql .rs .yaml .yml` (or `Dockerfile`) | mage |
| `action edit`/`write`, file ext `.tsx .jsx .css .scss .html .vue` | ranger |
| `action edit`/`write`, file ext `.md .mdx` | sage |
| anything else (`prompt`, generic edits, lifecycle) | — (no affinity) |

(Design's "long prompts → sage" can't be measured without prompt text, so `delegate` + `.md`
proxy the Sage signal. This is a suggestion only.)

## 6. `state.json` additions

```jsonc
"name": "Gandalf",                       // from profile; omitted if unset
"class": {
  "line": "mage",                        // null = Novice
  "tier": 3,
  "form": "Infra Archmage",
  "icon": "⚔",                           // "" for Novice
  "branch": null,                        // "a" | "b" | null
  "affinity": { "mage": 0.46, "ranger": 0.31, "rogue": 0.18, "sage": 0.05 },
  "advancement_pending": null            // "class" | "branch" | null
}
```
`advancement_pending`:
- `"class"` when `level >= 5 && line == null` (you can pick a class).
- `"branch"` when `level >= 50 && line != null && branch == null` (you can pick a branch).
- else `null`.

Both `name` and `class` are optional on `IState` (forward-compat with pre-2b state).

## 7. CLI — `tools/rpg.ts`

Run as `bun ~/.agentrpg/tools/rpg.ts <cmd> …`. Each command loads `profile.json`, validates
against the current level (from `reduceToFile`), writes `profile.json`, refreshes `state.json`
(`reduceToFile`), and prints a short result to stdout.

| command | effect / validation |
|---|---|
| `rpg name "<text>"` | set `name` (trim; cap length ~24 for the HUD) |
| `rpg class <line>` | set `line`; error if `level < 5` or `line` invalid; clears `branch` |
| `rpg branch <a\|b>` | set `branch`; error if `level < 50`, no `line`, or already set (locked) |
| `rpg respec <line>` | change `line` before Lv.50 (error at `level >= 50`); clears `branch` |
| `rpg status` | print name, form, level, affinity, and the suggested line (highest affinity) |

CLI stdout is fine (it's an interactive tool, not a hook). Errors print a message and exit
non-zero. `install.sh` already deploys `tools/`.

## 8. Reducer change

`reduce(events, config, today?, profile?)`:
- compute `affinity = computeAffinity(events)`.
- `line = profile?.line ?? null`, `branch = profile?.branch ?? null`.
- `tier = line ? tierForLevel(level) : 0`; `form = formFor(line, tier, branch)`;
  `icon = iconFor(line)`; resolve `advancement_pending` (§6).
- add `name = profile?.name` (when set) and the `class` block to the returned state.

`reduceToFile(home)` loads `profile.json` (via `loadProfile`) and passes it. Pre-2b callers
(`reduce(events, cfg)`) omit `profile` → Novice class + affinity, no `name` (non-breaking).

## 9. HUD

`renderHud` prepends identity before the level:
```
{name} · {classLabel}  Lv.{level} {bar} {pct}%{fire}  |  {model}  ${cost}  ·  ctx {ctx}%
```
- `name` = `state.name || "Adventurer"`.
- `classLabel` = `line ? "{icon} {form}" : "Novice"`, plus ` ✨` when `advancement_pending` is set.
- Reads `state.name`/`state.class` defensively (both optional).

Examples:
- `Gandalf · ⚔ Infra Archmage  Lv.30 ███████░░░ 72% 🔥5d  |  Opus 4.8  $0.42  · ctx 8%`
- `Adventurer · Novice ✨  Lv.6 ██░░░░░░░░ 19%  |  Opus 4.8  $0.42  · ctx 8%` (Lv.5+, no line yet)

## 10. Components

| File | Change |
|---|---|
| `core/classes.ts` | new — `ClassLine`, `CLASS_TREE`, `IClassState`, `tierForLevel`, `formFor`, `iconFor`, pending helper |
| `core/affinity.ts` | new — `computeAffinity(events)` |
| `core/profile.ts` | new — `IProfile`, `loadProfile(home)`, `saveProfile(home, profile)` |
| `core/state.ts` | add optional `name?`, `class?` (`IClassState`) |
| `core/reduce.ts` | `reduce(events, config, today?, profile?)` resolves class + affinity; `reduceToFile` loads profile |
| `tools/rpg.ts` | new — the player CLI |
| `hud/statusline.ts` | `renderHud` prepends `{name} · {classLabel}` |
| `tools/inspect.ts` | headline shows the class form |

## 11. Testing (TDD)

- **`core/classes.test.ts`** — `tierForLevel` boundaries; `formFor` (Novice, each tier, T4 with/without branch); `iconFor`.
- **`core/affinity.test.ts`** — `computeAffinity` proportions for mixed events; all-zero on no signals; ext mapping.
- **`core/profile.test.ts`** — `loadProfile` defaults when missing; `saveProfile`→`loadProfile` round-trip.
- **`core/reduce.test.ts`** — class resolves from a profile + level (Novice without line; correct tier/form; `advancement_pending` `"class"` at Lv.5 no line, `"branch"` at Lv.50 no branch); affinity present.
- **`tools/rpg.test.ts`** — spawn `rpg.ts` against a seeded home: `name`; `class` rejects below Lv.5 and accepts at/above; `branch` rejects below Lv.50; `respec` rejects at Lv.50; `status` prints the suggestion; each writes `profile.json` and refreshes `state.json`.
- **`hud/statusline.test.ts`** — `renderHud` for Novice (default name), a named mage form, and the ` ✨` pending marker.
- **`tools/inspect.test.ts`** — headline includes the class form.

## 12. Definition of done

1. `bun test` green; `bunx tsc --noEmit` clean.
2. `rpg name`/`class`/`branch`/`respec`/`status` behave with correct level validation; `profile.json` + `state.json` update.
3. A real session shows `{name} · {class}  Lv.N …` in the statusline; below Lv.5 it shows `Novice`, at Lv.5+ without a pick it shows the ` ✨` prompt.

## 13. Out of scope (→ 2b.2 / later)

- **Class passives / XP multipliers** (base + specialist) and §6.4 balance (EV match, floor, pity, auto-tune) → **2b.2**.
- Secret classes → 2c. Up-class ceremony/animation → companion app (Phase 3).
- Confirm-press at tiers 2/3; prompt-length/command-based affinity signals.
- **`ClassTierName` enum** (a display label per tier — e.g. Novice/Initiate/Adept/Master/
  Grandmaster). Deferred: the form name already encodes the tier, so a tier badge has no
  consumer until the companion app (Phase 3) wants a rank badge / progress bar. Add it then;
  `tier` stays a `number`.
