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
    walk[dir] = Array.from(
      { length: walkFrames },
      (_, i) => `/sprites/${root}/walk/${dir}/${i}.png`,
    );
  }
  return { idle, walk };
};

// key = `${line}-t${tier}`, or `${line}-t4a`/`-t4b` at tier 4 (the form splits by branch). Partial:
// only forms with real art appear; a missing key returns undefined so the renderer keeps the emoji.
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": buildSet("mage/t1", 9),
  "mage-t2": buildSet("mage/t2", 9),
  "mage-t3": buildSet("mage/t3", 9),
  "mage-t4a": buildSet("mage/t4a", 9),
  "mage-t4b": buildSet("mage/t4b", 9),
};

// At tier 4 the form branches (a/b) so the key carries it; below tier 4 the branch is ignored.
export const heroKey = (line: string, tier: number, branch?: string | null): string => {
  if (tier >= 4 && branch) {
    return `${line}-t${tier}${branch}`;
  }
  return `${line}-t${tier}`;
};

export const heroSpriteSet = (
  line: string,
  tier: number,
  branch?: string | null,
): ISpriteSet | undefined => {
  return HERO_SPRITES[heroKey(line, tier, branch)];
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
