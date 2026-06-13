# Product

## Register

product

## Users

A developer using an AI coding agent (Claude Code). While they work, a small **companion panel** sits in their VS Code bottom panel and shows their coding session gamified as an RPG character (Commit Quest). They glance at it between tasks; they are never *in* it as a task. Read-only, ambient, peripheral.

## Product Purpose

Make AI-coding progress feel rewarding at a glance: level, class, XP, streak, recent deeds (boss fights, loot, level-ups), current "zone". It is a **glanceable status surface**, not an app to operate. Success = a quick look tells you how the session is going and feels good, without pulling focus from the editor.

## Brand Personality

Retro 2D-MMORPG, fantasy. Aged and earthy, not neon. Three words: **cozy, epic, readable**. It should feel like a beloved old pixel MMO HUD (Tibia / RuneScape / Pixel Heroes era) — warm, slightly worn, never a slick modern SaaS dashboard and never an eye-searing neon arcade.

## Anti-references

- **Oversaturated / neon palettes** — the current colors read too bright and candy-vivid; a real retro MMO is muted and aged.
- Flat modern SaaS UI (Linear/Notion chrome) — wrong genre.
- Gratuitous motion / arcade flashiness that pulls focus from the editor.

## Design Principles

1. **Aged, not neon.** Muted, desaturated, slightly warm palette. Gold is brass, not highlighter; purple is dusk, not grape soda.
2. **Glanceable hierarchy.** The three things that matter (who you are, how far to next level, what just happened) read instantly; everything else recedes.
3. **Pixel-authentic chrome.** Chunky gold-bordered panels, pixel font, hard edges — the look is the reward.
4. **Motion conveys state, sparingly.** A pulse means "actively farming"; a fill means XP gained. No decorative choreography (it sits next to code).

## Accessibility & Inclusion

WCAG AA: body/label text ≥4.5:1 on its panel; large text ≥3:1. Honor `prefers-reduced-motion` (pulses/transitions degrade to static). Works against VS Code dark themes (the panel brings its own dark surface).
