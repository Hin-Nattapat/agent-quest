import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../..");
const snippetPath = join(ROOT, "adapters/copilot/config.snippet.json");

test("config snippet is valid JSON, version 1, wires the six post/lifecycle events", () => {
  const cfg = JSON.parse(readFileSync(snippetPath, "utf8"));
  expect(cfg.version).toBe(1);
  const events = Object.keys(cfg.hooks);
  for (const ev of ["SessionStart", "UserPromptSubmit", "PostToolUse", "PostToolUseFailure", "Stop", "SessionEnd"]) {
    expect(events).toContain(ev);
  }
  // never hook the fail-closed pre-events
  expect(events).not.toContain("PreToolUse");
  expect(events).not.toContain("PermissionRequest");
});

test("every wired hook command points at a deployed script that exists in the repo", () => {
  const cfg = JSON.parse(readFileSync(snippetPath, "utf8"));
  for (const entries of Object.values<any>(cfg.hooks)) {
    for (const entry of entries) {
      expect(entry.type).toBe("command");
      const m = entry.bash.match(/adapters\/copilot\/hooks\/([\w-]+\.sh)$/);
      expect(m).not.toBeNull();
      expect(existsSync(join(ROOT, "adapters/copilot/hooks", m[1]))).toBe(true);
    }
  }
});
