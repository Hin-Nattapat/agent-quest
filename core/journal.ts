import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { isNormalizedEvent, type INormalizedEvent } from "./events";

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
