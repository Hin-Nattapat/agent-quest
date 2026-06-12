import type { IStreak } from "./streak";
import type { IClassState, SecretLine } from "./classes";
import type { IInventoryItem, ICosmetics } from "./loot";

export interface IGroupStat {
  xp: number;
  sessions: number;
}

export interface IAchievementsState {
  earned: string[];
  points: number;
  progress: Record<string, number>;
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
  };
  streak?: IStreak;
  achievements?: IAchievementsState;
  name?: string;
  class?: IClassState;
  inventory?: IInventoryItem[];
  cosmetics?: ICosmetics;
  unlocked_secret_classes?: SecretLine[];
}
