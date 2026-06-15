# Commit Quest — statusBar name color + theme palette refresh

> **Status:** design approved 2026-06-15. Plan: `docs/superpowers/plans/`.
> Add a new droppable **name-color** cosmetic that tints the character name + title in the
> statusline HUD, and refresh the existing **theme** (exp-bar) colors to a deliberate truecolor
> palette. Terminal statusBar only — the companion app is untouched.

## Goal

A new `name_color` cosmetic kind drops, is equipped with `rpg namecolor <id>`, and recolors
`name + title` in `hud/statusline.ts` via ANSI. Separately, the six existing themes get refreshed
24-bit color values (fixing the Sunset/Golden duplicate and the Forest/Matrix clash). Both follow a
rarity ladder: lower tiers are tasteful solid colors, legendary gets the neon gimmick.

## Architecture (mirrors the existing `theme` cosmetic exactly)

```
LootKind.NameColor (new)
  → LOOT_TABLE name-ink items (value = ANSI SGR params)   → drop normally (own-once; not skin-excluded)
profile.name_color (equipped id)
  → resolveCosmetics → state.cosmetics.name_color (ANSI)  → statusline wraps `name + title`
```

The seam is unchanged: `core/` resolves the equipped color into `state.cosmetics` (denormalized);
`hud/` reads the resolved ANSI string and never imports loot logic. Theme already works this way
(`theme_color` colors the bar); name-color is the same pattern on a second slot.

## The palette (final)

ANSI value = SGR parameters inserted into `\x1b[<value>m…\x1b[0m`. Truecolor = `38;2;R;G;B`;
a leading `1;` adds bold.

### Theme (exp bar) — keep ids/names, update `value` to truecolor
| id | name | rarity | value | hex |
|---|---|---|---|---|
| `forest_theme` | Forest | common | `38;2;46;204;78` | #2ecc4e |
| `ocean_theme` | Ocean | rare | `38;2;40;130;255` | #2882ff |
| `neon_theme` | Neon | rare | `38;2;0;224;208` | #00e0d0 |
| `matrix_theme` | Matrix | epic | `38;2;180;255;26` | #b4ff1a |
| `sunset_theme` | Sunset | epic | `38;2;255;106;30` | #ff6a1e |
| `golden_theme` | Golden | legendary | `38;2;255;205;20` | #ffcd14 |

### Name ink (new `LootKind.NameColor`) — rarity ladder, neon gimmick at legendary
| id | name | rarity | value | hex |
|---|---|---|---|---|
| `mist_ink` | Mist | common | `38;2;159;180;201` | #9fb4c9 |
| `azure_ink` | Azure | rare | `38;2;61;155;255` | #3d9bff |
| `jade_ink` | Jade | rare | `38;2;47;194;138` | #2fc28a |
| `royal_ink` | Royal | epic | `38;2;138;92;255` | #8a5cff |
| `ruby_ink` | Ruby | epic | `38;2;236;59;90` | #ec3b5a |
| `plasma_ink` | Plasma | legendary | `1;38;2;255;54;255` | #ff36ff (bold neon) |

## Components / files

| File | Responsibility | Change |
|---|---|---|
| `core/loot.ts` | loot table, kinds, cosmetic resolution | `LootKind.NameColor`; 6 name-ink items; refresh 6 theme `value`s; add `NameColor` to `OWN_ONCE_KINDS`; `name_color` in `ICosmetics`; resolve it in `resolveCosmetics` | 
| `core/profile.ts` | persisted player profile | add `name_color?: string` to `IProfile` |
| `hud/statusline.ts` | terminal HUD render | wrap `name + titleSuffix` in `\x1b[${name_color}m…\x1b[0m` when set |
| `tools/rpg.ts` | player CLI | `equip` handles `NameColor` (→ `profile.name_color`); `namecolor <id>` + `namecolors` commands; usage line |
| `app/src/components/items-panel.tsx` | app inventory grid | add a `name_color` icon so the new drops don't render as `❔` (display only — no equip button) |
| `test/core/loot.test.ts` | core tests | `resolveCosmetics` resolves `name_color`; `rollInventory` caps a name-color at 1 |
| `test/hud/statusline.test.ts` | HUD tests | name+title wrapped in the name-color ANSI when set; plain when unset |

**No change to `core/reduce.ts`** — it already calls `resolveCosmetics({ profile: profile ?? {}, … })`
with the whole profile, so `name_color` flows through once the types include it.

### `resolveCosmetics` change
`IResolveCosmeticsArgs.profile` gains `name_color?: string`. `ICosmetics` gains
`name_color: string | null`. Resolution mirrors `theme_color`: the equipped item's `value` when it is
owned and its kind is `NameColor`, else `null`.

```ts
const nameItem =
  profile.name_color && owned.has(profile.name_color) ? lootTable[profile.name_color] : null;
return {
  title: lootTitle ?? earnedTitle,
  theme_color: themeItem?.kind === LootKind.Theme ? (themeItem.value ?? null) : null,
  name_color: nameItem?.kind === LootKind.NameColor ? (nameItem.value ?? null) : null,
};
```

### `hud/statusline.ts` change
```ts
const nameColor = state.cosmetics?.name_color;
const namePlate = `${name}${titleSuffix}`;
const coloredName = nameColor ? `\x1b[${nameColor}m${namePlate}\x1b[0m` : namePlate;
const left = `${coloredName} · ${label}${pending}  ` + `Lv.${state.level} ${coloredBar}…`;
```
`displayWidth` already strips `\x1b[[0-9;]*m`, so the space-between layout math is unaffected by the
added codes (truecolor `38;2;…m` matches the same strip regex).

### `tools/rpg.ts` change
- `equip` sets the profile field by kind: `Theme → profile.theme`, `NameColor → profile.name_color`
  (Title keeps its `availableTitles` path).
- `namecolor <id>` → `equip({ profile, kind: LootKind.NameColor, id })`.
- `namecolors` → list owned inventory items whose loot-table kind is `NameColor` (`id — name`),
  mirroring `titles`/`inventory`.
- Usage line gains `namecolor|namecolors`.

## Data flow / drop behaviour

- Name-colors drop through the normal pool: `rollDrop` only excludes `Skin`, so `NameColor` items
  roll like titles/themes at their rarities.
- `NameColor` joins `OWN_ONCE_KINDS`, so duplicates cap at count 1 (collection, not stack).
- Equipping is pure validate-then-mutate (same as theme): `rpg namecolor <id>` checks ownership +
  kind, sets `profile.name_color`, re-reduces; an unowned/wrong id fails with a message and no write.

## Error handling / edge cases

- **No name-color equipped** → `state.cosmetics.name_color` is `null` → statusline renders the name
  plain (unchanged behaviour).
- **Equipped id later not owned** (e.g. edited profile) → `resolveCosmetics` returns `null` (ownership
  gate), so the HUD falls back to plain — never emits a dangling ANSI code.
- **Terminal without truecolor** → it ignores/garbles the `38;2` code; acceptable (themes already rely
  on ANSI; modern terminals used here support truecolor). No runtime guard.
- **Layout** → ANSI is invisible to `displayWidth`; the right-group alignment is unaffected.
- **App Items panel** → name-color items appear in the collection with their own icon but no Equip
  button (equip is CLI-only this iteration); `equipKindOf` returns `null` for the kind, so no button
  renders — no app write path for name-color.

## Testing

- `resolveCosmetics`: returns the equipped name-color `value`; `null` when unowned or wrong kind.
- `rollInventory`: a repeated name-color drop caps at count 1 (own-once).
- `statusline`: with `cosmetics.name_color` set, output contains `\x1b[<value>m` and still contains
  the `name the Title` text; without it, the name is plain (no stray ANSI before the name).
- Existing theme tests updated only where they assert a specific old `value` (none assert exact theme
  values today beyond `theme_color: "36"` passed directly in the HUD test, which is independent of the
  loot-table refresh).

## Scope / non-goals

- **statusBar only** — the companion app portrait name/title are NOT recolored (no ANSI→CSS mapping).
- **No app equip** for name-color this iteration (CLI `rpg namecolor` only); the panel just displays.
- **No new gimmick beyond color** — legendary is bold neon, not animation/rainbow (rainbow per-char is
  a possible later enhancement, explicitly out of scope).
- **No migration** — refreshing theme `value`s keeps ids/names; pure reduce denormalizes fresh.
