import { test, expect } from "bun:test";
import { slotPos } from "./mob-slots";

test("slotPos gives each pack slot a distinct staggered position; clamps out of range", () => {
  const a = slotPos(0);
  const b = slotPos(1);
  const c = slotPos(2);
  for (const p of [a, b, c]) {
    expect(typeof p.right).toBe("string");
    expect(typeof p.bottom).toBe("string");
  }
  expect(new Set([a.bottom, b.bottom, c.bottom]).size).toBe(3);
  expect(parseFloat(a.bottom)).toBeLessThan(parseFloat(c.bottom));
  expect(slotPos(9)).toEqual(c);
});
