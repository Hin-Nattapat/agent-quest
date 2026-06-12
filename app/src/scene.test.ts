import { test, expect } from "bun:test";
import { sceneFor, SceneTheme } from "./scene";

test("sceneFor maps tier to a theme + monster", () => {
  expect(sceneFor(0).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(1).theme).toBe(SceneTheme.Grassland);
  expect(sceneFor(2).theme).toBe(SceneTheme.Forest);
  expect(sceneFor(3).theme).toBe(SceneTheme.Dungeon);
  expect(sceneFor(4).theme).toBe(SceneTheme.SecretRealm);
  expect(sceneFor(5).theme).toBe(SceneTheme.SecretRealm);
  expect(sceneFor(2).monster).toBe("Error Wraith");
});
