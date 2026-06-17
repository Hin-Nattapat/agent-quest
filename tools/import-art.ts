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
  const walk = pickAnimDir(animNames, "alking");
  if (!walk) {
    throw new Error(`hero export has no walking animation in ${animDir}`);
  }
  const cast = pickAnimDir(animNames, "asting");

  rmSync(out, { recursive: true, force: true });
  mkdirSync(join(out, "idle"), { recursive: true });
  for (const dir of CARDINALS) {
    const rotation = join(rawDir, "rotations", `${dir}.png`);
    if (!existsSync(rotation)) {
      throw new Error(`hero export missing rotations/${dir}.png in ${rawDir}`);
    }
    copyFileSync(rotation, join(out, "idle", `${dir}.png`));
    const srcWalk = join(animDir, walk, dir);
    if (!existsSync(srcWalk)) {
      throw new Error(`hero walk animation missing "${dir}/" in ${join(animDir, walk)}`);
    }
    mkdirSync(join(out, "walk", dir), { recursive: true });
    for (const f of pngs(srcWalk)) {
      copyFileSync(join(srcWalk, f), join(out, "walk", dir, `${frameIndex(f)}.png`));
    }
  }
  if (cast) {
    const srcCast = join(animDir, cast, "east");
    mkdirSync(join(out, "cast"), { recursive: true });
    for (const f of pngs(srcCast)) {
      copyFileSync(join(srcCast, f), join(out, "cast", `${frameIndex(f)}.png`));
    }
  } else {
    console.warn("  (no casting animation found — skipping cast/)");
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

const notImplemented = (name: string) => (): void => {
  throw new Error(
    `${name} import not implemented yet — see docs/reference/art-import.md (Adding a type)`,
  );
};

const TYPES: Record<AssetType, (raw: string, target: ITarget) => void> = {
  [AssetType.Hero]: importHero,
  [AssetType.Bg]: importBg,
  [AssetType.Item]: importItem,
  [AssetType.Monster]: notImplemented("monster"),
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
