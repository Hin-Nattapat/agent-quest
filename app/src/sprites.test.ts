import { test, expect } from "bun:test";
import { HeroAnim } from "./combat";
import { heroSpriteSet, heroFrames } from "./sprites";

test("heroSpriteSet resolves the Mage T1 set with 9 walk frames", () => {
  const set = heroSpriteSet("mage", 1);
  expect(set).toBeDefined();
  expect(set?.idle).toBe("/sprites/mage/t1/idle.png");
  expect(set?.walk.length).toBe(9);
  expect(set?.walk[0]).toBe("/sprites/mage/t1/walk-0.png");
  expect(set?.walk[8]).toBe("/sprites/mage/t1/walk-8.png");
});

test("heroSpriteSet returns undefined for forms with no art yet", () => {
  expect(heroSpriteSet("mage", 2)).toBeUndefined();
  expect(heroSpriteSet("rogue", 1)).toBeUndefined();
  expect(heroSpriteSet("novice", 0)).toBeUndefined();
});

test("heroFrames cycles the walk list only while wandering", () => {
  const set = heroSpriteSet("mage", 1);
  if (!set) {
    throw new Error("expected mage-t1 set");
  }
  expect(heroFrames(set, HeroAnim.Wander)).toEqual(set.walk);
  expect(heroFrames(set, HeroAnim.Idle)).toEqual([set.idle]);
  expect(heroFrames(set, HeroAnim.Attack)).toEqual([set.idle]);
  expect(heroFrames(set, HeroAnim.Farming)).toEqual([set.idle]);
});
