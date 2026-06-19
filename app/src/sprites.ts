import { Facing } from "./facing";

export interface ISpriteSet {
  idle: Record<Facing, string>;
  walk: Record<Facing, string[]>;
  attack?: string[]; // east-facing attack frames (cast/shoot/stab/invoke); present where art exists
}

const DIRS: Facing[] = [Facing.South, Facing.North, Facing.East, Facing.West];

// Build a set whose files live at /sprites/<root>/idle/<dir>.png and walk/<dir>/<0..8>.png.
// attackFrames > 0 adds east-facing attack frames at attack/<0..n-1>.png.
const buildSet = (root: string, walkFrames: number, attackFrames = 0): ISpriteSet => {
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
  if (attackFrames > 0) {
    set.attack = Array.from(
      { length: attackFrames },
      (_, i) => `/sprites/${root}/attack/${i}.png`,
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
  // Ranger: idle + walk + attack (Shoot — stands and looses an arrow).
  "ranger-t1": buildSet("ranger/t1", 9, 9),
  "ranger-t2": buildSet("ranger/t2", 9, 9),
  "ranger-t3": buildSet("ranger/t3", 9, 9),
  "ranger-t4a": buildSet("ranger/t4a", 9, 9),
  "ranger-t4b": buildSet("ranger/t4b", 9, 9),
  // Rogue: idle + walk + attack (Stab — dashes in and slashes).
  "rogue-t1": buildSet("rogue/t1", 9, 9),
  "rogue-t2": buildSet("rogue/t2", 9, 9),
  "rogue-t3": buildSet("rogue/t3", 9, 9),
  "rogue-t4a": buildSet("rogue/t4a", 9, 9),
  "rogue-t4b": buildSet("rogue/t4b", 9, 9),
  // Sage: idle + walk + attack (Invoke — stands and calls down a glyph).
  "sage-t1": buildSet("sage/t1", 9, 9),
  "sage-t2": buildSet("sage/t2", 9, 9),
  "sage-t3": buildSet("sage/t3", 9, 9),
  "sage-t4a": buildSet("sage/t4a", 9, 9),
  "sage-t4b": buildSet("sage/t4b", 9, 9),
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

// The front-facing (south) idle frame for a class — used as the portrait face in the HUD and Hero
// panel. Returns undefined for an unwired class so the caller keeps its emoji fallback.
interface IHeroPortraitClass {
  line?: string | null;
  tier?: number;
  branch?: string | null;
}
export const heroPortrait = (
  klass: IHeroPortraitClass | null | undefined,
): string | undefined => {
  if (!klass?.line) {
    return undefined;
  }
  const set = heroSpriteSet(klass.line, klass.tier ?? 0, klass.branch ?? null);
  return set?.idle[Facing.South];
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
