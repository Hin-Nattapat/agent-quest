import { test, expect } from "bun:test";
import { weekRangeLabel, levelLabel } from "./chronicle-view";

test("weekRangeLabel formats within and across months", () => {
  expect(weekRangeLabel("2026-07-13")).toBe("Jul 13–19");
  expect(weekRangeLabel("2026-07-27")).toBe("Jul 27 – Aug 2");
});

test("levelLabel collapses flat weeks", () => {
  const base = {
    week: "2026-W29",
    start: "2026-07-13",
    xp: 0,
    actions: 0,
    prompts: 0,
    sessions: 0,
    bosses_defeated: 0,
    bosses_fled: 0,
    top_realm: null,
    active_days: 0,
    busiest_day: null,
  };
  expect(levelLabel({ ...base, level_start: 43, level_end: 44 })).toBe("Lv.43→44");
  expect(levelLabel({ ...base, level_start: 50, level_end: 50 })).toBe("Lv.50");
});
