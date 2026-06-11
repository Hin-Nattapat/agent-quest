import { test, expect } from "bun:test";
import { loadProfile, saveProfile } from "../../core/profile";
import { ClassLine } from "../../core/classes";
import { makeHome } from "../helpers";

test("loadProfile defaults to empty when missing", () => {
  expect(loadProfile(makeHome())).toEqual({});
});

test("save then load round-trips", () => {
  const home = makeHome();
  saveProfile(home, { name: "Gandalf", line: ClassLine.Mage });
  expect(loadProfile(home)).toEqual({ name: "Gandalf", line: ClassLine.Mage });
});

test("invalid profile.json falls back to empty", () => {
  const home = makeHome();
  saveProfile(home, { name: "x" });
  Bun.spawnSync(["bash", "-c", `echo 'not json' > ${home}/profile.json`]);
  expect(loadProfile(home)).toEqual({});
});
