import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { MonsterAnim } from "./combat";
import { CreatureKind, buildCreatureSet, monsterSet, monsterFrames } from "./monsters";

test("buildCreatureSet lays out idle + attack frame paths", () => {
  const set = buildCreatureSet(CreatureKind.Monster, "grassland", 3, 2);
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

test("buildCreatureSet keys the folder off the kind", () => {
  const boss = buildCreatureSet(CreatureKind.Boss, "grassland", 1, 1);
  expect(boss.idle[0]).toBe("/sprites/boss/grassland/idle/0.png");
  expect(boss.attack[0]).toBe("/sprites/boss/grassland/attack/0.png");
});

test("monsterFrames picks attack on attack anim, else idle", () => {
  const set = buildCreatureSet(CreatureKind.Monster, "forest", 2, 2);
  expect(monsterFrames(set, MonsterAnim.Attack)).toBe(set.attack);
  expect(monsterFrames(set, MonsterAnim.Idle)).toBe(set.idle);
  expect(monsterFrames(set, MonsterAnim.Hurt)).toBe(set.idle);
  expect(monsterFrames(undefined, MonsterAnim.Idle)).toEqual([]);
});

test("monsterSet returns undefined for an unwired theme", () => {
  expect(monsterSet(SceneTheme.Guild)).toBeUndefined();
});

test("starter themes (T1-T3) resolve to 9+9 frame sets", () => {
  for (const theme of [SceneTheme.Grassland, SceneTheme.Forest, SceneTheme.Dungeon]) {
    expect(monsterSet(theme)?.idle.length).toBe(9);
    expect(monsterSet(theme)?.attack.length).toBe(9);
  }
  expect(monsterSet(SceneTheme.Grassland)?.idle[0]).toBe(
    "/sprites/monsters/grassland/idle/0.png",
  );
});
