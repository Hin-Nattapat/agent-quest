// Read the journal and print a verification summary. Read-only.
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { isNormalizedEvent, type INormalizedEvent } from "../core/events";

const HOME = process.env.AGENTRPG_HOME || join(process.env.HOME ?? "", ".agentrpg");

export function loadEvents(home: string): { events: INormalizedEvent[]; sessions: number } {
  const dir = join(home, "journal");
  if (!existsSync(dir)) return { events: [], sessions: 0 };
  const files = readdirSync(dir).filter((f) => f.endsWith(".ndjson"));
  const events: INormalizedEvent[] = [];
  for (const f of files) {
    for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
      const t = line.trim();
      if (!t) continue;
      try {
        const o = JSON.parse(t);
        if (isNormalizedEvent(o)) events.push(o);
      } catch {
        // skip malformed lines — the journal must survive partial writes
      }
    }
  }
  return { events, sessions: files.length };
}

function countBy(events: INormalizedEvent[], key: keyof INormalizedEvent): Record<string, number> {
  const m: Record<string, number> = {};
  for (const e of events) {
    const v = e[key];
    if (v != null) m[String(v)] = (m[String(v)] ?? 0) + 1;
  }
  return m;
}

function fmt(m: Record<string, number>): string {
  const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${k}: ${v}`);
  return rows.length ? rows.join("\n") : "  (none)";
}

export function summarize(home: string): string {
  const { events, sessions } = loadEvents(home);
  const last10 = events
    .slice(-10)
    .map((e) => `  ${e.ts} ${e.source} ${e.type}${e.action ? ":" + e.action : ""} ${e.repo ?? "-"} ${e.file ?? ""}`.trimEnd())
    .join("\n");
  return [
    `events: ${events.length}  sessions: ${sessions}`,
    `by type:`, fmt(countBy(events, "type")),
    `by action:`, fmt(countBy(events, "action")),
    `by source:`, fmt(countBy(events, "source")),
    `by repo:`, fmt(countBy(events, "repo")),
    `last 10:`, last10 || "  (none)",
  ].join("\n");
}

if (import.meta.main) {
  console.log(summarize(HOME));
}
