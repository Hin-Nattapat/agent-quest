import { test, expect } from "bun:test";
import { loadEvents } from "../../core/journal";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

test("loadEvents reads all files, skips malformed, counts session files", () => {
  const home = makeHome();
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "a.ndjson"),
    `{"ts":"t","source":"claude-code","session_id":"a","type":"prompt"}\nbroken\n`,
  );
  writeFileSync(
    join(dir, "b.ndjson"),
    `{"ts":"t","source":"claude-code","session_id":"b","type":"action","action":"edit"}\n`,
  );
  const { events, sessions } = loadEvents(home);
  expect(events.length).toBe(2);
  expect(sessions).toBe(2);
});

test("loadEvents on a home with no journal returns empty", () => {
  const { events, sessions } = loadEvents(makeHome());
  expect(events).toEqual([]);
  expect(sessions).toBe(0);
});
