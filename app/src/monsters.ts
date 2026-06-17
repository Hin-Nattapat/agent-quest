import { SceneTheme } from "./scene";
import { MonsterAnim } from "./combat";

export interface IMonsterSet {
  idle: string[]; // west-facing idle loop
  attack: string[]; // west-facing attack pose (one-shot per attack beat)
}

export const buildMonsterSet = (
  theme: string,
  idleFrames: number,
  attackFrames: number,
): IMonsterSet => ({
  idle: Array.from(
    { length: idleFrames },
    (_, i) => `/sprites/monsters/${theme}/idle/${i}.png`,
  ),
  attack: Array.from(
    { length: attackFrames },
    (_, i) => `/sprites/monsters/${theme}/attack/${i}.png`,
  ),
});

// Empty until art lands. After importing a theme's art (the importer prints idle/attack frame
// counts), add e.g. `[SceneTheme.Grassland]: buildMonsterSet("grassland", 4, 3),`. A missing theme
// returns undefined → the renderer keeps the emoji placeholder.
export const MONSTER_SPRITES: Partial<Record<SceneTheme, IMonsterSet>> = {};

export const monsterSet = (theme: SceneTheme): IMonsterSet | undefined =>
  MONSTER_SPRITES[theme];

// Attack frames on the attack beat (if any), otherwise the idle loop. Hurt/die keep the idle frames
// while their CSS keyframes (flash / fade) play over the top.
export const monsterFrames = (
  set: IMonsterSet | undefined,
  anim: MonsterAnim,
): string[] => {
  if (!set) {
    return [];
  }
  if (anim === MonsterAnim.Attack && set.attack.length > 0) {
    return set.attack;
  }
  return set.idle;
};
