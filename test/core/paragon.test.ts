import { test, expect } from "bun:test";
import { paragonFor, AURA_MILESTONES } from "../../core/paragon";
import { xpForLevel, DEFAULT_DIFFICULTY } from "../../core/xp";

const CAP_XP = xpForLevel(DEFAULT_DIFFICULTY.level_cap, DEFAULT_DIFFICULTY);
const STEP =
  xpForLevel(DEFAULT_DIFFICULTY.level_cap, DEFAULT_DIFFICULTY) -
  xpForLevel(DEFAULT_DIFFICULTY.level_cap - 1, DEFAULT_DIFFICULTY);

test("below the cap paragon is level 0 with a full step ahead", () => {
  const p = paragonFor({ xpTotal: CAP_XP - 1, difficulty: DEFAULT_DIFFICULTY });
  expect(p).toEqual({ level: 0, xp_in_paragon: 0, xp_to_next: STEP, auras: [] });
});

test("paragon levels are flat-priced from overflow XP", () => {
  expect(paragonFor({ xpTotal: CAP_XP, difficulty: DEFAULT_DIFFICULTY }).level).toBe(0);
  const p1 = paragonFor({ xpTotal: CAP_XP + STEP, difficulty: DEFAULT_DIFFICULTY });
  expect(p1.level).toBe(1);
  expect(p1.xp_in_paragon).toBe(0);
  expect(p1.xp_to_next).toBe(STEP);
  const p7 = paragonFor({
    xpTotal: CAP_XP + 7 * STEP + 123,
    difficulty: DEFAULT_DIFFICULTY,
  });
  expect(p7.level).toBe(7);
  expect(p7.xp_in_paragon).toBe(123);
  expect(p7.xp_to_next).toBe(STEP - 123);
});

test("aura milestones unlock at exactly their paragon level", () => {
  const p9 = paragonFor({ xpTotal: CAP_XP + 9 * STEP, difficulty: DEFAULT_DIFFICULTY });
  expect(p9.auras).toEqual([]);
  const p10 = paragonFor({ xpTotal: CAP_XP + 10 * STEP, difficulty: DEFAULT_DIFFICULTY });
  expect(p10.auras).toEqual(["ember"]);
  const p100 = paragonFor({
    xpTotal: CAP_XP + 100 * STEP,
    difficulty: DEFAULT_DIFFICULTY,
  });
  expect(p100.auras).toEqual(["ember", "azure", "royal", "radiant"]);
  expect(AURA_MILESTONES.map(m => m.level)).toEqual([10, 25, 50, 100]);
});

test("the step adapts to the difficulty config and never drops below 1", () => {
  const easy = { curve_k: 0.00005, curve_exp: 2.5, level_cap: 50 };
  const p = paragonFor({ xpTotal: 500, difficulty: easy });
  expect(p.xp_to_next).toBeGreaterThanOrEqual(1); // degenerate curve still steps by >= 1
  expect(p.level).toBeGreaterThan(0);
});

test("a degenerate level_cap of 1 still yields finite paragon math", () => {
  const p = paragonFor({
    xpTotal: 100,
    difficulty: { curve_k: 7, curve_exp: 2.5, level_cap: 1 },
  });
  expect(Number.isFinite(p.level)).toBe(true);
  expect(p.xp_to_next).toBeGreaterThanOrEqual(1);
});
