import { test, expect } from "bun:test";
import { reduceToFile } from "../../core/reduce";
import { renderHud } from "../../hud/statusline";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

test("journal -> reduceToFile -> renderHud produces a coherent line", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  // 5 prompts (25) + 4 edits (16) = 41 xp -> level 3 (>=40)
  const lines = [
    ...Array(5).fill(
      `{"ts":"t","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`,
    ),
    ...Array(4).fill(
      `{"ts":"t","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}`,
    ),
  ];
  writeFileSync(join(dir, "s.ndjson"), lines.join("\n") + "\n");

  const state = reduceToFile(home);
  expect(state.xp_total).toBe(41);
  expect(state.level).toBe(3);

  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  const line = renderHud({
    state: onDisk,
    tail: { model: "Opus 4.8", cost: 0.1, ctx: 12 },
  });
  expect(line).toContain("Lv.3");
  expect(line).toContain("ctx 12%");
});
