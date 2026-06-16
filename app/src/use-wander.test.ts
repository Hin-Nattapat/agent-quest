import { test, expect } from "bun:test";
import { Facing } from "./facing";
import { stepWander } from "./use-wander";

test("stepWander moves toward the target by speed*dt and faces the delta", () => {
  const r = stepWander({ xPct: 0, yPct: 0, targetX: 100, targetY: 0, speedPctPerSec: 50, dtMs: 100 });
  expect(r.reached).toBe(false);
  expect(r.pose.xPct).toBeCloseTo(5, 5); // 50%/s * 0.1s
  expect(r.pose.yPct).toBeCloseTo(0, 5);
  expect(r.pose.facing).toBe(Facing.East);
  expect(r.pose.moving).toBe(true);
});

test("stepWander snaps to the target and stops when within one step", () => {
  const r = stepWander({ xPct: 9.9, yPct: 0, targetX: 10, targetY: 0, speedPctPerSec: 50, dtMs: 100 });
  expect(r.reached).toBe(true);
  expect(r.pose.xPct).toBe(10);
  expect(r.pose.yPct).toBe(0);
  expect(r.pose.moving).toBe(false);
});
