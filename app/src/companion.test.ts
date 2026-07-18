import { test, expect } from "bun:test";
import { companionFrames, CompanionFacing } from "./companion";

test("companionFrames resolves 9 frames per facing for imported companions", () => {
  const east = companionFrames("sir_quacks", CompanionFacing.East);
  expect(east.length).toBe(9);
  expect(east[0]).toBe("/sprites/companion/sir_quacks/east/0.png");
  expect(companionFrames("sir_quacks", CompanionFacing.South)[8]).toBe(
    "/sprites/companion/sir_quacks/south/8.png",
  );
  expect(companionFrames("unknown_pet", CompanionFacing.East)).toEqual([]);
});
