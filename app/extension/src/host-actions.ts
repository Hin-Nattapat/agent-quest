import { loadProfile, saveProfile } from "../../../core/profile";
import { reduceToFile } from "../../../core/reduce";
import { LOOT_TABLE, LootKind } from "../../../core/loot";
import { readStateText } from "./state-feed";

interface IRawAction {
  name?: string;
  kind?: string;
  id?: string;
}

const LOOT_KIND: Record<string, LootKind> = {
  title: LootKind.Title,
  theme: LootKind.Theme,
};

// Apply an equip/unequip toggle from the webview, mirroring the rpg CLI: validate ownership, set the
// matching profile slot, re-reduce. Returns the fresh state.json text on success, null on bad input.
// Scope: INVENTORY cosmetics only (the Items panel's source) — a title is validated against the
// inventory + loot table, NOT achievement-earned titles (which the CLI's `rpg title` also accepts but
// the panel never surfaces). Widen this if a future panel offers earned titles.
export const applyAction = (home: string, action: IRawAction): string | null => {
  if (action.name !== "equip") {
    return null;
  }
  const kind = action.kind ? LOOT_KIND[action.kind] : undefined;
  const id = action.id;
  if (!kind || !id) {
    return null;
  }
  const row = LOOT_TABLE[id];
  if (!row || row.kind !== kind) {
    return null;
  }
  const owned = new Set((reduceToFile(home).inventory ?? []).map(i => i.id));
  if (!owned.has(id)) {
    return null;
  }

  const profile = loadProfile(home);
  if (kind === LootKind.Title) {
    profile.title = profile.title === id ? undefined : id;
  } else {
    profile.theme = profile.theme === id ? undefined : id;
  }
  saveProfile(home, profile);
  reduceToFile(home);
  return readStateText(home);
};
