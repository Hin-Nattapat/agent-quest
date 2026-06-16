import { test, expect } from "bun:test";
import { Facing, facingFromDelta } from "./facing";

test("facingFromDelta picks the dominant axis", () => {
  expect(facingFromDelta(5, 1)).toBe(Facing.East);
  expect(facingFromDelta(-5, 1)).toBe(Facing.West);
  expect(facingFromDelta(1, 5)).toBe(Facing.South);
  expect(facingFromDelta(1, -5)).toBe(Facing.North);
});

test("facingFromDelta breaks an axis tie toward vertical", () => {
  // |dx| == |dy| → the `>` test is false → vertical wins
  expect(facingFromDelta(3, 3)).toBe(Facing.South);
  expect(facingFromDelta(3, -3)).toBe(Facing.North);
});
