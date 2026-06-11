import { test, expect } from "bun:test";
import { runHook, journalLines, makeHome } from "../helpers";

test("on-stop emits turn_end", async () => {
  const home = makeHome();
  const { code, stdout } = await runHook(
    "on-stop.sh",
    { session_id: "l1", cwd: "/tmp/cq-test-proj", hook_event_name: "Stop" },
    home,
  );
  expect(code).toBe(0);
  expect(stdout).toBe("");
  expect(journalLines(home, "l1").at(-1).type).toBe("turn_end");
});

test("on-session-end emits session_end", async () => {
  const home = makeHome();
  const { code } = await runHook(
    "on-session-end.sh",
    { session_id: "l2", cwd: "/tmp/cq-test-proj", hook_event_name: "SessionEnd" },
    home,
  );
  expect(code).toBe(0);
  expect(journalLines(home, "l2").at(-1).type).toBe("session_end");
});
