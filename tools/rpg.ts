// Player command-line for character identity. Writes profile.json, refreshes state.json.
import { defaultHome, loadConfig } from "../core/config";
import { loadProfile, saveProfile, type IProfile } from "../core/profile";
import { reduceToFile } from "../core/reduce";
import {
  ClassLine,
  SecretLine,
  CLASS_TREE,
  SECRET_TREE,
  isSecret,
} from "../core/classes";
import { LOOT_TABLE, LootKind } from "../core/loot";

const HOME = defaultHome();
const LINES = Object.values(ClassLine) as string[];
const SECRETS = Object.values(SecretLine) as string[];

function fail(message: string): never {
  process.stderr.write(message + "\n");
  process.exit(1);
}

function currentLevel(): number {
  return reduceToFile(HOME).level;
}

function persist(profile: IProfile): void {
  saveProfile(HOME, profile);
  reduceToFile(HOME);
}

function setName(profile: IProfile, name: string): string {
  profile.name = name.trim().slice(0, 24);
  persist(profile);
  return `Name set to "${profile.name}".`;
}

function setClass(profile: IProfile, line: string): string {
  if (LINES.includes(line)) {
    if (currentLevel() < 5) {
      fail("Reach level 5 before choosing a class.");
    }
    profile.line = line as ClassLine;
    profile.branch = undefined;
    persist(profile);
    return `Class set to ${line}.`;
  }
  if (SECRETS.includes(line)) {
    const unlocked = reduceToFile(HOME).unlocked_secret_classes ?? [];
    if (!unlocked.includes(line as SecretLine)) {
      fail(`Secret class "${line}" is locked.`);
    }
    profile.line = line as SecretLine;
    profile.branch = undefined;
    persist(profile);
    return `Class set to ${line}.`;
  }
  fail(`Unknown class "${line}". Choose: ${LINES.join(", ")}.`);
}

function setBranch(profile: IProfile, branch: string): string {
  if (branch !== "a" && branch !== "b") {
    fail(`Branch must be "a" or "b".`);
  }
  if (!profile.line) {
    fail("Choose a class first.");
  }
  if (isSecret(profile.line)) {
    fail("Secret classes have no branch.");
  }
  if (currentLevel() < 50) {
    fail("Reach level 50 before branching.");
  }
  if (profile.branch) {
    fail("Branch already chosen (locked).");
  }
  profile.branch = branch;
  persist(profile);
  return `Branch locked: ${CLASS_TREE[profile.line].branches[branch]}.`;
}

function respec(profile: IProfile, line: string): string {
  if (!LINES.includes(line)) {
    fail(`Unknown class "${line}".`);
  }
  if (currentLevel() >= 50) {
    fail("Cannot respec at level 50.");
  }
  profile.line = line as ClassLine;
  profile.branch = undefined;
  persist(profile);
  return `Respec to ${line}.`;
}

function status(profile: IProfile): string {
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
}

function lootTable() {
  return loadConfig(HOME).loot ?? LOOT_TABLE;
}

function inventory(): string {
  const inv = reduceToFile(HOME).inventory ?? [];
  if (inv.length === 0) {
    return "Inventory empty.";
  }
  const table = lootTable();
  return inv
    .map(i => `${i.rarity.padEnd(9)} ${table[i.id]?.name ?? i.id}  ×${i.count}`)
    .join("\n");
}

function availableTitles(): { id: string; name: string }[] {
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
}

function titles(): string {
  const list = availableTitles();
  if (list.length === 0) {
    return "No titles yet.";
  }
  return list.map(t => `${t.id}  —  ${t.name}`).join("\n");
}

function equip(profile: IProfile, kind: LootKind, id: string): string {
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
  profile.theme = id;
  persist(profile);
  return `Equipped ${kind}: ${item.name}.`;
}

function secrets(): string {
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
}

function xyzzy(profile: IProfile): string {
  profile.xyzzy = true;
  persist(profile);
  return "A hollow voice says 'Fool.'  ✦ The Trickster is yours — `rpg class trickster`.";
}

function main(): void {
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
      out = equip(profile, LootKind.Title, args[0] ?? "");
      break;
    case "theme":
      out = equip(profile, LootKind.Theme, args[0] ?? "");
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
        "Usage: rpg <name|class|branch|respec|status|inventory|title|theme|titles|secrets|xyzzy> …",
      );
  }
  console.log(out);
}

if (import.meta.main) {
  main();
}
