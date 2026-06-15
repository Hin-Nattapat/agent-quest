import type { IState } from "../../core/state";

export enum GameEventType {
  BossDefeated = "boss_defeated",
  BossFled = "boss_fled",
}

export interface IGameEvent {
  type: GameEventType;
  items: string[]; // loot display names (see newItems), shown in the boss-defeat toast
}

// Display names of items gained in `next.inventory` vs `prev` (counts the per-item increase). Uses
// the reducer's denormalized `name` so the loot toast reads "Archmage", not "archmage_title"; falls
// back to the id when a name isn't present.
const newItems = (prev: IState | null, next: IState): string[] => {
  const before = new Map((prev?.inventory ?? []).map(i => [i.id, i.count]));
  const out: string[] = [];
  for (const item of next.inventory ?? []) {
    const had = before.get(item.id) ?? 0;
    for (let k = 0; k < item.count - had; k++) {
      out.push(item.name ?? item.id);
    }
  }
  return out;
};

export const diffStates = (prev: IState | null, next: IState): IGameEvent[] => {
  if (!prev) {
    return [];
  }
  const events: IGameEvent[] = [];
  const defeated = (next.stats.boss_defeated ?? 0) - (prev.stats.boss_defeated ?? 0);
  const fled = (next.stats.boss_fled ?? 0) - (prev.stats.boss_fled ?? 0);
  if (defeated > 0) {
    events.push({ type: GameEventType.BossDefeated, items: newItems(prev, next) });
  }
  if (fled > 0) {
    events.push({ type: GameEventType.BossFled, items: [] });
  }
  return events;
};

interface ICombatBeats {
  xp: number; // xp_total gained since prev (clamped >= 0)
  hurt: boolean; // a new action_fail occurred
  leveledUp: boolean; // level increased
}

export const combatBeats = (prev: IState | null, next: IState): ICombatBeats => {
  if (!prev) {
    return { xp: 0, hurt: false, leveledUp: false };
  }
  const xp = Math.max(0, next.xp_total - prev.xp_total);
  const hurt = (next.stats.action_fails ?? 0) > (prev.stats.action_fails ?? 0);
  const leveledUp = next.level > prev.level;
  return { xp, hurt, leveledUp };
};
