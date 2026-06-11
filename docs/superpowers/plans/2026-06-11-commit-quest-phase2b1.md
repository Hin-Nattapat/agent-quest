# Commit Quest Phase 2b.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the player name their character and pick a class; resolve class identity in the reducer and show `{name} · {icon}{form}  Lv.N …` in the statusline. No XP change (passives are 2b.2).

**Architecture:** A player-owned `profile.json` (written by a new `rpg` CLI) feeds the reducer, which resolves a `class` block (line + level → tier → form + affinity + pending) into `state.json`. The HUD reads one file.

**Tech Stack:** Bun + TypeScript, `bun test`. No runtime npm deps.

**Reference:** Spec `docs/superpowers/specs/2026-06-11-commit-quest-phase2b1-design.md`; conventions `CLAUDE.md` (string enums, `I*`/`T*` prefixes, no `any`, clarity over cleverness).

**Commit convention:** end each commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

**Branch:** already on `feat/phase2b1-class-identity` (off `main`); spec committed.

---

## File Structure

| File | Responsibility |
|---|---|
| `core/classes.ts` | `ClassLine`, `CLASS_TREE`, `IClassState`, `tierForLevel`, `formFor`, `iconFor`, `advancementPending` |
| `core/affinity.ts` | `computeAffinity(events)` |
| `core/profile.ts` | `IProfile`, `loadProfile`, `saveProfile` |
| `core/state.ts` | optional `name?`, `class?` |
| `core/reduce.ts` | `reduce(events, config, today?, profile?)` resolves class + affinity |
| `tools/rpg.ts` | the player CLI |
| `hud/statusline.ts` | `renderHud` prepends identity |
| `tools/inspect.ts` | headline shows the class form |

---

## Task 1: `core/classes.ts`

**Files:**
- Create: `core/classes.ts`
- Test: `test/core/classes.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/classes.test.ts`:
```ts
import { test, expect } from "bun:test";
import { ClassLine, tierForLevel, formFor, iconFor, advancementPending } from "../../core/classes";

test("tierForLevel boundaries", () => {
  expect(tierForLevel(4)).toBe(0);
  expect(tierForLevel(5)).toBe(1);
  expect(tierForLevel(14)).toBe(1);
  expect(tierForLevel(15)).toBe(2);
  expect(tierForLevel(30)).toBe(3);
  expect(tierForLevel(50)).toBe(4);
});

test("formFor across tiers and branches", () => {
  expect(formFor(null, 0, null)).toBe("Novice");
  expect(formFor(ClassLine.Mage, 0, null)).toBe("Novice");
  expect(formFor(ClassLine.Mage, 1, null)).toBe("Backend Mage");
  expect(formFor(ClassLine.Mage, 3, null)).toBe("Infra Archmage");
  expect(formFor(ClassLine.Mage, 4, null)).toBe("Infra Archmage"); // no branch yet
  expect(formFor(ClassLine.Mage, 4, "b")).toBe("Kernel Lich");
});

test("iconFor", () => {
  expect(iconFor(null)).toBe("");
  expect(iconFor(ClassLine.Ranger)).toBe("🏹");
});

test("advancementPending", () => {
  expect(advancementPending(null, 6, null)).toBe("class");
  expect(advancementPending(ClassLine.Mage, 6, null)).toBe(null);
  expect(advancementPending(ClassLine.Mage, 50, null)).toBe("branch");
  expect(advancementPending(ClassLine.Mage, 50, "a")).toBe(null);
  expect(advancementPending(null, 4, null)).toBe(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/classes.test.ts`
Expected: FAIL — cannot find module `../../core/classes`.

- [ ] **Step 3: Write `core/classes.ts`**

Create `core/classes.ts`:
```ts
export enum ClassLine {
  Mage = "mage",
  Ranger = "ranger",
  Rogue = "rogue",
  Sage = "sage",
}

export interface IClassDef {
  icon: string;
  forms: [string, string, string]; // T1, T2, T3
  branches: { a: string; b: string }; // T4
}

export const CLASS_TREE: Record<ClassLine, IClassDef> = {
  [ClassLine.Mage]: { icon: "⚔", forms: ["Backend Mage", "Server Sorcerer", "Infra Archmage"], branches: { a: "Cloud Summoner", b: "Kernel Lich" } },
  [ClassLine.Ranger]: { icon: "🏹", forms: ["Frontend Ranger", "UI Sharpshooter", "Pixel Hunter"], branches: { a: "Motion Trickster", b: "Design Warden" } },
  [ClassLine.Rogue]: { icon: "🗡", forms: ["Debugger Rogue", "Bug Assassin", "Stack Stalker"], branches: { a: "Heisenbug Hunter", b: "Forensics Shadow" } },
  [ClassLine.Sage]: { icon: "📖", forms: ["Architect Sage", "System Oracle", "Pattern Magus"], branches: { a: "Domain Prophet", b: "Orchestration Master" } },
};

export interface IClassState {
  line: ClassLine | null;
  tier: number;
  form: string;
  icon: string;
  branch: "a" | "b" | null;
  affinity: Record<string, number>;
  advancement_pending: "class" | "branch" | null;
}

export function tierForLevel(level: number): number {
  if (level >= 50) return 4;
  if (level >= 30) return 3;
  if (level >= 15) return 2;
  if (level >= 5) return 1;
  return 0;
}

export function iconFor(line: ClassLine | null): string {
  return line ? CLASS_TREE[line].icon : "";
}

export function formFor(line: ClassLine | null, tier: number, branch: "a" | "b" | null): string {
  if (!line || tier === 0) return "Novice";
  if (tier >= 4) return branch ? CLASS_TREE[line].branches[branch] : CLASS_TREE[line].forms[2];
  return CLASS_TREE[line].forms[tier - 1];
}

export function advancementPending(
  line: ClassLine | null,
  level: number,
  branch: "a" | "b" | null,
): "class" | "branch" | null {
  if (level >= 5 && line == null) return "class";
  if (level >= 50 && line != null && branch == null) return "branch";
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/classes.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add core/classes.ts test/core/classes.test.ts
git commit -m "feat(core): class tree + tier/form helpers"
```

---

## Task 2: `core/affinity.ts`

**Files:**
- Create: `core/affinity.ts`
- Test: `test/core/affinity.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/affinity.test.ts`:
```ts
import { test, expect } from "bun:test";
import { computeAffinity } from "../../core/affinity";

const ev = (o: object) => ({ ts: "t", source: "claude-code", session_id: "s", ...o }) as any;

test("affinity is the normalized proportion per line", () => {
  const a = computeAffinity([
    ev({ type: "action", action: "run" }),                  // mage
    ev({ type: "action", action: "edit", file: "a.tsx" }),  // ranger
    ev({ type: "action", action: "read" }),                 // rogue
    ev({ type: "action_fail", action: "run" }),             // rogue (failure)
    ev({ type: "action", action: "delegate" }),             // sage
    ev({ type: "prompt" }),                                  // no signal
  ]);
  expect(a.mage).toBeCloseTo(0.2);
  expect(a.ranger).toBeCloseTo(0.2);
  expect(a.rogue).toBeCloseTo(0.4);
  expect(a.sage).toBeCloseTo(0.2);
});

test("no signals -> all zero", () => {
  expect(computeAffinity([ev({ type: "prompt" })])).toEqual({ mage: 0, ranger: 0, rogue: 0, sage: 0 });
});

test("file extensions route edits to the right line", () => {
  const a = computeAffinity([
    ev({ type: "action", action: "edit", file: "schema.sql" }), // mage
    ev({ type: "action", action: "write", file: "notes.md" }),  // sage
  ]);
  expect(a.mage).toBeCloseTo(0.5);
  expect(a.sage).toBeCloseTo(0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/affinity.test.ts`
Expected: FAIL — cannot find module `../../core/affinity`.

- [ ] **Step 3: Write `core/affinity.ts`**

Create `core/affinity.ts`:
```ts
import { EventType, AgentAction, type INormalizedEvent } from "./events";
import { ClassLine } from "./classes";

const MAGE_EXT = [".go", ".sql", ".rs", ".yaml", ".yml"];
const RANGER_EXT = [".tsx", ".jsx", ".css", ".scss", ".html", ".vue"];
const SAGE_EXT = [".md", ".mdx"];

function hasExt(file: string | undefined, exts: string[]): boolean {
  return file != null && exts.some((ext) => file.endsWith(ext));
}

// Each event contributes to at most one line (delegate wins over a failed delegate, etc.).
function lineOf(e: INormalizedEvent): ClassLine | null {
  if (e.action === AgentAction.Delegate) return ClassLine.Sage;
  if (e.type === EventType.ActionFail) return ClassLine.Rogue;
  if (e.type !== EventType.Action) return null;
  if (e.action === AgentAction.Run) return ClassLine.Mage;
  if (e.action === AgentAction.Read || e.action === AgentAction.Search) return ClassLine.Rogue;
  if (e.action === AgentAction.Edit || e.action === AgentAction.Write) {
    if (hasExt(e.file, RANGER_EXT)) return ClassLine.Ranger;
    if (hasExt(e.file, MAGE_EXT) || e.file?.endsWith("Dockerfile")) return ClassLine.Mage;
    if (hasExt(e.file, SAGE_EXT)) return ClassLine.Sage;
  }
  return null;
}

export function computeAffinity(events: INormalizedEvent[]): Record<ClassLine, number> {
  const counts: Record<ClassLine, number> = {
    [ClassLine.Mage]: 0, [ClassLine.Ranger]: 0, [ClassLine.Rogue]: 0, [ClassLine.Sage]: 0,
  };
  let total = 0;
  for (const e of events) {
    const line = lineOf(e);
    if (line) {
      counts[line]++;
      total++;
    }
  }
  if (total === 0) return counts;
  const affinity = { ...counts };
  for (const line of Object.keys(affinity) as ClassLine[]) affinity[line] = counts[line] / total;
  return affinity;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/affinity.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add core/affinity.ts test/core/affinity.test.ts
git commit -m "feat(core): journal-derived class affinity"
```

---

## Task 3: `core/profile.ts`

**Files:**
- Create: `core/profile.ts`
- Test: `test/core/profile.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/profile.test.ts`:
```ts
import { test, expect } from "bun:test";
import { loadProfile, saveProfile } from "../../core/profile";
import { ClassLine } from "../../core/classes";
import { makeHome } from "../helpers";

test("loadProfile defaults to empty when missing", () => {
  expect(loadProfile(makeHome())).toEqual({});
});

test("save then load round-trips", () => {
  const home = makeHome();
  saveProfile(home, { name: "Gandalf", line: ClassLine.Mage });
  expect(loadProfile(home)).toEqual({ name: "Gandalf", line: "mage" });
});

test("invalid profile.json falls back to empty", () => {
  const home = makeHome();
  saveProfile(home, { name: "x" });
  Bun.spawnSync(["bash", "-c", `echo 'not json' > ${home}/profile.json`]);
  expect(loadProfile(home)).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/core/profile.test.ts`
Expected: FAIL — cannot find module `../../core/profile`.

- [ ] **Step 3: Write `core/profile.ts`**

Create `core/profile.ts`:
```ts
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { ClassLine } from "./classes";

export interface IProfile {
  name?: string;
  line?: ClassLine;
  branch?: "a" | "b";
}

export function loadProfile(home: string): IProfile {
  const p = join(home, "profile.json");
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, "utf8")) as IProfile;
  } catch {
    return {};
  }
}

export function saveProfile(home: string, profile: IProfile): void {
  writeFileSync(join(home, "profile.json"), JSON.stringify(profile, null, 2));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/core/profile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add core/profile.ts test/core/profile.test.ts
git commit -m "feat(core): player profile load/save"
```

---

## Task 4: `core/state.ts` + `core/reduce.ts` — resolve class

**Files:**
- Modify: `core/state.ts`
- Modify: `core/reduce.ts`
- Test: `test/core/reduce.test.ts` (append)

- [ ] **Step 1: Add fields to `core/state.ts`**

In `core/state.ts`, add an import and two optional fields. Change the import block + the end of `IState`:
```ts
import type { IStreak } from "./streak";
import type { IClassState } from "./classes";
```
and inside `IState`, after `achievements?`:
```ts
  streak?: IStreak;
  achievements?: IAchievementsState;
  name?: string;
  class?: IClassState;
```

- [ ] **Step 2: Write the failing test**

Append to `test/core/reduce.test.ts`:
```ts
import { ClassLine } from "../../core/classes";

const promptsTo5 = Array.from({ length: 60 }, () =>
  ({ ts: "2026-06-11T12:00:00Z", source: "claude-code", session_id: "s", type: "prompt", repo: "cq" }) as any);

test("no profile -> Novice class with affinity", () => {
  const s = reduce([evd("2026-06-11", { type: "action", action: "run", repo: "cq" })], cfgA, "2026-06-11");
  expect(s.class?.line).toBe(null);
  expect(s.class?.form).toBe("Novice");
  expect(s.class?.affinity.mage).toBeGreaterThan(0);
});

test("at level 5 with no line, advancement_pending is 'class'", () => {
  const s = reduce(promptsTo5, cfgA, "2026-06-11");
  expect(s.level).toBe(5);
  expect(s.class?.advancement_pending).toBe("class");
});

test("a chosen line resolves to its tier form + name", () => {
  const s = reduce(promptsTo5, cfgA, "2026-06-11", { name: "Gandalf", line: ClassLine.Mage });
  expect(s.name).toBe("Gandalf");
  expect(s.class?.line).toBe("mage");
  expect(s.class?.tier).toBe(1);
  expect(s.class?.form).toBe("Backend Mage");
  expect(s.class?.advancement_pending).toBe(null);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test test/core/reduce.test.ts`
Expected: FAIL — `reduce` ignores `profile`, returns no `class`.

- [ ] **Step 4: Update `core/reduce.ts`**

Add imports at the top of `core/reduce.ts` (merge with the existing block):
```ts
import { computeAffinity } from "./affinity";
import { loadProfile, type IProfile } from "./profile";
import { tierForLevel, formFor, iconFor, advancementPending, type IClassState } from "./classes";
```
Change the `reduce` signature and append the class resolution. Replace the signature line:
```ts
export function reduce(events: INormalizedEvent[], config: IConfig, today?: string): TReducedState {
```
with:
```ts
export function reduce(events: INormalizedEvent[], config: IConfig, today?: string, profile?: IProfile): TReducedState {
```
Then replace the `prelim` construction + return (the block starting `const prelim: TReducedState = {`) with:
```ts
  const line = profile?.line ?? null;
  const branch = profile?.branch ?? null;
  const tier = line ? tierForLevel(prog.level) : 0;
  const classState: IClassState = {
    line,
    tier,
    form: formFor(line, tier, branch),
    icon: iconFor(line),
    branch,
    affinity: computeAffinity(events),
    advancement_pending: advancementPending(line, prog.level, branch),
  };

  const prelim: TReducedState = {
    version: 1,
    xp_total,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: {
      prompts,
      actions,
      sessions: sessions.size,
      by_source: toGroupStats(bySource),
      by_repo: toGroupStats(byRepo),
    },
    streak,
    class: classState,
  };
  if (profile?.name) prelim.name = profile.name;
  return { ...prelim, achievements: evaluateAchievements(prelim, config.achievements) };
```
Finally, update `reduceToFile` to load the profile. Change its first lines from:
```ts
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home), localTodayKey());
```
to:
```ts
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home), localTodayKey(), loadProfile(home));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test test/core/reduce.test.ts`
Expected: PASS (8 tests in the file).

- [ ] **Step 6: Commit**

```bash
git add core/state.ts core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): reduce resolves class identity from profile + level"
```

---

## Task 5: `tools/rpg.ts` — player CLI

**Files:**
- Create: `tools/rpg.ts`
- Test: `test/tools/rpg.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/tools/rpg.test.ts`:
```ts
import { test, expect } from "bun:test";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

const RPG = new URL("../../tools/rpg.ts", import.meta.url).pathname;

function seedLevel(home: string, prompts: number) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const line = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(prompts).fill(line).join("\n") + "\n");
}

async function rpg(home: string, ...args: string[]) {
  const proc = Bun.spawn(["bun", RPG, ...args], {
    env: { ...process.env, AGENTRPG_HOME: home }, stdout: "pipe", stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  return { stdout, stderr, code: await proc.exited };
}

const profile = (home: string) => JSON.parse(readFileSync(join(home, "profile.json"), "utf8"));

test("name writes profile.json and exits 0", async () => {
  const home = makeHome(); seedLevel(home, 1);
  const r = await rpg(home, "name", "Gandalf");
  expect(r.code).toBe(0);
  expect(profile(home).name).toBe("Gandalf");
});

test("class is rejected below level 5", async () => {
  const home = makeHome(); seedLevel(home, 1); // ~5 xp -> level 1
  const r = await rpg(home, "class", "mage");
  expect(r.code).toBe(1);
  expect(r.stderr).toContain("level 5");
});

test("class is accepted at level 5+ and resolves the form", async () => {
  const home = makeHome(); seedLevel(home, 60); // 300 xp -> level 5
  const r = await rpg(home, "class", "mage");
  expect(r.code).toBe(0);
  expect(profile(home).line).toBe("mage");
  const state = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(state.class.form).toBe("Backend Mage");
});

test("branch is rejected below level 50", async () => {
  const home = makeHome(); seedLevel(home, 60);
  await rpg(home, "class", "mage");
  const r = await rpg(home, "branch", "a");
  expect(r.code).toBe(1);
  expect(r.stderr).toContain("level 50");
});

test("status prints a suggested line", async () => {
  const home = makeHome(); seedLevel(home, 60);
  const r = await rpg(home, "status");
  expect(r.code).toBe(0);
  expect(r.stdout).toContain("suggested line");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/tools/rpg.test.ts`
Expected: FAIL — `tools/rpg.ts` does not exist.

- [ ] **Step 3: Write `tools/rpg.ts`**

Create `tools/rpg.ts`:
```ts
// Player command-line for character identity. Writes profile.json, refreshes state.json.
import { defaultHome } from "../core/config";
import { loadProfile, saveProfile, type IProfile } from "../core/profile";
import { reduceToFile } from "../core/reduce";
import { ClassLine, CLASS_TREE } from "../core/classes";

const HOME = defaultHome();
const LINES = Object.values(ClassLine) as string[];

function fail(message: string): never {
  process.stderr.write(message + "\n");
  process.exit(1);
}

function currentLevel(): number {
  return reduceToFile(HOME).level;
}

function persist(profile: IProfile): void {
  saveProfile(HOME, profile);
  reduceToFile(HOME);
}

function setName(profile: IProfile, name: string): string {
  profile.name = name.trim().slice(0, 24);
  persist(profile);
  return `Name set to "${profile.name}".`;
}

function setClass(profile: IProfile, line: string): string {
  if (!LINES.includes(line)) fail(`Unknown class "${line}". Choose: ${LINES.join(", ")}.`);
  if (currentLevel() < 5) fail("Reach level 5 before choosing a class.");
  profile.line = line as ClassLine;
  profile.branch = undefined;
  persist(profile);
  return `Class set to ${line}.`;
}

function setBranch(profile: IProfile, branch: string): string {
  if (branch !== "a" && branch !== "b") fail(`Branch must be "a" or "b".`);
  if (!profile.line) fail("Choose a class first.");
  if (currentLevel() < 50) fail("Reach level 50 before branching.");
  if (profile.branch) fail("Branch already chosen (locked).");
  profile.branch = branch;
  persist(profile);
  return `Branch locked: ${CLASS_TREE[profile.line].branches[branch]}.`;
}

function respec(profile: IProfile, line: string): string {
  if (!LINES.includes(line)) fail(`Unknown class "${line}".`);
  if (currentLevel() >= 50) fail("Cannot respec at level 50.");
  profile.line = line as ClassLine;
  profile.branch = undefined;
  persist(profile);
  return `Respec to ${line}.`;
}

function status(profile: IProfile): string {
  const state = reduceToFile(HOME);
  const affinity = state.class?.affinity ?? {};
  const suggested = Object.entries(affinity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const bars = LINES.map((l) => `${l} ${Math.round((affinity[l] ?? 0) * 100)}%`).join("  ");
  return `${profile.name ?? "Adventurer"} · ${state.class?.form ?? "Novice"}  (Lv.${state.level})\n` +
    `affinity: ${bars}\nsuggested line: ${suggested}`;
}

function main(): void {
  const [cmd, ...args] = process.argv.slice(2);
  const profile = loadProfile(HOME);
  let out: string;
  switch (cmd) {
    case "name": out = setName(profile, args.join(" ")); break;
    case "class": out = setClass(profile, args[0] ?? ""); break;
    case "branch": out = setBranch(profile, args[0] ?? ""); break;
    case "respec": out = respec(profile, args[0] ?? ""); break;
    case "status": out = status(profile); break;
    default: fail("Usage: rpg <name|class|branch|respec|status> …");
  }
  console.log(out);
}

if (import.meta.main) main();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/tools/rpg.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/rpg.ts test/tools/rpg.test.ts
git commit -m "feat(tools): rpg CLI (name/class/branch/respec/status)"
```

---

## Task 6: `hud/statusline.ts` — show name + class

**Files:**
- Modify: `hud/statusline.ts` (`renderHud`)
- Test: `test/hud/statusline.test.ts` (update existing exact-matches + add new)

- [ ] **Step 1: Update the three exact-match assertions for the new prefix**

The HUD now leads with `{name} · {classLabel}  `. For the existing tests whose `state` has no
name/class, that prefix is `Adventurer · Novice  `. In `test/hud/statusline.test.ts`, change:
```ts
expect(renderHud(s, tail)).toBe("Lv.5 ████░░░░░░ 40%  |  Opus 4.8  $0.42  ·  ctx 8%");
```
to:
```ts
expect(renderHud(s, tail)).toBe("Adventurer · Novice  Lv.5 ████░░░░░░ 40%  |  Opus 4.8  $0.42  ·  ctx 8%");
```
and:
```ts
  expect(renderHud(s, { model: null, cost: null, ctx: null })).toBe(
    "Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%");
```
to:
```ts
  expect(renderHud(s, { model: null, cost: null, ctx: null })).toBe(
    "Adventurer · Novice  Lv.1 ░░░░░░░░░░ 0%  |  ?  $0.00  ·  ctx 0%");
```
and:
```ts
  expect(renderHud(s, { model: "M", cost: 0, ctx: 0 })).toBe(
    "Lv.50 ██████████ MAX 100%  |  M  $0.00  ·  ctx 0%");
```
to:
```ts
  expect(renderHud(s, { model: "M", cost: 0, ctx: 0 })).toBe(
    "Adventurer · Novice  Lv.50 ██████████ MAX 100%  |  M  $0.00  ·  ctx 0%");
```
(The `ctx 24%` `toContain` test and the 2a `🔥5d` `toContain` test need no change.)

- [ ] **Step 2: Add the new identity tests**

Append to `test/hud/statusline.test.ts`:
```ts
test("named character shows icon + form; pending adds the sparkle", () => {
  const base = state({ level: 30, xp_in_level: 0, xp_to_next: 100 });
  const tail = { model: "Opus 4.8", cost: 0.42, ctx: 8 };
  const named = { ...base, name: "Gandalf",
    class: { line: "mage", tier: 3, form: "Infra Archmage", icon: "⚔", branch: null, affinity: {}, advancement_pending: null } };
  expect(renderHud(named as any, tail)).toContain("Gandalf · ⚔ Infra Archmage  Lv.30");

  const pending = { ...base,
    class: { line: null, tier: 0, form: "Novice", icon: "", branch: null, affinity: {}, advancement_pending: "class" } };
  expect(renderHud(pending as any, tail)).toContain("Adventurer · Novice ✨  Lv.30");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun test test/hud/statusline.test.ts`
Expected: FAIL — `renderHud` does not yet emit the identity prefix.

- [ ] **Step 4: Update `renderHud` in `hud/statusline.ts`**

Replace the final `return` of `renderHud` with:
```ts
  const ctx = tail.ctx == null ? 0 : Math.round(tail.ctx);
  const fire = state.streak && state.streak.current_days >= 1 ? ` 🔥${state.streak.current_days}d` : "";
  const name = state.name || "Adventurer";
  const cls = state.class;
  const label = cls && cls.line ? `${cls.icon} ${cls.form}` : "Novice";
  const pending = cls?.advancement_pending ? " ✨" : "";
  return `${name} · ${label}${pending}  Lv.${state.level} ${bar}${maxed} ${Math.round(pct * 100)}%${fire}  |  ${model}  $${cost}  ·  ctx ${ctx}%`;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `bun test test/hud/statusline.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add hud/statusline.ts test/hud/statusline.test.ts
git commit -m "feat(hud): show character name + class in the statusline"
```

---

## Task 7: `tools/inspect.ts` — class in headline

**Files:**
- Modify: `tools/inspect.ts`
- Test: `test/tools/inspect.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/tools/inspect.test.ts`:
```ts
test("headline includes the class form", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}\n`);
  expect(summarize(home)).toContain("(Novice)");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/tools/inspect.test.ts`
Expected: FAIL — headline has no class form.

- [ ] **Step 3: Update the headline in `tools/inspect.ts`**

In `summarize`, change the `headline` assignment from:
```ts
  const headline =
    `level: ${s.level}  xp: ${s.xp_total}  streak: ${streak}  ` +
    `achievements: ${s.achievements?.earned.length ?? 0} (${s.achievements?.points ?? 0} pts)`;
```
to:
```ts
  const headline =
    `level: ${s.level} (${s.class?.form ?? "Novice"})  xp: ${s.xp_total}  streak: ${streak}  ` +
    `achievements: ${s.achievements?.earned.length ?? 0} (${s.achievements?.points ?? 0} pts)`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/tools/inspect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/inspect.ts test/tools/inspect.test.ts
git commit -m "feat(tools): inspect headline shows the class form"
```

---

## Task 8: full suite + tsc + integration

**Files:**
- Test: `test/integration/class-identity.test.ts`

- [ ] **Step 1: Write an end-to-end test**

Create `test/integration/class-identity.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduceToFile } from "../../core/reduce";
import { saveProfile } from "../../core/profile";
import { renderHud } from "../../hud/statusline";
import { ClassLine } from "../../core/classes";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

test("profile + journal -> reduceToFile -> HUD shows name + form", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const prompt = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(60).fill(prompt).join("\n") + "\n"); // -> level 5

  saveProfile(home, { name: "Gandalf", line: ClassLine.Mage });
  const state = reduceToFile(home);
  expect(state.name).toBe("Gandalf");
  expect(state.class?.form).toBe("Backend Mage");

  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(renderHud(onDisk, { model: "M", cost: 0, ctx: 0 })).toContain("Gandalf · ⚔ Backend Mage");
});
```

- [ ] **Step 2: Run the full suite**

Run: `bun test`
Expected: all PASS (Phase 0 + 1 + 2a + 2b.1).

- [ ] **Step 3: Type-check**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add test/integration/class-identity.test.ts
git commit -m "test: class identity end-to-end"
```

---

## Task 9: Deploy + real-session verify (manual)

- [ ] **Step 1: Redeploy**

Run `tools/install.sh --link` (re-links `core/`, `tools/`, `hud/`).

- [ ] **Step 2: Set up the character**

```bash
bun ~/.agentrpg/tools/rpg.ts name "Gandalf"
bun ~/.agentrpg/tools/rpg.ts status      # shows affinity + suggested line
bun ~/.agentrpg/tools/rpg.ts class mage  # if at level 5+
```
Expect `profile.json` and `state.json` to update; `status` prints affinity + suggestion.

- [ ] **Step 3: Real session shows the identity**

Open a new Claude Code session; the statusline shows `Gandalf · ⚔ {form}  Lv.N …`. Below Lv.5
it shows `Novice`; at Lv.5+ without a pick it shows `Novice ✨`.

- [ ] **Step 4: Finish the branch**

Use the superpowers:finishing-a-development-branch skill to PR/merge `feat/phase2b1-class-identity`.

---

## Self-Review notes (already applied)

- **Spec coverage:** CLASS_TREE + tier/form §4 (Task 1); affinity §5 (Task 2); profile §3 (Task 3); reduce resolves class + reduceToFile loads profile §6/§8 (Task 4); CLI name/class/branch/respec/status + level validation §7 (Task 5); HUD identity §9 (Task 6); inspect headline §10 (Task 7); DoD §12 (Tasks 8–9); out-of-scope respected (no passives/XP change).
- **No placeholders:** every code step is complete and runnable.
- **Type/name consistency:** `ClassLine`/`IClassState`/`IClassDef`/`IProfile`, `tierForLevel`/`formFor`/`iconFor`/`advancementPending`, `computeAffinity`, `loadProfile`/`saveProfile`, `reduce(events, config, today?, profile?)`, `renderHud` — consistent across tasks. `reduce`'s new `profile` param is the 4th positional optional, so pre-2b callers (`reduce(events, cfg)`, `reduce(events, cfgA, today)`) keep working. The HUD prefix change requires updating three existing exact-match assertions (Task 6 Step 1).
```

