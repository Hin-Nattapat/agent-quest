import { writeFileSync, renameSync, existsSync, statSync, readFileSync } from "fs";
import { join } from "path";
import { EventType, AgentAction, type INormalizedEvent } from "./events";
import { xpFor, levelProgress, levelFor, basePct } from "./xp";
import { loadConfig, type IConfig } from "./config";
import { loadEvents } from "./journal";
import { eventLocalDate, computeStreak, localTodayKey, isNight } from "./streak";
import { evaluateAchievements, type IAchievementDef } from "./achievements";
import { computeAffinity, isPassiveSignal } from "./affinity";
import { loadProfile, type IProfile, type IClassEpoch } from "./profile";
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
  type IInventoryItem,
  type TDropTable,
} from "./loot";
import { TimelineKind, pushTimeline, type ITimelineEntry } from "./timeline";
import { seededRng } from "./rng";
import { type IState, type IGroupStat } from "./state";
import {
  createBestiaryScan,
  recordBestiaryEvent,
  buildBestiary,
  realmFor,
  type IBestiaryScan,
} from "./bestiary";
import { paragonFor } from "./paragon";
import {
  createChronicleScan,
  recordChronicleEvent,
  buildChronicle,
  type IChronicleScan,
} from "./chronicle";

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

// Inputs every reduce phase shares, resolved once up front: config defaults, the class-epoch
// timeline, the loot tables (config may override both), and the chronologically sorted journal.
interface IReduceContext {
  config: IConfig;
  profile?: IProfile;
  line: TLine | null;
  branch: "a" | "b" | null;
  lineAt: (ts: string) => TLine | null;
  branchAt: (ts: string) => "a" | "b" | null;
  lootTable: Record<string, ILootItem>;
  dropTables: Record<string, TDropTable>;
  bossRate: number;
  bossFleeRate: number;
  sorted: INormalizedEvent[];
}

const buildContext = (props: IReduceArgs): IReduceContext => {
  const { events, config, profile } = props;
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
  // The branch active when an event was earned, from the same epoch history as lineAt. Epochs
  // written before this feature carry no branch — for those pure-legacy saves, events priced on
  // the CURRENT line inherit the current branch (matching the old behavior); anything else is
  // pre-branch (no realm).
  const anyBranchEpochs = classEpochs.some(e => e.branch != null);
  const branchAt = (ts: string): "a" | "b" | null => {
    if (classEpochs.length === 0) {
      return branch;
    }
    const at = tsOrder(ts);
    let active: IClassEpoch | null = null;
    for (const epoch of classEpochs) {
      if (tsOrder(epoch.ts) > at) {
        break;
      }
      active = epoch;
    }
    if (active == null) {
      return null;
    }
    if (active.branch != null) {
      return active.branch;
    }
    if (!anyBranchEpochs && active.line === line) {
      return branch;
    }
    return null;
  };
  return {
    config,
    profile,
    line,
    branch,
    lineAt,
    branchAt,
    lootTable: config.loot ?? LOOT_TABLE,
    dropTables: config.drops ?? DROP_TABLES,
    bossRate: config.boss_rate ?? DEFAULT_BOSS_RATE,
    bossFleeRate: config.boss_flee_rate ?? DEFAULT_BOSS_FLEE_RATE,
    sorted: [...events].sort((a, b) => tsOrder(a.ts) - tsOrder(b.ts)),
  };
};

interface ISessionFlags {
  hasFail: boolean;
  hasEnd: boolean;
}

// Everything one chronological pass over the journal yields: raw XP, the recent timeline, every
// stats counter, and the boss/duck outcomes the later phases consume.
interface IEventScan {
  xpRaw: number;
  recent: ITimelineEntry[];
  prompts: number;
  actionFails: number;
  nightActions: number;
  failuresRecovered: number;
  asceticSeal: number;
  bossDefeated: number;
  bossFled: number;
  actions: Record<string, number>;
  cmds: Record<string, number>;
  sessions: Set<string>;
  dates: Set<string>;
  sessionInfo: Record<string, ISessionFlags>;
  bySource: Record<string, IGroupAcc>;
  byRepo: Record<string, IGroupAcc>;
  bossTriggers: ITrigger[];
  quacksEarnedTs: string | null;
  bestiary: IBestiaryScan;
  chronicle: IChronicleScan;
}

// Scan-internal bookkeeping no later phase needs: level/tier watermarks for milestone detection,
// the open-failure ledger, the ascetic run ratio, and the boss ordinal.
interface IScanState extends IEventScan {
  prevLevel: number;
  prevTier: number;
  pendingFail: Set<string>;
  runningRuns: number;
  runningActions: number;
  bossOrdinal: number;
}

interface IScanStepArgs {
  state: IScanState;
  ctx: IReduceContext;
  event: INormalizedEvent;
}

interface IXpGain {
  gained: number;
  newLevel: number;
}

// XP for one event plus any LevelUp/Advance milestones it crossed. The pre-gain level drives the
// passive multiplier (causal: an event cannot benefit from the level it creates); the milestones
// report the post-gain level this event pushed us to.
const applyXpAndMilestones = (props: IScanStepArgs): IXpGain => {
  const { state, ctx, event } = props;
  const base = xpFor(event, ctx.config.weights);
  const level = levelFor(state.xpRaw, ctx.config.difficulty);
  // tierForLevel already floors to 0 below level 5, so no explicit level guard is needed.
  const activeLine = ctx.lineAt(event.ts);
  const tier = activeLine != null ? tierForLevel(level) : 0;
  const isSignal = activeLine != null && isPassiveSignal(activeLine, event);
  const mult = isSignal && tier >= 1 ? 1 + basePct(tier, ctx.config.passive) : 1;
  const gained = base * mult;
  state.xpRaw += gained;

  const newLevel = levelFor(state.xpRaw, ctx.config.difficulty);
  const newTier = ctx.line != null ? tierForLevel(newLevel) : 0;
  for (const entry of levelMilestones({
    prevLevel: state.prevLevel,
    newLevel,
    prevTier: state.prevTier,
    newTier,
    line: ctx.line,
    branch: ctx.branch,
    ts: event.ts,
  })) {
    state.recent = pushTimeline(state.recent, entry);
  }
  state.prevLevel = newLevel;
  state.prevTier = newTier;
  return { gained, newLevel };
};

// Session membership, per-day activity, and every simple counter a single event can bump.
const recordEventStats = (state: IScanState, e: INormalizedEvent): void => {
  state.sessions.add(e.session_id);
  state.dates.add(eventLocalDate(e.ts));
  if (!state.sessionInfo[e.session_id]) {
    state.sessionInfo[e.session_id] = { hasFail: false, hasEnd: false };
  }
  if (e.type === EventType.ActionFail) {
    state.sessionInfo[e.session_id].hasFail = true;
    state.actionFails++;
  }
  if (e.type === EventType.SessionEnd) {
    state.sessionInfo[e.session_id].hasEnd = true;
  }
  if (e.type === EventType.Prompt) {
    state.prompts++;
  }
  if (e.type === EventType.Action && e.action) {
    state.actions[e.action] = (state.actions[e.action] ?? 0) + 1;
  }
  if (e.type === EventType.Action || e.type === EventType.ActionFail) {
    if (isNight(e.ts)) {
      state.nightActions++;
    }
  }
  if (e.type === EventType.Action && e.action) {
    state.runningActions++;
    if (e.action === AgentAction.Run) {
      state.runningRuns++;
    }
    const key = `${e.session_id}:${e.action}`;
    if (state.pendingFail.has(key)) {
      state.failuresRecovered++;
      state.pendingFail.delete(key);
    }
  }
  if (e.type === EventType.ActionFail && e.action) {
    state.pendingFail.add(`${e.session_id}:${e.action}`);
  }
  if (e.cmd) {
    state.cmds[e.cmd] = (state.cmds[e.cmd] ?? 0) + 1;
  }
};

interface IBossStepArgs extends IScanStepArgs {
  newLevel: number;
}

// A boss may spawn on any Action. A defeat queues its loot trigger, and a defeat won inside
// Fool's Mirage (Trickster form at T4) tames Sir Quacks-a-lot — deterministic, not a rarity roll,
// so the legendary is earned, never lucked into.
const rollBossAndDuck = (props: IBossStepArgs): void => {
  const { state, ctx, event, newLevel } = props;
  if (event.type !== EventType.Action) {
    return;
  }
  state.bossOrdinal++;
  const boss = rollBossForEvent({
    ordinal: state.bossOrdinal,
    bossRate: ctx.bossRate,
    bossFleeRate: ctx.bossFleeRate,
    lootTable: ctx.lootTable,
    dropTables: ctx.dropTables,
    ts: event.ts,
  });
  state.bossDefeated += boss.defeated;
  state.bossFled += boss.fled;
  if (boss.trigger) {
    state.bossTriggers.push(boss.trigger);
  }
  for (const entry of boss.timeline) {
    state.recent = pushTimeline(state.recent, entry);
  }
  if (
    boss.defeated === 1 &&
    state.quacksEarnedTs === null &&
    ctx.lineAt(event.ts) === SecretLine.Trickster &&
    tierForLevel(newLevel) >= 4
  ) {
    state.quacksEarnedTs = event.ts;
    const duck = ctx.lootTable["sir_quacks"];
    if (duck) {
      state.recent = pushTimeline(state.recent, {
        kind: TimelineKind.Loot,
        detail: duck.name,
        rarity: duck.rarity,
        ts: event.ts,
      });
    }
  }
};

const sealAsceticIfEarned = (state: IScanState, newLevel: number): void => {
  const qualifies = qualifiesAsAscetic({
    level: newLevel,
    runningRuns: state.runningRuns,
    runningActions: state.runningActions,
  });
  if (state.asceticSeal === 0 && qualifies) {
    state.asceticSeal = 1;
  }
};

// The single chronological pass over the journal. Per event, in order: XP and its milestones,
// the stat counters, the boss roll (which needs this event's post-gain level), the bestiary record,
// the ascetic seal check (which needs the counters this event just bumped), then the per-source/repo XP tallies.
const scanEvents = (ctx: IReduceContext): IEventScan => {
  const state: IScanState = {
    xpRaw: 0,
    recent: [],
    prompts: 0,
    actionFails: 0,
    nightActions: 0,
    failuresRecovered: 0,
    asceticSeal: 0,
    bossDefeated: 0,
    bossFled: 0,
    actions: {},
    cmds: {},
    sessions: new Set(),
    dates: new Set(),
    sessionInfo: {},
    bySource: {},
    byRepo: {},
    bossTriggers: [],
    quacksEarnedTs: null,
    bestiary: createBestiaryScan(),
    chronicle: createChronicleScan(),
    prevLevel: levelFor(0, ctx.config.difficulty),
    prevTier: 0,
    pendingFail: new Set(),
    runningRuns: 0,
    runningActions: 0,
    bossOrdinal: 0,
  };
  for (const event of ctx.sorted) {
    const levelBefore = state.prevLevel;
    const { gained, newLevel } = applyXpAndMilestones({ state, ctx, event });
    recordEventStats(state, event);
    const bossDefeatedBefore = state.bossDefeated;
    const bossFledBefore = state.bossFled;
    rollBossAndDuck({ state, ctx, event, newLevel });
    const bossDefeatedDelta = state.bossDefeated - bossDefeatedBefore;
    const bossFledDelta = state.bossFled - bossFledBefore;
    const realm = realmFor({
      line: ctx.lineAt(event.ts),
      tier: tierForLevel(newLevel),
      branch: ctx.branchAt(event.ts),
    });
    recordBestiaryEvent({
      scan: state.bestiary,
      realm,
      isAction: event.type === EventType.Action,
      bossDefeated: bossDefeatedDelta,
      bossFled: bossFledDelta,
    });
    recordChronicleEvent({
      scan: state.chronicle,
      dateKey: eventLocalDate(event.ts),
      gained,
      eventType: event.type,
      sessionId: event.session_id,
      realm,
      bossDefeated: bossDefeatedDelta,
      bossFled: bossFledDelta,
      levelBefore,
      newLevel,
    });
    sealAsceticIfEarned(state, newLevel);
    tally({
      groups: state.bySource,
      key: event.source,
      xp: gained,
      sessionId: event.session_id,
    });
    if (event.repo) {
      tally({
        groups: state.byRepo,
        key: event.repo,
        xp: gained,
        sessionId: event.session_id,
      });
    }
  }
  return state;
};

interface IClassStateArgs {
  ctx: IReduceContext;
  level: number;
  events: INormalizedEvent[];
}

const buildClassState = (props: IClassStateArgs): IClassState => {
  const { ctx, level, events } = props;
  const { line, branch, config } = ctx;
  const tier = line ? tierForLevel(level) : 0;
  return {
    line,
    tier,
    form: formFor({ line, tier, branch }),
    icon: iconFor(line),
    branch,
    affinity: computeAffinity(events),
    advancement_pending: advancementPending({ line, level, branch }),
    base_passive_pct: basePct(tier, config.passive),
    tree: classTree(line),
  };
};

interface ILootTriggersArgs {
  scan: IEventScan;
  level: number;
  bestStreakDays: number;
}

// Every seeded loot roll the journal has earned: one per clean session close, one per level-up,
// one per streak milestone, plus each boss defeat's queued trigger.
const collectLootTriggers = (props: ILootTriggersArgs): ITrigger[] => {
  const { scan, level, bestStreakDays } = props;
  const triggers: ITrigger[] = [];
  for (const [sid, info] of Object.entries(scan.sessionInfo)) {
    if (info.hasEnd && !info.hasFail) {
      triggers.push({ table: "clean", seed: `clean:${sid}` });
    }
  }
  for (let lvl = 2; lvl <= level; lvl++) {
    triggers.push({ table: "levelup", seed: `level:${lvl}` });
  }
  if (bestStreakDays >= 7) {
    triggers.push({ table: "streak7", seed: "streak:7" });
  }
  if (bestStreakDays >= 30) {
    triggers.push({ table: "streak30", seed: "streak:30" });
  }
  if (bestStreakDays >= 100) {
    triggers.push({ table: "streak100", seed: "streak:100" });
  }
  triggers.push(...scan.bossTriggers);
  return triggers;
};

interface IInventoryArgs {
  ctx: IReduceContext;
  triggers: ITrigger[];
  quacksEarnedTs: string | null;
}

// Rolled loot plus the deterministic duck grant, decorated with display name/kind and whether the
// profile has each piece equipped.
const buildInventory = (props: IInventoryArgs): IInventoryItem[] => {
  const { ctx, triggers, quacksEarnedTs } = props;
  const { lootTable, dropTables, profile } = ctx;
  const rolled = rollInventory({ triggers, lootTable, dropTables });
  if (quacksEarnedTs !== null && lootTable["sir_quacks"]) {
    const already = rolled.some(i => i.id === "sir_quacks");
    if (!already) {
      rolled.push({
        id: "sir_quacks",
        rarity: lootTable["sir_quacks"].rarity,
        count: 1,
      });
      rolled.sort((a, b) => a.id.localeCompare(b.id));
    }
  }
  return rolled.map(item => ({
    ...item,
    name: lootTable[item.id]?.name,
    kind: lootTable[item.id]?.kind,
    equipped:
      item.id === profile?.title ||
      item.id === profile?.theme ||
      item.id === profile?.name_color ||
      item.id === profile?.companion,
  }));
};

const collectEarnedTitles = (
  registry: Record<string, IAchievementDef>,
  earned: string[],
): Record<string, string> => {
  const titles: Record<string, string> = {};
  for (const id of earned) {
    const title = registry[id]?.reward?.title;
    if (title) {
      titles[id] = title;
    }
  }
  return titles;
};

interface IDeedSummary {
  id: string;
  name: string;
  desc: string;
  points: number;
}

interface ICodex {
  earned_detail: IDeedSummary[];
  locked: IDeedSummary[];
  secret: number;
}

interface ICodexArgs {
  registry: Record<string, IAchievementDef>;
  earned: string[];
}

// Split the not-yet-earned deeds: visible ones become "locked goals" (with criteria), hidden ones
// stay an opaque "??? secret" count so the codex shows what to chase without spoiling easter eggs.
const buildCodex = (props: ICodexArgs): ICodex => {
  const { registry, earned } = props;
  const earned_detail = earned.map(id => ({
    id,
    name: registry[id]?.name ?? id,
    desc: registry[id]?.desc ?? "",
    points: registry[id]?.points ?? 0,
  }));
  const earnedSet = new Set(earned);
  const unearned = Object.entries(registry).filter(([id]) => !earnedSet.has(id));
  const locked = unearned
    .filter(([, def]) => !def.hidden)
    .map(([id, def]) => ({ id, name: def.name, desc: def.desc, points: def.points }));
  const secret = unearned.filter(([, def]) => def.hidden).length;
  return { earned_detail, locked, secret };
};

export const reduce = (props: IReduceArgs): TReducedState => {
  const { events, config, today, profile } = props;
  const ctx = buildContext(props);
  const scan = scanEvents(ctx);

  const xp_total = Math.round(scan.xpRaw);
  const prog = levelProgress(xp_total, config.difficulty);
  const streak = computeStreak([...scan.dates], today);
  const classState = buildClassState({ ctx, level: prog.level, events });
  const triggers = collectLootTriggers({
    scan,
    level: prog.level,
    bestStreakDays: streak.best_days,
  });
  const inventory = buildInventory({
    ctx,
    triggers,
    quacksEarnedTs: scan.quacksEarnedTs,
  });

  const prelim: TReducedState = {
    version: 1,
    xp_total,
    level: prog.level,
    xp_in_level: prog.xp_in_level,
    xp_to_next: prog.xp_to_next,
    stats: {
      prompts: scan.prompts,
      actions: scan.actions,
      sessions: scan.sessions.size,
      by_source: toGroupStats(scan.bySource),
      by_repo: toGroupStats(scan.byRepo),
      night_actions: scan.nightActions,
      failures_recovered: scan.failuresRecovered,
      ascetic_seal: scan.asceticSeal,
      cmds: scan.cmds,
      boss_defeated: scan.bossDefeated,
      boss_fled: scan.bossFled,
      action_fails: scan.actionFails,
    },
    streak,
    class: classState,
    inventory,
    bestiary: buildBestiary(scan.bestiary),
    paragon: paragonFor({ xpTotal: xp_total, difficulty: config.difficulty }),
    chronicle: buildChronicle(scan.chronicle),
    recent: scan.recent,
  };
  if (profile?.name) {
    prelim.name = profile.name;
  }
  const lastEvent = ctx.sorted[ctx.sorted.length - 1];
  if (lastEvent) {
    prelim.last_event = {
      ts: lastEvent.ts,
      type: lastEvent.type,
      source: lastEvent.source,
    };
  }

  // Achievements are judged against the prelim state; the advance option is resolved after them so
  // it can offer any secret line those achievements just unlocked.
  const registry = config.achievements ?? {};
  const achievements = evaluateAchievements(prelim, config.achievements);
  const unlocked = collectUnlocks({ earned: achievements.earned, registry, profile });
  classState.advance = advanceOption({
    line: ctx.line,
    level: prog.level,
    branch: ctx.branch,
    unlockedSecrets: unlocked as string[],
  });
  const cosmetics = resolveCosmetics({
    profile: profile ?? {},
    inventory,
    earnedTitles: collectEarnedTitles(registry, achievements.earned),
    lootTable: ctx.lootTable,
    conqueredRealms: scan.bestiary.conqueredOrder,
    unlockedAuras: prelim.paragon?.auras ?? [],
  });
  const codex = buildCodex({ registry, earned: achievements.earned });
  return {
    ...prelim,
    achievements: {
      ...achievements,
      ...codex,
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
