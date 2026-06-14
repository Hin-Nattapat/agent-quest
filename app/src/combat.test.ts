import { test, expect } from "bun:test";
import {
  HeroAnim,
  MonsterAnim,
  MONSTER_HITS,
  hitMonster,
  heroAnim,
  monsterAnim,
} from "./combat";
import { ActivityState } from "./activity";
import {
  PACK_HITS,
  packSize,
  makePack,
  firstAlive,
  strike,
  packCleared,
} from "./combat";

test("hitMonster increments and dies + respawns at MONSTER_HITS", () => {
  let hits = 0;
  let deaths = 0;
  for (let i = 0; i < MONSTER_HITS; i++) {
    const r = hitMonster(hits);
    hits = r.hits;
    if (r.died) {
      deaths++;
    }
  }
  expect(deaths).toBe(1);
  expect(hits).toBe(0); // respawned
});

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
  const base = { celebrate: false, hurt: false, attack: false, activity: ActivityState.Idle };
  expect(heroAnim({ ...base, wander: true })).toBe(HeroAnim.Wander);
  expect(heroAnim({ ...base, wander: true, attack: true })).toBe(HeroAnim.Attack);
  expect(heroAnim({ ...base })).toBe(HeroAnim.Idle); // wander omitted → activity base
});
