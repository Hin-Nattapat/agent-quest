import { test, expect } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readStateText, refreshStateText } from "./state-feed";

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

test("refreshStateText folds journal into state.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "cq-feed-"));
  try {
    mkdirSync(join(dir, "journal"));
    writeFileSync(
      join(dir, "journal", "codex.ndjson"),
      '{"ts":"2026-06-21T00:00:00Z","source":"codex","session_id":"codex","type":"prompt"}\n',
    );
    const state = JSON.parse(refreshStateText(dir) ?? "{}");
    expect(state.stats.prompts).toBe(1);
    expect(state.stats.by_source.codex.sessions).toBe(1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
