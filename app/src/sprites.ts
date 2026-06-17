import { Facing } from "./facing";

export interface ISpriteSet {
  idle: Record<Facing, string>;
  walk: Record<Facing, string[]>;
  cast?: string[]; // east-facing cast frames; present only where the art exists
}

const DIRS: Facing[] = [Facing.South, Facing.North, Facing.East, Facing.West];

// Build a set whose files live at /sprites/<root>/idle/<dir>.png and walk/<dir>/<0..8>.png.
// castFrames > 0 adds east-facing cast frames at cast/<0..n-1>.png.
const buildSet = (root: string, walkFrames: number, castFrames = 0): ISpriteSet => {
  const idle = {} as Record<Facing, string>;
  const walk = {} as Record<Facing, string[]>;
  for (const dir of DIRS) {
    idle[dir] = `/sprites/${root}/idle/${dir}.png`;
    walk[dir] = Array.from(
      { length: walkFrames },
      (_, i) => `/sprites/${root}/walk/${dir}/${i}.png`,
    );
  }
  const set: ISpriteSet = { idle, walk };
  if (castFrames > 0) {
    set.cast = Array.from(
      { length: castFrames },
      (_, i) => `/sprites/${root}/cast/${i}.png`,
    );
  }
  return set;
};

// key = `${line}-t${tier}`, or `${line}-t4a`/`-t4b` at tier 4 (the form splits by branch). Partial:
// only forms with real art appear; a missing key returns undefined so the renderer keeps the emoji.
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": buildSet("mage/t1", 9, 9),
  "mage-t2": buildSet("mage/t2", 9, 9),
  "mage-t3": buildSet("mage/t3", 9, 9),
  "mage-t4a": buildSet("mage/t4a", 9, 9),
  "mage-t4b": buildSet("mage/t4b", 9, 9),
  // Ranger: walk + idle only for now (no cast art wired — ranger uses the melee dash).
  "ranger-t1": buildSet("ranger/t1", 9),
  "ranger-t2": buildSet("ranger/t2", 9),
  "ranger-t3": buildSet("ranger/t3", 9),
  "ranger-t4a": buildSet("ranger/t4a", 9),
  "ranger-t4b": buildSet("ranger/t4b", 9),
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
