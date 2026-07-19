// Player command-line for character identity. Writes profile.json, refreshes state.json.
import { defaultHome, loadConfig } from "../core/config";
import { loadProfile, saveProfile, type IProfile } from "../core/profile";
import { reduceToFile } from "../core/reduce";
import { ClassLine, SecretLine, SECRET_TREE } from "../core/classes";
import { chooseClass, respecClass, chooseBranch } from "../core/advance";
import { LOOT_TABLE, LootKind } from "../core/loot";
import { REALM_LABELS, CONQUEST_THRESHOLDS, REALM_TOTAL } from "../core/bestiary";
import { AURA_MILESTONES } from "../core/paragon";
import { existsSync } from "fs";
import { join } from "path";

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
  const r = chooseBranch({
    profile,
    branch,
    level: state.level,
    ts: new Date().toISOString(),
  });
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
  if (kind === LootKind.Companion) {
    profile.companion = id;
    persist(profile);
    return `Equipped companion: ${item.name}.`;
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
    [SecretLine.Trickster]: "an old magic word, first whispered in a colossal cave",
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

const codex = (): string => {
  const bestiary = reduceToFile(HOME).bestiary;
  const realms = bestiary?.realms ?? {};
  const conqueredCount = bestiary?.conquered.length ?? 0;
  const lines: string[] = [
    `Realm Conquest  ${conqueredCount}/${bestiary?.total ?? REALM_TOTAL}`,
  ];
  for (const [theme, label] of Object.entries(REALM_LABELS)) {
    const r = realms[theme];
    if (!r) {
      continue;
    }
    const t = CONQUEST_THRESHOLDS[theme];
    if (r.conquered) {
      lines.push(
        `✦ ${label} — CONQUERED  (${r.encounters} fights · ${r.boss_defeated} bosses)`,
      );
    } else {
      lines.push(
        `◇ ${label} — ${r.encounters}/${t.encounters} fights · ${r.boss_defeated}/${t.bosses} bosses`,
      );
    }
  }
  const undiscovered = REALM_TOTAL - Object.keys(realms).length;
  if (undiscovered > 0) {
    lines.push(`? ???  ·  ${undiscovered} undiscovered`);
  }
  return lines.join("\n");
};

const equipFrame = (profile: IProfile, id: string): string => {
  if (id === "none") {
    delete profile.frame;
    persist(profile);
    return "Frame unequipped.";
  }
  const conquered = new Set(reduceToFile(HOME).bestiary?.conquered ?? []);
  if (!conquered.has(id)) {
    fail(`Realm "${id}" is not conquered.`);
  }
  profile.frame = id;
  persist(profile);
  return `Equipped frame: ${REALM_LABELS[id] ?? id}.`;
};

const equipAura = (profile: IProfile, id: string): string => {
  if (id === "none") {
    delete profile.aura;
    persist(profile);
    return "Aura unequipped.";
  }
  const unlocked = new Set(reduceToFile(HOME).paragon?.auras ?? []);
  if (!unlocked.has(id)) {
    fail(`Aura "${id}" is locked.`);
  }
  const label = AURA_MILESTONES.find(m => m.id === id)?.label ?? id;
  profile.aura = id;
  persist(profile);
  return `Equipped aura: ${label}.`;
};

const ensureEngineDeployed = (): void => {
  if (existsSync(join(HOME, "adapters"))) {
    return;
  }
  const installer = new URL("./install.sh", import.meta.url).pathname;
  const proc = Bun.spawnSync(["bash", installer, "--deploy-only"], {
    env: { ...process.env, AGENTRPG_HOME: HOME },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  if ((proc.exitCode ?? 0) !== 0) {
    fail(`Failed to deploy the Agent Quest engine to ${HOME}`);
  }
};

const runSetup = (): never => {
  ensureEngineDeployed();
  const wire = new URL("../scripts/wire.sh", import.meta.url).pathname;
  const proc = Bun.spawnSync(["bash", wire, "interactive"], {
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(proc.exitCode ?? 0);
};

const xyzzy = (profile: IProfile): string => {
  profile.xyzzy = true;
  persist(profile);
  return "A hollow voice says 'Fool.'  ✦ The Trickster is yours — `aq class trickster`.";
};

const HELP = `Agent Quest — gamify your AI coding agent usage into an RPG

Usage:  aq <command> [args]

Setup
  setup                wire your coding agent(s) (checkbox picker)

Character
  status               show your character
  name <name>          set your name
  class <line>         choose/advance a line (mage|ranger|rogue|sage)
  branch <a|b>         choose your tier-4 branch
  respec <line>        switch main line

Cosmetics & deeds
  inventory            list your loot
  title <id>           equip a title        titles       list owned titles
  theme <id>           equip a theme
  namecolor <id>       equip a name color   namecolors   list owned colors
  companion <id|none>  equip a companion
  secrets              list unlocked secret classes
  codex                realm conquest progress
  frame <realm|none>   equip a conquered realm's frame
  aura <id|none>       equip a paragon aura

  aq --help            show this help`;

const main = (): void => {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === undefined || cmd === "--help" || cmd === "-h") {
    console.log(HELP);
    return;
  }
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
    case "companion":
      if ((args[0] ?? "") === "none") {
        delete profile.companion;
        persist(profile);
        out = "Companion unequipped.";
      } else {
        out = equip({ profile, kind: LootKind.Companion, id: args[0] ?? "" });
      }
      break;
    case "titles":
      out = titles();
      break;
    case "secrets":
      out = secrets();
      break;
    case "codex":
      out = codex();
      break;
    case "frame":
      out = equipFrame(profile, args[0] ?? "");
      break;
    case "aura":
      out = equipAura(profile, args[0] ?? "");
      break;
    case "xyzzy":
      out = xyzzy(profile);
      break;
    case "setup":
      runSetup();
      return;
    default:
      fail(`unknown command: ${cmd}\nRun 'aq --help' for usage.`);
  }
  console.log(out);
};

if (import.meta.main) {
  main();
}
