import type { CSSProperties } from "react";
import type { IState } from "../../core/state";
import { TimelineKind } from "../../core/events";
import type { ITimelineEntry } from "../../core/timeline";
import type { IInventoryItem } from "../../core/loot";
import { assetUrl } from "./assets-base";

// A background-image style for a sprite frame (resolved under the webview asset base), or undefined
// when there's no frame yet so the element keeps its emoji/gradient fallback.
export const spriteStyle = (frame: string | undefined): CSSProperties | undefined => {
  if (!frame) {
    return undefined;
  }
  return { backgroundImage: `url(${assetUrl(frame)})` };
};

// A 0..1 fraction clamped to a 0..100 percentage for a CSS bar width.
export const hpPercent = (fraction: number): number =>
  Math.max(0, Math.min(1, fraction)) * 100;

// Title Case a snake_case id ("stone_wyrm" → "Stone Wyrm").
export const titleCase = (id: string): string =>
  id
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const xpPercent = (state: IState): number => {
  if (state.xp_to_next <= 0) {
    return 100; // MAX at the level cap
  }
  const span = state.xp_in_level + state.xp_to_next;
  return Math.round((state.xp_in_level / span) * 100);
};

export const displayName = (state: IState): string => state.name ?? "Adventurer";

export enum TimelineTone {
  Gold = "gold",
  Teal = "teal",
  Green = "green",
  Red = "red",
  Common = "common",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export interface ITimelineDisplay {
  label: string;
  tag: string;
  tone: TimelineTone;
}

export const formatTimeline = (entry: ITimelineEntry): ITimelineDisplay => {
  if (entry.kind === TimelineKind.LevelUp) {
    return { label: `Level up! → ${entry.detail}`, tag: "LVL", tone: TimelineTone.Gold };
  }
  if (entry.kind === TimelineKind.Advance) {
    return { label: `Became ${entry.detail}`, tag: "CLASS", tone: TimelineTone.Teal };
  }
  if (entry.kind === TimelineKind.BossDefeated) {
    return { label: "Defeated a boss", tag: "BOSS", tone: TimelineTone.Green };
  }
  if (entry.kind === TimelineKind.BossFled) {
    return { label: "A boss fled", tag: "FLED", tone: TimelineTone.Red };
  }
  const rarity = entry.rarity ?? "common";
  return {
    label: `Loot: ${entry.detail}`,
    tag: rarity.toUpperCase(),
    tone: rarity as TimelineTone,
  };
};

export const passiveMultiplier = (state: IState): string => {
  const pct = state.class?.base_passive_pct ?? 0;
  return (1 + pct).toFixed(1);
};

const CMD_LABELS: Record<string, string> = {
  git_rebase_onto: "Rebase Onto",
  git_rebase_i: "Interactive Rebase",
  cherry_pick: "Cherry-Picks",
  force_push: "Force Pushes",
  bisect: "Bisects",
  reflog: "Reflog Dives",
  stash: "Stashes",
  pr_merge: "PR Merges",
  cowboy: "Cowboy Commits",
  test_run: "Test Runs",
};

// Readable label for a CmdTag value; unknown tags fall back to Title Case of the snake_case key.
export const cmdLabel = (tag: string): string => CMD_LABELS[tag] ?? titleCase(tag);

// Entries of a count record sorted by value descending (Array.sort is stable, so ties keep order).
export const byCountDesc = (rec: Record<string, number>): [string, number][] => {
  return Object.entries(rec).sort((a, b) => b[1] - a[1]);
};

export interface ISourceShare {
  source: string;
  xp: number;
  pct: number;
}

// Per-source XP shares of the hero's total, highest first (ties broken by source name). pct is an
// integer percent; every share is 0 when no XP has been earned yet.
export const sourceBreakdown = (
  bySource: Record<string, { xp: number; sessions: number }>,
): ISourceShare[] => {
  const total = Object.values(bySource).reduce((sum, group) => sum + group.xp, 0);
  return Object.entries(bySource)
    .map(([source, group]) => ({
      source,
      xp: group.xp,
      pct: total === 0 ? 0 : Math.round((group.xp / total) * 100),
    }))
    .sort((a, b) => b.xp - a.xp || a.source.localeCompare(b.source));
};

// Wire kind keys, not the LootKind enum: the app may not import core game logic at runtime, and
// these strings are already the shared contract via state.json (same precedent as realm themes).
const KIND_ORDER: { kind: string; label: string; icon: string }[] = [
  { kind: "title", label: "Titles", icon: "👑" },
  { kind: "theme", label: "Themes", icon: "🎨" },
  { kind: "name_color", label: "Name Colors", icon: "✒️" },
  { kind: "companion", label: "Companions", icon: "🦆" },
  { kind: "skin", label: "Skins", icon: "👕" },
];

export interface IInventoryGroup {
  kind: string;
  label: string;
  icon: string;
  items: IInventoryItem[];
}

// The inventory reads as a wardrobe instead of a flat heap: one section per cosmetic kind in a
// fixed order, the equipped piece floated to the front, empty kinds hidden, unknown kinds folded
// into a trailing Other section.
export const groupInventory = (inv: IInventoryItem[]): IInventoryGroup[] => {
  const byKind = new Map<string, IInventoryItem[]>();
  for (const item of inv) {
    const kind = item.kind ?? "other";
    const known = KIND_ORDER.some(k => k.kind === kind) ? kind : "other";
    const list = byKind.get(known) ?? [];
    list.push(item);
    byKind.set(known, list);
  }
  const equippedFirst = (items: IInventoryItem[]): IInventoryItem[] => {
    const equipped = items.filter(i => i.equipped);
    const rest = items.filter(i => !i.equipped);
    return [...equipped, ...rest];
  };
  const groups: IInventoryGroup[] = [];
  for (const def of KIND_ORDER) {
    const items = byKind.get(def.kind);
    if (items && items.length > 0) {
      groups.push({ ...def, items: equippedFirst(items) });
    }
  }
  const other = byKind.get("other");
  if (other && other.length > 0) {
    groups.push({
      kind: "other",
      label: "Other",
      icon: "❔",
      items: equippedFirst(other),
    });
  }
  return groups;
};
