import { test, expect } from "bun:test";
import {
  xpFor,
  xpForLevel,
  levelFor,
  levelProgress,
  DEFAULT_WEIGHTS,
  DEFAULT_DIFFICULTY,
} from "../../core/xp";
import { EventType, AgentAction } from "../../core/events";

const ev = (o: object) =>
  ({ ts: "t", source: "claude-code", session_id: "s", ...o }) as any;

test("xpFor maps events to weights; session_start/action_fail = 0", () => {
  expect(xpFor(ev({ type: EventType.Prompt }))).toBe(5);
  expect(xpFor(ev({ type: EventType.TurnEnd }))).toBe(10);
  expect(xpFor(ev({ type: EventType.SessionEnd }))).toBe(20);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Edit }))).toBe(4);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Run }))).toBe(3);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Delegate }))).toBe(8);
  expect(xpFor(ev({ type: EventType.Action, action: AgentAction.Other }))).toBe(1);
  expect(xpFor(ev({ type: EventType.ActionFail, action: AgentAction.Run }))).toBe(0);
  expect(xpFor(ev({ type: EventType.SessionStart }))).toBe(0);
});

test("xpForLevel matches the curve", () => {
  expect(xpForLevel(1)).toBe(0);
  expect(xpForLevel(2)).toBe(7);
  expect(xpForLevel(5)).toBe(Math.round(7 * Math.pow(4, 2.5))); // 224
});

test("levelFor respects boundaries and cap", () => {
  expect(levelFor(0)).toBe(1);
  expect(levelFor(6)).toBe(1);
  expect(levelFor(7)).toBe(2);
  expect(levelFor(10_000_000)).toBe(DEFAULT_DIFFICULTY.level_cap);
});

test("levelProgress splits in-level vs to-next; cap has 0 to-next", () => {
  const p = levelProgress(7); // exactly level 2 start
  expect(p.level).toBe(2);
  expect(p.xp_in_level).toBe(0);
  expect(p.xp_to_next).toBe(xpForLevel(3) - 7);

  const max = levelProgress(99_999_999);
  expect(max.level).toBe(DEFAULT_DIFFICULTY.level_cap);
  expect(max.xp_to_next).toBe(0);
});

test("defaults are present", () => {
  expect(DEFAULT_WEIGHTS.prompt).toBe(5);
  expect(DEFAULT_WEIGHTS.actions.delegate).toBe(8);
  expect(DEFAULT_DIFFICULTY.curve_exp).toBe(2.5);
});
