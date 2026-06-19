import { test, expect } from "bun:test";
import { SceneTheme } from "./scene";
import { hasOverworldBg } from "./overworld-bg";

test("hasOverworldBg is true for the imported guild map, false otherwise", () => {
  expect(hasOverworldBg(SceneTheme.Guild)).toBe(true);
  expect(hasOverworldBg(SceneTheme.Ascendant)).toBe(false);
});
