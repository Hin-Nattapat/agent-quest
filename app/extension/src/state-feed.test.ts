import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readStateText } from "./state-feed";

test("readStateText returns the file text, or null when absent", () => {
  const dir = mkdtempSync(join(tmpdir(), "cq-feed-"));
  try {
    expect(readStateText(dir)).toBe(null);
    writeFileSync(join(dir, "state.json"), '{"level":7}');
    expect(readStateText(dir)).toBe('{"level":7}');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
