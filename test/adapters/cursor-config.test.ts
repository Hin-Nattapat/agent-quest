import { test, expect } from "bun:test";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dir, "../..");
const PREFIX = "~/.agentrpg/adapters/cursor/";

interface IHookEntry {
  command: string;
}
interface IConfig {
  version: number;
  hooks: Record<string, IHookEntry[]>;
}

test("config.snippet.json is version 1 and references only existing hook scripts", () => {
  const cfg = JSON.parse(
    readFileSync(join(ROOT, "adapters/cursor/config.snippet.json"), "utf8"),
  ) as IConfig;
  expect(cfg.version).toBe(1);
  const commands = Object.values(cfg.hooks)
    .flat()
    .map(h => h.command);
  expect(commands.length).toBeGreaterThan(0);
  for (const command of commands) {
    expect(command.startsWith(PREFIX)).toBe(true);
    const rel = command.slice(PREFIX.length);
    expect(existsSync(join(ROOT, "adapters/cursor", rel))).toBe(true);
  }
});

test("config wires all seven Cursor hook events", () => {
  const cfg = JSON.parse(
    readFileSync(join(ROOT, "adapters/cursor/config.snippet.json"), "utf8"),
  ) as IConfig;
  const expected = [
    "sessionStart",
    "beforeSubmitPrompt",
    "postToolUse",
    "postToolUseFailure",
    "subagentStart",
    "stop",
    "sessionEnd",
  ];
  expect(Object.keys(cfg.hooks).sort()).toEqual([...expected].sort());
});

test("both postToolUse and postToolUseFailure map to the single on-tool.sh", () => {
  const cfg = JSON.parse(
    readFileSync(join(ROOT, "adapters/cursor/config.snippet.json"), "utf8"),
  ) as IConfig;
  expect(cfg.hooks.postToolUse[0].command).toBe(cfg.hooks.postToolUseFailure[0].command);
  expect(cfg.hooks.postToolUse[0].command.endsWith("on-tool.sh")).toBe(true);
});
