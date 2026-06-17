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
