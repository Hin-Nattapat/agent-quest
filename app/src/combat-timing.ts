import { AttackStyle, attackStyleFor, isRanged } from "./combat";

// Single source for the hero attack-animation length, shared by the farming director and the boss
// fight. It MUST stay in lockstep with the hero sprite's frame cycle (≈9 frames at 15fps) and the
// CSS keyframes: a ranged/cast hero needs its full ~600ms cycle, a melee dash is a quick 280ms.
// (Previously forked as CAST_MS/HERO_MS.attack in the director and HERO_RANGED_MS/HERO_MELEE_MS in
// the boss fight.)
export const HERO_RANGED_ATTACK_MS = 600;
export const HERO_MELEE_ATTACK_MS = 280;

export const attackMsForStyle = (style: AttackStyle): number =>
  isRanged(style) ? HERO_RANGED_ATTACK_MS : HERO_MELEE_ATTACK_MS;

export const heroAttackMs = (line: string): number =>
  attackMsForStyle(attackStyleFor(line));
