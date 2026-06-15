import { loadProfile, saveProfile } from "../../../core/profile";
import { reduceToFile } from "../../../core/reduce";
import { LOOT_TABLE, LootKind } from "../../../core/loot";
import { chooseClass, respecClass, chooseBranch } from "../../../core/advance";
import { readStateText } from "./state-feed";

interface IRawAction {
  name?: string;
  kind?: string;
  id?: string;
  line?: string;
  branch?: string;
}

const LOOT_KIND: Record<string, LootKind> = {
  title: LootKind.Title,
  theme: LootKind.Theme,
};

// Load the profile, run a validate+mutate (from core/advance), and on ok persist + re-reduce.
// Returns the fresh state.json text on success, null when the validator rejects.
const applyAdvance = (
  home: string,
  run: (profile: ReturnType<typeof loadProfile>) => { ok: boolean },
): string | null => {
  const profile = loadProfile(home);
  if (!run(profile).ok) {
    return null;
  }
  saveProfile(home, profile);
  reduceToFile(home);
  return readStateText(home);
};

// Apply a webview intent, mirroring the rpg CLI's mutations and re-reducing. Returns the fresh
// state.json text on success, null on bad input. Equip is INVENTORY cosmetics only (the Items
// panel's source) — a title is validated against the inventory + loot table, NOT achievement-earned
// titles (which `rpg title` also accepts but the panel never surfaces).
export const applyAction = (home: string, action: IRawAction): string | null => {
  if (action.name === "setClass") {
    return applyAdvance(home, profile => {
      const state = reduceToFile(home);
      const line = action.line ?? "";
      return profile.line == null
        ? chooseClass({
            profile,
            line,
            level: state.level,
            unlockedSecrets: (state.unlocked_secret_classes ?? []) as string[],
          })
        : respecClass({ profile, line, level: state.level });
    });
  }
  if (action.name === "setBranch") {
    return applyAdvance(home, profile => {
      const state = reduceToFile(home);
      return chooseBranch({ profile, branch: action.branch ?? "", level: state.level });
    });
  }
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
