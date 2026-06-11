import { writeFileSync, renameSync, existsSync, statSync } from "fs";
import { join } from "path";
import { EventType, type INormalizedEvent } from "./events";
import { xpFor, levelProgress, levelFor, basePct } from "./xp";
import { loadConfig, type IConfig } from "./config";
import { loadEvents } from "./journal";
import { eventLocalDate, computeStreak, localTodayKey } from "./streak";
import { evaluateAchievements } from "./achievements";
import { computeAffinity, lineForEvent } from "./affinity";
import { loadProfile, type IProfile } from "./profile";
import {
  tierForLevel,
  formFor,
  iconFor,
  advancementPending,
  type IClassState,
} from "./classes";
import { type IState, type IGroupStat } from "./state";

export type TReducedState = Omit<IState, "updated_at">;

// Per-group running totals: summed xp and the distinct sessions that touched the group.
interface IGroupAcc {
  xp: number;
  sessions: Set<string>;
}

function tally(
  groups: Record<string, IGroupAcc>,
  key: string,
  xp: number,
  sessionId: string,
): void {
  if (!groups[key]) {
    groups[key] = { xp: 0, sessions: new Set() };
  }
  const group = groups[key];
  group.xp += xp;
  group.sessions.add(sessionId);
}

function toGroupStats(groups: Record<string, IGroupAcc>): Record<string, IGroupStat> {
  const stats: Record<string, IGroupStat> = {};
  for (const [key, group] of Object.entries(groups)) {
    stats[key] = { xp: Math.round(group.xp), sessions: group.sessions.size };
  }
  return stats;
}

function tsOrder(ts: string): number {
  return Date.parse(ts) || 0;
}

export function reduce(
  events: INormalizedEvent[],
  config: IConfig,
  today?: string,
  profile?: IProfile,
): TReducedState {
  let prompts = 0;
  const actions: Record<string, number> = {};
  const sessions = new Set<string>();
  const bySource: Record<string, IGroupAcc> = {};
  const byRepo: Record<string, IGroupAcc> = {};
  const dates = new Set<string>();

  const line = profile?.line ?? null;
  const sorted = [...events].sort((a, b) => tsOrder(a.ts) - tsOrder(b.ts));
  let running = 0;
  for (const e of sorted) {
    const base = xpFor(e, config.weights);
    const level = levelFor(running, config.difficulty); // from XP accrued so far (causal)
    const tier = line != null && level >= 5 ? tierForLevel(level) : 0;
    const isSignal = line != null && lineForEvent(e) === line;
    const mult = isSignal && tier >= 1 ? 1 + basePct(tier, config.passive) : 1;
    const gained = base * mult;
    running += gained;

    sessions.add(e.session_id);
    dates.add(eventLocalDate(e.ts));
    if (e.type === EventType.Prompt) {
      prompts++;
    }
    if (e.type === EventType.Action && e.action) {
      actions[e.action] = (actions[e.action] ?? 0) + 1;
    }
    tally(bySource, e.source, gained, e.session_id);
    if (e.repo) {
      tally(byRepo, e.repo, gained, e.session_id);
    }
  }

  const xp_total = Math.round(running);
  const prog = levelProgress(xp_total, config.difficulty);
  const streak = computeStreak([...dates], today);

  const branch = profile?.branch ?? null;
  const classTier = line ? tierForLevel(prog.level) : 0;
  const classState: IClassState = {
    line,
    tier: classTier,
    form: formFor(line, classTier, branch),
    icon: iconFor(line),
    branch,
    affinity: computeAffinity(events),
    advancement_pending: advancementPending(line, prog.level, branch),
    base_passive_pct: basePct(classTier, config.passive),
  };

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
    class: classState,
  };
  if (profile?.name) {
    prelim.name = profile.name;
  }
  return { ...prelim, achievements: evaluateAchievements(prelim, config.achievements) };
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19) + "Z";
}

export function reduceToFile(home: string): IState {
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home), localTodayKey(), loadProfile(home));
  const state: IState = { ...reduced, updated_at: nowStamp() };
  const dst = join(home, "state.json");
  const tmp = dst + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, dst); // atomic: statusline never reads a half-written file
  return state;
}

export function reduceThrottled(home: string, maxAgeMs = 2000): void {
  const p = join(home, "state.json");
  if (existsSync(p) && Date.now() - statSync(p).mtimeMs < maxAgeMs) {
    return;
  }
  reduceToFile(home);
}
