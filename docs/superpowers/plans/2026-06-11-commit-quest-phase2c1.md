# Commit Quest Phase 2c.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cosmetic loot drops (seeded → idempotent) collected in an inventory; equippable title + HUD theme; a left/right space-between statusline with CC rate-limit monitoring.

**Architecture:** A tiny seeded PRNG turns stable per-trigger seeds into deterministic drops. The reducer detects triggers (clean session / level-up / streak) and rolls an inventory; equipped ids in `profile.json` resolve into `state.cosmetics`. The statusline splits into game (left) and CC monitor (right).

**Tech Stack:** Bun + TypeScript, `bun test`, Prettier. No runtime npm deps.

**Reference:** Spec `docs/superpowers/specs/2026-06-11-commit-quest-phase2c1-design.md`; conventions `CLAUDE.md` (string enums, `I*`/`T*` prefixes, no `any`, braces on if/else, clarity over cleverness).

**Commit convention:** end commit bodies with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Run `bun run format` before committing.

**Branch:** already on `feat/phase2c1-loot` (off `main`); spec committed.

---

## File Structure

| File | Change |
|---|---|
| `core/rng.ts` | new — `hashStr`, `mulberry32`, `seededRng` |
| `core/loot.ts` | new — enums, items, tables, `rollDrop`, `rollInventory`, `resolveCosmetics` |
| `core/profile.ts` | `IProfile` gains `title?`, `theme?` |
| `core/state.ts` | optional `inventory?`, `cosmetics?` |
| `core/config.ts` | `IConfig.loot?`/`drops?` + merge |
| `core/reduce.ts` | triggers → `rollInventory`; `resolveCosmetics` |
| `hud/statusline.ts` | HUD overhaul (left/right, theme, title, 🎒, rate limits) |
| `tools/rpg.ts` | `inventory` / `title` / `theme` |

---

## Task 1: `core/rng.ts`

**Files:** Create `core/rng.ts`; Test `test/core/rng.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/rng.test.ts`:
```ts
import { test, expect } from "bun:test";
import { hashStr, seededRng } from "../../core/rng";

test("hashStr is deterministic and distinguishes strings", () => {
  expect(hashStr("clean:s1")).toBe(hashStr("clean:s1"));
  expect(hashStr("a")).not.toBe(hashStr("b"));
});

test("seededRng is deterministic and yields [0,1)", () => {
  const va = seededRng("x")();
  expect(va).toBe(seededRng("x")());
  expect(va).toBeGreaterThanOrEqual(0);
  expect(va).toBeLessThan(1);
  expect(seededRng("y")()).not.toBe(seededRng("x")());
});
```

- [ ] **Step 2: Run — expect FAIL** (`bun test test/core/rng.test.ts`; cannot find module).

- [ ] **Step 3: Write `core/rng.ts`**
```ts
// cyrb53 string hash -> a stable number seed.
export function hashStr(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// mulberry32 PRNG: a numeric seed -> a function yielding values in [0, 1).
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededRng(seedStr: string): () => number {
  return mulberry32(hashStr(seedStr));
}
```

- [ ] **Step 4: Run — expect PASS** (`bun test test/core/rng.test.ts`).

- [ ] **Step 5: Commit**
```bash
bun run format
git add core/rng.ts test/core/rng.test.ts
git commit -m "feat(core): seeded RNG (hashStr + mulberry32)"
```

---

## Task 2: `core/loot.ts`

**Files:** Create `core/loot.ts`; Test `test/core/loot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/core/loot.test.ts`:
```ts
import { test, expect } from "bun:test";
import { rollDrop, rollInventory, resolveCosmetics, LOOT_TABLE, Rarity } from "../../core/loot";

test("rollDrop is deterministic per seed and not null for a known table", () => {
  const a = rollDrop({ table: "clean", seed: "s" });
  expect(a).toBe(rollDrop({ table: "clean", seed: "s" }));
  expect(a).not.toBe(null);
});

test("streak100 always yields a legendary item", () => {
  for (const seed of ["a", "b", "c", "d", "e"]) {
    const id = rollDrop({ table: "streak100", seed })!;
    expect(LOOT_TABLE[id].rarity).toBe(Rarity.Legendary);
  }
});

test("rollInventory aggregates duplicate drops and sorts by id", () => {
  const inv = rollInventory([{ table: "clean", seed: "s" }, { table: "clean", seed: "s" }]);
  expect(inv.length).toBe(1);
  expect(inv[0].count).toBe(2);
});

test("resolveCosmetics maps owned equips, ignores unowned/wrong-kind", () => {
  const inv = [
    { id: "rookie_title", rarity: Rarity.Common, count: 1 },
    { id: "neon_theme", rarity: Rarity.Rare, count: 1 },
  ];
  const r = resolveCosmetics({ title: "rookie_title", theme: "neon_theme" }, inv);
  expect(r.title).toBe("Rookie");
  expect(r.theme_color).toBe("36");
  expect(resolveCosmetics({ title: "archmage_title" }, inv).title).toBe(null); // not owned
  expect(resolveCosmetics({ title: "neon_theme" }, inv).title).toBe(null); // wrong kind
});
```

- [ ] **Step 2: Run — expect FAIL** (cannot find module).

- [ ] **Step 3: Write `core/loot.ts`**
```ts
import { seededRng } from "./rng";

export enum Rarity {
  Common = "common",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export enum LootKind {
  Title = "title",
  Theme = "theme",
  Skin = "skin",
}

export interface ILootItem {
  id: string;
  name: string;
  rarity: Rarity;
  kind: LootKind;
  value?: string; // theme -> ANSI SGR code; skin -> app sprite key
}

export interface IInventoryItem {
  id: string;
  rarity: Rarity;
  count: number;
}

export interface ICosmetics {
  title: string | null;
  theme_color: string | null;
}

export const LOOT_TABLE: Record<string, ILootItem> = {
  rookie_title: { id: "rookie_title", name: "Rookie", rarity: Rarity.Common, kind: LootKind.Title },
  tinkerer_title: { id: "tinkerer_title", name: "Tinkerer", rarity: Rarity.Common, kind: LootKind.Title },
  forest_theme: { id: "forest_theme", name: "Forest", rarity: Rarity.Common, kind: LootKind.Theme, value: "32" },
  hoodie_skin: { id: "hoodie_skin", name: "Hoodie Dev", rarity: Rarity.Common, kind: LootKind.Skin },
  codeweaver_title: { id: "codeweaver_title", name: "Codeweaver", rarity: Rarity.Rare, kind: LootKind.Title },
  night_coder_title: { id: "night_coder_title", name: "Night Coder", rarity: Rarity.Rare, kind: LootKind.Title },
  neon_theme: { id: "neon_theme", name: "Neon", rarity: Rarity.Rare, kind: LootKind.Theme, value: "36" },
  ocean_theme: { id: "ocean_theme", name: "Ocean", rarity: Rarity.Rare, kind: LootKind.Theme, value: "34" },
  cyber_ninja_skin: { id: "cyber_ninja_skin", name: "Cyber Ninja", rarity: Rarity.Rare, kind: LootKind.Skin },
  archmage_title: { id: "archmage_title", name: "Archmage", rarity: Rarity.Epic, kind: LootKind.Title },
  bug_whisperer_title: { id: "bug_whisperer_title", name: "Bug Whisperer", rarity: Rarity.Epic, kind: LootKind.Title },
  sunset_theme: { id: "sunset_theme", name: "Sunset", rarity: Rarity.Epic, kind: LootKind.Theme, value: "33" },
  matrix_theme: { id: "matrix_theme", name: "Matrix", rarity: Rarity.Epic, kind: LootKind.Theme, value: "92" },
  wizard_robe_skin: { id: "wizard_robe_skin", name: "Wizard Robe", rarity: Rarity.Epic, kind: LootKind.Skin },
  legendary_title: { id: "legendary_title", name: "The Legendary", rarity: Rarity.Legendary, kind: LootKind.Title },
  tenx_title: { id: "tenx_title", name: "10x", rarity: Rarity.Legendary, kind: LootKind.Title },
  golden_theme: { id: "golden_theme", name: "Golden", rarity: Rarity.Legendary, kind: LootKind.Theme, value: "33" },
  golden_armor_skin: { id: "golden_armor_skin", name: "Golden Armor", rarity: Rarity.Legendary, kind: LootKind.Skin },
};

export type TDropTable = Array<{ rarity: Rarity; weight: number }>;

export const DROP_TABLES: Record<string, TDropTable> = {
  clean: [
    { rarity: Rarity.Common, weight: 0.7 },
    { rarity: Rarity.Rare, weight: 0.25 },
    { rarity: Rarity.Epic, weight: 0.05 },
  ],
  levelup: [
    { rarity: Rarity.Common, weight: 0.6 },
    { rarity: Rarity.Rare, weight: 0.3 },
    { rarity: Rarity.Epic, weight: 0.08 },
    { rarity: Rarity.Legendary, weight: 0.02 },
  ],
  streak7: [
    { rarity: Rarity.Rare, weight: 0.7 },
    { rarity: Rarity.Epic, weight: 0.25 },
    { rarity: Rarity.Legendary, weight: 0.05 },
  ],
  streak30: [
    { rarity: Rarity.Epic, weight: 0.8 },
    { rarity: Rarity.Legendary, weight: 0.2 },
  ],
  streak100: [{ rarity: Rarity.Legendary, weight: 1.0 }],
};

export interface ITrigger {
  table: string;
  seed: string;
}

function rollRarity(rng: () => number, table: TDropTable): Rarity {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let r = rng() * total;
  for (const entry of table) {
    r -= entry.weight;
    if (r < 0) {
      return entry.rarity;
    }
  }
  return table[table.length - 1].rarity;
}

function pickItem(rng: () => number, items: ILootItem[]): ILootItem | null {
  if (items.length === 0) {
    return null;
  }
  return items[Math.floor(rng() * items.length)];
}

export function rollDrop(
  trigger: ITrigger,
  lootTable: Record<string, ILootItem> = LOOT_TABLE,
  dropTables: Record<string, TDropTable> = DROP_TABLES,
): string | null {
  const dropTable = dropTables[trigger.table];
  if (!dropTable) {
    return null;
  }
  const rng = seededRng(trigger.seed);
  const rarity = rollRarity(rng, dropTable);
  const pool = Object.values(lootTable).filter(item => item.rarity === rarity);
  const item = pickItem(rng, pool);
  return item ? item.id : null;
}

export function rollInventory(
  triggers: ITrigger[],
  lootTable: Record<string, ILootItem> = LOOT_TABLE,
  dropTables: Record<string, TDropTable> = DROP_TABLES,
): IInventoryItem[] {
  const counts: Record<string, number> = {};
  for (const trigger of triggers) {
    const id = rollDrop(trigger, lootTable, dropTables);
    if (id) {
      counts[id] = (counts[id] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([id, count]) => ({ id, rarity: lootTable[id].rarity, count }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function resolveCosmetics(
  profile: { title?: string; theme?: string },
  inventory: IInventoryItem[],
  lootTable: Record<string, ILootItem> = LOOT_TABLE,
): ICosmetics {
  const owned = new Set(inventory.map(i => i.id));
  const titleItem = profile.title && owned.has(profile.title) ? lootTable[profile.title] : null;
  const themeItem = profile.theme && owned.has(profile.theme) ? lootTable[profile.theme] : null;
  return {
    title: titleItem?.kind === LootKind.Title ? titleItem.name : null,
    theme_color: themeItem?.kind === LootKind.Theme ? (themeItem.value ?? null) : null,
  };
}
```

- [ ] **Step 4: Run — expect PASS** (4 tests).

- [ ] **Step 5: Commit**
```bash
bun run format
git add core/loot.ts test/core/loot.test.ts
git commit -m "feat(core): cosmetic loot table, drop rolls, cosmetics resolution"
```

---

## Task 3: state / profile / config plumbing

**Files:** Modify `core/state.ts`, `core/profile.ts`, `core/config.ts`; Test `test/core/config.test.ts` (append)

- [ ] **Step 1: Add fields to `core/state.ts`**

Add the import and two optional fields to `IState`:
```ts
import type { IInventoryItem, ICosmetics } from "./loot";
```
and at the end of `IState` (after `class?`):
```ts
  inventory?: IInventoryItem[];
  cosmetics?: ICosmetics;
```

- [ ] **Step 2: Add equip ids to `core/profile.ts`**

In `IProfile`, add:
```ts
export interface IProfile {
  name?: string;
  line?: ClassLine;
  branch?: "a" | "b";
  title?: string;
  theme?: string;
}
```

- [ ] **Step 3: Write the failing config test**

Append to `test/core/config.test.ts`:
```ts
import { LOOT_TABLE, DROP_TABLES } from "../../core/loot";

test("loot table and drop tables default to the built-in sets", () => {
  const c = loadConfig(makeHome());
  expect(c.loot?.rookie_title?.name).toBe("Rookie");
  expect(Object.keys(c.loot ?? {}).length).toBe(Object.keys(LOOT_TABLE).length);
  expect(c.drops?.streak100?.[0]?.rarity).toBe(DROP_TABLES.streak100[0].rarity);
});
```

- [ ] **Step 4: Run — expect FAIL** (`loadConfig` returns no `loot`/`drops`).

- [ ] **Step 5: Update `core/config.ts`**

Add to the `./loot` imports + `IConfig` + `loadConfig`. Add this import:
```ts
import { LOOT_TABLE, DROP_TABLES, type ILootItem, type TDropTable } from "./loot";
```
Extend `IConfig`:
```ts
  achievements?: Record<string, IAchievementDef>;
  passive?: TPassiveRates;
  loot?: Record<string, ILootItem>;
  drops?: Record<string, TDropTable>;
```
Add to `base`:
```ts
    passive: DEFAULT_PASSIVE,
    loot: LOOT_TABLE,
    drops: DROP_TABLES,
```
and to the merged return (after `passive`):
```ts
      passive: { ...DEFAULT_PASSIVE, ...(raw?.passive ?? {}) },
      loot: { ...LOOT_TABLE, ...(raw?.loot ?? {}) },
      drops: { ...DROP_TABLES, ...(raw?.drops ?? {}) },
```

- [ ] **Step 6: Run — expect PASS** (`bun test test/core/config.test.ts`).

- [ ] **Step 7: Commit**
```bash
bun run format
git add core/state.ts core/profile.ts core/config.ts test/core/config.test.ts
git commit -m "feat(core): state inventory/cosmetics, profile equips, config loot tables"
```

---

## Task 4: `core/reduce.ts` — triggers → inventory + cosmetics

**Files:** Modify `core/reduce.ts`; Test `test/core/reduce.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `test/core/reduce.test.ts`:
```ts
const zeroCfg = {
  weights: {
    prompt: 0, turn_end: 0, session_end: 0,
    actions: { edit: 0, write: 0, run: 0, read: 0, search: 0, delegate: 0, other: 0 },
  },
  difficulty: DEFAULT_DIFFICULTY,
};

test("a clean session drops loot; a session with a fail does not", () => {
  const clean = [
    at("01", { session_id: "s1", type: "action", action: "edit", repo: "cq" }),
    at("02", { session_id: "s1", type: "session_end", repo: "cq" }),
  ];
  expect(reduce(clean, zeroCfg, "2026-06-11").inventory?.length).toBe(1);

  const failed = [
    at("01", { session_id: "s2", type: "action_fail", action: "run", repo: "cq" }),
    at("02", { session_id: "s2", type: "session_end", repo: "cq" }),
  ];
  expect(reduce(failed, zeroCfg, "2026-06-11").inventory).toEqual([]);
});

test("loot is idempotent", () => {
  const ev = [at("01", { session_id: "s1", type: "session_end", repo: "cq" })];
  expect(reduce(ev, zeroCfg, "2026-06-11").inventory).toEqual(reduce(ev, zeroCfg, "2026-06-11").inventory);
});

test("cosmetics resolve only when the equipped item is owned", () => {
  const ev = [at("01", { session_id: "s1", type: "action", action: "edit", repo: "cq" })]; // no session_end -> empty inventory
  const s = reduce(ev, zeroCfg, "2026-06-11", { title: "archmage_title" });
  expect(s.inventory).toEqual([]);
  expect(s.cosmetics?.title).toBe(null);
});
```

- [ ] **Step 2: Run — expect FAIL** (no `inventory`/`cosmetics`).

- [ ] **Step 3: Update `core/reduce.ts`**

Add to the import block:
```ts
import {
  rollInventory,
  resolveCosmetics,
  LOOT_TABLE,
  DROP_TABLES,
  type ITrigger,
} from "./loot";
```
Inside the fold loop, track per-session fail/end. After the existing `sessions.add(e.session_id);` line, add:
```ts
    if (!sessionInfo[e.session_id]) {
      sessionInfo[e.session_id] = { hasFail: false, hasEnd: false };
    }
    if (e.type === EventType.ActionFail) {
      sessionInfo[e.session_id].hasFail = true;
    }
    if (e.type === EventType.SessionEnd) {
      sessionInfo[e.session_id].hasEnd = true;
    }
```
and declare `sessionInfo` next to the other accumulators (before the loop):
```ts
  const sessionInfo: Record<string, { hasFail: boolean; hasEnd: boolean }> = {};
```
After `const classState: IClassState = { … };` (before building `prelim`), add the loot roll:
```ts
  const lootTable = config.loot ?? LOOT_TABLE;
  const triggers: ITrigger[] = [];
  for (const [sid, info] of Object.entries(sessionInfo)) {
    if (info.hasEnd && !info.hasFail) {
      triggers.push({ table: "clean", seed: `clean:${sid}` });
    }
  }
  for (let lvl = 2; lvl <= prog.level; lvl++) {
    triggers.push({ table: "levelup", seed: `level:${lvl}` });
  }
  if (streak.best_days >= 7) {
    triggers.push({ table: "streak7", seed: "streak:7" });
  }
  if (streak.best_days >= 30) {
    triggers.push({ table: "streak30", seed: "streak:30" });
  }
  if (streak.best_days >= 100) {
    triggers.push({ table: "streak100", seed: "streak:100" });
  }
  const inventory = rollInventory(triggers, lootTable, config.drops ?? DROP_TABLES);
  const cosmetics = resolveCosmetics(profile ?? {}, inventory, lootTable);
```
Add `inventory` and `cosmetics` to `prelim`:
```ts
    streak,
    class: classState,
    inventory,
    cosmetics,
  };
```

- [ ] **Step 4: Run — expect PASS** (`bun test test/core/reduce.test.ts`).

- [ ] **Step 5: Commit**
```bash
bun run format
git add core/reduce.ts test/core/reduce.test.ts
git commit -m "feat(core): reduce rolls loot from triggers + resolves cosmetics"
```

---

## Task 5: `hud/statusline.ts` — left/right HUD + theme/title/bag + rate limits

**Files:** Modify `hud/statusline.ts`; Test `test/hud/statusline.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/hud/statusline.test.ts`:
```ts
test("loot cosmetics + rate limits render; null rates are omitted", () => {
  const s = {
    ...state({ level: 5, xp_in_level: 0, xp_to_next: 100 }),
    cosmetics: { title: "Codeweaver", theme_color: "36" },
    inventory: [{ id: "x", rarity: "rare", count: 3 }],
  } as any;
  const out = renderHud(s, { model: "Opus", cost: 0.5, ctx: 8, five_hour: 23, seven_day: 41 });
  expect(out).toContain("Adventurer the Codeweaver");
  expect(out).toContain("\x1b[36m");
  expect(out).toContain("🎒3");
  expect(out).toContain("5h 23%");
  expect(out).toContain("7d 41%");

  const bare = renderHud(state({ level: 5, xp_in_level: 0, xp_to_next: 100 }), {
    model: "M", cost: 0, ctx: 0, five_hour: null, seven_day: null,
  });
  expect(bare).not.toContain("5h");
  expect(bare).not.toContain("7d");
});

test("space-between right-aligns the CC group when cols is wide", () => {
  const s = state({ level: 5, xp_in_level: 0, xp_to_next: 100 });
  const out = renderHud(s, { model: "M", cost: 0, ctx: 0 }, 200);
  expect(out.endsWith("ctx 0%")).toBe(true);
  expect(out).not.toContain("|");
  expect(out.length).toBe(200);
});
```

- [ ] **Step 2: Run — expect FAIL** (no rate-limit / theme / cols support; the three existing exact-match tests still pass).

- [ ] **Step 3: Rewrite `renderHud` + `ITail` in `hud/statusline.ts`**

Replace the `ITail` interface and the whole `renderHud` function with:
```ts
export interface ITail {
  model: string | null;
  cost: number | null;
  ctx: number | null;
  five_hour?: number | null;
  seven_day?: number | null;
}

function visibleWidth(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function renderHud(state: IState, tail: ITail, cols = 0): string {
  const pct = state.xp_to_next === 0 ? 1 : state.xp_in_level / (state.xp_in_level + state.xp_to_next);
  const filled = Math.round(pct * 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);
  const maxed = state.xp_to_next === 0 ? " MAX" : "";
  const themeColor = state.cosmetics?.theme_color;
  const coloredBar = themeColor ? `\x1b[${themeColor}m${bar}\x1b[0m` : bar;

  const name = state.name || "Adventurer";
  const titleSuffix = state.cosmetics?.title ? ` the ${state.cosmetics.title}` : "";
  const cls = state.class;
  const label = cls && cls.line ? `${cls.icon} ${cls.form}` : "Novice";
  const pending = cls?.advancement_pending ? " ✨" : "";
  const fire = state.streak && state.streak.current_days >= 1 ? ` 🔥${state.streak.current_days}d` : "";
  const bagCount = (state.inventory ?? []).reduce((sum, item) => sum + item.count, 0);
  const bag = bagCount > 0 ? ` 🎒${bagCount}` : "";
  const left =
    `${name}${titleSuffix} · ${label}${pending}  ` +
    `Lv.${state.level} ${coloredBar}${maxed} ${Math.round(pct * 100)}%${fire}${bag}`;

  const model = tail.model || "?";
  const cost = tail.cost == null ? "0.00" : tail.cost.toFixed(2);
  const ctx = tail.ctx == null ? 0 : Math.round(tail.ctx);
  const rate5 = tail.five_hour == null ? "" : `  ·  5h ${Math.round(tail.five_hour)}%`;
  const rate7 = tail.seven_day == null ? "" : `  ·  7d ${Math.round(tail.seven_day)}%`;
  const right = `${model}  $${cost}  ·  ctx ${ctx}%${rate5}${rate7}`;

  const used = visibleWidth(left) + visibleWidth(right);
  if (cols > used + 1) {
    return left + " ".repeat(cols - used) + right;
  }
  return `${left}  |  ${right}`;
}
```

- [ ] **Step 4: Pass `cols` + rate limits from `main`**

In `main`, extend the `tail` object and the final write. Change the `tail = { … }` assignment to:
```ts
    tail = {
      model: j?.model?.display_name ?? null,
      cost: j?.cost?.total_cost_usd ?? null,
      ctx: j?.context_window?.used_percentage ?? null,
      five_hour: j?.rate_limits?.five_hour?.used_percentage ?? null,
      seven_day: j?.rate_limits?.seven_day?.used_percentage ?? null,
    };
```
and the final line from `process.stdout.write(renderHud(readState(HOME), tail));` to:
```ts
  const cols = Number(process.env.COLUMNS) || 0;
  process.stdout.write(renderHud(readState(HOME), tail, cols));
```

- [ ] **Step 5: Run — expect PASS** (`bun test test/hud/statusline.test.ts`; existing exact-match tests still pass because cosmetics/inventory/rates are absent and `cols = 0` falls back).

- [ ] **Step 6: Commit**
```bash
bun run format
git add hud/statusline.ts test/hud/statusline.test.ts
git commit -m "feat(hud): left/right space-between layout, theme/title/bag, CC rate limits"
```

---

## Task 6: `tools/rpg.ts` — inventory + equip

**Files:** Modify `tools/rpg.ts`; Test `test/tools/rpg.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `test/tools/rpg.test.ts`:
```ts
import { rollDrop, LOOT_TABLE, LootKind } from "../../core/loot";
import { writeFileSync as writeFile } from "fs";

// a zero-weight config so a session_end is the only trigger (one deterministic clean drop)
function seedOneClean(home: string) {
  writeFile(join(home, "config.json"), JSON.stringify({
    xp: { weights: { prompt: 0, turn_end: 0, session_end: 0,
      actions: { edit: 0, write: 0, run: 0, read: 0, search: 0, delegate: 0, other: 0 } } },
  }));
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"session_end","repo":"cq"}\n`);
}

test("inventory lists owned items after a clean session", async () => {
  const home = makeHome(); seedOneClean(home);
  const r = await rpg(home, "inventory");
  expect(r.code).toBe(0);
  expect(r.stdout).not.toContain("empty");
});

test("equipping an owned item succeeds; an unowned one errors", async () => {
  const home = makeHome(); seedOneClean(home);
  const droppedId = rollDrop({ table: "clean", seed: "clean:s" })!;
  const kind = LOOT_TABLE[droppedId].kind;
  if (kind !== LootKind.Skin) {
    const ok = await rpg(home, kind, droppedId);
    expect(ok.code).toBe(0);
  }
  const unowned = Object.keys(LOOT_TABLE).find(
    id => id !== droppedId && LOOT_TABLE[id].kind === LootKind.Title,
  )!;
  const bad = await rpg(home, "title", unowned);
  expect(bad.code).toBe(1);
});
```

- [ ] **Step 2: Run — expect FAIL** (no `inventory`/`title`/`theme` commands).

- [ ] **Step 3: Update `tools/rpg.ts`**

Add imports:
```ts
import { loadConfig } from "../core/config";
import { LOOT_TABLE, LootKind } from "../core/loot";
```
Add helpers + commands. After the `status` function, add:
```ts
function lootTable() {
  return loadConfig(HOME).loot ?? LOOT_TABLE;
}

function inventory(): string {
  const inv = reduceToFile(HOME).inventory ?? [];
  if (inv.length === 0) {
    return "Inventory empty.";
  }
  const table = lootTable();
  return inv
    .map(i => `${i.rarity.padEnd(9)} ${table[i.id]?.name ?? i.id}  ×${i.count}`)
    .join("\n");
}

function equip(profile: IProfile, kind: LootKind, id: string): string {
  const item = lootTable()[id];
  if (!item || item.kind !== kind) {
    fail(`Unknown ${kind} "${id}".`);
  }
  const owned = new Set((reduceToFile(HOME).inventory ?? []).map(i => i.id));
  if (!owned.has(id)) {
    fail(`You don't own "${id}".`);
  }
  if (kind === LootKind.Title) {
    profile.title = id;
  } else {
    profile.theme = id;
  }
  persist(profile);
  return `Equipped ${kind}: ${item.name}.`;
}
```
Add the cases to the `main` switch (before `default`):
```ts
    case "inventory":
      out = inventory();
      break;
    case "title":
      out = equip(profile, LootKind.Title, args[0] ?? "");
      break;
    case "theme":
      out = equip(profile, LootKind.Theme, args[0] ?? "");
      break;
```
and update the usage string in `default`:
```ts
    default:
      fail("Usage: rpg <name|class|branch|respec|status|inventory|title|theme> …");
```

- [ ] **Step 4: Run — expect PASS** (`bun test test/tools/rpg.test.ts`).

- [ ] **Step 5: Commit**
```bash
bun run format
git add tools/rpg.ts test/tools/rpg.test.ts
git commit -m "feat(tools): rpg inventory + equip (title/theme)"
```

---

## Task 7: full suite + tsc + format + integration

**Files:** Test `test/integration/loot.test.ts`

- [ ] **Step 1: Write an end-to-end test**

Create `test/integration/loot.test.ts`:
```ts
import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { renderHud } from "../../hud/statusline";
import { LOOT_TABLE } from "../../core/loot";
import { makeHome } from "../helpers";

test("clean sessions produce an inventory; equipping resolves into the HUD", () => {
  const cfg = loadConfig(makeHome());
  const events = [
    { ts: "2026-06-11T12:00:00Z", source: "claude-code", session_id: "s1", type: "action", action: "edit", repo: "cq" },
    { ts: "2026-06-11T12:01:00Z", source: "claude-code", session_id: "s1", type: "session_end", repo: "cq" },
  ] as any;

  const base = reduce(events, cfg, "2026-06-11");
  expect((base.inventory ?? []).length).toBeGreaterThan(0);

  // equip the first owned item if it's a title, and confirm the HUD shows it
  const owned = base.inventory!.find(i => LOOT_TABLE[i.id].kind === "title");
  if (owned) {
    const equipped = reduce(events, cfg, "2026-06-11", { title: owned.id });
    const line = renderHud(equipped, { model: "M", cost: 0, ctx: 0 });
    expect(line).toContain(`the ${LOOT_TABLE[owned.id].name}`);
  }
});
```

- [ ] **Step 2: Run the full suite** — `bun test` — all PASS.
- [ ] **Step 3: Type-check + format** — `bunx tsc --noEmit && bun run format:check` — clean.
- [ ] **Step 4: Commit**
```bash
bun run format
git add test/integration/loot.test.ts
git commit -m "test: loot end-to-end (drop -> equip -> HUD)"
```

---

## Task 8: Deploy + verify (manual)

- [ ] **Step 1: Redeploy** — `tools/install.sh --link`.
- [ ] **Step 2: See loot** — `bun ~/.agentrpg/tools/rpg.ts inventory` (your real clean sessions / level-ups / streak should have dropped items).
- [ ] **Step 3: Equip** — `bun ~/.agentrpg/tools/rpg.ts title <id>` and `… theme <id>` (use an owned id); a new Claude Code session shows `{name} the {title}` and a colored XP bar.
- [ ] **Step 4: Layout** — if your CC sets `COLUMNS` (v2.1.153+), the CC monitor (model/cost/ctx/5h/7d) hugs the right edge; otherwise it stays after ` | `.
- [ ] **Step 5: Finish the branch** — superpowers:finishing-a-development-branch to PR/merge `feat/phase2c1-loot`.

---

## Self-Review notes (already applied)

- **Spec coverage:** seeded RNG L1/§3 (Task 1); loot table + roll + resolve §4 (Task 2); state/profile/config §6/§9 (Task 3); triggers + inventory + cosmetics §5 (Task 4); HUD left/right + theme/title/bag + rate limits L6/§7 (Task 5); CLI §8 (Task 6); DoD §11 (Tasks 7–8); out-of-scope respected (no buffs/skin-equip/test-PR triggers/secret).
- **No placeholders:** every code step is complete; the rpg equip test computes the deterministic drop to stay reliable.
- **Type/name consistency:** `Rarity`/`LootKind`/`ILootItem`/`IInventoryItem`/`ICosmetics`/`ITrigger`, `hashStr`/`seededRng`, `rollDrop`/`rollInventory`/`resolveCosmetics`, `IConfig.loot`/`drops`, `renderHud(state, tail, cols?)`, `ITail.five_hour`/`seven_day` — consistent. Novice/no-cosmetics/`cols = 0` keeps the HUD byte-identical, so existing exact-match tests pass.
```

