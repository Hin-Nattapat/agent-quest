import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readState, sseMessage } from "./server";

function tmpHome(): string {
  return mkdtempSync(join(tmpdir(), "cq-app-"));
}

test("readState returns the file text, or null when absent", () => {
  const home = tmpHome();
  expect(readState(home)).toBe(null);
  writeFileSync(join(home, "state.json"), '{"level":7}');
  expect(readState(home)).toBe('{"level":7}');
  rmSync(home, { recursive: true, force: true });
});

test("sseMessage frames a state event", () => {
  expect(sseMessage('{"level":7}')).toBe('event: state\ndata: {"level":7}\n\n');
});

test("sseMessage prefixes every line of pretty-printed JSON with data:", () => {
  const pretty = '{\n  "level": 7\n}';
  expect(sseMessage(pretty)).toBe(
    'event: state\ndata: {\ndata:   "level": 7\ndata: }\n\n',
  );
});
