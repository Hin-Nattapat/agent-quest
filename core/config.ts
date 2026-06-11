import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { DEFAULT_WEIGHTS, DEFAULT_DIFFICULTY, type IWeights, type IDifficulty } from "./xp";

export interface IConfig {
  weights: IWeights;
  difficulty: IDifficulty;
}

export function loadConfig(home: string): IConfig {
  const base: IConfig = { weights: DEFAULT_WEIGHTS, difficulty: DEFAULT_DIFFICULTY };
  const p = join(home, "config.json");
  if (!existsSync(p)) return base;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8"));
    return {
      weights: {
        ...DEFAULT_WEIGHTS,
        ...(raw?.xp?.weights ?? {}),
        actions: { ...DEFAULT_WEIGHTS.actions, ...(raw?.xp?.weights?.actions ?? {}) },
      },
      difficulty: { ...DEFAULT_DIFFICULTY, ...(raw?.difficulty ?? {}) },
    };
  } catch {
    return base;
  }
}
