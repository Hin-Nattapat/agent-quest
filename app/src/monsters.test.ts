import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { MonsterAnim } from "./combat";
import { buildMonsterSet, monsterSet, monsterFrames } from "./monsters";

test("buildMonsterSet lays out idle + attack frame paths", () => {
  const set = buildMonsterSet("grassland", 3, 2);
  expect(set.idle).toEqual([
    "/sprites/monsters/grassland/idle/0.png",
    "/sprites/monsters/grassland/idle/1.png",
    "/sprites/monsters/grassland/idle/2.png",
  ]);
  expect(set.attack).toEqual([
    "/sprites/monsters/grassland/attack/0.png",
    "/sprites/monsters/grassland/attack/1.png",
  ]);
});

test("monsterFrames picks attack on attack anim, else idle", () => {
  const set = buildMonsterSet("forest", 2, 2);
  expect(monsterFrames(set, MonsterAnim.Attack)).toBe(set.attack);
  expect(monsterFrames(set, MonsterAnim.Idle)).toBe(set.idle);
  expect(monsterFrames(set, MonsterAnim.Hurt)).toBe(set.idle);
  expect(monsterFrames(undefined, MonsterAnim.Idle)).toEqual([]);
});

test("monsterSet returns undefined for an unwired theme", () => {
  expect(monsterSet(SceneTheme.Guild)).toBeUndefined();
});
