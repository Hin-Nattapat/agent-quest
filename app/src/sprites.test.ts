import { test, expect } from "bun:test";
import { Facing } from "./facing";
import { heroSpriteSet, directionalFrames } from "./sprites";

test("heroSpriteSet resolves Mage T1 with 4 idle stills and 4×9 walk frames", () => {
  const set = heroSpriteSet("mage", 1);
  expect(set).toBeDefined();
  expect(set?.idle[Facing.East]).toBe("/sprites/mage/t1/idle/east.png");
  expect(set?.idle[Facing.South]).toBe("/sprites/mage/t1/idle/south.png");
  expect(set?.walk[Facing.West].length).toBe(9);
  expect(set?.walk[Facing.North][0]).toBe("/sprites/mage/t1/walk/north/0.png");
  expect(set?.walk[Facing.North][8]).toBe("/sprites/mage/t1/walk/north/8.png");
});

test("heroSpriteSet returns undefined for forms with no art", () => {
  expect(heroSpriteSet("mage", 2)).toBeUndefined();
  expect(heroSpriteSet("novice", 0)).toBeUndefined();
});

test("directionalFrames cycles walk when moving, else the idle still", () => {
  const set = heroSpriteSet("mage", 1);
  if (!set) {
    throw new Error("expected mage-t1 set");
  }
  expect(directionalFrames(set, Facing.East, true)).toEqual(set.walk[Facing.East]);
  expect(directionalFrames(set, Facing.South, false)).toEqual([set.idle[Facing.South]]);
});
