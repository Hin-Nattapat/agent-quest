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

  const earned = reduce(events, cfg, "2026-06-11");
  expect(earned.achievements?.earned).toContain("timebender");

  const worn = reduce(events, cfg, "2026-06-11", { name: "Nat", title: "timebender" });
  expect(worn.cosmetics?.title).toBe("Timebender");
  const line = renderHud({ ...worn, updated_at: "" }, { model: "M", cost: 0, ctx: 0 });
  expect(line).toContain("Nat the Timebender");
});
