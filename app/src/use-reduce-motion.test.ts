import { test, expect } from "bun:test";
import { effectiveReducedMotion } from "./use-reduce-motion";

test("effectiveReducedMotion is on when either the in-app pref or the OS setting is", () => {
  expect(effectiveReducedMotion(false, false)).toBe(false);
  expect(effectiveReducedMotion(true, false)).toBe(true);
  expect(effectiveReducedMotion(false, true)).toBe(true);
  expect(effectiveReducedMotion(true, true)).toBe(true);
});
