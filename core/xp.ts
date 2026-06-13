import { EventType, AgentAction, type INormalizedEvent } from "./events";

export interface IWeights {
  prompt: number;
  turn_end: number;
  session_end: number;
  actions: Record<AgentAction, number>;
}

export interface IDifficulty {
  curve_k: number;
  curve_exp: number;
  level_cap: number;
}

export const DEFAULT_WEIGHTS: IWeights = {
  prompt: 5,
  turn_end: 10,
  session_end: 20,
  actions: {
    [AgentAction.Edit]: 4,
    [AgentAction.Write]: 4,
    [AgentAction.Run]: 3,
    [AgentAction.Read]: 1,
    [AgentAction.Search]: 1,
    [AgentAction.Delegate]: 8,
    [AgentAction.Other]: 1,
  },
};

export const DEFAULT_DIFFICULTY: IDifficulty = {
  curve_k: 7,
  curve_exp: 2.5,
  level_cap: 50,
};

export const xpFor = (e: INormalizedEvent, w: IWeights = DEFAULT_WEIGHTS): number => {
  switch (e.type) {
    case EventType.Prompt:
      return w.prompt;
    case EventType.TurnEnd:
      return w.turn_end;
    case EventType.SessionEnd:
      return w.session_end;
    case EventType.Action:
      return w.actions[e.action ?? AgentAction.Other];
    default:
      return 0; // session_start, action_fail
  }
};

export const xpForLevel = (L: number, d: IDifficulty = DEFAULT_DIFFICULTY): number => {
  return Math.round(d.curve_k * Math.pow(L - 1, d.curve_exp));
};

export const levelFor = (xp: number, d: IDifficulty = DEFAULT_DIFFICULTY): number => {
  let level = 1;
  for (let L = 2; L <= d.level_cap; L++) {
    if (xp < xpForLevel(L, d)) {
      break;
    }
    level = L;
  }
  return level;
};

export interface IProgress {
  level: number;
  xp_in_level: number;
  xp_to_next: number;
}

export const levelProgress = (
  xp: number,
  d: IDifficulty = DEFAULT_DIFFICULTY,
): IProgress => {
  const level = levelFor(xp, d);
  if (level >= d.level_cap) {
    return { level, xp_in_level: xp - xpForLevel(level, d), xp_to_next: 0 };
  }
  const floor = xpForLevel(level, d);
  const ceil = xpForLevel(level + 1, d);
  return { level, xp_in_level: xp - floor, xp_to_next: ceil - xp };
};

export type TPassiveRates = Record<number, number>;

export const DEFAULT_PASSIVE: TPassiveRates = { 1: 0.2, 2: 0.3, 3: 0.4, 4: 0.5 };

export const basePct = (tier: number, rates: TPassiveRates = DEFAULT_PASSIVE): number => {
  return rates[tier] ?? 0;
};
