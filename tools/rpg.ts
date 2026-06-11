// Player command-line for character identity. Writes profile.json, refreshes state.json.
import { defaultHome } from "../core/config";
import { loadProfile, saveProfile, type IProfile } from "../core/profile";
import { reduceToFile } from "../core/reduce";
import { ClassLine, CLASS_TREE } from "../core/classes";

const HOME = defaultHome();
const LINES = Object.values(ClassLine) as string[];

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
  if (!LINES.includes(line)) {
    fail(`Unknown class "${line}". Choose: ${LINES.join(", ")}.`);
  }
  if (currentLevel() < 5) {
    fail("Reach level 5 before choosing a class.");
  }
  profile.line = line as ClassLine;
  profile.branch = undefined;
  persist(profile);
  return `Class set to ${line}.`;
}

function setBranch(profile: IProfile, branch: string): string {
  if (branch !== "a" && branch !== "b") {
    fail(`Branch must be "a" or "b".`);
  }
  if (!profile.line) {
    fail("Choose a class first.");
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
  return (
    `${profile.name ?? "Adventurer"} · ${state.class?.form ?? "Novice"}  (Lv.${state.level})\n` +
    `affinity: ${bars}\nsuggested line: ${suggested}`
  );
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
    default:
      fail("Usage: rpg <name|class|branch|respec|status> …");
  }
  console.log(out);
}

if (import.meta.main) {
  main();
}
