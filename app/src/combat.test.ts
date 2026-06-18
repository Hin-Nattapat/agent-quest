import { test, expect } from "bun:test";
import {
  HeroAnim,
  MonsterAnim,
  AttackStyle,
  PACK_HITS,
  packSize,
  makePack,
  firstAlive,
  strike,
  packCleared,
  heroAnim,
  monsterAnim,
  attackStyleFor,
  isRanged,
} from "./combat";
import { ActivityState } from "./activity";

test("heroAnim resolves priority celebrate > hurt > attack > activity base", () => {
  const base = {
    celebrate: false,
    hurt: false,
    attack: false,
    activity: ActivityState.Farming,
  };
  expect(heroAnim(base)).toBe(HeroAnim.Farming);
  expect(heroAnim({ ...base, activity: ActivityState.Rest })).toBe(HeroAnim.Rest);
  expect(heroAnim({ ...base, attack: true })).toBe(HeroAnim.Attack);
  expect(heroAnim({ ...base, attack: true, hurt: true })).toBe(HeroAnim.Hurt);
  expect(heroAnim({ ...base, attack: true, hurt: true, celebrate: true })).toBe(
    HeroAnim.Celebrate,
  );
});

test("monsterAnim resolves priority die > attack > hurt > idle", () => {
  expect(monsterAnim({ dying: false, attacking: false, hurt: false })).toBe(
    MonsterAnim.Idle,
  );
  expect(monsterAnim({ dying: false, attacking: false, hurt: true })).toBe(
    MonsterAnim.Hurt,
  );
  expect(monsterAnim({ dying: false, attacking: true, hurt: true })).toBe(
    MonsterAnim.Attack,
  );
  expect(monsterAnim({ dying: true, attacking: true, hurt: true })).toBe(MonsterAnim.Die);
});

test("packSize is 1..3, deterministic, and varies across waves", () => {
  const sizes = Array.from({ length: 30 }, (_, i) => packSize(i));
  for (const s of sizes) {
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThanOrEqual(3);
  }
  expect(packSize(7)).toBe(packSize(7)); // deterministic
  expect(new Set(sizes).size).toBeGreaterThan(1); // not constant
});

test("pack: make / firstAlive / strike / packCleared", () => {
  const pack = makePack(3);
  expect(pack).toEqual([PACK_HITS, PACK_HITS, PACK_HITS]);
  expect(firstAlive(pack)).toBe(0);

  let p = pack;
  for (let i = 0; i < PACK_HITS; i++) {
    p = strike(p, 0);
  }
  expect(p[0]).toBe(0);
  expect(p[1]).toBe(PACK_HITS); // only the target took damage
  expect(firstAlive(p)).toBe(1); // leftmost alive moved on
  expect(packCleared(p)).toBe(false);

  const cleared = makePack(1).map(() => 0);
  expect(firstAlive(cleared)).toBe(-1);
  expect(packCleared(cleared)).toBe(true);
});

test("strike floors at 0 and never goes negative", () => {
  expect(strike([0], 0)).toEqual([0]);
});

test("heroAnim returns Wander only when no pulse is active", () => {
  const base = {
    celebrate: false,
    hurt: false,
    attack: false,
    activity: ActivityState.Idle,
  };
  expect(heroAnim({ ...base, wander: true })).toBe(HeroAnim.Wander);
  expect(heroAnim({ ...base, wander: true, attack: true })).toBe(HeroAnim.Attack);
  expect(heroAnim({ ...base })).toBe(HeroAnim.Idle); // wander omitted → activity base
});

test("attackStyleFor: unknown/fallback lines melee", () => {
  expect(attackStyleFor("novice")).toBe(AttackStyle.Melee);
  expect(attackStyleFor("")).toBe(AttackStyle.Melee);
});

test("attackStyleFor maps every line to its style", () => {
  expect(attackStyleFor("mage")).toBe(AttackStyle.Cast);
  expect(attackStyleFor("ranger")).toBe(AttackStyle.Shoot);
  expect(attackStyleFor("rogue")).toBe(AttackStyle.Stab);
  expect(attackStyleFor("sage")).toBe(AttackStyle.Invoke);
  expect(attackStyleFor("novice")).toBe(AttackStyle.Melee);
});

test("isRanged: cast/shoot/invoke stand; stab/melee dash", () => {
  expect(isRanged(AttackStyle.Cast)).toBe(true);
  expect(isRanged(AttackStyle.Shoot)).toBe(true);
  expect(isRanged(AttackStyle.Invoke)).toBe(true);
  expect(isRanged(AttackStyle.Stab)).toBe(false);
  expect(isRanged(AttackStyle.Melee)).toBe(false);
});
