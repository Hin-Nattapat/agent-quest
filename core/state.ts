import type { IStreak } from "./streak";
import type { IClassState, SecretLine } from "./classes";
import type { IInventoryItem, ICosmetics } from "./loot";
import type { EventType } from "./events";
import type { ITimelineEntry } from "./timeline";
import { type IBestiaryState } from "./bestiary";
import { type IParagonState } from "./paragon";

export interface IGroupStat {
  xp: number;
  sessions: number;
}

export interface IEarnedAchievement {
  id: string;
  name: string;
  desc: string;
  points: number;
}

export interface IAchievementsState {
  earned: string[];
  points: number;
  progress: Record<string, number>;
  earned_detail?: IEarnedAchievement[];
  // Not-earned, non-secret deeds (with their criteria) so the player can see what to work toward.
  locked?: IEarnedAchievement[];
  // Count of not-earned hidden deeds — shown as "??? secret", never with criteria.
  secret?: number;
  total?: number;
}

export interface IState {
  version: number;
  updated_at: string;
  xp_total: number;
  level: number;
  xp_in_level: number;
  xp_to_next: number;
  stats: {
    prompts: number;
    actions: Record<string, number>;
    sessions: number;
    by_source: Record<string, IGroupStat>;
    by_repo: Record<string, IGroupStat>;
    night_actions?: number;
    failures_recovered?: number;
    ascetic_seal?: number;
    cmds?: Record<string, number>;
    boss_defeated?: number;
    boss_fled?: number;
    action_fails?: number;
  };
  streak?: IStreak;
  achievements?: IAchievementsState;
  name?: string;
  class?: IClassState;
  inventory?: IInventoryItem[];
  bestiary?: IBestiaryState;
  paragon?: IParagonState;
  cosmetics?: ICosmetics;
  unlocked_secret_classes?: SecretLine[];
  last_event?: { ts: string; type: EventType; source: string };
  recent?: ITimelineEntry[];
}
