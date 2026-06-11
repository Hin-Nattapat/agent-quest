import { test, expect } from "bun:test";
import { reduceToFile } from "../../core/reduce";
import { renderHud } from "../../hud/statusline";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

test("journal -> reduceToFile -> state has streak+achievements; HUD shows fire", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  // one action today -> first_blood; today's activity -> current streak >= 1
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(dir, "s.ndjson"),
    `{"ts":"${today}T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}\n`);

  const state = reduceToFile(home);
  expect(state.achievements?.earned).toContain("first_blood");
  expect(state.streak?.current_days).toBeGreaterThanOrEqual(1);

  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(renderHud(onDisk, { model: "M", cost: 0, ctx: 0 })).toContain("🔥");
});
