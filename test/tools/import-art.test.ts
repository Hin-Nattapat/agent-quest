import { test, expect } from "bun:test";
import { AssetType, parseTarget, frameIndex, pickAnimDir } from "../../tools/import-art";

test("parseTarget reads hero line+tier and bg/item name", () => {
  expect(parseTarget("hero:mage:t4a")).toEqual({
    type: AssetType.Hero,
    line: "mage",
    tier: "t4a",
  });
  expect(parseTarget("bg:grassland")).toEqual({ type: AssetType.Bg, name: "grassland" });
  expect(parseTarget("item:trophy")).toEqual({ type: AssetType.Item, name: "trophy" });
});

test("parseTarget rejects unknown type and wrong arg count", () => {
  expect(() => parseTarget("wizard:mage:t1")).toThrow(/unknown asset type/);
  expect(() => parseTarget("hero:mage")).toThrow(/hero needs/);
  expect(() => parseTarget("bg:a:b")).toThrow(/bg needs/);
});

test("frameIndex strips PixelLab zero-padding", () => {
  expect(frameIndex("frame_000.png")).toBe("0");
  expect(frameIndex("frame_007.png")).toBe("7");
  expect(frameIndex("frame_012.png")).toBe("12");
  expect(() => frameIndex(".DS_Store")).toThrow(/frame file/);
});

test("pickAnimDir matches PixelLab's inconsistent folder names", () => {
  const names = ["walking_forward", "casting_a_spell_swinging_the_staff_up_then_thrusti"];
  expect(pickAnimDir(names, "alking")).toBe("walking_forward");
  expect(pickAnimDir(names, "asting")).toBe(
    "casting_a_spell_swinging_the_staff_up_then_thrusti",
  );
  expect(pickAnimDir(["Casting_a_spell"], "asting")).toBe("Casting_a_spell");
  expect(pickAnimDir(names, "rotations")).toBeNull();
});
