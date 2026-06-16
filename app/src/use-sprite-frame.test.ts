import { test, expect } from "bun:test";
import { frameAt } from "./use-sprite-frame";

test("frameAt holds frame 0 for a single frame or empty set", () => {
  expect(frameAt(0, 1, 10)).toBe(0);
  expect(frameAt(5000, 1, 10)).toBe(0);
  expect(frameAt(5000, 0, 10)).toBe(0);
});

test("frameAt advances one frame per 1000/fps ms", () => {
  // fps 10 → 100ms per frame
  expect(frameAt(0, 9, 10)).toBe(0);
  expect(frameAt(99, 9, 10)).toBe(0);
  expect(frameAt(100, 9, 10)).toBe(1);
  expect(frameAt(250, 9, 10)).toBe(2);
});

test("frameAt wraps with modulo over the frame count", () => {
  // 9 frames at fps 10 → loops every 900ms
  expect(frameAt(900, 9, 10)).toBe(0);
  expect(frameAt(1000, 9, 10)).toBe(1);
});
