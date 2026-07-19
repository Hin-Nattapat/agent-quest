import { EventType } from "./events";

// Weekly Chronicle (spec 2026-07-19): the journal bucketed into ISO weeks — a "wrapped" card per
// week. Raw data only; consumers compose the prose. Weeks beyond the newest 12 are dropped from
// state (they stay recomputable from the journal).

export interface IChronicleWeek {
  week: string;
  start: string;
  xp: number;
  actions: number;
  prompts: number;
  sessions: number;
  bosses_defeated: number;
  bosses_fled: number;
  top_realm: string | null;
  active_days: number;
  busiest_day: { date: string; xp: number } | null;
  level_start: number;
  level_end: number;
}

export interface IChronicleState {
  weeks: IChronicleWeek[];
}

export const CHRONICLE_MAX_WEEKS = 12;

// ISO-8601: a date's week belongs to the year of that week's Thursday. Date-only math in UTC so
// the local-date keys (already localized by eventLocalDate) are never re-shifted.
const isoWeekParts = (dateKey: string): { year: number; week: number } => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const isoYear = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: isoYear, week };
};

export const weekKeyFor = (dateKey: string): string => {
  const { year, week } = isoWeekParts(dateKey);
  return `${year}-W${String(week).padStart(2, "0")}`;
};

export const weekStartFor = (dateKey: string): string => {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - (day - 1));
  return date.toISOString().slice(0, 10);
};

interface IWeekBucket {
  start: string;
  xpRaw: number;
  actions: number;
  prompts: number;
  sessions: Set<string>;
  bossesDefeated: number;
  bossesFled: number;
  realmCounts: Record<string, number>;
  dayXp: Record<string, number>;
  levelStart: number;
  levelEnd: number;
}

export interface IChronicleScan {
  buckets: Record<string, IWeekBucket>;
}

export const createChronicleScan = (): IChronicleScan => {
  return { buckets: {} };
};

interface IRecordChronicleArgs {
  scan: IChronicleScan;
  dateKey: string;
  gained: number;
  eventType: EventType;
  sessionId: string;
  realm: string | null;
  bossDefeated: number;
  bossFled: number;
  levelBefore: number;
  newLevel: number;
}

// Precondition: events must arrive in chronological journal order. levelStart/levelEnd track first/last XP tier per week.
export const recordChronicleEvent = (props: IRecordChronicleArgs): void => {
  if (Number.isNaN(Date.parse(props.dateKey))) {
    return; // a malformed timestamp earns no chronicle entry rather than a corrupted bucket
  }
  const { scan, dateKey, gained, eventType, sessionId, realm } = props;
  const { bossDefeated, bossFled, levelBefore, newLevel } = props;
  const key = weekKeyFor(dateKey);
  if (!scan.buckets[key]) {
    scan.buckets[key] = {
      start: weekStartFor(dateKey),
      xpRaw: 0,
      actions: 0,
      prompts: 0,
      sessions: new Set(),
      bossesDefeated: 0,
      bossesFled: 0,
      realmCounts: {},
      dayXp: {},
      levelStart: levelBefore,
      levelEnd: newLevel,
    };
  }
  const bucket = scan.buckets[key];
  bucket.xpRaw += gained;
  if (eventType === EventType.Action) {
    bucket.actions++;
  }
  if (eventType === EventType.Prompt) {
    bucket.prompts++;
  }
  bucket.sessions.add(sessionId);
  bucket.bossesDefeated += bossDefeated;
  bucket.bossesFled += bossFled;
  if (realm != null) {
    bucket.realmCounts[realm] = (bucket.realmCounts[realm] ?? 0) + 1;
  }
  bucket.dayXp[dateKey] = (bucket.dayXp[dateKey] ?? 0) + gained;
  bucket.levelEnd = newLevel;
};

// Ties break to the first realm seen: strict > (not >=) preserves Object.entries insertion order.
const topRealmOf = (counts: Record<string, number>): string | null => {
  let best: string | null = null;
  let bestCount = 0;
  for (const [realm, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = realm;
      bestCount = count;
    }
  }
  return best;
};

const busiestDayOf = (
  dayXp: Record<string, number>,
): { date: string; xp: number } | null => {
  let best: { date: string; xp: number } | null = null;
  for (const [date, xp] of Object.entries(dayXp)) {
    if (xp > 0 && (best == null || xp > best.xp)) {
      best = { date, xp: Math.round(xp) };
    }
  }
  return best;
};

export const buildChronicle = (scan: IChronicleScan): IChronicleState => {
  const weeks = Object.entries(scan.buckets)
    .map(([week, b]) => ({
      week,
      start: b.start,
      xp: Math.round(b.xpRaw),
      actions: b.actions,
      prompts: b.prompts,
      sessions: b.sessions.size,
      bosses_defeated: b.bossesDefeated,
      bosses_fled: b.bossesFled,
      top_realm: topRealmOf(b.realmCounts),
      active_days: Object.keys(b.dayXp).length,
      busiest_day: busiestDayOf(b.dayXp),
      level_start: b.levelStart,
      level_end: b.levelEnd,
    }))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
  return { weeks: weeks.slice(0, CHRONICLE_MAX_WEEKS) };
};
