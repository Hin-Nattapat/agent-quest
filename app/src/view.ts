import type { IState } from "../../core/state";
import { TimelineKind, type ITimelineEntry } from "../../core/timeline";
import { sceneFor } from "./scene";

export function xpPercent(state: IState): number {
  if (state.xp_to_next <= 0) {
    return 100; // MAX at the level cap
  }
  const span = state.xp_in_level + state.xp_to_next;
  return Math.round((state.xp_in_level / span) * 100);
}

export function displayName(state: IState): string {
  return state.name ?? "Adventurer";
}

export function classLabel(state: IState): string {
  const klass = state.class;
  if (!klass || !klass.line) {
    return "Novice";
  }
  return `${klass.icon} ${klass.form}`.trim();
}

export function titleSuffix(state: IState): string {
  const title = state.cosmetics?.title;
  return title ? ` the ${title}` : "";
}

export function streakText(state: IState): string {
  const days = state.streak?.current_days ?? 0;
  return days > 0 ? `🔥 ${days}d` : "";
}

export type TTimelineTone =
  | "gold"
  | "teal"
  | "green"
  | "red"
  | "common"
  | "rare"
  | "epic"
  | "legendary";

export interface ITimelineDisplay {
  label: string;
  tag: string;
  tone: TTimelineTone;
}

export function formatTimeline(entry: ITimelineEntry): ITimelineDisplay {
  if (entry.kind === TimelineKind.LevelUp) {
    return { label: `Level up! → ${entry.detail}`, tag: "LVL", tone: "gold" };
  }
  if (entry.kind === TimelineKind.Advance) {
    return { label: `Became ${entry.detail}`, tag: "CLASS", tone: "teal" };
  }
  if (entry.kind === TimelineKind.BossDefeated) {
    return { label: "Defeated a boss", tag: "BOSS", tone: "green" };
  }
  if (entry.kind === TimelineKind.BossFled) {
    return { label: "A boss fled", tag: "FLED", tone: "red" };
  }
  const rarity = entry.rarity ?? "common";
  return {
    label: `Loot: ${entry.detail}`,
    tag: rarity.toUpperCase(),
    tone: rarity as TTimelineTone,
  };
}

export function passiveMultiplier(state: IState): string {
  const pct = state.class?.base_passive_pct ?? 0;
  return (1 + pct).toFixed(1);
}

export function areaLabel(state: IState): string {
  return sceneFor(state.class?.tier ?? 0).label;
}
