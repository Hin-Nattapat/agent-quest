import { writeFileSync, renameSync, existsSync, statSync } from "fs";
import { join } from "path";
import { EventType, type INormalizedEvent } from "./events";
import { xpFor, levelProgress } from "./xp";
import { loadConfig, type IConfig } from "./config";
import { loadEvents } from "./journal";
import { type IState, type IGroupStat } from "./state";

export type TReducedState = Omit<IState, "updated_at">;

export function reduce(events: INormalizedEvent[], config: IConfig): TReducedState {
  let xp_total = 0;
  let prompts = 0;
  const actions: Record<string, number> = {};
  const sessions = new Set<string>();
  const by_source: Record<string, IGroupStat> = {};
  const by_repo: Record<string, IGroupStat> = {};
  const srcSessions: Record<string, Set<string>> = {};
  const repoSessions: Record<string, Set<string>> = {};

  for (const e of events) {
    const w = xpFor(e, config.weights);
    xp_total += w;
    sessions.add(e.session_id);
    if (e.type === EventType.Prompt) prompts++;
    if (e.type === EventType.Action && e.action) actions[e.action] = (actions[e.action] ?? 0) + 1;

    (by_source[e.source] ??= { xp: 0, sessions: 0 }).xp += w;
    (srcSessions[e.source] ??= new Set()).add(e.session_id);

    if (e.repo) {
      (by_repo[e.repo] ??= { xp: 0, sessions: 0 }).xp += w;
      (repoSessions[e.repo] ??= new Set()).add(e.session_id);
    }
  }
  for (const s of Object.keys(by_source)) by_source[s].sessions = srcSessions[s].size;
  for (const r of Object.keys(by_repo)) by_repo[r].sessions = repoSessions[r].size;

  const prog = levelProgress(xp_total, config.difficulty);
  return {
    version: 1,
    xp_total,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: { prompts, actions, sessions: sessions.size, by_source, by_repo },
  };
}

function nowStamp(): string {
  return new Date().toISOString().slice(0, 19) + "Z";
}

export function reduceToFile(home: string): IState {
  const { events } = loadEvents(home);
  const reduced = reduce(events, loadConfig(home));
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
