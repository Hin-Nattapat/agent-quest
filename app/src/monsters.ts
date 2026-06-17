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

// Starter mobs (T1-T3, idle 9 + attack 9, west-facing). Add a theme here after importing its art
// (the importer prints the frame counts). A missing theme returns undefined → emoji placeholder.
export const MONSTER_SPRITES: Partial<Record<SceneTheme, IMonsterSet>> = {
  [SceneTheme.Grassland]: buildMonsterSet("grassland", 9, 9),
  [SceneTheme.Forest]: buildMonsterSet("forest", 9, 9),
  [SceneTheme.Dungeon]: buildMonsterSet("dungeon", 9, 9),
};

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
