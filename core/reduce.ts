import { writeFileSync, renameSync, existsSync, statSync } from "fs";
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
    const tier = line != null && level >= 5 ? tierForLevel(level) : 0;
    const isSignal = line != null && isPassiveSignal(line, e);
    const mult = isSignal && tier >= 1 ? 1 + basePct(tier, config.passive) : 1;
    const gained = base * mult;
    running += gained;

    // `level` above is pre-gain (causal for this event's passive mult); newLevel is
    // post-gain, which is what a level-up milestone reflects.
    const newLevel = levelFor(running, config.difficulty);
    if (newLevel > prevLevel) {
      for (let lv = prevLevel + 1; lv <= newLevel; lv++) {
        recent = pushTimeline(recent, {
          kind: TimelineKind.LevelUp,
          detail: String(lv),
          ts: e.ts,
        });
      }
      prevLevel = newLevel;
    }
    const newTier = line != null && newLevel >= 5 ? tierForLevel(newLevel) : 0;
    if (newTier > prevTier) {
      recent = pushTimeline(recent, {
        kind: TimelineKind.Advance,
        detail: formFor({ line, tier: newTier, branch }),
        ts: e.ts,
      });
      prevTier = newTier;
    }

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
      if (seededRng(`boss:${bossOrdinal}`)() < bossRate) {
        if (seededRng(`bossflee:${bossOrdinal}`)() < bossFleeRate) {
          bossFled++;
          recent = pushTimeline(recent, {
            kind: TimelineKind.BossFled,
            detail: "",
            ts: e.ts,
          });
        } else {
          bossDefeated++;
          // One seed shared by the inventory roll and the timeline peek so the logged
          // loot name always matches the item rollInventory actually grants.
          const bossSeed = `bossloot:${bossOrdinal}`;
          bossTriggers.push({ table: "boss", seed: bossSeed });
          recent = pushTimeline(recent, {
            kind: TimelineKind.BossDefeated,
            detail: "",
            ts: e.ts,
          });
          const dropId = rollDrop({
            trigger: { table: "boss", seed: bossSeed },
            lootTable,
            dropTables,
          });
          if (dropId && lootTable[dropId]) {
            recent = pushTimeline(recent, {
              kind: TimelineKind.Loot,
              detail: lootTable[dropId].name,
              rarity: lootTable[dropId].rarity,
              ts: e.ts,
            });
          }
        }
      }
    }
    if (asceticSeal === 0 && runningActions > 0) {
      const lvlNow = levelFor(running, config.difficulty);
      if (
        lvlNow >= ASCETIC_LEVEL &&
        runningRuns / runningActions < ASCETIC_MAX_RUN_RATIO
      ) {
        asceticSeal = 1;
      }
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
    prelim.last_event = { ts: lastEv.ts, type: lastEv.type };
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
  return {
    ...prelim,
    achievements: { ...achievements, earned_detail, total: Object.keys(registry).length },
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
