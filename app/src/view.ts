import type { IState } from "../../core/state";
import { TimelineKind } from "../../core/events";
import type { ITimelineEntry } from "../../core/timeline";

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
export const cmdLabel = (tag: string): string => {
  const known = CMD_LABELS[tag];
  if (known) {
    return known;
  }
  return tag
    .split("_")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
};

// Entries of a count record sorted by value descending (Array.sort is stable, so ties keep order).
export const byCountDesc = (rec: Record<string, number>): [string, number][] => {
  return Object.entries(rec).sort((a, b) => b[1] - a[1]);
};
