import { test, expect } from "bun:test";
import { hashStr, seededRng } from "../../core/rng";

test("hashStr is deterministic and distinguishes strings", () => {
  expect(hashStr("clean:s1")).toBe(hashStr("clean:s1"));
  expect(hashStr("a")).not.toBe(hashStr("b"));
});

test("seededRng is deterministic and yields [0,1)", () => {
  const va = seededRng("x")();
  expect(va).toBe(seededRng("x")());
  expect(va).toBeGreaterThanOrEqual(0);
  expect(va).toBeLessThan(1);
  expect(seededRng("y")()).not.toBe(seededRng("x")());
});
