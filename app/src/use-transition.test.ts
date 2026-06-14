import { test, expect } from "bun:test";
import { shouldTransition } from "./use-transition";

test("shouldTransition fires only on a real theme change, never first mount", () => {
  expect(shouldTransition(null, "grassland")).toBe(false); // first mount — no "from" world
  expect(shouldTransition("grassland", "grassland")).toBe(false); // unchanged
  expect(shouldTransition("grassland", "skyforge_aether")).toBe(true); // tier-up / realm change
  expect(shouldTransition("skyforge_aether", "guild")).toBe(true); // field → guild
  expect(shouldTransition("guild", "grassland")).toBe(true); // guild → field
});
