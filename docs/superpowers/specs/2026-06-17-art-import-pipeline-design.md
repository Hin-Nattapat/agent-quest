# Art Import Pipeline — Design

**Status:** approved
**Date:** 2026-06-17
**Scope:** repo tooling (`tools/import-art.mjs`) + a reference doc. Produces assets under `app/public/`; touches no runtime code.
**Builds on:** the Mage sprite layout (PR #43). This branch is stacked on `feat/mage-all-tiers` so the migrate/verify step can diff against the committed `app/public/sprites/mage`.

## Goal

A single dev-tool that turns a raw PixelLab export into correctly-laid-out game assets, driven entirely by a CLI flag. Drop a raw export anywhere, run `bun tools/import-art.mjs <raw> --as <type>:<args>`, get assets in the codebase's `public/` layout, then delete the raw folder. The committed `public/` tree is the durable artifact; raw exports are transient.

## Why

Sprite extraction is currently ad-hoc bash run by hand, and it only knows about heroes. PixelLab names export folders inconsistently (`dressed_as_a_kernel-`, `casting_a_spell_swinging…`), so any convention that parses folder names is fragile. A small importer keyed by an explicit `--as <type>` flag makes every future drop (Ranger, Sage, monsters, backgrounds) a one-liner, keeps the messy raw names out of the repo, and gives one place to encode each asset type's extraction logic.

## Decisions (settled during brainstorming)

- **Mechanism = CLI flag**, not folder-name convention or a persistent manifest. The user tells the script what a raw folder is via `--as <type>:<args>`; the script's per-type extractor knows how to read PixelLab's internal structure. Robust to messy export names, no config to maintain.
- **v1 types = `hero`, `bg`, `item`.** `monster` and `boss` are framework-ready but not implemented (no art yet, and how monsters key in code is unresolved) — their handlers throw a clear "not implemented" error pointing at the extensibility section.
- **Copy/rename only — no image processing, no normalization.** The script uses `fs` alone (no new dep; the project keeps runtime deps to jq+bun). Cross-size mismatch is prevented by a *gen convention* (always 56×56 · mannequin) documented in the reference, not by trimming/padding at import. Normalization is deferred until padding variance is a real problem.
- **Raw is transient.** The script copies into `public/` (committed) and does not archive. `--rm` deletes the raw folder after a successful import. Recommended staging dir is `art/incoming/` (already gitignored via `art/`).

## CLI

```
bun tools/import-art.mjs <raw-folder> --as <type>:<args> [--rm]
```

Examples:
```
bun tools/import-art.mjs art/incoming/Ranger      --as hero:ranger:t1
bun tools/import-art.mjs art/incoming/CloudMage   --as hero:mage:t4a
bun tools/import-art.mjs art/incoming/grassland   --as bg:grassland
bun tools/import-art.mjs art/incoming/trophy.png  --as item:trophy
```

- Exits non-zero with a clear message on: missing raw folder, unknown type, malformed `--as`, or a type's expected sub-structure not found.
- Idempotent: each import `rm -rf`s its own target sub-folder first, then copies. Re-running is safe.
- Prints a summary (files copied per group). `--rm` removes the raw folder only after success.

## Output layout (the codebase "pattern")

```
app/public/
  sprites/<line>/t<key>/          # hero forms; key ∈ {1,2,3,4a,4b}
      idle/<dir>.png              # dir ∈ {south,north,east,west}
      walk/<dir>/<N>.png          # N = 0..8
      cast/<N>.png                # east-facing cast frames
  sprites/monster/<key>/…         # (future)
  sprites/boss/<key>/…            # (future)
  scenes/<theme>.png              # bg / map_bg
  items/<id>.png                  # item
```

This matches what the renderer already consumes for heroes (`sprites.ts` keys `${line}-t${key}`); `scenes/` and `items/` are new dirs whose consumers (a CSS background seam, an items view) are wired separately when the art lands — same staged pattern as hero `cast`.

## Components

### 1. Arg parsing — `parseTarget(asArg)`

Pure. `"hero:mage:t4a"` → `{ type: "hero", line: "mage", tier: "t4a" }`; `"bg:grassland"` → `{ type: "bg", name: "grassland" }`; `"item:trophy"` → `{ type: "item", name: "trophy" }`. Throws on unknown type or wrong arg count for the type.

### 2. Type registry — `TYPES`

```js
const TYPES = {
  hero: importHero,   // (rawDir, target) => { copied }
  bg: importBg,
  item: importItem,
  monster: notImplemented("monster"),
  boss: notImplemented("boss"),
};
```

Each entry is a function `(rawDir, target) => { groups }` that builds and executes the copy plan for that type. `notImplemented(name)` returns a function that throws with a pointer to the "Adding a type" section. Adding monster/boss later = write one function + register it; nothing else changes.

### 3. `importHero(rawDir, { line, tier })`

Knows the PixelLab character shape:
- `rotations/<dir>.png` for `dir ∈ {south,north,east,west}` → `…/<tier>/idle/<dir>.png`.
- The walk animation dir is found by glob (`*alking*` — names vary by case/length); its `<dir>/frame_00N.png` → `…/<tier>/walk/<dir>/<N>.png` (N from the frame index, `frame_007.png` → `7`).
- The cast animation dir is found by glob (`*asting*`); its `east/frame_00N.png` → `…/<tier>/cast/<N>.png`. Cast is optional — skip with a warning if absent.
- Target root: `app/public/sprites/<line>/<tier>`.

### 4. `importBg` / `importItem`

Single-image copies. The raw arg may be a `.png` file or a folder containing exactly one `.png`; resolve it and copy to `app/public/scenes/<name>.png` (bg) or `app/public/items/<name>.png` (item). Error if zero or multiple PNGs in a folder.

### 5. Small pure helpers (tested)

- `frameIndex("frame_007.png")` → `"7"`.
- `pickAnimDir(names, needle)` → the entry containing `needle` (case-insensitive), or null.
- `parseTarget` (above).

## Migration + verification

The ad-hoc Mage extraction is replaced by the script. Re-import every Mage form through `import-art hero:mage:t<key>` against the existing raw export, then `git diff --stat app/public/sprites/mage` MUST be empty — proving the script reproduces the committed assets byte-for-byte. After that, the raw `art/T1_Backend_Mage/` and `art/pixellab/` directories are deleted (they're under the gitignored `art/`, so this is a filesystem cleanup, not a commit).

## Error handling

- Missing raw folder / unknown type / malformed `--as` → exit 1 with a one-line reason.
- `hero` without `rotations/` or a `*alking*` animation dir → exit 1 naming what's missing.
- `bg`/`item` folder with ≠1 PNG → exit 1.
- `monster`/`boss` → exit 1 with "not implemented; see docs/reference/art-import.md → Adding a type".

## Testing (bun test, pure helpers; copy verified by migration diff)

- `parseTarget` — each type's happy path + unknown type + wrong arg count.
- `frameIndex` — `frame_000`→`0`, `frame_012`→`12`.
- `pickAnimDir` — matches `Casting_a_spell` and `casting_a_spell_swinging…` for `asting`; returns null when absent.
- Migration diff (`app/public/sprites/mage` unchanged after re-import) is the integration test for the copy itself.

## Documentation

`docs/reference/art-import.md`: the gen convention (56×56 · mannequin · Low Top-Down · Black outline), the `--as` command per type with examples, the output layout, and an "Adding a type" section (write a `(rawDir, target)` function, register it in `TYPES`). Linked from `art-prompts.md`.

## Out of scope (deliberate)

Image normalization/trim-pad, `monster`/`boss` extractors, wiring `scenes/`/`items/` into the renderer, a persistent import manifest, and auto-editing `sprites.ts` (adding the manifest entry stays a manual one-line code step). Each can be added without reworking the importer.
