import { test, expect } from "bun:test";
import { ActivityState } from "./activity";
import { SceneMode, sceneModeFor } from "./scene-mode";

test("farming is Battle; idle and rest are Overworld", () => {
  expect(sceneModeFor(ActivityState.Farming)).toBe(SceneMode.Battle);
  expect(sceneModeFor(ActivityState.Idle)).toBe(SceneMode.Overworld);
  expect(sceneModeFor(ActivityState.Rest)).toBe(SceneMode.Overworld);
});
