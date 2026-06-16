import { test, expect } from "bun:test";
import { SceneMode } from "./scene-mode";
import { bannerScene } from "./scene-banner";

test("battle banner keys on mode+theme and labels Entering Battle", () => {
  const b = bannerScene(SceneMode.Battle, "lair_skyforge");
  expect(b.theme).toBe("battle:lair_skyforge");
  expect(b.label).toBe("Entering Battle");
});

test("overworld banner is a single stable key labelled Returning to Guild", () => {
  const b = bannerScene(SceneMode.Overworld, "lair_skyforge");
  expect(b.theme).toBe("overworld");
  expect(b.label).toBe("Returning to Guild");
});
