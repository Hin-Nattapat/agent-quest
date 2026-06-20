import { test, expect } from "bun:test";
import { Facing } from "./facing";
import { heroSpriteSet, heroKey, directionalFrames } from "./sprites";

test("heroKey carries the branch only at tier 4", () => {
  expect(heroKey("mage", 1)).toBe("mage-t1");
  expect(heroKey("mage", 3, "a")).toBe("mage-t3"); // branch ignored below tier 4
  expect(heroKey("mage", 4, "a")).toBe("mage-t4a");
  expect(heroKey("mage", 4, "b")).toBe("mage-t4b");
  expect(heroKey("mage", 4, null)).toBe("mage-t4"); // pre-branch (no art)
});

test("heroSpriteSet resolves every Mage form (T1-T3 + both T4 branches)", () => {
  expect(heroSpriteSet("mage", 1)?.idle[Facing.East]).toBe(
    "/sprites/mage/t1/idle/east.png",
  );
  expect(heroSpriteSet("mage", 2)?.walk[Facing.South].length).toBe(9);
  expect(heroSpriteSet("mage", 3)).toBeDefined();
  expect(heroSpriteSet("mage", 4, "a")?.idle[Facing.West]).toBe(
    "/sprites/mage/t4a/idle/west.png",
  );
  expect(heroSpriteSet("mage", 4, "b")?.walk[Facing.North][8]).toBe(
    "/sprites/mage/t4b/walk/north/8.png",
  );
});

test("heroSpriteSet returns undefined for forms with no art", () => {
  expect(heroSpriteSet("mage", 4, null)).toBeUndefined(); // tier 4 before a branch is chosen
  expect(heroSpriteSet("maestro", 1)).toBeUndefined(); // secret line, no art yet
});

test("heroSpriteSet resolves the Novice starter (tier 0)", () => {
  expect(heroKey("novice", 0)).toBe("novice-t0");
  expect(heroSpriteSet("novice", 0)?.idle[Facing.South]).toBe(
    "/sprites/novice/t0/idle/south.png",
  );
  expect(heroSpriteSet("novice", 0)?.attack?.length).toBe(9);
});

test("directionalFrames cycles walk when moving, else the idle still", () => {
  const set = heroSpriteSet("mage", 1);
  if (!set) {
    throw new Error("expected mage-t1 set");
  }
  expect(directionalFrames(set, Facing.East, true)).toEqual(set.walk[Facing.East]);
  expect(directionalFrames(set, Facing.South, false)).toEqual([set.idle[Facing.South]]);
});

test("Mage forms carry 9 east cast frames", () => {
  expect(heroSpriteSet("mage", 1)?.attack?.length).toBe(9);
  expect(heroSpriteSet("mage", 1)?.attack?.[0]).toBe("/sprites/mage/t1/attack/0.png");
  expect(heroSpriteSet("mage", 4, "b")?.attack?.[8]).toBe(
    "/sprites/mage/t4b/attack/8.png",
  );
});

test("Ranger forms resolve (walk + idle + attack)", () => {
  expect(heroSpriteSet("ranger", 1)?.idle[Facing.East]).toBe(
    "/sprites/ranger/t1/idle/east.png",
  );
  expect(heroSpriteSet("ranger", 1)?.walk[Facing.South].length).toBe(9);
  expect(heroSpriteSet("ranger", 1)?.attack?.length).toBe(9);
  expect(heroSpriteSet("ranger", 1)?.attack?.[0]).toBe("/sprites/ranger/t1/attack/0.png");
  expect(heroSpriteSet("ranger", 4, "a")).toBeDefined();
});

test("Rogue forms resolve (walk + idle + attack)", () => {
  expect(heroSpriteSet("rogue", 1)?.idle[Facing.East]).toBe(
    "/sprites/rogue/t1/idle/east.png",
  );
  expect(heroSpriteSet("rogue", 1)?.walk[Facing.South].length).toBe(9);
  expect(heroSpriteSet("rogue", 1)?.attack?.length).toBe(9);
  expect(heroSpriteSet("rogue", 4, "b")).toBeDefined();
});

test("Sage forms resolve (walk + idle + attack)", () => {
  expect(heroSpriteSet("sage", 1)?.idle[Facing.East]).toBe(
    "/sprites/sage/t1/idle/east.png",
  );
  expect(heroSpriteSet("sage", 1)?.walk[Facing.South].length).toBe(9);
  expect(heroSpriteSet("sage", 1)?.attack?.length).toBe(9);
  expect(heroSpriteSet("sage", 4, "a")).toBeDefined();
});
