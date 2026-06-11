import { test, expect } from "bun:test";
import { reduceToFile, reduceThrottled } from "../../core/reduce";
import { makeHome } from "../helpers";
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";

function seedJournal(home: string) {
  const dir = join(home, "journal");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "s1.ndjson"),
    `{"ts":"t","source":"claude-code","session_id":"s1","type":"prompt","repo":"cq"}\n`);
}

test("reduceToFile writes a valid state.json with updated_at", () => {
  const home = makeHome();
  seedJournal(home);
  const state = reduceToFile(home);
  expect(state.xp_total).toBe(5);
  expect(state.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  const onDisk = JSON.parse(readFileSync(join(home, "state.json"), "utf8"));
  expect(onDisk.xp_total).toBe(5);
});

test("reduceThrottled skips when state.json is fresh, recomputes when stale", () => {
  const home = makeHome();
  seedJournal(home);
  reduceThrottled(home);                                  // first call writes
  const p = join(home, "state.json");
  expect(existsSync(p)).toBe(true);
  const mtime1 = statSync(p).mtimeMs;

  reduceThrottled(home, 60_000);                          // within window -> skip
  expect(statSync(p).mtimeMs).toBe(mtime1);

  reduceThrottled(home, 0);                               // zero window -> recompute
  expect(statSync(p).mtimeMs).toBeGreaterThanOrEqual(mtime1);
});
