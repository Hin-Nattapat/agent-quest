import { Facing } from "./facing";

export interface ISpriteSet {
  idle: Record<Facing, string>;
  walk: Record<Facing, string[]>;
}

const DIRS: Facing[] = [Facing.South, Facing.North, Facing.East, Facing.West];

// Build a set whose files live at /sprites/<root>/idle/<dir>.png and walk/<dir>/<0..8>.png.
const buildSet = (root: string, walkFrames: number): ISpriteSet => {
  const idle = {} as Record<Facing, string>;
  const walk = {} as Record<Facing, string[]>;
  for (const dir of DIRS) {
    idle[dir] = `/sprites/${root}/idle/${dir}.png`;
    walk[dir] = Array.from({ length: walkFrames }, (_, i) => `/sprites/${root}/walk/${dir}/${i}.png`);
  }
  return { idle, walk };
};

// key = `${line}-t${tier}`. Partial: only forms with real art appear; a missing key returns
// undefined so the renderer keeps the emoji placeholder (today only Mage T1 exists).
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": buildSet("mage/t1", 9),
};

export const heroSpriteSet = (line: string, tier: number): ISpriteSet | undefined => {
  return HERO_SPRITES[`${line}-t${tier}`];
};

export const directionalFrames = (
  set: ISpriteSet,
  facing: Facing,
  moving: boolean,
): string[] => {
  if (moving) {
    return set.walk[facing];
  }
  return [set.idle[facing]];
};
