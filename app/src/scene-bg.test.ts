import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { hasSceneBg } from "./scene-bg";

test("hasSceneBg is false until a theme's art is wired in", () => {
  expect(hasSceneBg(SceneTheme.Guild)).toBe(false);
  expect(hasSceneBg(SceneTheme.Grassland)).toBe(false);
});
