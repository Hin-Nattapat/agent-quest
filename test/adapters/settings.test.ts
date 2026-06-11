import { test, expect } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";

const snippet = JSON.parse(
  readFileSync(join(import.meta.dir, "../../adapters/claude-code/settings.snippet.json"), "utf8"),
);

test("declares all six hook events", () => {
  const h = snippet.hooks;
  for (const ev of ["SessionStart", "UserPromptSubmit", "PostToolUse", "PostToolUseFailure", "Stop", "SessionEnd"]) {
    expect(h[ev]).toBeDefined();
  }
});

test("PostToolUse has the tool-list matcher; PostToolUseFailure has none", () => {
  expect(snippet.hooks.PostToolUse[0].matcher).toBe("Edit|MultiEdit|Write|Bash|Read|Grep|Glob|Task");
  expect(snippet.hooks.PostToolUseFailure[0].matcher).toBeUndefined();
});

test("commands point at the hooks/ scripts under ~/.agentrpg", () => {
  const cmd = snippet.hooks.PostToolUse[0].hooks[0].command;
  expect(cmd).toBe("~/.agentrpg/adapters/claude-code/hooks/on-tool.sh");
});

test("declares a statusLine pointing at the deployed statusline.ts", () => {
  expect(snippet.statusLine.type).toBe("command");
  expect(snippet.statusLine.command).toBe("bun ~/.agentrpg/hud/statusline.ts");
});
