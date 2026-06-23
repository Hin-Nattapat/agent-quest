import { writeFileSync, renameSync, existsSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { EventType, AgentAction, type INormalizedEvent } from "./events";
import { xpFor, levelProgress, levelFor, basePct } from "./xp";
import { loadConfig, type IConfig } from "./config";
import { loadEvents } from "./journal";
import { eventLocalDate, computeStreak, localTodayKey, isNight } from "./streak";
import { evaluateAchievements, type IAchievementDef } from "./achievements";
import { computeAffinity, isPassiveSignal } from "./affinity";
import { loadProfile, type IProfile } from "./profile";
import {
  tierForLevel,
  formFor,
  iconFor,
  advancementPending,
  advanceOption,
  classTree,
  SecretLine,
  type IClassState,
  type TLine,
} from "./classes";
import {
  rollInventory,
  rollDrop,
  resolveCosmetics,
  LOOT_TABLE,
  DROP_TABLES,
  DEFAULT_BOSS_RATE,
  DEFAULT_BOSS_FLEE_RATE,
  type ITrigger,
  type ILootItem,
  type TDropTable,
} from "./loot";
import { TimelineKind, pushTimeline, type ITimelineEntry } from "./timeline";
import { seededRng } from "./rng";
import { type IState, type IGroupStat } from "./state";

export type TReducedState = Omit<IState, "updated_at">;

// Per-group running totals: summed xp and the distinct sessions that touched the group.
interface IGroupAcc {
  xp: number;
  sessions: Set<string>;
}

interface ITallyArgs {
  groups: Record<string, IGroupAcc>;
  key: string;
  xp: number;
  sessionId: string;
}

const tally = (props: ITallyArgs): void => {
  const { groups, key, xp, sessionId } = props;
  if (!groups[key]) {
    groups[key] = { xp: 0, sessions: new Set() };
  }
  const group = groups[key];
  group.xp += xp;
  group.sessions.add(sessionId);
};

const toGroupStats = (groups: Record<string, IGroupAcc>): Record<string, IGroupStat> => {
  const stats: Record<string, IGroupStat> = {};
  for (const [key, group] of Object.entries(groups)) {
    stats[key] = { xp: Math.round(group.xp), sessions: group.sessions.size };
  }
  return stats;
};

const tsOrder = (ts: string): number => {
  return Date.parse(ts) || 0;
};

const ASCETIC_LEVEL = 25;
const ASCETIC_MAX_RUN_RATIO = 0.2;

// The agent earns the ascetic seal once it reaches level 25 having leaned on `run` for under a fifth
// of its actions (a "thinker, not a runner" badge).
interface IAsceticArgs {
  level: number;
  runningRuns: number;
  runningActions: number;
}
const qualifiesAsAscetic = (props: IAsceticArgs): boolean => {
  const { level, runningRuns, runningActions } = props;
  if (runningActions === 0) {
    return false;
  }
  return level >= ASCETIC_LEVEL && runningRuns / runningActions < ASCETIC_MAX_RUN_RATIO;
};

// Timeline entries for thresholds crossed on one event: one LevelUp per level gained, plus an
// Advance when the class tier steps up.
interface ILevelMilestonesArgs {
  prevLevel: number;
  newLevel: number;
  prevTier: number;
  newTier: number;
  line: TLine | null;
  branch: "a" | "b" | null;
  ts: string;
}
const levelMilestones = (props: ILevelMilestonesArgs): ITimelineEntry[] => {
  const { prevLevel, newLevel, prevTier, newTier, line, branch, ts } = props;
  const entries: ITimelineEntry[] = [];
  for (let lv = prevLevel + 1; lv <= newLevel; lv++) {
    entries.push({ kind: TimelineKind.LevelUp, detail: String(lv), ts });
  }
  if (newTier > prevTier) {
    entries.push({
      kind: TimelineKind.Advance,
      detail: formFor({ line, tier: newTier, branch }),
      ts,
    });
  }
  return entries;
};

interface IBossRollArgs {
  ordinal: number;
  bossRate: number;
  bossFleeRate: number;
  lootTable: Record<string, ILootItem>;
  dropTables: Record<string, TDropTable>;
  ts: string;
}
interface IBossRoll {
  defeated: number; // 0 or 1
  fled: number; // 0 or 1
  trigger?: ITrigger; // inventory trigger for a defeat's loot drop
  timeline: ITimelineEntry[];
}
// One seeded boss roll for an Action event: a `bossRate` chance to appear, then a `bossFleeRate`
// chance to flee vs. be defeated (defeat rolls a loot drop). Seeds are derived from the ordinal so
// the whole sequence is reproducible from the journal; the loot seed is shared with rollInventory so
// the logged drop name matches what's actually granted.
const rollBossForEvent = (props: IBossRollArgs): IBossRoll => {
  const { ordinal, bossRate, bossFleeRate, lootTable, dropTables, ts } = props;
  if (seededRng(`boss:${ordinal}`)() >= bossRate) {
    return { defeated: 0, fled: 0, timeline: [] };
  }
  if (seededRng(`bossflee:${ordinal}`)() < bossFleeRate) {
    return {
      defeated: 0,
      fled: 1,
      timeline: [{ kind: TimelineKind.BossFled, detail: "", ts }],
    };
  }
  const seed = `bossloot:${ordinal}`;
  const timeline: ITimelineEntry[] = [
    { kind: TimelineKind.BossDefeated, detail: "", ts },
  ];
  const dropId = rollDrop({ trigger: { table: "boss", seed }, lootTable, dropTables });
  if (dropId && lootTable[dropId]) {
    timeline.push({
      kind: TimelineKind.Loot,
      detail: lootTable[dropId].name,
      rarity: lootTable[dropId].rarity,
      ts,
    });
  }
  return { defeated: 1, fled: 0, trigger: { table: "boss", seed }, timeline };
};

interface ICollectUnlocksArgs {
  earned: string[];
  registry: Record<string, IAchievementDef>;
  profile?: IProfile;
}

const collectUnlocks = (props: ICollectUnlocksArgs): SecretLine[] => {
  const { earned, registry, profile } = props;
  const set = new Set<SecretLine>();
  for (const id of earned) {
    const unlock = registry[id]?.reward?.unlocks_class;
    if (unlock) {
      set.add(unlock);
    }
  }
  if (profile?.xyzzy) {
    set.add(SecretLine.Trickster);
  }
  return [...set].sort();
};

interface IReduceArgs {
  events: INormalizedEvent[];
  config: IConfig;
  today?: string;
  profile?: IProfile;
}

export const reduce = (props: IReduceArgs): TReducedState => {
  const { events, config, today, profile } = props;
  let prompts = 0;
  const actions: Record<string, number> = {};
  const sessions = new Set<string>();
  const bySource: Record<string, IGroupAcc> = {};
  const byRepo: Record<string, IGroupAcc> = {};
  const dates = new Set<string>();
  const sessionInfo: Record<string, { hasFail: boolean; hasEnd: boolean }> = {};
  let nightActions = 0;
  let actionFails = 0;
  let failuresRecovered = 0;
  let asceticSeal = 0;
  let runningRuns = 0;
  let runningActions = 0;
  const pendingFail = new Set<string>();
  const cmds: Record<string, number> = {};
  let bossOrdinal = 0;
  let bossDefeated = 0;
  let bossFled = 0;
  const bossTriggers: ITrigger[] = [];
  const bossRate = config.boss_rate ?? DEFAULT_BOSS_RATE;
  const bossFleeRate = config.boss_flee_rate ?? DEFAULT_BOSS_FLEE_RATE;

  const line = profile?.line ?? null;
  const branch = profile?.branch ?? null;
  const classEpochs = [...(profile?.history ?? [])].sort(
    (a, b) => tsOrder(a.ts) - tsOrder(b.ts),
  );
  // The class active when an event was earned. Legacy saves carry no history, so we fall back to the
  // current class throughout — preserving their existing totals while new switches are dated.
  const lineAt = (ts: string): TLine | null => {
    if (classEpochs.length === 0) {
      return line;
    }
    const at = tsOrder(ts);
    let active: TLine | null = null;
    for (const epoch of classEpochs) {
      if (tsOrder(epoch.ts) > at) {
        break;
      }
      active = epoch.line;
    }
    return active;
  };
  const lootTable = config.loot ?? LOOT_TABLE;
  const dropTables = config.drops ?? DROP_TABLES;
  const sorted = [...events].sort((a, b) => tsOrder(a.ts) - tsOrder(b.ts));
  let running = 0;
  let recent: ITimelineEntry[] = [];
  let prevLevel = levelFor(0, config.difficulty);
  let prevTier = 0;
  for (const e of sorted) {
    const base = xpFor(e, config.weights);
    const level = levelFor(running, config.difficulty); // from XP accrued so far (causal)
    // tierForLevel already floors to 0 below level 5, so no explicit level guard is needed.
    const activeLine = lineAt(e.ts);
    const tier = activeLine != null ? tierForLevel(level) : 0;
    const isSignal = activeLine != null && isPassiveSignal(activeLine, e);
    const mult = isSignal && tier >= 1 ? 1 + basePct(tier, config.passive) : 1;
    const gained = base * mult;
    running += gained;

    // `level`/`tier` above are pre-gain (causal for this event's passive mult); the milestones below
    // reflect the post-gain level/tier this event pushed us to.
    const newLevel = levelFor(running, config.difficulty);
    const newTier = line != null ? tierForLevel(newLevel) : 0;
    for (const entry of levelMilestones({
      prevLevel,
      newLevel,
      prevTier,
      newTier,
      line,
      branch,
      ts: e.ts,
    })) {
      recent = pushTimeline(recent, entry);
    }
    prevLevel = newLevel;
    prevTier = newTier;

    sessions.add(e.session_id);
    dates.add(eventLocalDate(e.ts));
    if (!sessionInfo[e.session_id]) {
      sessionInfo[e.session_id] = { hasFail: false, hasEnd: false };
    }
    if (e.type === EventType.ActionFail) {
      sessionInfo[e.session_id].hasFail = true;
      actionFails++;
    }
    if (e.type === EventType.SessionEnd) {
      sessionInfo[e.session_id].hasEnd = true;
    }
    if (e.type === EventType.Prompt) {
      prompts++;
    }
    if (e.type === EventType.Action && e.action) {
      actions[e.action] = (actions[e.action] ?? 0) + 1;
    }
    if (e.type === EventType.Action || e.type === EventType.ActionFail) {
      if (isNight(e.ts)) {
        nightActions++;
      }
    }
    if (e.type === EventType.Action && e.action) {
      runningActions++;
      if (e.action === AgentAction.Run) {
        runningRuns++;
      }
      const key = `${e.session_id}:${e.action}`;
      if (pendingFail.has(key)) {
        failuresRecovered++;
        pendingFail.delete(key);
      }
    }
    if (e.type === EventType.ActionFail && e.action) {
      pendingFail.add(`${e.session_id}:${e.action}`);
    }
    if (e.cmd) {
      cmds[e.cmd] = (cmds[e.cmd] ?? 0) + 1;
    }
    if (e.type === EventType.Action) {
      bossOrdinal++;
      const boss = rollBossForEvent({
        ordinal: bossOrdinal,
        bossRate,
        bossFleeRate,
        lootTable,
        dropTables,
        ts: e.ts,
      });
      bossDefeated += boss.defeated;
      bossFled += boss.fled;
      if (boss.trigger) {
        bossTriggers.push(boss.trigger);
      }
      for (const entry of boss.timeline) {
        recent = pushTimeline(recent, entry);
      }
    }
    // newLevel is this event's post-gain level (computed above) — reuse it instead of recomputing.
    if (
      asceticSeal === 0 &&
      qualifiesAsAscetic({ level: newLevel, runningRuns, runningActions })
    ) {
      asceticSeal = 1;
    }
    tally({ groups: bySource, key: e.source, xp: gained, sessionId: e.session_id });
    if (e.repo) {
      tally({ groups: byRepo, key: e.repo, xp: gained, sessionId: e.session_id });
    }
  }

  const xp_total = Math.round(running);
  const prog = levelProgress(xp_total, config.difficulty);
  const streak = computeStreak([...dates], today);

  const classTier = line ? tierForLevel(prog.level) : 0;
  const classState: IClassState = {
    line,
    tier: classTier,
    form: formFor({ line, tier: classTier, branch }),
    icon: iconFor(line),
    branch,
    affinity: computeAffinity(events),
    advancement_pending: advancementPending({ line, level: prog.level, branch }),
    base_passive_pct: basePct(classTier, config.passive),
    tree: classTree(line),
  };

  const triggers: ITrigger[] = [];
  for (const [sid, info] of Object.entries(sessionInfo)) {
    if (info.hasEnd && !info.hasFail) {
      triggers.push({ table: "clean", seed: `clean:${sid}` });
    }
  }
  for (let lvl = 2; lvl <= prog.level; lvl++) {
    triggers.push({ table: "levelup", seed: `level:${lvl}` });
  }
  if (streak.best_days >= 7) {
    triggers.push({ table: "streak7", seed: "streak:7" });
  }
  if (streak.best_days >= 30) {
    triggers.push({ table: "streak30", seed: "streak:30" });
  }
  if (streak.best_days >= 100) {
    triggers.push({ table: "streak100", seed: "streak:100" });
  }
  triggers.push(...bossTriggers);
  const inventoryRaw = rollInventory({ triggers, lootTable, dropTables });
  const inventory = inventoryRaw.map(item => ({
    ...item,
    name: lootTable[item.id]?.name,
    kind: lootTable[item.id]?.kind,
    equipped:
      item.id === profile?.title ||
      item.id === profile?.theme ||
      item.id === profile?.name_color,
  }));

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
      night_actions: nightActions,
      failures_recovered: failuresRecovered,
      ascetic_seal: asceticSeal,
      cmds,
      boss_defeated: bossDefeated,
      boss_fled: bossFled,
      action_fails: actionFails,
    },
    streak,
    class: classState,
    inventory,
    recent,
  };
  if (profile?.name) {
    prelim.name = profile.name;
  }
  const lastEv = sorted[sorted.length - 1];
  if (lastEv) {
    prelim.last_event = { ts: lastEv.ts, type: lastEv.type, source: lastEv.source };
  }
  const achievements = evaluateAchievements(prelim, config.achievements);
  const unlocked = collectUnlocks({
    earned: achievements.earned,
    registry: config.achievements ?? {},
    profile,
  });
  classState.advance = advanceOption({
    line,
    level: prog.level,
    branch,
    unlockedSecrets: unlocked as string[],
  });
  const registry = config.achievements ?? {};
  const earnedTitles: Record<string, string> = {};
  for (const id of achievements.earned) {
    const title = registry[id]?.reward?.title;
    if (title) {
      earnedTitles[id] = title;
    }
  }
  const cosmetics = resolveCosmetics({
    profile: profile ?? {},
    inventory,
    earnedTitles,
    lootTable,
  });
  const earned_detail = achievements.earned.map(id => ({
    id,
    name: registry[id]?.name ?? id,
    desc: registry[id]?.desc ?? "",
    points: registry[id]?.points ?? 0,
  }));
  // Split the not-yet-earned deeds: visible ones become "locked goals" (with criteria), hidden ones
  // stay an opaque "??? secret" count so the codex shows what to chase without spoiling easter eggs.
  const earnedSet = new Set(achievements.earned);
  const unearned = Object.entries(registry).filter(([id]) => !earnedSet.has(id));
  const locked = unearned
    .filter(([, def]) => !def.hidden)
    .map(([id, def]) => ({ id, name: def.name, desc: def.desc, points: def.points }));
  const secret = unearned.filter(([, def]) => def.hidden).length;
  return {
    ...prelim,
    achievements: {
      ...achievements,
      earned_detail,
      locked,
      secret,
      total: Object.keys(registry).length,
    },
    cosmetics,
    unlocked_secret_classes: unlocked,
  };
};

const nowStamp = (): string => {
  return new Date().toISOString().slice(0, 19) + "Z";
};

export const reduceToFile = (home: string): IState => {
  const { events } = loadEvents(home);
  const reduced = reduce({
    events,
    config: loadConfig(home),
    today: localTodayKey(),
    profile: loadProfile(home),
  });
  const state: IState = { ...reduced, updated_at: nowStamp() };
  const dst = join(home, "state.json");
  const tmp = dst + ".tmp";
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, dst); // atomic: statusline never reads a half-written file
  return state;
};

export const reduceThrottled = (home: string, maxAgeMs = 2000): void => {
  const p = join(home, "state.json");
  if (existsSync(p) && Date.now() - statSync(p).mtimeMs < maxAgeMs) {
    return;
  }
  reduceToFile(home);
};

// Fold the journal into state.json (throttled), then return state.json's text. Shared by the dev
// server and the extension so the "catch up to the journal" reduce-then-read lives in one place —
// the companion needs it because agents without a statusline (Codex) never trigger a reduce.
export const refreshStateText = (home: string): string | null => {
  try {
    reduceThrottled(home);
  } catch {
    // A malformed journal line must not blank the HUD — keep the last good state.json.
  }
  const p = join(home, "state.json");
  if (!existsSync(p)) {
    return null;
  }
  try {
    return readFileSync(p, "utf8");
  } catch {
    return null;
  }
};
