import type { IChronicleWeek } from "../../../core/chronicle";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const weekRangeLabel = (start: string): string => {
  const [y, m, d] = start.split("-").map(Number);
  const startDate = new Date(Date.UTC(y, m - 1, d));
  const endDate = new Date(Date.UTC(y, m - 1, d + 6));
  const sm = MONTHS[startDate.getUTCMonth()];
  const em = MONTHS[endDate.getUTCMonth()];
  if (sm === em) {
    return `${sm} ${startDate.getUTCDate()}–${endDate.getUTCDate()}`;
  }
  return `${sm} ${startDate.getUTCDate()} – ${em} ${endDate.getUTCDate()}`;
};

export const levelLabel = (week: IChronicleWeek): string => {
  if (week.level_start === week.level_end) {
    return `Lv.${week.level_end}`;
  }
  return `Lv.${week.level_start}→${week.level_end}`;
};
