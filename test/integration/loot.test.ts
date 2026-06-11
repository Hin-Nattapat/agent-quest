import { test, expect } from "bun:test";
import { reduce } from "../../core/reduce";
import { loadConfig } from "../../core/config";
import { renderHud } from "../../hud/statusline";
import { LOOT_TABLE } from "../../core/loot";
import { makeHome } from "../helpers";

test("clean sessions produce an inventory; equipping resolves into the HUD", () => {
  const cfg = loadConfig(makeHome());
  const events = [
    {
      ts: "2026-06-11T12:00:00Z",
      source: "claude-code",
      session_id: "s1",
      type: "action",
      action: "edit",
      repo: "cq",
    },
    {
      ts: "2026-06-11T12:01:00Z",
      source: "claude-code",
      session_id: "s1",
      type: "session_end",
      repo: "cq",
    },
  ] as any;

  const base = reduce(events, cfg, "2026-06-11");
  expect((base.inventory ?? []).length).toBeGreaterThan(0);

  const owned = base.inventory!.find(i => LOOT_TABLE[i.id].kind === "title");
  if (owned) {
    const equipped = reduce(events, cfg, "2026-06-11", { title: owned.id });
    const line = renderHud(
      { ...equipped, updated_at: "" },
      { model: "M", cost: 0, ctx: 0 },
    );
    expect(line).toContain(`the ${LOOT_TABLE[owned.id].name}`);
  }
});
