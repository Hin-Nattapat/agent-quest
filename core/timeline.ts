// TimelineKind is defined in core/events (the module the app may import at runtime); re-exported
// here so core-internal consumers keep importing it alongside the timeline logic.
import { TimelineKind } from "./events";
export { TimelineKind };

export interface ITimelineEntry {
  kind: TimelineKind;
  detail: string; // new level, form name, or boss-loot item name
  rarity?: string; // loot only — drives the tag/tone
  ts: string; // source event timestamp (ordering)
}

export const TIMELINE_MAX = 12;

// Append one milestone, keeping only the last TIMELINE_MAX (newest last).
export const pushTimeline = (
  list: ITimelineEntry[],
  entry: ITimelineEntry,
): ITimelineEntry[] => {
  const next = [...list, entry];
  if (next.length > TIMELINE_MAX) {
    return next.slice(next.length - TIMELINE_MAX);
  }
  return next;
};
