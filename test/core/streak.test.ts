import { test, expect } from "bun:test";
import { computeStreak, eventLocalDate } from "../../core/streak";

test("a 3-day run ending today gives current=best=3", () => {
  const s = computeStreak(["2026-06-09", "2026-06-10", "2026-06-11"], "2026-06-11");
  expect(s).toEqual({ current_days: 3, best_days: 3, last_active: "2026-06-11" });
});

test("active yesterday (gap 1) keeps the streak alive", () => {
  const s = computeStreak(["2026-06-10", "2026-06-11"], "2026-06-12");
  expect(s.current_days).toBe(2);
});

test("a gap > 1 day breaks current but best survives", () => {
  const s = computeStreak(
    ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-10", "2026-06-11"],
    "2026-06-15",
  );
  expect(s.best_days).toBe(3); // 01-03
  expect(s.current_days).toBe(0); // last active 06-11, today 06-15 -> broken
  expect(s.last_active).toBe("2026-06-11");
});

test("duplicates are collapsed; empty input is zero", () => {
  expect(computeStreak(["2026-06-11", "2026-06-11"], "2026-06-11").current_days).toBe(1);
  expect(computeStreak([], "2026-06-11")).toEqual({
    current_days: 0,
    best_days: 0,
    last_active: "",
  });
});

test("eventLocalDate returns a YYYY-MM-DD key", () => {
  expect(eventLocalDate("2026-06-11T12:00:00Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
