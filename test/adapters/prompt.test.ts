import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome, basename } from "../helpers";

test("on-prompt emits a prompt event, exit 0, no stdout", async () => {
  const home = makeHome();
  const cwd = "/tmp/cq-test-proj"; // non-git -> repo falls back to basename
  const { code, stdout } = await runHook(
    "on-prompt.sh",
    { session_id: "p1", cwd, hook_event_name: "UserPromptSubmit", prompt: "hi" },
    home,
  );

  expect(code).toBe(0);
  expect(stdout).toBe(""); // safety: never write to stdout

  const lines = journalLines(home, "p1");
  expect(lines.length).toBe(1);
  const e = lines[0];
  expect(e.type).toBe("prompt");
  expect(e.source).toBe("claude-code");
  expect(e.session_id).toBe("p1");
  expect(e.repo).toBe(basename(cwd)); // "cq-test-proj"
  expect(e.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
});
