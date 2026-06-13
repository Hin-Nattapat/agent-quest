import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { renderHud } from "../../hud/statusline";
import { makeHome } from "../helpers";

test("a rebase --onto deed unlocks a title that renders in the HUD", () => {
  const cfg = loadConfig(makeHome());
  const events = [
    {
      ts: "2026-06-11T12:00:00Z",
      source: "claude-code",
      session_id: "s",
      type: "action",
      action: "run",
      repo: "cq",
      cmd: "git_rebase_onto",
    },
  ] as any;

  const earned = reduce({ events, config: cfg, today: "2026-06-11" });
  expect(earned.achievements?.earned).toContain("timebender");

  const worn = reduce({
    events,
    config: cfg,
    today: "2026-06-11",
    profile: { name: "Nat", title: "timebender" },
  });
  expect(worn.cosmetics?.title).toBe("Timebender");
  const line = renderHud({
    state: { ...worn, updated_at: "" },
    tail: { model: "M", cost: 0, ctx: 0 },
  });
  expect(line).toContain("Nat the Timebender");
});
