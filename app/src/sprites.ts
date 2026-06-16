import { HeroAnim } from "./combat";

export interface ISpriteSet {
  idle: string;
  walk: string[];
}

// key = `${line}-t${tier}`. Partial: only forms with real art appear; a missing key returns
// undefined so the renderer keeps the emoji placeholder (today only Mage T1 exists).
export const HERO_SPRITES: Partial<Record<string, ISpriteSet>> = {
  "mage-t1": {
    idle: "/sprites/mage/t1/idle.png",
    walk: [
      "/sprites/mage/t1/walk-0.png",
      "/sprites/mage/t1/walk-1.png",
      "/sprites/mage/t1/walk-2.png",
      "/sprites/mage/t1/walk-3.png",
      "/sprites/mage/t1/walk-4.png",
      "/sprites/mage/t1/walk-5.png",
      "/sprites/mage/t1/walk-6.png",
      "/sprites/mage/t1/walk-7.png",
      "/sprites/mage/t1/walk-8.png",
    ],
  },
};

export const heroSpriteSet = (line: string, tier: number): ISpriteSet | undefined => {
  return HERO_SPRITES[`${line}-t${tier}`];
};

export const heroFrames = (set: ISpriteSet, anim: HeroAnim): string[] => {
  if (anim === HeroAnim.Wander) {
    return set.walk;
  }
  return [set.idle];
};
