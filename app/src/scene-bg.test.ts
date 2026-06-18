import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { hasSceneBg } from "./scene-bg";

test("hasSceneBg is true for a wired theme, false otherwise", () => {
  expect(hasSceneBg(SceneTheme.Grassland)).toBe(true);
  expect(hasSceneBg(SceneTheme.Forest)).toBe(true);
  expect(hasSceneBg(SceneTheme.Dungeon)).toBe(true);
  expect(hasSceneBg(SceneTheme.SkyforgeAether)).toBe(true);
  expect(hasSceneBg(SceneTheme.CircuitCatacombs)).toBe(true);
  expect(hasSceneBg(SceneTheme.Guild)).toBe(false);
  expect(hasSceneBg(SceneTheme.Ascendant)).toBe(false);
});
