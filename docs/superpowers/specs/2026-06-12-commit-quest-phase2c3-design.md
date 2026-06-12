# Commit Quest — Phase 2c.3 Design (command-aware achievements + equippable titles)

> Closes Phase 2c / epic #3. Builds on 2a (achievements), 2c.1 (loot + cosmetic titles),
> 2c.2 (secret classes). Adds the one deferred adapter change: the Claude Code hook classifies
> Bash commands into a **safe `cmd` tag**, unlocking git/test "deed" achievements — and makes the
> achievement **titles equippable** so an earned deed can be worn in the HUD.
> Backlog: `docs/reference/command-aware-achievements.md`. Conventions: `CLAUDE.md` (esp. §4 hook
> safety; §3 string enums).

---

## 1. What 2c.3 proves

Doing something notable at the shell — `git rebase --onto`, `git reflog`, `git bisect`, running
the test suite — earns a themed **deed achievement** and unlocks a **title** you can equip
(`rpg title the_undying` → HUD shows `Nat the Undying`). The journal still never stores a raw
command; only a short classification tag crosses the seam.

## 2. Locked decisions (brainstorm 2026-06-12)

| # | Topic | Decision |
|---|---|---|
| E1 | Where classification lives | **In the hook** (`on-tool.sh`, jq). The journal cannot carry the command (privacy + §4), so the reducer can't classify — the hook emits a tag only. |
| E2 | Tag safety | Emit `cmd` **only when a known tag matches** (else omit). **Never** the raw command. Lines stay < 4 KB; classification is a few jq `test()` calls. |
| E3 | Scope | cmd-tag mechanic + 10 git/test deed achievements + **equippable titles** (feature B, applies to all achievements with a `reward.title`). |
| E4 | test signal | **Count test runs** (no pass/fail detection — unreliable) → one achievement, **no bonus XP** (avoids farming). |
| E5 | Balance | **No level floor** — these are skill-flex deeds ("did you ever do this"), not power. Rare commands unlock at ≥ 1; repeated ones use a count. Achievements are **visible** (not hidden) so players can chase them. Thresholds are config-overridable. |
| E6 | Cowboy proxy | "merged without a PR" isn't knowable from one command; proxy = a `git push`/`merge` that names a **protected branch** (main/master/prod/production/uat). |
| E7 | Idempotency | Per-tag counts are monotonic; titles unlock from earned (monotonic) achievements or owned loot — stable on recompute. |

## 3. Hook classification (`on-tool.sh`)

For `tool_name == "Bash"`, classify `.tool_input.command` with jq `test()` (Oniguruma), first match wins:

| tag | pattern (regex intent) |
|---|---|
| `git_rebase_onto` | `git … rebase … --onto` |
| `git_rebase_i` | `git … rebase … (-i\|--interactive)` |
| `cherry_pick` | `git … cherry-pick` |
| `force_push` | `git … push … (--force\|-f\|--force-with-lease)` |
| `bisect` | `git … bisect` |
| `reflog` | `git … reflog` |
| `stash` | `git … stash` |
| `pr_merge` | `gh … pr … merge` |
| `cowboy` | `git … (push\|merge) … \b(main\|master\|prod\|production\|uat)\b` |
| `test_run` | `(bun\|npm\|pnpm\|yarn) … test`, `pytest`, `go … test`, `jest`, `vitest`, `cargo … test`, `mocha`, `rspec` |

Order matters: `--onto` before `-i`; `force_push` before `cowboy` (a `--force` to main tags as
`force_push`). When a tag matches, the event line gains `"cmd": "<tag>"`; otherwise the field is
omitted. The raw command is never read into the output. Non-Bash tools never get a `cmd`.

The hook stays §4-compliant: no stdout, `exit 0`, append-only one-file-per-session, JSON via jq,
small lines, no network.

## 4. Event contract (`core/events.ts`)

```ts
export enum CmdTag {
  GitRebaseOnto = "git_rebase_onto",
  GitRebaseI = "git_rebase_i",
  CherryPick = "cherry_pick",
  ForcePush = "force_push",
  Bisect = "bisect",
  Reflog = "reflog",
  Stash = "stash",
  PrMerge = "pr_merge",
  Cowboy = "cowboy",
  TestRun = "test_run",
}
```
`INormalizedEvent.cmd?: CmdTag` — present on `action`/`action_fail` Bash events only. The enum
values ARE the wire strings the hook emits (keep in sync, like `EventType`/`AgentAction`).

## 5. Reducer → facts

- The fold tallies `state.stats.cmds: Record<string, number>` (`if (e.cmd) cmds[e.cmd]++`).
- `facts()` spreads each tag as a flat fact `cmd_<tag>` (e.g. `cmd_git_rebase_onto`), so deed
  achievements gate with the existing `{ stat: "cmd_<tag>", gte: N }` condition — no new cond type.

## 6. Deed achievements (`core/achievements.ts`)

Visible (not hidden), no level floor, each grants points + a `reward.title`:

| id | deed name | title | cond | points |
|---|---|---|---|---|
| `timebender` | Threads of Fate | the Timebender | `cmd_git_rebase_onto ≥ 1` | 25 |
| `undying` | From Beyond the Grave | the Undying | `cmd_reflog ≥ 1` | 25 |
| `truthseeker` | Trial by Ordeal | the Truthseeker | `cmd_bisect ≥ 1` | 20 |
| `reckless` | Ride or Die | the Reckless | `cmd_cowboy ≥ 1` | 15 |
| `chronicler` | Rewriting History | the Chronicler | `cmd_git_rebase_i ≥ 10` | 15 |
| `gleaner` | A Fine Harvest | the Gleaner | `cmd_cherry_pick ≥ 10` | 15 |
| `unrelenting` | No Mercy | the Unrelenting | `cmd_force_push ≥ 10` | 15 |
| `hoarder` | Squirreled Away | the Hoarder | `cmd_stash ≥ 20` | 15 |
| `unifier` | For the Guild | the Unifier | `cmd_pr_merge ≥ 20` | 20 |
| `slayer` | Boss Hunter | the Slayer | `cmd_test_run ≥ 100` | 25 |

`reward.title` stays a plain display string (existing 17 achievements keep theirs); the title's
equip-**id is the achievement id** (e.g. `rpg title undying`).

## 7. Equippable titles (feature B)

A title is **available to equip** if it is an owned loot title (2c.1) **or** the title of an
**earned** achievement. The equipped id (`profile.title`) resolves to a display name from either
source.

- `resolveCosmetics(profile, inventory, earnedTitles, lootTable)` — gains an `earnedTitles:
  Record<string, string>` (achievement-id → `reward.title`) argument. Resolution: a loot title (owned
  + kind Title) wins; else an earned-achievement title; else `null`.
- `reduce` builds `earnedTitles` from `achievements.earned` × the registry's `reward.title`, and
  passes it to `resolveCosmetics`.
- `tools/rpg.ts`:
  - `rpg titles` — lists every equippable title (owned loot + earned deeds), id + display name.
  - `rpg title <id>` — accepts a loot title id (owned) **or** an achievement id (earned); rejects
    a locked/unearned id.
- The HUD is unchanged — it already renders `state.cosmetics.title`.

All 17 pre-existing achievement titles (Rookie, Veteran, …) become equippable for free.

## 8. Components

| File | Change |
|---|---|
| `adapters/claude-code/hooks/on-tool.sh` | jq classify Bash `command` → `cmd` tag (tag-only, first-match) |
| `core/events.ts` | `CmdTag` enum + `cmd?` field |
| `core/state.ts` | `stats.cmds?: Record<string, number>` |
| `core/reduce.ts` | tally `cmds` in the fold; build `earnedTitles`; pass it to `resolveCosmetics` |
| `core/achievements.ts` | `facts` spreads `cmd_*`; 10 deed achievements |
| `core/loot.ts` | `resolveCosmetics` resolves earned-achievement titles too |
| `tools/rpg.ts` | `titles` list; `title <id>` accepts earned achievement titles |

`core/` imports stay within `core/`. The adapter only emits the new event field; it imports no
game logic (it may reference the `CmdTag` type, like other event types).

## 9. Testing (TDD)

- **`test/adapters/tool.test.ts`** — spawn the real `on-tool.sh` with Bash fixtures:
  `git rebase feature --onto main` → line has `"cmd":"git_rebase_onto"`; `git reflog` → `reflog`;
  `bun test` → `test_run`; a plain `ls` → **no `cmd` field**; assert the **raw command never
  appears** in the journal line, `exit 0`, empty stdout. A non-Bash tool → no `cmd`.
- **`core/events.test.ts`** — `CmdTag` round-trips as a wire string.
- **`core/reduce.test.ts`** — `stats.cmds` tallies tags; `cmd_*` facts drive a deed (e.g. one
  `git_rebase_onto` event → `timebender` earned); idempotent on recompute.
- **`core/achievements.test.ts`** — each deed earns at its threshold and not below.
- **`core/loot.test.ts`** — `resolveCosmetics` resolves an earned-achievement title; a not-yet-earned
  title id stays `null`; an owned loot title still wins.
- **`test/tools/rpg.test.ts`** — `rpg title <achievement-id>` succeeds once earned, fails when not;
  `rpg titles` lists both sources; the HUD shows the equipped earned title end-to-end.

## 10. Definition of done

1. `bun test` green; `bunx tsc --noEmit` clean; `bun run format:check` clean.
2. The hook tags representative commands and **never** writes the raw command; a non-matching
   command adds no `cmd`.
3. A journal containing a `git_rebase_onto` event earns *Threads of Fate*; equipping the resulting
   title shows `… the Timebender` in the HUD.
4. Deployed: after a real `git reflog`/`bun test`, `rpg titles` lists the earned deed titles and
   `rpg title <id>` wears one.

## 11. Out of scope (→ later)

- **PR-merged loot trigger**, **bonus XP per command** (farm risk), config-defined cmd patterns.
- test **pass/fail** detection (only run-count here).
- Carry-overs: specialist passives + §6.4 auto-tune (2b); secret-class signature gimmicks +
  config-defined secret classes (2c.2); Maestro/`polyglot` awaiting a 2nd agent adapter.
