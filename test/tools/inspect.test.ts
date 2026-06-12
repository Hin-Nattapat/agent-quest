import { test, expect } from "bun:test";
import { summarize } from "../../tools/inspect";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

function seed(home: string) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s1.ndjson"),
    [
      `{"ts":"2026-06-11T00:00:00Z","source":"claude-code","session_id":"s1","type":"session_start","repo":"commit-quest"}`,
      `{"ts":"2026-06-11T00:00:01Z","source":"claude-code","session_id":"s1","type":"action","action":"edit","repo":"commit-quest","file":"a.ts"}`,
      `not valid json`, // must be skipped
    ].join("\n") + "\n",
  );
  writeFileSync(
    join(dir, "s2.ndjson"),
    `{"ts":"2026-06-11T00:00:02Z","source":"claude-code","session_id":"s2","type":"prompt","repo":"pos"}\n`,
  );
}

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

test("summary headline shows level, xp, streak, achievements", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}\n`,
  );
  const out = summarize(home);
  expect(out).toContain("level:");
  expect(out).toContain("achievements:");
});

test("headline includes the class form", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "s.ndjson"),
    `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"action","action":"edit","repo":"cq"}\n`,
  );
  expect(summarize(home)).toContain("(Novice)");
});

test("headline reflects the equipped class from the profile", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  const prompt = `{"ts":"2026-06-11T12:00:00Z","source":"claude-code","session_id":"s","type":"prompt","repo":"cq"}`;
  writeFileSync(join(dir, "s.ndjson"), Array(60).fill(prompt).join("\n") + "\n"); // -> Lv.5
  writeFileSync(join(home, "profile.json"), JSON.stringify({ line: "mage" }));
  expect(summarize(home)).toContain("(Backend Mage)");
});
