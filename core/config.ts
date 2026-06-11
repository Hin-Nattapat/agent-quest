import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  DEFAULT_WEIGHTS,
  DEFAULT_DIFFICULTY,
  DEFAULT_PASSIVE,
  type IWeights,
  type IDifficulty,
  type TPassiveRates,
} from "./xp";
import { DEFAULT_ACHIEVEMENTS, type IAchievementDef } from "./achievements";

export interface IConfig {
  weights: IWeights;
  difficulty: IDifficulty;
  achievements?: Record<string, IAchievementDef>; // optional so pre-2a reduce(events, cfg) callers still type-check
  passive?: TPassiveRates;
}

// The runtime home (`$AGENTRPG_HOME`, else `~/.agentrpg`). Shared by the CLI entry points.
export function defaultHome(): string {
  return process.env.AGENTRPG_HOME || join(process.env.HOME ?? "", ".agentrpg");
}

export function loadConfig(home: string): IConfig {
  const base: IConfig = {
    weights: DEFAULT_WEIGHTS,
    difficulty: DEFAULT_DIFFICULTY,
    achievements: DEFAULT_ACHIEVEMENTS,
    passive: DEFAULT_PASSIVE,
  };
  const p = join(home, "config.json");
  if (!existsSync(p)) {
    return base;
  }
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return {
      weights: {
        ...DEFAULT_WEIGHTS,
        ...(raw?.xp?.weights ?? {}),
        actions: { ...DEFAULT_WEIGHTS.actions, ...(raw?.xp?.weights?.actions ?? {}) },
      },
      difficulty: { ...DEFAULT_DIFFICULTY, ...(raw?.difficulty ?? {}) },
      achievements: { ...DEFAULT_ACHIEVEMENTS, ...(raw?.achievements ?? {}) },
      passive: { ...DEFAULT_PASSIVE, ...(raw?.passive ?? {}) },
    };
  } catch {
    return base;
  }
}
