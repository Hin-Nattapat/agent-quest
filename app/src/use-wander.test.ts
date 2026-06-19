import { test, expect } from "bun:test";
import { Facing } from "./facing";
import { stepWander, pickNextRoute } from "./use-wander";

test("stepWander moves toward the target by speed*dt and faces the delta", () => {
  const r = stepWander({
    xPct: 0,
    yPct: 0,
    targetX: 100,
    targetY: 0,
    speedPctPerSec: 50,
    dtMs: 100,
  });
  expect(r.reached).toBe(false);
  expect(r.pose.xPct).toBeCloseTo(5, 5); // 50%/s * 0.1s
  expect(r.pose.yPct).toBeCloseTo(0, 5);
  expect(r.pose.facing).toBe(Facing.East);
  expect(r.pose.moving).toBe(true);
});

test("stepWander snaps to the target and stops when within one step", () => {
  const r = stepWander({
    xPct: 9.9,
    yPct: 0,
    targetX: 10,
    targetY: 0,
    speedPctPerSec: 50,
    dtMs: 100,
  });
  expect(r.reached).toBe(true);
  expect(r.pose.xPct).toBe(10);
  expect(r.pose.yPct).toBe(0);
  expect(r.pose.moving).toBe(false);
});

test("pickNextRoute always returns a different route than the current", () => {
  const count = 4;
  for (let current = 0; current < count; current++) {
    for (const rand of [0, 0.25, 0.5, 0.75, 0.999]) {
      const next = pickNextRoute(current, count, rand);
      expect(next).not.toBe(current);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(count);
    }
  }
});

test("pickNextRoute returns 0 when there is one route or none", () => {
  expect(pickNextRoute(0, 1, 0.5)).toBe(0);
  expect(pickNextRoute(0, 0, 0.5)).toBe(0);
});
