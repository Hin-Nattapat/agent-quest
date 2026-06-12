import { test, expect } from "bun:test";
import { isNormalizedEvent, EventType, AgentAction } from "../../core/events";

test("valid event passes the guard", () => {
  expect(
    isNormalizedEvent({
      ts: "2026-06-11T00:00:00Z",
      source: "claude-code",
      session_id: "a",
      type: EventType.Prompt,
    }),
  ).toBe(true);
});

test("missing required field fails", () => {
  expect(
    isNormalizedEvent({ source: "claude-code", session_id: "a", type: EventType.Prompt }),
  ).toBe(false);
});

test("unknown type fails", () => {
  expect(
    isNormalizedEvent({ ts: "x", source: "x", session_id: "a", type: "bogus" }),
  ).toBe(false);
});

test("non-object fails", () => {
  expect(isNormalizedEvent(null)).toBe(false);
  expect(isNormalizedEvent("x")).toBe(false);
});

test("enums expose the wire values", () => {
  expect(Object.values(EventType) as string[]).toContain("session_start");
  expect(Object.values(AgentAction) as string[]).toContain("delegate");
});

import { CmdTag } from "../../core/events";

test("CmdTag members carry the wire strings the hook emits", () => {
  expect(CmdTag.GitRebaseOnto as string).toBe("git_rebase_onto");
  expect(CmdTag.Reflog as string).toBe("reflog");
  expect(CmdTag.TestRun as string).toBe("test_run");
  expect(CmdTag.Cowboy as string).toBe("cowboy");
});
