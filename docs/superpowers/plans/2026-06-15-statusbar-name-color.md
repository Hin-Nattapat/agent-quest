# statusBar Name Color + Theme Palette Refresh — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a droppable `name_color` cosmetic that tints the character name + title in the statusline HUD (equipped with `rpg namecolor`), and refresh the six theme (exp-bar) colors to a deliberate 24-bit palette.

**Architecture:** A new `LootKind.NameColor` mirrors the existing `theme` cosmetic exactly — items carry an ANSI SGR `value`, the reducer denormalizes the equipped color into `state.cosmetics.name_color`, and `hud/statusline.ts` wraps `name + title` in it. The seam is unchanged: `hud/` reads resolved ANSI, never loot logic. statusBar only — the companion app is not recolored.

**Tech Stack:** Bun + TypeScript, `bun test`, bash/jq hooks unaffected. ANSI truecolor (`38;2;R;G;B`).

**Spec:** `docs/superpowers/specs/2026-06-15-statusbar-name-color-design.md`

---

## Context for the implementer

- All loot is cosmetic and equip-once. `core/loot.ts` holds: `LootKind` enum (`Title`/`Theme`/`Skin`), `LOOT_TABLE` (id → `ILootItem{ id, name, rarity, kind, value? }`), `OWN_ONCE_KINDS` (caps duplicate drops at count 1 in `rollInventory`), `rollDrop` (excludes `Skin` from the pool), `ICosmetics{ title, theme_color }`, and `resolveCosmetics` (resolves the equipped title/theme into `ICosmetics`).
- `core/reduce.ts` already calls `resolveCosmetics({ profile: profile ?? {}, … })` with the **whole** profile, so a new `profile.name_color` flows through with **no reduce.ts change** once the types include it.
- `hud/statusline.ts` builds the `left` group as plain text; `theme_color` currently wraps only the xp bar. `displayWidth` (line 18) strips `\x1b[[0-9;]*m`, so any ANSI (including `38;2;…m`) is invisible to layout math.
- `tools/rpg.ts` has a generic `equip({ profile, kind, id })` (Title takes a special path; the else-branch currently hard-codes `profile.theme = id`).
- Tests are pure-function `bun test` (no DOM). Read results with `bun test 2>&1 | grep -E "pass|fail"` — never `tail`.
- Run formatting with `bun run format` before each commit; CI runs `format:check`.

---

## Task 1: Name-color kind + cosmetic resolution

**Files:**
- Modify: `core/loot.ts` (enum, `ICosmetics`, `IResolveCosmeticsArgs`, `resolveCosmetics`, `OWN_ONCE_KINDS`)
- Modify: `core/profile.ts` (`IProfile`)
- Test: `test/core/loot.test.ts`

- [ ] **Step 1: Write the failing test** — append to `test/core/loot.test.ts` (it already imports `resolveCosmetics`, `LootKind`, `Rarity`):

```ts
test("resolveCosmetics resolves an owned name-color via its value; null otherwise", () => {
  const table = {
    azure_ink: {
      id: "azure_ink",
      name: "Azure",
      rarity: Rarity.Rare,
      kind: LootKind.NameColor,
      value: "38;2;61;155;255",
    },
    rookie_title: {
      id: "rookie_title",
      name: "Rookie",
      rarity: Rarity.Common,
      kind: LootKind.Title,
    },
  } as Record<string, import("../../core/loot").ILootItem>;

  const inv = [{ id: "azure_ink", rarity: Rarity.Rare, count: 1 }];
  expect(
    resolveCosmetics({ profile: { name_color: "azure_ink" }, inventory: inv, lootTable: table })
      .name_color,
  ).toBe("38;2;61;155;255");
  expect(
    resolveCosmetics({ profile: { name_color: "plasma_ink" }, inventory: inv, lootTable: table })
      .name_color,
  ).toBe(null); // not owned

  const inv2 = [{ id: "rookie_title", rarity: Rarity.Common, count: 1 }];
  expect(
    resolveCosmetics({ profile: { name_color: "rookie_title" }, inventory: inv2, lootTable: table })
      .name_color,
  ).toBe(null); // wrong kind
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/loot.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `name_color` is not on `ICosmetics`/not resolved (returns `undefined`, not the value).

- [ ] **Step 3: Add the `NameColor` kind** — in `core/loot.ts`, change:

```ts
export enum LootKind {
  Title = "title",
  Theme = "theme",
  Skin = "skin",
}
```
to:
```ts
export enum LootKind {
  Title = "title",
  Theme = "theme",
  Skin = "skin",
  NameColor = "name_color",
}
```

- [ ] **Step 4: Add `name_color` to `ICosmetics`** — change:

```ts
export interface ICosmetics {
  title: string | null;
  theme_color: string | null;
}
```
to:
```ts
export interface ICosmetics {
  title: string | null;
  theme_color: string | null;
  name_color: string | null;
}
```

- [ ] **Step 5: Add `NameColor` to `OWN_ONCE_KINDS`** — change the set (around line 246):

```ts
const OWN_ONCE_KINDS: ReadonlySet<LootKind> = new Set([
  LootKind.Title,
  LootKind.Theme,
  LootKind.Skin,
]);
```
to:
```ts
const OWN_ONCE_KINDS: ReadonlySet<LootKind> = new Set([
  LootKind.Title,
  LootKind.Theme,
  LootKind.Skin,
  LootKind.NameColor,
]);
```

- [ ] **Step 6: Extend `IResolveCosmeticsArgs.profile` and `resolveCosmetics`** — change:

```ts
interface IResolveCosmeticsArgs {
  profile: { title?: string; theme?: string };
  inventory: IInventoryItem[];
  earnedTitles?: Record<string, string>;
  lootTable?: Record<string, ILootItem>;
}
```
to add `name_color?`:
```ts
interface IResolveCosmeticsArgs {
  profile: { title?: string; theme?: string; name_color?: string };
  inventory: IInventoryItem[];
  earnedTitles?: Record<string, string>;
  lootTable?: Record<string, ILootItem>;
}
```
and in `resolveCosmetics`, change the return block from:
```ts
  const themeItem =
    profile.theme && owned.has(profile.theme) ? lootTable[profile.theme] : null;
  return {
    title: lootTitle ?? earnedTitle,
    theme_color: themeItem?.kind === LootKind.Theme ? (themeItem.value ?? null) : null,
  };
```
to:
```ts
  const themeItem =
    profile.theme && owned.has(profile.theme) ? lootTable[profile.theme] : null;
  const nameItem =
    profile.name_color && owned.has(profile.name_color) ? lootTable[profile.name_color] : null;
  return {
    title: lootTitle ?? earnedTitle,
    theme_color: themeItem?.kind === LootKind.Theme ? (themeItem.value ?? null) : null,
    name_color: nameItem?.kind === LootKind.NameColor ? (nameItem.value ?? null) : null,
  };
```

- [ ] **Step 7: Add `name_color` to `IProfile`** — in `core/profile.ts`, change:

```ts
export interface IProfile {
  name?: string;
  line?: TLine;
  branch?: "a" | "b";
  title?: string;
  theme?: string;
  xyzzy?: boolean;
}
```
to add `name_color?` after `theme`:
```ts
export interface IProfile {
  name?: string;
  line?: TLine;
  branch?: "a" | "b";
  title?: string;
  theme?: string;
  name_color?: string;
  xyzzy?: boolean;
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `bun test test/core/loot.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail.

- [ ] **Step 9: Format + commit**

```bash
bun run format
git add core/loot.ts core/profile.ts test/core/loot.test.ts
git commit -m "feat(core): name-color cosmetic kind + resolution"
```

---

## Task 2: The name-ink catalog + theme color refresh

**Files:**
- Modify: `core/loot.ts` (`LOOT_TABLE` — add 6 name-inks, refresh 6 theme `value`s)
- Test: `test/core/loot.test.ts`

- [ ] **Step 1: Write the failing test** — append to `test/core/loot.test.ts`:

```ts
test("name-inks exist as own-once NameColor items with truecolor values", () => {
  expect(LOOT_TABLE.plasma_ink.kind).toBe(LootKind.NameColor);
  expect(LOOT_TABLE.plasma_ink.rarity).toBe(Rarity.Legendary);
  expect(LOOT_TABLE.azure_ink.value).toBe("38;2;61;155;255");

  // a repeated name-color drop caps at count 1 (own-once), proved via a single-item table
  const oneInk = { azure_ink: LOOT_TABLE.azure_ink };
  const drops = { clean: [{ rarity: Rarity.Rare, weight: 1 }] };
  const inv = rollInventory({
    triggers: [
      { table: "clean", seed: "x" },
      { table: "clean", seed: "x" },
    ],
    lootTable: oneInk,
    dropTables: drops,
  });
  expect(inv).toEqual([{ id: "azure_ink", rarity: Rarity.Rare, count: 1 }]);
});

test("themes use refreshed truecolor values (no two the same)", () => {
  const themeVals = Object.values(LOOT_TABLE)
    .filter(i => i.kind === LootKind.Theme)
    .map(i => i.value);
  expect(LOOT_TABLE.golden_theme.value).toBe("38;2;255;205;20");
  expect(LOOT_TABLE.sunset_theme.value).toBe("38;2;255;106;30");
  expect(new Set(themeVals).size).toBe(themeVals.length); // all distinct (Sunset/Golden no longer share)
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/core/loot.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — `LOOT_TABLE.plasma_ink`/`azure_ink` are undefined and `golden_theme.value` is still `"33"`.

- [ ] **Step 3: Refresh the six theme `value`s** — in `core/loot.ts` `LOOT_TABLE`, change each theme item's `value` line:

| item | old `value:` | new `value:` |
|---|---|---|
| `forest_theme` | `"32"` | `"38;2;46;204;78"` |
| `ocean_theme` | `"34"` | `"38;2;40;130;255"` |
| `neon_theme` | `"36"` | `"38;2;0;224;208"` |
| `matrix_theme` | `"92"` | `"38;2;180;255;26"` |
| `sunset_theme` | `"33"` | `"38;2;255;106;30"` |
| `golden_theme` | `"33"` | `"38;2;255;205;20"` |

(Edit only the `value:` line inside each named block; leave id/name/rarity/kind unchanged.)

- [ ] **Step 4: Add the six name-ink items** — in `core/loot.ts`, insert these entries inside the `LOOT_TABLE` object, immediately before its closing `};` (the line before `export type TDropTable`):

```ts
  mist_ink: {
    id: "mist_ink",
    name: "Mist",
    rarity: Rarity.Common,
    kind: LootKind.NameColor,
    value: "38;2;159;180;201",
  },
  azure_ink: {
    id: "azure_ink",
    name: "Azure",
    rarity: Rarity.Rare,
    kind: LootKind.NameColor,
    value: "38;2;61;155;255",
  },
  jade_ink: {
    id: "jade_ink",
    name: "Jade",
    rarity: Rarity.Rare,
    kind: LootKind.NameColor,
    value: "38;2;47;194;138",
  },
  royal_ink: {
    id: "royal_ink",
    name: "Royal",
    rarity: Rarity.Epic,
    kind: LootKind.NameColor,
    value: "38;2;138;92;255",
  },
  ruby_ink: {
    id: "ruby_ink",
    name: "Ruby",
    rarity: Rarity.Epic,
    kind: LootKind.NameColor,
    value: "38;2;236;59;90",
  },
  plasma_ink: {
    id: "plasma_ink",
    name: "Plasma",
    rarity: Rarity.Legendary,
    kind: LootKind.NameColor,
    value: "1;38;2;255;54;255",
  },
```

- [ ] **Step 5: Run to verify it passes**

Run: `bun test test/core/loot.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail.

- [ ] **Step 6: Format + commit**

```bash
bun run format
git add core/loot.ts test/core/loot.test.ts
git commit -m "feat(core): name-ink catalog + deliberate truecolor theme refresh"
```

---

## Task 3: Color the name + title in the statusline

**Files:**
- Modify: `hud/statusline.ts`
- Test: `test/hud/statusline.test.ts`

- [ ] **Step 1: Write the failing test** — append to `test/hud/statusline.test.ts` (it imports `renderHud`, `ITail`):

```ts
test("name + title are wrapped in the name-color ANSI when equipped", () => {
  const tail: ITail = { model: "M", cost: 0, ctx: 0 };
  const tinted = state({
    name: "Calypso",
    cosmetics: { title: "Archmage", theme_color: null, name_color: "1;38;2;255;54;255" },
  });
  const out = renderHud({ state: tinted, tail });
  expect(out).toContain("\x1b[1;38;2;255;54;255mCalypso the Archmage\x1b[0m");

  const plain = state({
    name: "Calypso",
    cosmetics: { title: "Archmage", theme_color: null, name_color: null },
  });
  const plainOut = renderHud({ state: plain, tail });
  expect(plainOut).toContain("Calypso the Archmage");
  expect(plainOut).not.toContain("\x1b[1;38;2"); // no stray ANSI on the name
});
```

> Uses the file's existing `state(o: Partial<IState>)` fixture helper (top of `test/hud/statusline.test.ts`). `cosmetics` requires all three fields after Task 1 adds `name_color` to `ICosmetics`.

- [ ] **Step 2: Run to verify it fails**

Run: `bun test test/hud/statusline.test.ts 2>&1 | grep -E "pass|fail"`
Expected: FAIL — the name is rendered plain, so the wrapped ANSI substring is absent.

- [ ] **Step 3: Wrap the name plate** — in `hud/statusline.ts` `renderHud`, change:

```ts
  const name = state.name || "Adventurer";
  const titleSuffix = state.cosmetics?.title ? ` the ${state.cosmetics.title}` : "";
```
to add the color wrap:
```ts
  const name = state.name || "Adventurer";
  const titleSuffix = state.cosmetics?.title ? ` the ${state.cosmetics.title}` : "";
  const nameColor = state.cosmetics?.name_color;
  const namePlate = `${name}${titleSuffix}`;
  const coloredName = nameColor ? `\x1b[${nameColor}m${namePlate}\x1b[0m` : namePlate;
```
and change the `left` assignment from:
```ts
  const left =
    `${name}${titleSuffix} · ${label}${pending}  ` +
    `Lv.${state.level} ${coloredBar}${maxed} ${Math.round(pct * 100)}%${fire}${bag}`;
```
to:
```ts
  const left =
    `${coloredName} · ${label}${pending}  ` +
    `Lv.${state.level} ${coloredBar}${maxed} ${Math.round(pct * 100)}%${fire}${bag}`;
```

- [ ] **Step 4: Run to verify it passes**

Run: `bun test test/hud/statusline.test.ts 2>&1 | grep -E "pass|fail"`
Expected: PASS, 0 fail (existing tests unaffected — they have no `name_color`, so the name stays plain).

- [ ] **Step 5: Format + commit**

```bash
bun run format
git add hud/statusline.ts test/hud/statusline.test.ts
git commit -m "feat(hud): tint name + title with the equipped name-color"
```

---

## Task 4: Equip name colors from the rpg CLI

**Files:**
- Modify: `tools/rpg.ts`

- [ ] **Step 1: Generalize `equip` to set the right profile field** — in `tools/rpg.ts`, change the tail of `equip` from:

```ts
  const owned = new Set((reduceToFile(HOME).inventory ?? []).map(i => i.id));
  if (!owned.has(id)) {
    fail(`You don't own "${id}".`);
  }
  profile.theme = id;
  persist(profile);
  return `Equipped ${kind}: ${item.name}.`;
};
```
to:
```ts
  const owned = new Set((reduceToFile(HOME).inventory ?? []).map(i => i.id));
  if (!owned.has(id)) {
    fail(`You don't own "${id}".`);
  }
  if (kind === LootKind.NameColor) {
    profile.name_color = id;
  } else {
    profile.theme = id;
  }
  persist(profile);
  return `Equipped ${kind}: ${item.name}.`;
};
```

- [ ] **Step 2: Add a `nameColors` listing helper** — in `tools/rpg.ts`, add this after the `titles` function (around line 118):

```ts
const nameColors = (): string => {
  const table = lootTable();
  const owned = (reduceToFile(HOME).inventory ?? []).filter(
    i => table[i.id]?.kind === LootKind.NameColor,
  );
  if (owned.length === 0) {
    return "No name colors yet.";
  }
  return owned.map(i => `${i.id}  —  ${table[i.id].name}`).join("\n");
};
```

- [ ] **Step 3: Wire the `namecolor` / `namecolors` commands** — in the `main` switch, add these cases after the `theme` case:

```ts
    case "namecolor":
      out = equip({ profile, kind: LootKind.NameColor, id: args[0] ?? "" });
      break;
    case "namecolors":
      out = nameColors();
      break;
```
and update the usage `fail(...)` string from:
```ts
        "Usage: rpg <name|class|branch|respec|status|inventory|title|theme|titles|secrets|xyzzy> …",
```
to:
```ts
        "Usage: rpg <name|class|branch|respec|status|inventory|title|theme|namecolor|titles|namecolors|secrets|xyzzy> …",
```

- [ ] **Step 4: Verify the CLI end-to-end**

Run: `bun tools/rpg.ts 2>&1 | grep -o namecolor | head -1`
Expected: prints `namecolor` (the usage line now lists it).

Run: `bun tools/rpg.ts namecolor not_a_real_id 2>&1`
Expected: fails with `Unknown name_color "not_a_real_id".` (validate-then-mutate rejects unknown ids; no profile write).

- [ ] **Step 5: Commit**

```bash
git add tools/rpg.ts
git commit -m "feat(tools): rpg namecolor equip + namecolors list"
```

---

## Task 5: Show name-color items in the app Items panel (display only)

**Files:**
- Modify: `app/src/components/items-panel.tsx`

- [ ] **Step 1: Add a name-color icon** — in `app/src/components/items-panel.tsx`, change:

```ts
const KIND_ICON: Record<string, string> = { title: "👑", theme: "🎨", skin: "👕" };
```
to:
```ts
const KIND_ICON: Record<string, string> = {
  title: "👑",
  theme: "🎨",
  skin: "👕",
  name_color: "✒️",
};
```

(No change to `equipKindOf` — it returns `null` for `name_color`, so the panel shows the item with its ✒️ icon and **no** Equip button. Name-color equipping stays CLI-only this iteration, per the spec.)

- [ ] **Step 2: Typecheck the app**

Run: `cd app && bun run typecheck 2>&1 | tail -2`
Expected: no errors (`$ tsc --noEmit` with no diagnostics).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/items-panel.tsx
git commit -m "feat(app): show name-color loot with an ink icon (no equip path)"
```

---

## Final verification

- [ ] **Full suite + formatting + typecheck**

```bash
bun test 2>&1 | grep -E "pass|fail"          # all green, 0 fail
bun run format:check 2>&1 | tail -2          # Prettier clean
cd app && bun run typecheck 2>&1 | tail -2   # app tsc clean
```

- [ ] **Rebuild the companion** (so the new ✒️ icon ships in the webview):

```bash
cd app/extension && npm run reinstall 2>&1 | grep -E "DONE|successfully"
```

- [ ] **Manual smoke (real terminal):** with a name-ink owned, `rpg namecolor plasma_ink`, then trigger a statusline render — the name + title appear in bold neon magenta while the xp bar uses its own (refreshed) theme color.

---

## Self-Review

**Spec coverage:**
- `LootKind.NameColor` + items + drop normally (own-once, not skin-excluded) → Task 1 (kind, OWN_ONCE) + Task 2 (items; drop pool already excludes only Skin). ✅
- Theme truecolor refresh + fix Sunset/Golden duplicate → Task 2 step 3 + the "no two the same" test. ✅
- `name_color` in `ICosmetics` + `resolveCosmetics` + `IProfile`; reduce.ts untouched → Task 1. ✅
- statusline wraps name+title; layout unaffected → Task 3 (`displayWidth` strips ANSI). ✅
- `rpg namecolor` / `namecolors`; `equip` sets `profile.name_color` → Task 4. ✅
- App shows items, no equip button → Task 5. ✅
- Scope: statusBar only, no app coloring, no migration → honored (no app render change, theme ids/names unchanged). ✅

**Placeholder scan:** none — every step has concrete code/commands. The one soft note (Task 3 `zeroState()`) explicitly points at reusing the file's existing fixture shape rather than inventing an export.

**Type consistency:** `name_color` is `string | null` on `ICosmetics` (matches `theme_color`) and `string | undefined` (`name_color?`) on `IProfile` and `IResolveCosmeticsArgs.profile`. Ids (`mist_ink`/`azure_ink`/`jade_ink`/`royal_ink`/`ruby_ink`/`plasma_ink`) and their `value`s are identical across the catalog (Task 2), the resolution test (Task 1), and the statusline test (Task 3 uses `1;38;2;255;54;255` = `plasma_ink`). `LootKind.NameColor = "name_color"` matches the `KIND_ICON` key and the app `kind` string.
