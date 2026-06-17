# Art Import Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A CLI dev-tool (`bun tools/import-art.ts <raw> --as <type>:<args> [--rm]`) that lays out raw PixelLab exports into the codebase's `app/public/` structure for heroes, backgrounds, and items.

**Architecture:** One TypeScript file under `tools/` (run by bun, fs-only, no new deps). Pure helpers (`parseTarget`/`frameIndex`/`pickAnimDir`) are unit-tested; per-type extractors (`importHero`/`importBg`/`importItem`) do `fs` copies and are proven by re-importing the committed Mage assets and asserting an empty diff. A `TYPES` registry keyed by an `AssetType` enum makes adding `monster`/`boss` later a one-function change.

**Tech Stack:** Bun + TypeScript; `node:fs`/`node:path`; `bun test`.

**Spec:** `docs/superpowers/specs/2026-06-17-art-import-pipeline-design.md`

**Branch:** `feat/art-import` (stacked on `feat/mage-all-tiers` / PR #43 — needed for the Task 6 Mage diff).

**Conventions (CLAUDE.md):** arrow-const only (no `function` declarations); `interface I*` / `type T*`; **string enums** (not bare unions); no `any`; braces on every `if`/`else`; no multi-line/nested ternaries; kebab-case files; comments explain WHY; Prettier owns formatting (`bun run format`). The file is `.ts` (not `.mjs`) to match `tools/rpg.ts` and the conventions, run via `bun tools/import-art.ts`.

**Test location:** `test/tools/import-art.test.ts` (root `bun test` discovers `test/**`). Run: `bun test test/tools/import-art.test.ts 2>&1 | grep -E "pass|fail"`.

**Note on `import.meta`:** bun provides `import.meta.dir` (the file's directory) and `import.meta.main` (true when this file is the entry point). Both are used.

---

## File Structure

- `tools/import-art.ts` — the whole importer: `AssetType` enum, `ITarget`, pure helpers, three extractors, `TYPES` registry, `run(argv)`, and a `import.meta.main` guard. Single focused file (~150 lines).
- `test/tools/import-art.test.ts` — unit tests for the pure helpers.
- `docs/reference/art-import.md` — usage + gen convention + "Adding a type".

The importer grows by tasks: Task 1 creates it with helpers only; Tasks 2-4 append extractors + the runner. Each task shows the full new code to append (no "TODO").

---

## Task 1: Pure helpers + types

**Files:**
- Create: `tools/import-art.ts`
- Create: `test/tools/import-art.test.ts`

- [ ] **Step 1: Write the failing test** — `test/tools/import-art.test.ts`:

```ts
import { test, expect } from "bun:test";
import { AssetType, parseTarget, frameIndex, pickAnimDir } from "../../tools/import-art";

test("parseTarget reads hero line+tier and bg/item name", () => {
  expect(parseTarget("hero:mage:t4a")).toEqual({ type: AssetType.Hero, line: "mage", tier: "t4a" });
  expect(parseTarget("bg:grassland")).toEqual({ type: AssetType.Bg, name: "grassland" });
  expect(parseTarget("item:trophy")).toEqual({ type: AssetType.Item, name: "trophy" });
});

test("parseTarget rejects unknown type and wrong arg count", () => {
  expect(() => parseTarget("wizard:mage:t1")).toThrow(/unknown asset type/);
  expect(() => parseTarget("hero:mage")).toThrow(/hero needs/);
  expect(() => parseTarget("bg:a:b")).toThrow(/bg needs/);
});

test("frameIndex strips PixelLab zero-padding", () => {
  expect(frameIndex("frame_000.png")).toBe("0");
  expect(frameIndex("frame_007.png")).toBe("7");
  expect(frameIndex("frame_012.png")).toBe("12");
  expect(() => frameIndex(".DS_Store")).toThrow(/frame file/);
});

test("pickAnimDir matches PixelLab's inconsistent folder names", () => {
  const names = ["walking_forward", "casting_a_spell_swinging_the_staff_up_then_thrusti"];
  expect(pickAnimDir(names, "alking")).toBe("walking_forward");
  expect(pickAnimDir(names, "asting")).toBe("casting_a_spell_swinging_the_staff_up_then_thrusti");
  expect(pickAnimDir(["Casting_a_spell"], "asting")).toBe("Casting_a_spell");
  expect(pickAnimDir(names, "rotations")).toBeNull();
});
```

- [ ] **Step 2: Run — expect FAIL** (`cannot find module ../../tools/import-art`):

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun test test/tools/import-art.test.ts 2>&1 | grep -E "pass|fail|error"`

- [ ] **Step 3: Create `tools/import-art.ts` with the types + helpers**

```ts
import {
  readdirSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

export enum AssetType {
  Hero = "hero",
  Bg = "bg",
  Item = "item",
  Monster = "monster",
  Boss = "boss",
}

export interface ITarget {
  type: AssetType;
  line?: string;
  tier?: string;
  name?: string;
}

// `--as hero:<line>:<tier>` or `--as bg:<name>` / `item:<name>` (and monster/boss, name-shaped).
export const parseTarget = (asArg: string): ITarget => {
  const parts = asArg.split(":");
  const type = parts[0] as AssetType;
  if (!Object.values(AssetType).includes(type)) {
    throw new Error(
      `unknown asset type "${parts[0]}" (expected ${Object.values(AssetType).join("|")})`,
    );
  }
  if (type === AssetType.Hero) {
    if (parts.length !== 3) {
      throw new Error(`hero needs --as hero:<line>:<tier> (got "${asArg}")`);
    }
    return { type, line: parts[1], tier: parts[2] };
  }
  if (parts.length !== 2) {
    throw new Error(`${type} needs --as ${type}:<name> (got "${asArg}")`);
  }
  return { type, name: parts[1] };
};

// "frame_007.png" -> "7" (PixelLab zero-pads; our layout uses bare indices).
export const frameIndex = (file: string): string => {
  const match = file.match(/frame_(\d+)\.png$/);
  if (!match) {
    throw new Error(`not a PixelLab frame file: ${file}`);
  }
  return String(Number(match[1]));
};

// PixelLab names animation folders inconsistently (case + the full Action Description), so match
// by substring instead of an exact name. Returns the folder name or null if none contains needle.
export const pickAnimDir = (names: string[], needle: string): string | null => {
  const lower = needle.toLowerCase();
  const found = names.find((name) => name.toLowerCase().includes(lower));
  return found ?? null;
};
```

- [ ] **Step 4: Run — expect 4 pass**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun test test/tools/import-art.test.ts 2>&1 | grep -E "pass|fail"`

- [ ] **Step 5: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add tools/import-art.ts test/tools/import-art.test.ts
git commit -m "feat(tools): art-import target parsing + frame/anim helpers"
```

---

## Task 2: Hero extractor

**Files:**
- Modify: `tools/import-art.ts` (append constants + `importHero`)

No unit test (fs copy; proven by the Task 6 Mage diff).

- [ ] **Step 1: Append the public-dir constants + `importHero` to `tools/import-art.ts`** (after `pickAnimDir`):

```ts
// import-art.ts lives in tools/, so the repo root is one level up; assets go under app/public.
const PUBLIC = join(import.meta.dir, "..", "app", "public");
const CARDINALS = ["south", "north", "east", "west"];

const pngs = (dir: string): string[] => readdirSync(dir).filter((f) => f.endsWith(".png"));

// PixelLab character export -> sprites/<line>/<tier>/{idle/<dir>, walk/<dir>/N, cast/N (east)}.
const importHero = (rawDir: string, target: ITarget): void => {
  const out = join(PUBLIC, "sprites", target.line ?? "", target.tier ?? "");
  const animDir = join(rawDir, "animations");
  if (!existsSync(join(rawDir, "rotations")) || !existsSync(animDir)) {
    throw new Error(`hero export missing rotations/ or animations/ in ${rawDir}`);
  }
  const animNames = readdirSync(animDir);
  const walk = pickAnimDir(animNames, "alking");
  if (!walk) {
    throw new Error(`hero export has no walking animation in ${animDir}`);
  }
  const cast = pickAnimDir(animNames, "asting");

  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "idle"), { recursive: true });
  for (const dir of CARDINALS) {
    copyFileSync(join(rawDir, "rotations", `${dir}.png`), join(out, "idle", `${dir}.png`));
    const srcWalk = join(animDir, walk, dir);
    mkdirSync(join(out, "walk", dir), { recursive: true });
    for (const f of pngs(srcWalk)) {
      copyFileSync(join(srcWalk, f), join(out, "walk", dir, `${frameIndex(f)}.png`));
    }
  }
  if (cast) {
    const srcCast = join(animDir, cast, "east");
    mkdirSync(join(out, "cast"), { recursive: true });
    for (const f of pngs(srcCast)) {
      copyFileSync(join(srcCast, f), join(out, "cast", `${frameIndex(f)}.png`));
    }
  } else {
    console.warn("  (no casting animation found — skipping cast/)");
  }
  console.log(`hero ${target.line}/${target.tier} -> ${out}`);
};
```

- [ ] **Step 2: Typecheck the file compiles** (bun parses on run; do a no-op import check):

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun -e 'import("./tools/import-art.ts").then(() => console.log("ok"))'`
Expected: prints `ok` (module loads with no syntax/type error).

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add tools/import-art.ts
git commit -m "feat(tools): hero extractor (rotations + walk + cast)"
```

---

## Task 3: Background + item extractors

**Files:**
- Modify: `tools/import-art.ts` (append `oneSourcePng` + `importBg` + `importItem`)

- [ ] **Step 1: Append to `tools/import-art.ts`** (after `importHero`):

```ts
// A bg/item source is either a single .png file or a folder containing exactly one .png.
const oneSourcePng = (raw: string): string => {
  if (statSync(raw).isFile()) {
    if (!raw.endsWith(".png")) {
      throw new Error(`expected a .png file: ${raw}`);
    }
    return raw;
  }
  const found = pngs(raw);
  if (found.length !== 1) {
    throw new Error(`expected exactly one .png in ${raw}, found ${found.length}`);
  }
  return join(raw, found[0]);
};

const importSingle = (raw: string, target: ITarget, subdir: string): void => {
  const out = join(PUBLIC, subdir);
  mkdirSync(out, { recursive: true });
  const dest = join(out, `${target.name ?? ""}.png`);
  copyFileSync(oneSourcePng(raw), dest);
  console.log(`${target.type} -> ${dest}`);
};

const importBg = (raw: string, target: ITarget): void => importSingle(raw, target, "scenes");
const importItem = (raw: string, target: ITarget): void => importSingle(raw, target, "items");
```

- [ ] **Step 2: Verify it loads**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun -e 'import("./tools/import-art.ts").then(() => console.log("ok"))'`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add tools/import-art.ts
git commit -m "feat(tools): bg + item single-image extractors"
```

---

## Task 4: Registry + CLI runner

**Files:**
- Modify: `tools/import-art.ts` (append `notImplemented`, `TYPES`, `run`, the `import.meta.main` guard)

- [ ] **Step 1: Append to `tools/import-art.ts`** (at the end):

```ts
const notImplemented = (name: string) => (): void => {
  throw new Error(
    `${name} import not implemented yet — see docs/reference/art-import.md (Adding a type)`,
  );
};

const TYPES: Record<AssetType, (raw: string, target: ITarget) => void> = {
  [AssetType.Hero]: importHero,
  [AssetType.Bg]: importBg,
  [AssetType.Item]: importItem,
  [AssetType.Monster]: notImplemented("monster"),
  [AssetType.Boss]: notImplemented("boss"),
};

const USAGE = "usage: bun tools/import-art.ts <raw-folder> --as <type>:<args> [--rm]";

export const run = (argv: string[]): void => {
  const raw = argv[0];
  const asIdx = argv.indexOf("--as");
  const asArg = asIdx >= 0 ? argv[asIdx + 1] : undefined;
  if (!raw || raw.startsWith("--") || !asArg) {
    throw new Error(USAGE);
  }
  if (!existsSync(raw)) {
    throw new Error(`raw path not found: ${raw}`);
  }
  const target = parseTarget(asArg);
  TYPES[target.type](raw, target);
  if (argv.includes("--rm")) {
    rmSync(raw, { recursive: true, force: true });
    console.log(`removed raw ${raw}`);
  }
  console.log("done");
};

if (import.meta.main) {
  try {
    run(process.argv.slice(2));
  } catch (err) {
    console.error(`import-art: ${(err as Error).message}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: Smoke-test the CLI error paths** (no assets touched):

Run:
```bash
cd /Users/calypso/Project/Ottery/commit-quest
bun tools/import-art.ts 2>&1 | tail -1                       # expect: import-art: usage: ...
bun tools/import-art.ts art/T1_Backend_Mage --as monster:slime 2>&1 | tail -1   # expect: not implemented
echo "exit demo: $(bun tools/import-art.ts nope --as hero:mage:t1 >/dev/null 2>&1; echo $?)"  # expect: 1
```
Expected: usage line; "not implemented … Adding a type"; exit `1`.

- [ ] **Step 3: Prettier**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun run format 2>&1 | tail -2` (formats tools/import-art.ts + test).

- [ ] **Step 4: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add tools/import-art.ts test/tools/import-art.test.ts
git commit -m "feat(tools): import-art CLI runner + type registry"
```

---

## Task 5: Reference doc

**Files:**
- Create: `docs/reference/art-import.md`
- Modify: `docs/reference/art-prompts.md` (one link line)

- [ ] **Step 1: Create `docs/reference/art-import.md`**

````markdown
# Art Import — raw PixelLab export → game assets

`tools/import-art.ts` copies a raw PixelLab export into the codebase's `app/public/` layout.
Drop a raw export anywhere, run the importer, then delete the raw folder — the committed
`public/` tree is the durable artifact.

## Gen convention (keeps characters consistent — we do NOT normalize at import)

Set every character the same in PixelLab: **56×56 · Template `mannequin` · Camera `Low Top-Down`
· Detail `Highly detailed` · Outline `Black outline`**. Same size everywhere = consistent on-screen
scale without trimming/padding. Prompts per line/tier live in `art-prompts.md`.

## Usage

```
bun tools/import-art.ts <raw-folder> --as <type>:<args> [--rm]
```

`--rm` deletes the raw folder after a successful import. Re-running is safe (each import wipes its
own target first).

| type | command | output |
|---|---|---|
| hero | `--as hero:<line>:<tier>` (`tier` ∈ `t1 t2 t3 t4a t4b`) | `app/public/sprites/<line>/<tier>/{idle/<dir>.png, walk/<dir>/<N>.png, cast/<N>.png}` |
| bg | `--as bg:<theme>` | `app/public/scenes/<theme>.png` |
| item | `--as item:<id>` | `app/public/items/<id>.png` |

Examples:
```
bun tools/import-art.ts art/incoming/Ranger    --as hero:ranger:t1
bun tools/import-art.ts art/incoming/CloudMage --as hero:mage:t4a --rm
bun tools/import-art.ts art/incoming/grassland --as bg:grassland
```

After a hero import, add one manifest line in `app/src/sprites.ts`:
`"<line>-<tier>": buildSet("<line>/<tier>", 9),` (the importer touches assets only, never code).

## Adding a type (monster / boss / …)

1. Write `const importMonster = (raw: string, target: ITarget): void => { … }` in
   `tools/import-art.ts` (copy the shape from `importHero`).
2. Register it: `[AssetType.Monster]: importMonster` in `TYPES` (replacing `notImplemented`).
3. Document its row in the table above.
````

- [ ] **Step 2: Link it from `art-prompts.md`** — under the title line (`# Commit Quest — Art & Image-Gen Prompt Pack`), add:

```markdown
> Importing exports into the game: see `art-import.md`.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
git add docs/reference/art-import.md docs/reference/art-prompts.md
git commit -m "docs: art-import usage + gen convention + extensibility"
```

---

## Task 6: Migrate Mage through the importer + verify + delete raw

**Files:** none committed (verification + gitignored-cleanup only)

This proves the script reproduces the committed Mage assets, then removes the now-redundant raw export.

- [ ] **Step 1: Re-import all 5 Mage forms through the script**

```bash
cd /Users/calypso/Project/Ottery/commit-quest
SRC=art/T1_Backend_Mage
bun tools/import-art.ts "$SRC/T1_Backend_Mage"      --as hero:mage:t1
bun tools/import-art.ts "$SRC/T2_Server_Sorcerer"   --as hero:mage:t2
bun tools/import-art.ts "$SRC/T3_Infra_Archmage"    --as hero:mage:t3
bun tools/import-art.ts "$SRC/T4a_Cloud_Summoner"   --as hero:mage:t4a
bun tools/import-art.ts "$SRC/dressed_as_a_kernel-" --as hero:mage:t4b
```
Expected: five `hero mage/tN -> …` lines, no errors.

- [ ] **Step 2: Verify the importer reproduced the committed assets byte-for-byte**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && git status --short app/public/sprites/mage`
Expected: **empty output** (no changes) — the script's output matches what PR #43 committed. If there IS a diff, STOP and investigate the extractor before deleting any raw.

- [ ] **Step 3: Delete the redundant raw exports** (only after Step 2 is clean)

```bash
cd /Users/calypso/Project/Ottery/commit-quest
rm -rf art/T1_Backend_Mage art/pixellab
ls art/ 2>/dev/null || echo "art/ now empty"
```
(`art/` is gitignored, so this is a filesystem cleanup with nothing to commit.)

- [ ] **Step 4: Full test sweep (no regressions)**

Run: `cd /Users/calypso/Project/Ottery/commit-quest && bun test 2>&1 | grep -E "pass|fail" | tail -2`
Expected: all pass (existing 234 + the 4 new import-art tests).

---

## Self-Review (completed)

**Spec coverage:** CLI/flags → Task 4 (`run`). Output layout → Tasks 2/3 (extractor targets). Hero extractor §"importHero" → Task 2. bg/item §"importBg/importItem" → Task 3. Pure helpers + tests §"Small pure helpers" → Task 1. Registry/extensibility §2 → Task 4 (`TYPES` + `notImplemented`) + Task 5 doc. Migration/verify §"Migration" → Task 6. Doc §"Documentation" → Task 5. Raw deletion §4 → Task 6 Step 3 + `--rm` flag (Task 4). Error handling §"Error handling" → Task 4 `run` guards + Task 2/3 missing-structure throws + Task 4 smoke test.

**Type consistency:** `AssetType` (hero/bg/item/monster/boss), `ITarget { type, line?, tier?, name? }`, `parseTarget`, `frameIndex`, `pickAnimDir`, `importHero`/`importBg`/`importItem`, `TYPES: Record<AssetType, (raw, target) => void>`, `run(argv)` — names consistent across tasks. The file is appended to across Tasks 1-4; helper names referenced later (`pngs`, `PUBLIC`, `CARDINALS`) are all defined in Task 2 before their Task 3/4 use.

**Out of scope (per spec):** normalization, monster/boss extractors (stubbed via `notImplemented`), wiring scenes/items into the renderer, auto-editing `sprites.ts` — none planned.
