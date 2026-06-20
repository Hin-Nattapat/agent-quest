# Design

Visual system for the Agent Quest companion panel (VS Code bottom panel, two-column pixel-MMORPG HUD). Anchored to the real PixelLab Mage sprites: **muted purple robe + brass-gold trim + teal terminal-crystal**, 56×56px, low top-down, 1px black outline. The chrome harmonizes with the character — aged, not neon.

## Color (muted retro palette — OKLCH-checked for AA)

The previous palette read too bright/candy. These are desaturated and slightly warm, matching the sprite.

| Token | Value | Role |
|---|---|---|
| `--ink` | `#14111c` | hard outline / deepest shadow (matches sprite outline) |
| `--bg` | `#100d18` | app background behind panels |
| `--panel` | `#372f4a` | panel fill (dusk purple, low chroma) |
| `--panel-2` | `#2b2540` | secondary / inset surface |
| `--panel-dark` | `#201b2e` | bevel inner |
| `--gold` | `#c39a44` | brass border + frame (aged, not highlighter) |
| `--gold-soft` | `#dab964` | gold text/highlight (on dark) |
| `--text` | `#e7e0cf` | body — warm parchment, ≥7:1 on `--panel` |
| `--dim` | `#a59cae` | secondary text — ≥4.5:1 on `--panel` |
| `--teal` | `#69b09c` | crystal teal — advance tone + class accent |
| `--ember` | `#cf8a5a` | streak |

Rarity / log tones (muted, still distinguishable, each ≥4.5:1 on `--panel`):
`common #b3ad9c · rare #6f9fcf · epic #a37fc0 · legendary #cf9f4e · gold #dab964 · green #88a861 · red #c97a5c · teal #69b09c`.

XP bar fill: aged-gold gradient `#cdae57 → #9a7a30` (not the old `#ffe06a`).
Scene night sky: muted indigo→dusk `#1a1730 → #2a2742`, grass `#33532c → #21391b`, moon soft cream `#d8d0b4` (not pure white).

## Typography

- **Pixelify Sans** — names, body, labels (the workhorse pixel sans).
- **Press Start 2P** — tiny uppercase chips/eyebrows ONLY (log tags, section label), ≤4 words.
- Hierarchy by weight + size, not extra families. Name 15px/700, class 11px, title 11px italic-accent, log row 12px, tags 8px.

## Components

Chunky pixel panels: 3px `--gold` border + 2px `--panel-dark` inset bevel + 2px `--ink` outer. Hard corners (3px radius max). Bars have a dark inset track. Chips are small rounded pills. Buttons share the panel border vocabulary; disabled = reduced opacity + `not-allowed`.

- **Portrait frame** (scene overlay, top-left): 56×56 portrait slot (sprite seam) + level badge, name, **equipped title** (new), class·tier, XP bar, streak/mult chips.
- **Zone tag** (scene overlay, top-right): area name in a gold pill.
- **Activity bar** (scene, bottom-center): "Currently: …" with a state dot.
- **Activity log** (sidebar): tone-coded rows (dot + label + tag); the tag carries the row's tone color (informative, readable). Empty state teaches ("No deeds yet…").
- **Nav** (sidebar): 4 disabled placeholder buttons.

## Sprite seam (ready for real art)

Hero / portrait / monster / boss are emoji via `::after` today. Real PixelLab sprites (56×56, south-facing for the portrait + idle, 8-direction sheets for walk later) drop in by swapping the CSS `background-image` on `.portrait-face` / `.hero` / `.monster` — no component changes. `image-rendering: pixelated` keeps them crisp at integer scale.

## Motion (sparse, state-conveying)

- `.activity-dot` pulses only while **farming** (conveys active work). Idle/rest = static.
- XP bar fill transitions on gain (150–250ms ease-out).
- Existing boss hit/flee animations stay.
- All gated by `@media (prefers-reduced-motion: reduce)` → static.
