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
