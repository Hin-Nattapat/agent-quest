# Multi-agent values — first cut (design)

> Surfaces per-source activity on the single shared hero. Context: the project now has two adapters
> (claude-code, codex) feeding one journal → one `state.json`. We keep **one global hero** (level,
> class, unlocks shared across all agents — the reward loop accumulates instead of fragmenting) and
> add multi-agent *values* as read-only display on top of the per-source data the reducer already
> produces.

## 1. Goal & decisions

**Decisions (from brainstorming):**
- **Identity model = single global hero (current).** Not per-adapter heroes (would fragment progress
  and push source-awareness into `core`, breaking the source-agnostic seam) and not a per-line roster
  (YAGNI). Multi-agent is expressed as flavor/stats on the one hero.
- **First-cut scope = two display values:** (1) a per-source breakdown in the Hero panel, (2) the
  active source surfaced in the HUD and the companion. No new achievements/cosmetics this cut.
- **Gate on ≥2 distinct sources.** Single-agent users (the common case) see none of this — no clutter.

**Non-goals (YAGNI):** per-adapter level/class, hero roster, Polyglot achievement, source titles/
cosmetics, per-source streaks, source icons. (Candidates for a later cut.)

## 2. What already exists (no change)

- `stats.by_source: Record<string, IGroupStat>` where `IGroupStat = { xp: number; sessions: number }`
  — the reducer already tallies XP + sessions per source (`core/reduce.ts`).
- `app/src/view.ts` `titleCase(id)` turns a source id into a label (`claude-code` → "Claude Code",
  `codex` → "Codex"). No source-name map needed; no new shared module (which would cross the app seam).
- The companion already live-reduces on journal change, so these views update as agents run.

## 3. Architecture

Everything is read-only over `by_source` plus one new read-side field (`last_event.source`). No
game-logic change, no per-source progression, no new `core` runtime module imported by the app (the
app keeps importing only the `core/state` type and the `core/events` contract).

```
reduce → state.json { stats.by_source{xp,sessions}, last_event{ts,type,source} }
   ├── hud/statusline.ts        → " · via <source>"  (when ≥2 sources)
   └── app (React)
        ├── view.ts: sourceBreakdown(by_source) → [{source,xp,pct}] sorted desc
        ├── hero-panel.tsx       → "Sources" bars  (when ≥2 sources)
        └── portrait-frame.tsx   → "via <source>" chip  (when ≥2 sources)
```

## 4. Components

### 4.1 Core — `last_event.source` (the only core change)

`core/state.ts`: `last_event?: { ts: string; type: EventType; source: string }`.
`core/reduce.ts:404`: `prelim.last_event = { ts: lastEv.ts, type: lastEv.type, source: lastEv.source }`
(`lastEv` is the last `INormalizedEvent`, which already carries `source`). `by_source` is unchanged.

### 4.2 `app/src/view.ts` — `sourceBreakdown` (pure, tested)

```ts
export interface ISourceShare { source: string; xp: number; pct: number; }
// Per-source XP shares, sorted high→low. pct is integer percent of total XP (0 when no XP yet).
export const sourceBreakdown = (
  bySource: Record<string, { xp: number; sessions: number }>,
): ISourceShare[] => { … };
```
Sorting: descending `xp`, then `source` ascending for a stable order on ties. `pct = round(xp/total*100)`
with `total = sum(xp)`; if `total === 0`, every `pct = 0`. Consumers decide the ≥2 gate via
`Object.keys(bySource).length >= 2`.

### 4.3 Hero panel — "Sources" section

`app/src/components/hero-panel.tsx`: when `Object.keys(state.stats.by_source).length >= 2`, render a
"Sources" block reusing the existing affinity-bar markup (`.aff-bars` / `.aff-row` / `.aff-bar`): one
row per `sourceBreakdown(...)` entry — `titleCase(source)` label, a bar at `width: pct%`, and the `pct`.
Placed beside/under the existing Affinity + Stats columns. No new CSS class required (reuse aff-*),
or add a thin `.src-*` alias if visual tweaks are wanted — reuse first.

### 4.4 HUD statusline — active-source segment

`hud/statusline.ts`: when `≥2` sources, append a compact ` · via ${titleCase(state.last_event.source)}`
to the rendered line (after the class label). Omit entirely when `<2` sources or `last_event` absent.
Plain text (no extra color) to respect the statusline budget.

### 4.5 Companion — active-source chip

`app/src/components/portrait-frame.tsx`: when `≥2` sources and `last_event?.source` present, add a
`chip` (reusing the existing `.chip` row that shows streak/items/mult) reading
`via ${titleCase(last_event.source)}`.

## 5. Testing (TDD)

- **core**: `reduce` test asserts `last_event.source` equals the last event's source (extend an
  existing reduce/session test fixture that has events from a known source).
- **app**: `view.test.ts` (or a new `source-breakdown.test.ts`) for `sourceBreakdown` — ordering
  (desc xp, tie-break), pct math, and `total === 0 → pct 0`. No `any`; use the `IGroupStat` shape.
- **hud**: `statusline-integration.test.ts` — with ≥2 sources in `by_source` and a `last_event.source`,
  the line contains `via <Label>`; with one source it does not.

## 6. Out of scope (deferred)

Polyglot/Conductor achievement, source titles/cosmetics, source icons (vs title-cased text),
per-source streaks, "main agent" badge, per-adapter progression, hero roster.
