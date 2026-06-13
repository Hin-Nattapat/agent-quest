import { test, expect } from "bun:test";
import { reduceToFile } from "../../core/reduce";
import { saveProfile } from "../../core/profile";
import { renderHud } from "../../hud/statusline";
import { ClassLine, ClassForm } from "../../core/classes";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync } from "fs";
import { join } from "path";

test("profile + journal -> reduceToFile -> HUD shows name + form", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const prompt = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(60).fill(prompt).join("\n") + "\n"); // -> level 5

  saveProfile(home, { name: "Gandalf", line: ClassLine.Mage });
  const state = reduceToFile(home);
  expect(state.name).toBe("Gandalf");
  expect(state.class?.form).toBe(ClassForm.BackendMage);

  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(renderHud({ state: onDisk, tail: { model: "M", cost: 0, ctx: 0 } })).toContain(
    "Gandalf · ⚔ Backend Mage",
  );
});
