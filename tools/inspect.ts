// Read the journal and print a verification summary. Read-only.
import { type INormalizedEvent } from "../core/events";
import { loadEvents } from "../core/journal";
import { reduce } from "../core/reduce";
import { loadConfig, defaultHome } from "../core/config";
import { localTodayKey } from "../core/streak";

const HOME = defaultHome();

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
  const s = reduce(events, loadConfig(home), localTodayKey());
  const streak = s.streak ? `${s.streak.current_days}d (best ${s.streak.best_days})` : "0d";
  const headline =
    `level: ${s.level}  xp: ${s.xp_total}  streak: ${streak}  ` +
    `achievements: ${s.achievements?.earned.length ?? 0} (${s.achievements?.points ?? 0} pts)`;
  const last10 = events
    .slice(-10)
    .map((e) => `  ${e.ts} ${e.source} ${e.type}${e.action ? ":" + e.action : ""} ${e.repo ?? "-"} ${e.file ?? ""}`.trimEnd())
    .join("\n");
  return [
    headline,
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
