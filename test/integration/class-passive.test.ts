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

test("passive locks at earn time: switching class later keeps the prior class's XP and level", () => {
  const cfg = loadConfig(makeHome());
  const run = {
    ts: "2026-06-11T12:00:00Z",
    source: "claude-code",
    session_id: "s",
    type: "action",
    action: "run", // a Mage signal, not a Rogue one
    repo: "cq",
  } as any;
  const events = Array.from({ length: 80 }, () => ({ ...run }));

  // Earned every event as a Mage, then respec'd to Rogue *after* all of them.
  const mageOnly = reduce({
    events,
    config: cfg,
    today: "2026-06-20",
    profile: { line: ClassLine.Mage },
  });
  const switched = reduce({
    events,
    config: cfg,
    today: "2026-06-20",
    profile: {
      line: ClassLine.Rogue,
      history: [
        { ts: "2026-06-01T00:00:00Z", line: ClassLine.Mage },
        { ts: "2026-06-20T00:00:00Z", line: ClassLine.Rogue },
      ],
    },
  });

  // The Mage-era runs keep their bonus; switching to Rogue must not erase that XP or drop the level.
  expect(switched.xp_total).toBe(mageOnly.xp_total);
  expect(switched.level).toBe(mageOnly.level);
});
