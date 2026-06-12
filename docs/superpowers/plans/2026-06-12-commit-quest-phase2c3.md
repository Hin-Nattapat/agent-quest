# Commit Quest Phase 2c.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify Bash commands into a safe `cmd` tag in the hook, earn themed git/test "deed" achievements from them, and make achievement titles equippable in the HUD.

**Architecture:** The CC hook (`on-tool.sh`) maps `.tool_input.command` to a tag via jq `test()` — tag only, never the raw command. The reducer tallies `stats.cmds`, exposes `cmd_*` facts, and 10 deed achievements gate on them. A title is equippable if it is an owned loot title OR an earned achievement's `reward.title`.

**Tech Stack:** Bun + TypeScript, bash + jq hooks, `bun test`, Prettier. No runtime npm deps.

**Reference:** Spec `docs/superpowers/specs/2026-06-12-commit-quest-phase2c3-design.md`; conventions `CLAUDE.md` (§4 hook safety: no stdout, exit 0, append-only, jq-built JSON, lines < 4 KB; §3 string enums; braces on every if/else). End each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Run `bun run format` before committing. Branch: already on `feat/phase2c3-command-aware`; spec committed.

---

## File Structure

| File | Change |
|---|---|
| `adapters/claude-code/hooks/on-tool.sh` | jq classifies Bash `command` → `cmd` tag (tag-only, first-match) |
| `core/events.ts` | `CmdTag` enum + `cmd?` field |
| `core/state.ts` | `stats.cmds?: Record<string, number>` |
| `core/achievements.ts` | `facts` spreads `cmd_*`; 10 deed achievements |
| `core/loot.ts` | `resolveCosmetics` resolves earned-achievement titles |
| `core/reduce.ts` | tally `cmds`; build `earnedTitles`; compute cosmetics after achievements |
| `tools/rpg.ts` | `titles` list; `title <id>` accepts earned achievement titles |

---

## Task 1: hook — classify Bash command into a `cmd` tag

**Files:** Modify `adapters/claude-code/hooks/on-tool.sh`; Test `test/adapters/tool.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/adapters/tool.test.ts` (add `readFileSync`/`join` imports at the top if absent):
```ts
import { readFileSync } from "fs";
import { join } from "path";

test.each([
  ["git rebase feature --onto main", "git_rebase_onto"],
  ["git rebase -i HEAD~3", "git_rebase_i"],
  ["git cherry-pick abc123", "cherry_pick"],
  ["git push --force origin x", "force_push"],
  ["git bisect start", "bisect"],
  ["git reflog", "reflog"],
  ["git stash push -m wip", "stash"],
  ["gh pr merge 12 --merge", "pr_merge"],
  ["git push origin main", "cowboy"],
  ["bun test", "test_run"],
])("classifies Bash command %s -> cmd %s", async (command, cmd) => {
  const home = makeHome();
  await runHook(
    "on-tool.sh",
    { ...base, session_id: "c1", tool_name: "Bash", tool_input: { command } },
    home,
  );
  const e = journalLines(home, "c1").at(-1);
  expect(e.cmd).toBe(cmd);
});

test("a non-matching command adds no cmd and never stores the raw command", async () => {
  const home = makeHome();
  const command = "ls -la /secret/path";
  await runHook(
    "on-tool.sh",
    { ...base, session_id: "c2", tool_name: "Bash", tool_input: { command } },
    home,
  );
  const raw = readFileSync(join(home, "journal", "c2.ndjson"), "utf8");
  expect(raw).not.toContain("/secret/path");
  expect(journalLines(home, "c2").at(-1).cmd).toBeUndefined();
});

test("non-Bash tools never get a cmd", async () => {
  const home = makeHome();
  await runHook(
    "on-tool.sh",
    { ...base, session_id: "c3", tool_name: "Edit", tool_input: { command: "git reflog" } },
    home,
  );
  expect(journalLines(home, "c3").at(-1).cmd).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/adapters/tool.test.ts`
Expected: FAIL — `e.cmd` is undefined for the classified cases.

- [ ] **Step 3: Add the classification to `adapters/claude-code/hooks/on-tool.sh`**

Replace the `line="$(... jq ...)"` assignment with this jq program (adds `$c`/`$cmd`; the raw
command `$c` is only tested, never emitted):
```bash
line="$(printf '%s' "$input" | jq -c --arg source "$SOURCE" --arg repo "$repo" '
  ({ "Edit":"edit","MultiEdit":"edit","Write":"write","Bash":"run",
     "Read":"read","Grep":"search","Glob":"search","Task":"delegate" }[.tool_name] // "other") as $a |
  (.tool_input.command // "") as $c |
  (if .tool_name == "Bash" then
     (if   ($c|test("git\\s+rebase\\b.*--onto")) then "git_rebase_onto"
      elif ($c|test("git\\s+rebase\\b.*(-i|--interactive)")) then "git_rebase_i"
      elif ($c|test("git\\s+cherry-pick")) then "cherry_pick"
      elif ($c|test("git\\s+push\\b.*(--force|-f\\b)")) then "force_push"
      elif ($c|test("git\\s+bisect")) then "bisect"
      elif ($c|test("git\\s+reflog")) then "reflog"
      elif ($c|test("git\\s+stash")) then "stash"
      elif ($c|test("gh\\s+pr\\s+merge")) then "pr_merge"
      elif ($c|test("git\\s+(push|merge)\\b.*\\b(main|master|prod|production|uat)\\b")) then "cowboy"
      elif ($c|test("(bun|npm|pnpm|yarn)\\s+(run\\s+)?test|pytest|go\\s+test|jest|vitest|cargo\\s+test|mocha|rspec")) then "test_run"
      else null end)
   else null end) as $cmd |
  { ts:(now|todate), source:$source, session_id:(.session_id // "unknown"),
    type:(if .hook_event_name=="PostToolUseFailure" then "action_fail" else "action" end),
    action:$a, native:(.tool_name // "unknown") }
  + (if $repo != "" then {repo:$repo} else {} end)
  + (if (.tool_input.file_path // "") != "" then {file: .tool_input.file_path} else {} end)
  + (if $cmd != null then {cmd: $cmd} else {} end)
' 2>/dev/null)"
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test test/adapters/tool.test.ts`
Expected: PASS (all existing + new cases).

- [ ] **Step 5: Commit**
```bash
bun run format
git add adapters/claude-code/hooks/on-tool.sh test/adapters/tool.test.ts
git commit -m "feat(adapter): classify Bash commands into a safe cmd tag (no raw command stored)"
```

---

## Task 2: event contract — `CmdTag` + `cmd` field + `stats.cmds`

**Files:** Modify `core/events.ts`, `core/state.ts`; Test `test/core/events.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/events.test.ts`:
```ts
import { CmdTag } from "../../core/events";

test("CmdTag members carry the wire strings the hook emits", () => {
  expect(CmdTag.GitRebaseOnto).toBe("git_rebase_onto");
  expect(CmdTag.Reflog).toBe("reflog");
  expect(CmdTag.TestRun).toBe("test_run");
  expect(CmdTag.Cowboy).toBe("cowboy");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/events.test.ts`
Expected: FAIL — `CmdTag` not exported.

- [ ] **Step 3: Add `CmdTag` + `cmd` to `core/events.ts`**

After the `AgentAction` enum, add:
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
Add the field to `INormalizedEvent` (after `native`):
```ts
  cmd?: CmdTag; // type=action/action_fail Bash only — a safe classification, never the raw command
```

- [ ] **Step 4: Add `stats.cmds` to `core/state.ts`**

In `IState.stats`, add (after `ascetic_seal?`):
```ts
    cmds?: Record<string, number>;
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test test/core/events.test.ts && bunx tsc --noEmit`
Expected: PASS; no type errors.

- [ ] **Step 6: Commit**
```bash
bun run format
git add core/events.ts core/state.ts test/core/events.test.ts
git commit -m "feat(core): CmdTag event field + stats.cmds"
```

---

## Task 3: reducer tally + `cmd_*` facts + deed achievements

**Files:** Modify `core/reduce.ts`, `core/achievements.ts`; Test `test/core/reduce.test.ts`, `test/core/achievements.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/core/reduce.test.ts`:
```ts
test("the fold tallies cmd tags and a single rebase --onto earns Threads of Fate", () => {
  const cfg = loadConfig(makeHome());
  const evs = [
    { ts: "2026-06-11T12:00:00Z", source: "claude-code", session_id: "s", type: "action", action: "run", repo: "cq", cmd: "git_rebase_onto" },
    { ts: "2026-06-11T12:00:01Z", source: "claude-code", session_id: "s", type: "action", action: "run", repo: "cq", cmd: "test_run" },
    { ts: "2026-06-11T12:00:02Z", source: "claude-code", session_id: "s", type: "action", action: "run", repo: "cq", cmd: "test_run" },
  ] as any;
  const s = reduce(evs, cfg, "2026-06-11");
  expect(s.stats.cmds).toEqual({ git_rebase_onto: 1, test_run: 2 });
  expect(s.achievements?.earned).toContain("timebender");
});
```

Append to `test/core/achievements.test.ts`:
```ts
test("a deed earns at its cmd_* threshold", () => {
  const reg = DEFAULT_ACHIEVEMENTS;
  const withCmds = (cmds: Record<string, number>) =>
    baseState({ stats: { prompts: 0, actions: {}, sessions: 0, by_source: {}, by_repo: {}, cmds } });
  expect(evaluateAchievements(withCmds({ reflog: 1 }), reg).earned).toContain("undying");
  expect(evaluateAchievements(withCmds({ stash: 19 }), reg).earned).not.toContain("hoarder");
  expect(evaluateAchievements(withCmds({ stash: 20 }), reg).earned).toContain("hoarder");
  expect(reg.timebender.reward?.title).toBe("the Timebender");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/reduce.test.ts test/core/achievements.test.ts`
Expected: FAIL — no `stats.cmds`, no `cmd_*` facts, deeds undefined.

- [ ] **Step 3: Tally `cmds` in `core/reduce.ts`**

Add an accumulator next to the others (after `const pendingFail = ...`):
```ts
  const cmds: Record<string, number> = {};
```
In the fold loop, after the `if (e.type === EventType.ActionFail && e.action) {...}` block, add:
```ts
    if (e.cmd) {
      cmds[e.cmd] = (cmds[e.cmd] ?? 0) + 1;
    }
```
Add `cmds` to `prelim.stats` (after `ascetic_seal`):
```ts
      cmds,
```

- [ ] **Step 4: Spread `cmd_*` facts + add deeds in `core/achievements.ts`**

In `facts()`, before the closing `};` of the returned object, append the cmd spread by changing
the `return { ... };` to build then extend. Replace the `return {` line and its body's closing with:
```ts
  const base: TFacts = {
    xp_total: state.xp_total,
    level: state.level,
    prompts: state.stats.prompts,
    sessions: state.stats.sessions,
    actions_total: Object.values(a).reduce((s, x) => s + x, 0),
    edits: n("edit"),
    writes: n("write"),
    runs: n("run"),
    reads: n("read"),
    searches: n("search"),
    delegates: n("delegate"),
    streak_best: state.streak?.best_days ?? 0,
    distinct_source: Object.keys(state.stats.by_source).length,
    distinct_repo: Object.keys(state.stats.by_repo).length,
    night_actions: state.stats.night_actions ?? 0,
    failures_recovered: state.stats.failures_recovered ?? 0,
    ascetic_seal: state.stats.ascetic_seal ?? 0,
  };
  for (const [tag, count] of Object.entries(state.stats.cmds ?? {})) {
    base[`cmd_${tag}`] = count;
  }
  return base;
```
(Delete the previous inline `return { ... };` object.) Add the ten deeds to `DEFAULT_ACHIEVEMENTS`
(before its closing `}`):
```ts
  timebender: {
    name: "Threads of Fate",
    desc: "Rewrite a branch's roots with git rebase --onto",
    cond: { stat: "cmd_git_rebase_onto", gte: 1 },
    points: 25,
    reward: { title: "the Timebender" },
  },
  undying: {
    name: "From Beyond the Grave",
    desc: "Raise lost work with git reflog",
    cond: { stat: "cmd_reflog", gte: 1 },
    points: 25,
    reward: { title: "the Undying" },
  },
  truthseeker: {
    name: "Trial by Ordeal",
    desc: "Hunt the guilty commit with git bisect",
    cond: { stat: "cmd_bisect", gte: 1 },
    points: 20,
    reward: { title: "the Truthseeker" },
  },
  reckless: {
    name: "Ride or Die",
    desc: "Push or merge straight onto a protected branch",
    cond: { stat: "cmd_cowboy", gte: 1 },
    points: 15,
    reward: { title: "the Reckless" },
  },
  chronicler: {
    name: "Rewriting History",
    desc: "10 interactive rebases",
    cond: { stat: "cmd_git_rebase_i", gte: 10 },
    points: 15,
    reward: { title: "the Chronicler" },
  },
  gleaner: {
    name: "A Fine Harvest",
    desc: "10 cherry-picks",
    cond: { stat: "cmd_cherry_pick", gte: 10 },
    points: 15,
    reward: { title: "the Gleaner" },
  },
  unrelenting: {
    name: "No Mercy",
    desc: "10 force pushes",
    cond: { stat: "cmd_force_push", gte: 10 },
    points: 15,
    reward: { title: "the Unrelenting" },
  },
  hoarder: {
    name: "Squirreled Away",
    desc: "20 stashes",
    cond: { stat: "cmd_stash", gte: 20 },
    points: 15,
    reward: { title: "the Hoarder" },
  },
  unifier: {
    name: "For the Guild",
    desc: "Merge 20 pull requests",
    cond: { stat: "cmd_pr_merge", gte: 20 },
    points: 20,
    reward: { title: "the Unifier" },
  },
  slayer: {
    name: "Boss Hunter",
    desc: "Run the test suite 100 times",
    cond: { stat: "cmd_test_run", gte: 100 },
    points: 25,
    reward: { title: "the Slayer" },
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test test/core/reduce.test.ts test/core/achievements.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**
```bash
bun run format
git add core/reduce.ts core/achievements.ts test/core/reduce.test.ts test/core/achievements.test.ts
git commit -m "feat(core): cmd_* facts + ten git/test deed achievements"
```

---

## Task 4: equippable titles — resolve earned achievement titles

**Files:** Modify `core/loot.ts`, `core/reduce.ts`; Test `test/core/loot.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/loot.test.ts`:
```ts
test("resolveCosmetics resolves an earned-achievement title; loot title still wins", () => {
  const inv = [{ id: "rookie_title", rarity: Rarity.Common, count: 1 }];
  const earned = { undying: "the Undying" };
  // earned achievement title, not a loot item
  expect(resolveCosmetics({ title: "undying" }, [], earned).title).toBe("the Undying");
  // not earned, not owned -> null
  expect(resolveCosmetics({ title: "undying" }, [], {}).title).toBe(null);
  // owned loot title resolves by its item name
  expect(resolveCosmetics({ title: "rookie_title" }, inv, earned).title).toBe("Rookie");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/loot.test.ts`
Expected: FAIL — `resolveCosmetics` has no earned-titles arg / signature mismatch.

- [ ] **Step 3: Extend `resolveCosmetics` in `core/loot.ts`**

Replace the `resolveCosmetics` function with:
```ts
export function resolveCosmetics(
  profile: { title?: string; theme?: string },
  inventory: IInventoryItem[],
  earnedTitles: Record<string, string> = {},
  lootTable: Record<string, ILootItem> = LOOT_TABLE,
): ICosmetics {
  const owned = new Set(inventory.map(i => i.id));
  const lootTitle =
    profile.title && owned.has(profile.title) && lootTable[profile.title]?.kind === LootKind.Title
      ? lootTable[profile.title].name
      : null;
  const earnedTitle =
    profile.title && earnedTitles[profile.title] ? earnedTitles[profile.title] : null;
  const themeItem =
    profile.theme && owned.has(profile.theme) ? lootTable[profile.theme] : null;
  return {
    title: lootTitle ?? earnedTitle,
    theme_color: themeItem?.kind === LootKind.Theme ? (themeItem.value ?? null) : null,
  };
}
```

- [ ] **Step 4: Build `earnedTitles` in `core/reduce.ts` (cosmetics after achievements)**

In `reduce`, the cosmetics currently sit in `prelim` and are computed before `evaluateAchievements`.
Move cosmetics after achievements so they can see earned titles. Make three edits:

(a) Delete the `const cosmetics = resolveCosmetics(...)` line and remove `cosmetics` from the
`prelim` object literal (leave `inventory`).

(b) Replace the final return block:
```ts
  const achievements = evaluateAchievements(prelim, config.achievements);
  const unlocked = collectUnlocks(achievements.earned, config.achievements ?? {}, profile);
  return { ...prelim, achievements, unlocked_secret_classes: unlocked };
```
with:
```ts
  const achievements = evaluateAchievements(prelim, config.achievements);
  const unlocked = collectUnlocks(achievements.earned, config.achievements ?? {}, profile);
  const registry = config.achievements ?? {};
  const earnedTitles: Record<string, string> = {};
  for (const id of achievements.earned) {
    const title = registry[id]?.reward?.title;
    if (title) {
      earnedTitles[id] = title;
    }
  }
  const cosmetics = resolveCosmetics(profile ?? {}, inventory, earnedTitles, lootTable);
  return { ...prelim, achievements, cosmetics, unlocked_secret_classes: unlocked };
```
(`inventory` and `lootTable` are already in scope from the loot block above.)

- [ ] **Step 5: Run to verify it passes**

Run: `bun test test/core/loot.test.ts test/core/reduce.test.ts && bunx tsc --noEmit`
Expected: PASS; no type errors (the 2c.1 loot test still calls `resolveCosmetics(profile, inv)` —
the new `earnedTitles`/`lootTable` params default, so those calls keep working).

- [ ] **Step 6: Commit**
```bash
bun run format
git add core/loot.ts core/reduce.ts test/core/loot.test.ts
git commit -m "feat(core): earned achievement titles are equippable cosmetics"
```

---

## Task 5: `tools/rpg.ts` — `titles` list + equip an earned title

**Files:** Modify `tools/rpg.ts`; Test `test/tools/rpg.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/tools/rpg.test.ts`:
```ts
function seedCmd(home: string, cmd: string) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"run","repo":"cq","cmd":"${cmd}"}\n`,
  );
}

test("an earned deed title is listed and equippable; a locked one is rejected", async () => {
  const home = makeHome();
  const locked = await rpg(home, "title", "undying");
  expect(locked.code).toBe(1); // not earned yet

  seedCmd(home, "reflog"); // earns `undying` -> "the Undying"
  const list = await rpg(home, "titles");
  expect(list.stdout).toContain("undying");

  const equip = await rpg(home, "title", "undying");
  expect(equip.code).toBe(0);
  expect(profile(home).title).toBe("undying");
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/tools/rpg.test.ts`
Expected: FAIL — `titles` unknown; `title undying` rejected (loot-only check).

- [ ] **Step 3: Update `tools/rpg.ts`**

Add `loadConfig` is already imported. Add an availability helper above `main` (after `equip`):
```ts
function availableTitles(): { id: string; name: string }[] {
  const state = reduceToFile(HOME);
  const table = lootTable();
  const out: { id: string; name: string }[] = [];
  for (const item of state.inventory ?? []) {
    if (table[item.id]?.kind === LootKind.Title) {
      out.push({ id: item.id, name: table[item.id].name });
    }
  }
  const registry = loadConfig(HOME).achievements ?? {};
  for (const id of state.achievements?.earned ?? []) {
    const title = registry[id]?.reward?.title;
    if (title) {
      out.push({ id, name: title });
    }
  }
  return out;
}

function titles(): string {
  const list = availableTitles();
  if (list.length === 0) {
    return "No titles yet.";
  }
  return list.map(t => `${t.id}  —  ${t.name}`).join("\n");
}
```
Replace `equip` so titles use `availableTitles` (loot OR earned), theme stays loot-only:
```ts
function equip(profile: IProfile, kind: LootKind, id: string): string {
  if (kind === LootKind.Title) {
    const match = availableTitles().find(t => t.id === id);
    if (!match) {
      fail(`Title "${id}" is locked.`);
    }
    profile.title = id;
    persist(profile);
    return `Equipped title: ${match.name}.`;
  }
  const item = lootTable()[id];
  if (!item || item.kind !== kind) {
    fail(`Unknown ${kind} "${id}".`);
  }
  const owned = new Set((reduceToFile(HOME).inventory ?? []).map(i => i.id));
  if (!owned.has(id)) {
    fail(`You don't own "${id}".`);
  }
  profile.theme = id;
  persist(profile);
  return `Equipped ${kind}: ${item.name}.`;
}
```
Add the `titles` case to the `switch` (after `secrets`):
```ts
    case "titles":
      out = titles();
      break;
```
Update the usage string to include `titles`:
```ts
      fail(
        "Usage: rpg <name|class|branch|respec|status|inventory|title|theme|titles|secrets|xyzzy> …",
      );
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test test/tools/rpg.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
bun run format
git add tools/rpg.ts test/tools/rpg.test.ts
git commit -m "feat(tools): rpg titles + equip earned deed titles"
```

---

## Task 6: integration + full suite + tsc + format

**Files:** Test `test/integration/command-aware.test.ts`

- [ ] **Step 1: Write an end-to-end test**

Create `test/integration/command-aware.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { renderHud } from "../../hud/statusline";
import { makeHome } from "../helpers";

test("a rebase --onto deed unlocks a title that renders in the HUD", () => {
  const cfg = loadConfig(makeHome());
  const events = [
    { ts: "2026-06-11T12:00:00Z", source: "claude-code", session_id: "s", type: "action", action: "run", repo: "cq", cmd: "git_rebase_onto" },
  ] as any;

  const earned = reduce(events, cfg, "2026-06-11");
  expect(earned.achievements?.earned).toContain("timebender");

  const worn = reduce(events, cfg, "2026-06-11", { name: "Nat", title: "timebender" });
  expect(worn.cosmetics?.title).toBe("the Timebender");
  const line = renderHud({ ...worn, updated_at: "" }, { model: "M", cost: 0, ctx: 0 });
  expect(line).toContain("Nat the Timebender");
});
```

- [ ] **Step 2: Full suite**

Run: `bun test`
Expected: all PASS (Phase 0 → 2c.3).

- [ ] **Step 3: Type-check + format**

Run: `bunx tsc --noEmit && bun run format:check`
Expected: clean.

- [ ] **Step 4: Commit**
```bash
bun run format
git add test/integration/command-aware.test.ts
git commit -m "test: command deed -> earned title -> HUD end-to-end"
```

---

## Task 7: Deploy + real-session verify (manual)

- [ ] **Step 1: Redeploy** — `tools/install.sh --link`.

- [ ] **Step 2: Generate + observe a tag** — in any session, run e.g. `git reflog` (the hook tags it
`reflog`), then:
```bash
bun ~/.agentrpg/tools/inspect.ts | head -1     # earned count rises
bun ~/.agentrpg/tools/rpg.ts titles            # lists "the Undying" (and any owned loot titles)
bun ~/.agentrpg/tools/rpg.ts title undying     # wear it
bun ~/.agentrpg/tools/rpg.ts status            # name line shows the title
```
You already have many `bun test` runs in the journal, so `the Slayer` may already be earned.

- [ ] **Step 3: Confirm privacy** — `tail ~/.agentrpg/journal/*.ndjson` and confirm Bash lines carry
only a `cmd` tag, never the command text.

- [ ] **Step 4: Tune if desired** — deed thresholds live in `~/.agentrpg/config.json`'s
`achievements` (override a deed's `cond`).

- [ ] **Step 5: Finish the branch** — superpowers:finishing-a-development-branch (grouping commit +
push + PR, "Closes #3").

---

## Self-Review notes (already applied)

- **Spec coverage:** hook classification §3 (Task 1); CmdTag/`cmd` §4 + `stats.cmds` §5 (Task 2);
  `cmd_*` facts + deeds §5/§6 (Task 3); equippable titles §7 (Tasks 4–5); HUD/DoD §10 (Task 6);
  privacy + deploy §10 (Task 7). Out-of-scope honored (no PR-loot, no per-cmd XP, no pass/fail).
- **No placeholders:** every code/jq step is complete; the regex order (onto→i, force→cowboy) is
  encoded; thresholds match the spec table.
- **Type/name consistency:** `CmdTag`, `INormalizedEvent.cmd`, `stats.cmds`, `cmd_<tag>` facts, deed
  ids (`timebender`…`slayer`) + `reward.title`, `resolveCosmetics(profile, inventory, earnedTitles,
  lootTable)`, `availableTitles`, `titles`. Cosmetics is computed *after* achievements in `reduce` to
  break the title↔achievement dependency (facts never read cosmetics, so the order is safe). The new
  `resolveCosmetics` params default, so the 2c.1 two-arg callers still type-check.
```
