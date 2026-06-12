export interface IStreak {
  current_days: number;
  best_days: number;
  last_active: string;
}

// A Date's LOCAL calendar day as YYYY-MM-DD. The only timezone-dependent logic.
function dateKeyOf(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function eventLocalDate(ts: string): string {
  return dateKeyOf(new Date(ts));
}

export function localTodayKey(): string {
  return dateKeyOf(new Date());
}

const NIGHT_END_HOUR = 4; // local 00:00–03:59 is "night"

export function eventLocalHour(ts: string): number {
  return new Date(ts).getHours();
}

export function isNight(ts: string): boolean {
  const hour = eventLocalHour(ts);
  return hour >= 0 && hour < NIGHT_END_HOUR;
}

// Date key -> whole-day epoch. Parsed as UTC midnight so the run math is TZ-neutral.
function dayNumber(key: string): number {
  return Date.parse(`${key}T00:00:00Z`) / 86_400_000;
}

function isNextDay(earlier: string, later: string): boolean {
  return dayNumber(later) - dayNumber(earlier) === 1;
}

// `today` defaults to the last active day (so a clock-free call treats the streak as alive).
export function computeStreak(dateKeys: string[], today?: string): IStreak {
  const days = [...new Set(dateKeys)].sort();
  if (days.length === 0) {
    return { current_days: 0, best_days: 0, last_active: "" };
  }

  let bestRun = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = isNextDay(days[i - 1], days[i]) ? run + 1 : 1;
    bestRun = Math.max(bestRun, run);
  }

  let runEndingLast = 1;
  for (let i = days.length - 1; i > 0 && isNextDay(days[i - 1], days[i]); i--) {
    runEndingLast++;
  }

  const lastActive = days[days.length - 1];
  const brokenStreak = dayNumber(today ?? lastActive) - dayNumber(lastActive) > 1;
  return {
    current_days: brokenStreak ? 0 : runEndingLast,
    best_days: bestRun,
    last_active: lastActive,
  };
}
