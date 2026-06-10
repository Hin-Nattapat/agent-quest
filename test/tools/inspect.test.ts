import { test, expect } from "bun:test";
import { summarize, loadEvents } from "../../tools/inspect";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

function seed(home: string) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s1.ndjson"),
    [
      `{"ts":"2026-06-11T00:00:00Z","source":"claude-code","session_id":"s1","type":"session_start","repo":"commit-quest"}`,
      `{"ts":"2026-06-11T00:00:01Z","source":"claude-code","session_id":"s1","type":"action","action":"edit","repo":"commit-quest","file":"a.ts"}`,
      `not valid json`, // must be skipped
    ].join("\n") + "\n");
  writeFileSync(join(dir, "s2.ndjson"),
    `{"ts":"2026-06-11T00:00:02Z","source":"claude-code","session_id":"s2","type":"prompt","repo":"pos"}\n`);
}

test("loadEvents skips malformed lines and counts sessions by file", () => {
  const home = makeHome();
  seed(home);
  const { events, sessions } = loadEvents(home);
  expect(events.length).toBe(3); // 2 from s1 (1 skipped) + 1 from s2
  expect(sessions).toBe(2);
});

test("summarize reports totals and groupings", () => {
  const home = makeHome();
  seed(home);
  const out = summarize(home);
  expect(out).toContain("events: 3");
  expect(out).toContain("sessions: 2");
  expect(out).toContain("edit: 1");
  expect(out).toContain("commit-quest: 2");
});

test("empty home summarizes to zeros", () => {
  const home = makeHome();
  const out = summarize(home);
  expect(out).toContain("events: 0");
  expect(out).toContain("sessions: 0");
});
