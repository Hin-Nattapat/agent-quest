import { test, expect } from "bun:test";
import { activityState, ActivityState, ACTIVE_WINDOW_MS } from "./activity";

const NOW = Date.parse("2026-06-11T12:00:00Z");
const ev = (type: string, agoMs: number) =>
  ({ ts: new Date(NOW - agoMs).toISOString(), type }) as any;

test("activityState maps the last event + recency to a state", () => {
  expect(activityState(undefined, NOW)).toBe(ActivityState.Idle);
  expect(activityState(ev("action", 5_000), NOW)).toBe(ActivityState.Farming);
  expect(activityState(ev("action", 120_000), NOW)).toBe(ActivityState.Idle);
  expect(activityState(ev("session_end", 1_000), NOW)).toBe(ActivityState.Rest);
  expect(activityState(ev("session_end", 999_999), NOW)).toBe(ActivityState.Rest);
  expect(activityState(ev("session_start", 1_000), NOW)).toBe(ActivityState.Idle);
  // boundary: exactly the window is not "recent" -> idle
  expect(activityState(ev("action", ACTIVE_WINDOW_MS), NOW)).toBe(ActivityState.Idle);
});
