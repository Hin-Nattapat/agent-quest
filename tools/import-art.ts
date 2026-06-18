import {
  readdirSync,
  copyFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

export enum AssetType {
  Hero = "hero",
  Bg = "bg",
  Item = "item",
  Monster = "monster",
  Boss = "boss",
}

export interface ITarget {
  type: AssetType;
  line?: string;
  tier?: string;
  name?: string;
}

// `--as hero:<line>:<tier>` or `--as bg:<name>` / `item:<name>` (and monster/boss, name-shaped).
export const parseTarget = (asArg: string): ITarget => {
  const parts = asArg.split(":");
  const type = parts[0] as AssetType;
  if (!Object.values(AssetType).includes(type)) {
    throw new Error(
      `unknown asset type "${parts[0]}" (expected ${Object.values(AssetType).join("|")})`,
    );
  }
  if (type === AssetType.Hero) {
    if (parts.length !== 3) {
      throw new Error(`hero needs --as hero:<line>:<tier> (got "${asArg}")`);
    }
    return { type, line: parts[1], tier: parts[2] };
  }
  if (parts.length !== 2) {
    throw new Error(`${type} needs --as ${type}:<name> (got "${asArg}")`);
  }
  return { type, name: parts[1] };
};

// "frame_007.png" -> "7" (PixelLab zero-pads; our layout uses bare indices).
export const frameIndex = (file: string): string => {
  const match = file.match(/frame_(\d+)\.png$/);
  if (!match) {
    throw new Error(`not a PixelLab frame file: ${file}`);
  }
  return String(Number(match[1]));
};

// PixelLab names animation folders inconsistently (case + the full Action Description), so match
// by substring instead of an exact name. Returns the folder name or null if none contains needle.
export const pickAnimDir = (names: string[], needle: string): string | null => {
  const lower = needle.toLowerCase();
  const found = names.find(name => name.toLowerCase().includes(lower));
  return found ?? null;
};

// import-art.ts lives in tools/, so the repo root is one level up; assets go under app/public.
const PUBLIC = join(import.meta.dir, "..", "app", "public");
const CARDINALS = ["south", "north", "east", "west"];

const pngs = (dir: string): string[] => readdirSync(dir).filter(f => f.endsWith(".png"));

// PixelLab character export -> sprites/<line>/<tier>/{idle/<dir>, walk/<dir>/N, cast/N (east)}.
const importHero = (rawDir: string, target: ITarget): void => {
  const out = join(PUBLIC, "sprites", target.line ?? "", target.tier ?? "");
  const animDir = join(rawDir, "animations");
  if (!existsSync(join(rawDir, "rotations")) || !existsSync(animDir)) {
    throw new Error(`hero export missing rotations/ or animations/ in ${rawDir}`);
  }
  const animNames = readdirSync(animDir);
  // "alk" matches both the short "walk" export folder and the older "walking_forward" description.
  const walk = pickAnimDir(animNames, "alk");
  if (!walk) {
    throw new Error(`hero export has no walking animation in ${animDir}`);
  }
  // Prefer "attack" folder (ranger/rogue/sage); fall back to "casting" for mage — both output to attack/.
  const attack = pickAnimDir(animNames, "ttack") ?? pickAnimDir(animNames, "asting");

  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "idle"), { recursive: true });
  for (const dir of CARDINALS) {
    const rotation = join(rawDir, "rotations", `${dir}.png`);
    if (!existsSync(rotation)) {
      throw new Error(`hero export missing rotations/${dir}.png in ${rawDir}`);
    }
    copyFileSync(rotation, join(out, "idle", `${dir}.png`));
    let srcWalk = join(animDir, walk, dir);
    if (!existsSync(srcWalk)) {
      // Some exports only render the east (battle-facing) walk; reuse it for the other overworld
      // directions so the manifest's per-direction frames still resolve instead of 404-ing.
      const eastWalk = join(animDir, walk, "east");
      if (!existsSync(eastWalk)) {
        throw new Error(
          `hero walk animation missing "${dir}/" (no east fallback) in ${join(animDir, walk)}`,
        );
      }
      srcWalk = eastWalk;
    }
    mkdirSync(join(out, "walk", dir), { recursive: true });
    for (const f of pngs(srcWalk)) {
      copyFileSync(join(srcWalk, f), join(out, "walk", dir, `${frameIndex(f)}.png`));
    }
  }
  if (attack) {
    const srcAttack = join(animDir, attack, "east");
    mkdirSync(join(out, "attack"), { recursive: true });
    for (const f of pngs(srcAttack)) {
      copyFileSync(join(srcAttack, f), join(out, "attack", `${frameIndex(f)}.png`));
    }
  } else {
    console.warn("  (no attack/casting animation found — skipping attack/)");
  }
  console.log(`hero ${target.line}/${target.tier} -> ${out}`);
};

// A bg/item source is either a single .png file or a folder containing exactly one .png.
const oneSourcePng = (raw: string): string => {
  if (statSync(raw).isFile()) {
    if (!raw.endsWith(".png")) {
      throw new Error(`expected a .png file: ${raw}`);
    }
    return raw;
  }
  const found = pngs(raw);
  if (found.length !== 1) {
    throw new Error(`expected exactly one .png in ${raw}, found ${found.length}`);
  }
  return join(raw, found[0]);
};

const importSingle = (raw: string, target: ITarget, subdir: string): void => {
  const out = join(PUBLIC, subdir);
  mkdirSync(out, { recursive: true });
  const dest = join(out, `${target.name ?? ""}.png`);
  copyFileSync(oneSourcePng(raw), dest);
  console.log(`${target.type} -> ${dest}`);
};

const importBg = (raw: string, target: ITarget): void =>
  importSingle(raw, target, "scenes");
const importItem = (raw: string, target: ITarget): void =>
  importSingle(raw, target, "items");

// Monster anims may be single-direction (frames directly in the anim folder) or multi-direction
// (frames under west/south/…). The battle mob faces the hero on the left, so prefer the west view.
const animFrameDir = (animPath: string): string => {
  const west = join(animPath, "west");
  if (existsSync(west)) {
    return west;
  }
  return animPath;
};

// PixelLab creature export -> sprites/monsters/<theme>/{idle/N, attack/N} (west = faces the hero).
const importMonster = (rawDir: string, target: ITarget): void => {
  const theme = target.name ?? "";
  const out = join(PUBLIC, "sprites", "monsters", theme);
  const animDir = join(rawDir, "animations");
  if (!existsSync(animDir)) {
    throw new Error(`monster export missing animations/ in ${rawDir}`);
  }
  const animNames = readdirSync(animDir);
  const idle = pickAnimDir(animNames, "dle");
  const attack = pickAnimDir(animNames, "ttack");
  if (!idle) {
    throw new Error(`monster export has no idle animation in ${animDir}`);
  }

  rmSync(out, { recursive: true, force: true });
  const copyAnim = (animName: string, sub: string): number => {
    const src = animFrameDir(join(animDir, animName));
    mkdirSync(join(out, sub), { recursive: true });
    const files = pngs(src);
    for (const f of files) {
      copyFileSync(join(src, f), join(out, sub, `${frameIndex(f)}.png`));
    }
    return files.length;
  };

  const idleN = copyAnim(idle, "idle");
  let attackN = 0;
  if (attack) {
    attackN = copyAnim(attack, "attack");
  } else {
    console.warn("  (no attack animation found — skipping attack/)");
  }
  console.log(`monster ${theme} -> ${out}  (idle: ${idleN}, attack: ${attackN})`);
};

const notImplemented = (name: string) => (): void => {
  throw new Error(
    `${name} import not implemented yet — see docs/reference/art-import.md (Adding a type)`,
  );
};

const TYPES: Record<AssetType, (raw: string, target: ITarget) => void> = {
  [AssetType.Hero]: importHero,
  [AssetType.Bg]: importBg,
  [AssetType.Item]: importItem,
  [AssetType.Monster]: importMonster,
  [AssetType.Boss]: notImplemented("boss"),
};

const USAGE = "usage: bun tools/import-art.ts <raw-folder> --as <type>:<args> [--rm]";

export const run = (argv: string[]): void => {
  const raw = argv[0];
  const asIdx = argv.indexOf("--as");
  const asArg = asIdx >= 0 ? argv[asIdx + 1] : undefined;
  if (!raw || raw.startsWith("--") || !asArg) {
    throw new Error(USAGE);
  }
  if (!existsSync(raw)) {
    throw new Error(`raw path not found: ${raw}`);
  }
  const target = parseTarget(asArg);
  TYPES[target.type](raw, target);
  if (argv.includes("--rm")) {
    rmSync(raw, { recursive: true, force: true });
    console.log(`removed raw ${raw}`);
  }
  console.log("done");
};

if (import.meta.main) {
  try {
    run(process.argv.slice(2));
  } catch (err) {
    console.error(`import-art: ${(err as Error).message}`);
    process.exit(1);
  }
}
