import { writeFileSync, renameSync, existsSync, statSync } from "fs";
import { join } from "path";
import { EventType, type INormalizedEvent } from "./events";
import { xpFor, levelProgress } from "./xp";
import { loadConfig, type IConfig } from "./config";
import { loadEvents } from "./journal";
import { eventLocalDate, computeStreak, localTodayKey } from "./streak";
import { evaluateAchievements } from "./achievements";
import { type IState, type IGroupStat } from "./state";

export type TReducedState = Omit<IState, "updated_at">;

// Per-group running totals: summed xp and the distinct sessions that touched the group.
interface IGroupAcc {
  xp: number;
  sessions: Set<string>;
}

function tally(groups: Record<string, IGroupAcc>, key: string, xp: number, sessionId: string): void {
  if (!groups[key]) groups[key] = { xp: 0, sessions: new Set() };
  const group = groups[key];
  group.xp += xp;
  group.sessions.add(sessionId);
}

function toGroupStats(groups: Record<string, IGroupAcc>): Record<string, IGroupStat> {
  const stats: Record<string, IGroupStat> = {};
  for (const [key, group] of Object.entries(groups)) {
    stats[key] = { xp: group.xp, sessions: group.sessions.size };
  }
  return stats;
}

export function reduce(events: INormalizedEvent[], config: IConfig, today?: string): TReducedState {
  let xp_total = 0;
  let prompts = 0;
  const actions: Record<string, number> = {};
  const sessions = new Set<string>();
  const bySource: Record<string, IGroupAcc> = {};
  const byRepo: Record<string, IGroupAcc> = {};
  const dates = new Set<string>();

  for (const e of events) {
    const xp = xpFor(e, config.weights);
    xp_total += xp;
    sessions.add(e.session_id);
    dates.add(eventLocalDate(e.ts));
    if (e.type === EventType.Prompt) prompts++;
    if (e.type === EventType.Action && e.action) actions[e.action] = (actions[e.action] ?? 0) + 1;

    tally(bySource, e.source, xp, e.session_id);
    if (e.repo) tally(byRepo, e.repo, xp, e.session_id);
  }

  const prog = levelProgress(xp_total, config.difficulty);
  const streak = computeStreak([...dates], today);

  const prelim: TReducedState = {
    version: 1,
    xp_total,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: {
      prompts,
      actions,
      sessions: sessions.size,
      by_source: toGroupStats(bySource),
      by_repo: toGroupStats(byRepo),
    },
    streak,
  };
  return { ...prelim, achievements: evaluateAchievements(prelim, config.achievements) };
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19) + "Z";
}

export function reduceToFile(home: string): IState {
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home), localTodayKey());
  const state: IState = { ...reduced, updated_at: nowStamp() };
  const dst = join(home, "state.json");
  const tmp = dst + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, dst); // atomic: statusline never reads a half-written file
  return state;
}

export function reduceThrottled(home: string, maxAgeMs = 2000): void {
  const p = join(home, "state.json");
  if (existsSync(p) && Date.now() - statSync(p).mtimeMs < maxAgeMs) return;
  reduceToFile(home);
}
