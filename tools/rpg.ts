// Player command-line for character identity. Writes profile.json, refreshes state.json.
import { defaultHome, loadConfig } from "../core/config";
import { loadProfile, saveProfile, type IProfile } from "../core/profile";
import { reduceToFile } from "../core/reduce";
import { ClassLine, SecretLine, SECRET_TREE } from "../core/classes";
import { chooseClass, respecClass, chooseBranch } from "../core/advance";
import { LOOT_TABLE, LootKind } from "../core/loot";

const HOME = defaultHome();
const LINES = Object.values(ClassLine) as string[];
const SECRETS = Object.values(SecretLine) as string[];

const fail: (message: string) => never = message => {
  process.stderr.write(message + "\n");
  process.exit(1);
};

const persist = (profile: IProfile): void => {
  saveProfile(HOME, profile);
  reduceToFile(HOME);
};

const setName = (profile: IProfile, name: string): string => {
  profile.name = name.trim().slice(0, 24);
  persist(profile);
  return `Name set to "${profile.name}".`;
};

const setClass = (profile: IProfile, line: string): string => {
  const state = reduceToFile(HOME);
  const r = chooseClass({
    profile,
    line,
    level: state.level,
    unlockedSecrets: (state.unlocked_secret_classes ?? []) as string[],
    ts: new Date().toISOString(),
  });
  if (!r.ok) {
    fail(r.error ?? "");
  }
  persist(profile);
  return `Class set to ${line}.`;
};

const setBranch = (profile: IProfile, branch: string): string => {
  const state = reduceToFile(HOME);
  const r = chooseBranch({ profile, branch, level: state.level });
  if (!r.ok) {
    fail(r.error ?? "");
  }
  persist(profile);
  return `Branch locked: ${branch}.`;
};

const respec = (profile: IProfile, line: string): string => {
  const state = reduceToFile(HOME);
  const r = respecClass({
    profile,
    line,
    unlockedSecrets: (state.unlocked_secret_classes ?? []) as string[],
    ts: new Date().toISOString(),
  });
  if (!r.ok) {
    fail(r.error ?? "");
  }
  persist(profile);
  return `Respec to ${line}.`;
};

const status = (profile: IProfile): string => {
  const state = reduceToFile(HOME);
  const affinity = state.class?.affinity ?? {};
  const suggested = Object.entries(affinity).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const bars = LINES.map(l => `${l} ${Math.round((affinity[l] ?? 0) * 100)}%`).join("  ");
  const form = state.class?.form ?? "Novice";
  const pct = Math.round((state.class?.base_passive_pct ?? 0) * 100);
  return (
    `${profile.name ?? "Adventurer"} · ${form}  (Lv.${state.level})\n` +
    `passive: +${pct}% (${form})\n` +
    `affinity: ${bars}\nsuggested line: ${suggested}`
  );
};

const lootTable = () => {
  return loadConfig(HOME).loot ?? LOOT_TABLE;
};

const inventory = (): string => {
  const inv = reduceToFile(HOME).inventory ?? [];
  if (inv.length === 0) {
    return "Inventory empty.";
  }
  const table = lootTable();
  return inv
    .map(i => {
      const qty = i.count > 1 ? `  ×${i.count}` : "";
      return `${i.rarity.padEnd(9)} ${table[i.id]?.name ?? i.id}${qty}`;
    })
    .join("\n");
};

const availableTitles = (): { id: string; name: string }[] => {
  const state = reduceToFile(HOME);
  const table = lootTable();
  const out: { id: string; name: string }[] = [];
  for (const item of state.inventory ?? []) {
    if (table[item.id]?.kind === LootKind.Title) {
      out.push({ id: item.id, name: table[item.id].name });
    }
  }
  const registry = loadConfig(HOME).achievements ?? {};
  for (const id of state.achievements?.earned ?? []) {
    const title = registry[id]?.reward?.title;
    if (title) {
      out.push({ id, name: title });
    }
  }
  return out;
};

const titles = (): string => {
  const list = availableTitles();
  if (list.length === 0) {
    return "No titles yet.";
  }
  return list.map(t => `${t.id}  —  ${t.name}`).join("\n");
};

const nameColors = (): string => {
  const table = lootTable();
  const owned = (reduceToFile(HOME).inventory ?? []).filter(
    i => table[i.id]?.kind === LootKind.NameColor,
  );
  if (owned.length === 0) {
    return "No name colors yet.";
  }
  return owned.map(i => `${i.id}  —  ${table[i.id].name}`).join("\n");
};

interface IEquipArgs {
  profile: IProfile;
  kind: LootKind;
  id: string;
}

const equip = (props: IEquipArgs): string => {
  const { profile, kind, id } = props;
  if (kind === LootKind.Title) {
    const match = availableTitles().find(t => t.id === id);
    if (!match) {
      fail(`Title "${id}" is locked.`);
    }
    profile.title = id;
    persist(profile);
    return `Equipped title: ${match.name}.`;
  }
  const item = lootTable()[id];
  if (!item || item.kind !== kind) {
    fail(`Unknown ${kind} "${id}".`);
  }
  const owned = new Set((reduceToFile(HOME).inventory ?? []).map(i => i.id));
  if (!owned.has(id)) {
    fail(`You don't own "${id}".`);
  }
  if (kind === LootKind.NameColor) {
    profile.name_color = id;
  } else {
    profile.theme = id;
  }
  persist(profile);
  return `Equipped ${kind}: ${item.name}.`;
};

const secrets = (): string => {
  const unlocked = new Set(
    (reduceToFile(HOME).unlocked_secret_classes ?? []) as string[],
  );
  const registry = loadConfig(HOME).achievements ?? {};
  const hint: Record<string, string> = {
    [SecretLine.Trickster]: "whispered, not earned",
  };
  for (const def of Object.values(registry)) {
    if (def.reward?.unlocks_class) {
      hint[def.reward.unlocks_class] = def.desc;
    }
  }
  return SECRETS.map(s => {
    if (unlocked.has(s)) {
      return `${SECRET_TREE[s as SecretLine].icon} ${s} — UNLOCKED`;
    }
    return `??? — ${hint[s] ?? "hidden"}`;
  }).join("\n");
};

const xyzzy = (profile: IProfile): string => {
  profile.xyzzy = true;
  persist(profile);
  return "A hollow voice says 'Fool.'  ✦ The Trickster is yours — `rpg class trickster`.";
};

const main = (): void => {
  const [cmd, ...args] = process.argv.slice(2);
  const profile = loadProfile(HOME);
  let out: string;
  switch (cmd) {
    case "name":
      out = setName(profile, args.join(" "));
      break;
    case "class":
      out = setClass(profile, args[0] ?? "");
      break;
    case "branch":
      out = setBranch(profile, args[0] ?? "");
      break;
    case "respec":
      out = respec(profile, args[0] ?? "");
      break;
    case "status":
      out = status(profile);
      break;
    case "inventory":
      out = inventory();
      break;
    case "title":
      out = equip({ profile, kind: LootKind.Title, id: args[0] ?? "" });
      break;
    case "theme":
      out = equip({ profile, kind: LootKind.Theme, id: args[0] ?? "" });
      break;
    case "namecolor":
      out = equip({ profile, kind: LootKind.NameColor, id: args[0] ?? "" });
      break;
    case "namecolors":
      out = nameColors();
      break;
    case "titles":
      out = titles();
      break;
    case "secrets":
      out = secrets();
      break;
    case "xyzzy":
      out = xyzzy(profile);
      break;
    default:
      fail(
        "Usage: rpg <name|class|branch|respec|status|inventory|title|theme|namecolor|titles|namecolors|secrets|xyzzy> …",
      );
  }
  console.log(out);
};

if (import.meta.main) {
  main();
}
