import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { ClassLine } from "../../core/classes";
import { makeHome } from "../helpers";

test("a classed character out-levels a Novice on the same line-heavy journal", () => {
  const cfg = loadConfig(makeHome());
  // 80 runs (mage signals) — plenty to pass Lv.5 and accrue the passive
  const run = {
    ts: "2026-06-11T12:00:00Z",
    source: "claude-code",
    session_id: "s",
    type: "action",
    action: "run",
    repo: "cq",
  } as any;
  const events = Array.from({ length: 80 }, () => ({ ...run }));

  const novice = reduce({ events, config: cfg, today: "2026-06-11" });
  const mage = reduce({
    events,
    config: cfg,
    today: "2026-06-11",
    profile: { line: ClassLine.Mage },
  });

  expect(mage.xp_total).toBeGreaterThan(novice.xp_total);
  expect(mage.level).toBeGreaterThanOrEqual(novice.level);
  expect(mage.class?.base_passive_pct).toBeGreaterThan(0);
});
