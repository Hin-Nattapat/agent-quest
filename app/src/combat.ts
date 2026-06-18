import { ActivityState } from "./activity";

export enum HeroAnim {
  Farming = "farming",
  Idle = "idle",
  Rest = "rest",
  Attack = "attack",
  Hurt = "hurt",
  Celebrate = "celebrate",
  Wander = "wander",
}

export enum MonsterAnim {
  Idle = "idle",
  Hurt = "hurt",
  Attack = "attack",
  Die = "die",
}

export enum AttackStyle {
  Cast = "cast",
  Shoot = "shoot",
  Stab = "stab",
  Invoke = "invoke",
  Melee = "melee",
}

// Which battle attack a class plays. The director gates this on attack-art presence, so a line
// with no attack frames yet falls back to the Melee dash.
export const attackStyleFor = (line: string): AttackStyle => {
  if (line === "mage") {
    return AttackStyle.Cast;
  }
  if (line === "ranger") {
    return AttackStyle.Shoot;
  }
  if (line === "rogue") {
    return AttackStyle.Stab;
  }
  if (line === "sage") {
    return AttackStyle.Invoke;
  }
  return AttackStyle.Melee;
};

// Ranged styles stand and fire a projectile-like VFX; melee styles dash in.
export const isRanged = (style: AttackStyle): boolean => {
  return (
    style === AttackStyle.Cast ||
    style === AttackStyle.Shoot ||
    style === AttackStyle.Invoke
  );
};

const HERO_BASE: Record<ActivityState, HeroAnim> = {
  [ActivityState.Farming]: HeroAnim.Farming,
  [ActivityState.Idle]: HeroAnim.Idle,
  [ActivityState.Rest]: HeroAnim.Rest,
};

interface IHeroAnimArgs {
  celebrate: boolean;
  hurt: boolean;
  attack: boolean;
  activity: ActivityState;
  wander?: boolean;
}

export const heroAnim = (props: IHeroAnimArgs): HeroAnim => {
  const { celebrate, hurt, attack, activity, wander } = props;
  if (celebrate) {
    return HeroAnim.Celebrate;
  }
  if (hurt) {
    return HeroAnim.Hurt;
  }
  if (attack) {
    return HeroAnim.Attack;
  }
  if (wander) {
    return HeroAnim.Wander;
  }
  return HERO_BASE[activity];
};

interface IMonsterAnimArgs {
  dying: boolean;
  attacking: boolean;
  hurt: boolean;
}

export const monsterAnim = (props: IMonsterAnimArgs): MonsterAnim => {
  const { dying, attacking, hurt } = props;
  if (dying) {
    return MonsterAnim.Die;
  }
  if (attacking) {
    return MonsterAnim.Attack;
  }
  if (hurt) {
    return MonsterAnim.Hurt;
  }
  return MonsterAnim.Idle;
};

export const PACK_HITS = 3; // cosmetic hits to fell one pack mob

// Small pure 32-bit integer hash → varied-but-deterministic wave sizes (no Math.random in logic).
// Intentionally re-implemented here rather than importing core/rng: app/ must not import core
// runtime code (app/CLAUDE.md seam). Signature differs too (number→number vs string→() => number).
const hashInt = (n: number): number => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

export const packSize = (waveIndex: number): number => 1 + (hashInt(waveIndex) % 3);
export const makePack = (size: number): number[] => Array(size).fill(PACK_HITS);
export const firstAlive = (pack: number[]): number => pack.findIndex(h => h > 0);
export const strike = (pack: number[], idx: number): number[] =>
  pack.map((h, i) => (i === idx ? Math.max(0, h - 1) : h));
export const packCleared = (pack: number[]): boolean => pack.every(h => h <= 0);
