import { test, expect } from "bun:test";
import { activityState, ActivityState, ACTIVE_WINDOW_MS } from "./activity";
import { EventType } from "../../core/events";
import type { IState } from "../../core/state";

const NOW = Date.parse("2026-06-11T12:00:00Z");
const ev = (type: EventType, agoMs: number): IState["last_event"] => ({
  ts: new Date(NOW - agoMs).toISOString(),
  type,
  source: "claude-code",
});

test("activityState maps the last event + recency to a state", () => {
  expect(activityState(undefined, NOW)).toBe(ActivityState.Idle);
  expect(activityState(ev(EventType.Action, 5_000), NOW)).toBe(ActivityState.Farming);
  expect(activityState(ev(EventType.Action, 120_000), NOW)).toBe(ActivityState.Idle);
  expect(activityState(ev(EventType.SessionEnd, 1_000), NOW)).toBe(ActivityState.Rest);
  expect(activityState(ev(EventType.SessionEnd, 999_999), NOW)).toBe(ActivityState.Rest);
  expect(activityState(ev(EventType.SessionStart, 1_000), NOW)).toBe(ActivityState.Idle);
  // boundary: exactly the window is not "recent" -> idle
  expect(activityState(ev(EventType.Action, ACTIVE_WINDOW_MS), NOW)).toBe(
    ActivityState.Idle,
  );
});
