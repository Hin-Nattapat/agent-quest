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
import {
  LOOT_TABLE,
  DROP_TABLES,
  DEFAULT_BOSS_RATE,
  DEFAULT_BOSS_FLEE_RATE,
  type ILootItem,
  type TDropTable,
} from "./loot";

export interface IConfig {
  weights: IWeights;
  difficulty: IDifficulty;
  achievements?: Record<string, IAchievementDef>; // optional so pre-2a reduce(events, cfg) callers still type-check
  passive?: TPassiveRates;
  loot?: Record<string, ILootItem>;
  drops?: Record<string, TDropTable>;
  boss_rate?: number;
  boss_flee_rate?: number;
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
    loot: LOOT_TABLE,
    drops: DROP_TABLES,
    boss_rate: DEFAULT_BOSS_RATE,
    boss_flee_rate: DEFAULT_BOSS_FLEE_RATE,
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
      loot: { ...LOOT_TABLE, ...(raw?.loot ?? {}) },
      drops: { ...DROP_TABLES, ...(raw?.drops ?? {}) },
      boss_rate: raw?.boss_rate ?? DEFAULT_BOSS_RATE,
      boss_flee_rate: raw?.boss_flee_rate ?? DEFAULT_BOSS_FLEE_RATE,
    };
  } catch {
    return base;
  }
}
