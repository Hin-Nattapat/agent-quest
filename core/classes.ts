export enum ClassLine {
  Mage = "mage",
  Ranger = "ranger",
  Rogue = "rogue",
  Sage = "sage",
}

// Secret lines: unlocked via hidden achievements / an easter egg, never in the pick menu.
export enum SecretLine {
  Maestro = "maestro",
  NightOwl = "night_owl",
  Ascetic = "ascetic",
  Gremlin = "gremlin",
  Trickster = "trickster",
}

export type TLine = ClassLine | SecretLine;

const SECRET_VALUES: Set<string> = new Set(Object.values(SecretLine));

export const isSecret = (line: TLine): line is SecretLine => {
  return SECRET_VALUES.has(line);
};

// Every (line × tier) form name. Members carry the display string (the wire/HUD value).
export enum ClassForm {
  Novice = "Novice",

  BackendMage = "Backend Mage",
  ServerSorcerer = "Server Sorcerer",
  InfraArchmage = "Infra Archmage",
  CloudSummoner = "Cloud Summoner",
  KernelLich = "Kernel Lich",

  FrontendRanger = "Frontend Ranger",
  UISharpshooter = "UI Sharpshooter",
  PixelHunter = "Pixel Hunter",
  MotionTrickster = "Motion Trickster",
  DesignWarden = "Design Warden",

  DebuggerRogue = "Debugger Rogue",
  BugAssassin = "Bug Assassin",
  StackStalker = "Stack Stalker",
  HeisenbugHunter = "Heisenbug Hunter",
  ForensicsShadow = "Forensics Shadow",

  ArchitectSage = "Architect Sage",
  SystemOracle = "System Oracle",
  PatternMagus = "Pattern Magus",
  DomainProphet = "Domain Prophet",
  OrchestrationMaster = "Orchestration Master",

  Conductor = "Conductor",
  Maestro = "Maestro",
  Virtuoso = "Virtuoso",
  GrandSymphony = "Grand Symphony",

  NightOwl = "Night Owl",
  Moonlighter = "Moonlighter",
  Nocturne = "Nocturne",
  Eclipse = "Eclipse",

  Initiate = "Initiate",
  Ascetic = "Ascetic",
  Hermit = "Hermit",
  Enlightened = "Enlightened",

  Imp = "Imp",
  Gremlin = "Gremlin",
  Poltergeist = "Poltergeist",
  ChaosDaemon = "Chaos Daemon",

  Prankster = "Prankster",
  Trickster = "Trickster",
  Illusionist = "Illusionist",
  Archfool = "Archfool",
}

export interface IClassDef {
  icon: string;
  forms: [ClassForm, ClassForm, ClassForm]; // T1, T2, T3
  branches: { a: ClassForm; b: ClassForm }; // T4
}

export const CLASS_TREE: Record<ClassLine, IClassDef> = {
  [ClassLine.Mage]: {
    icon: "⚔",
    forms: [ClassForm.BackendMage, ClassForm.ServerSorcerer, ClassForm.InfraArchmage],
    branches: { a: ClassForm.CloudSummoner, b: ClassForm.KernelLich },
  },
  [ClassLine.Ranger]: {
    icon: "🏹",
    forms: [ClassForm.FrontendRanger, ClassForm.UISharpshooter, ClassForm.PixelHunter],
    branches: { a: ClassForm.MotionTrickster, b: ClassForm.DesignWarden },
  },
  [ClassLine.Rogue]: {
    icon: "🗡",
    forms: [ClassForm.DebuggerRogue, ClassForm.BugAssassin, ClassForm.StackStalker],
    branches: { a: ClassForm.HeisenbugHunter, b: ClassForm.ForensicsShadow },
  },
  [ClassLine.Sage]: {
    icon: "📖",
    forms: [ClassForm.ArchitectSage, ClassForm.SystemOracle, ClassForm.PatternMagus],
    branches: { a: ClassForm.DomainProphet, b: ClassForm.OrchestrationMaster },
  },
};

export interface ISecretDef {
  icon: string;
  forms: [ClassForm, ClassForm, ClassForm, ClassForm]; // T1..T4, no branch
}

export const SECRET_TREE: Record<SecretLine, ISecretDef> = {
  [SecretLine.Maestro]: {
    icon: "🎼",
    forms: [
      ClassForm.Conductor,
      ClassForm.Maestro,
      ClassForm.Virtuoso,
      ClassForm.GrandSymphony,
    ],
  },
  [SecretLine.NightOwl]: {
    icon: "🦉",
    forms: [
      ClassForm.NightOwl,
      ClassForm.Moonlighter,
      ClassForm.Nocturne,
      ClassForm.Eclipse,
    ],
  },
  [SecretLine.Ascetic]: {
    icon: "🧘",
    forms: [
      ClassForm.Initiate,
      ClassForm.Ascetic,
      ClassForm.Hermit,
      ClassForm.Enlightened,
    ],
  },
  [SecretLine.Gremlin]: {
    icon: "👺",
    forms: [
      ClassForm.Imp,
      ClassForm.Gremlin,
      ClassForm.Poltergeist,
      ClassForm.ChaosDaemon,
    ],
  },
  [SecretLine.Trickster]: {
    icon: "✦",
    forms: [
      ClassForm.Prankster,
      ClassForm.Trickster,
      ClassForm.Illusionist,
      ClassForm.Archfool,
    ],
  },
};

export interface IClassTree {
  forms: string[]; // tier forms (3 main, 4 secret)
  branches?: { a: string; b: string }; // T4 forms (main lines only)
}

export const classTree = (line: TLine | null): IClassTree | undefined => {
  if (line === null) {
    return undefined;
  }
  if (isSecret(line)) {
    return { forms: [...SECRET_TREE[line].forms] };
  }
  return {
    forms: [...CLASS_TREE[line].forms],
    branches: { ...CLASS_TREE[line].branches },
  };
};

export interface IClassState {
  line: TLine | null;
  tier: number;
  form: ClassForm;
  icon: string;
  branch: "a" | "b" | null;
  affinity: Record<string, number>;
  advancement_pending: "class" | "branch" | null;
  base_passive_pct: number;
  tree?: IClassTree;
}

export const tierForLevel = (level: number): number => {
  if (level >= 50) {
    return 4;
  }
  if (level >= 30) {
    return 3;
  }
  if (level >= 15) {
    return 2;
  }
  if (level >= 5) {
    return 1;
  }
  return 0;
};

export const iconFor = (line: TLine | null): string => {
  if (!line) {
    return "";
  }
  if (isSecret(line)) {
    return SECRET_TREE[line].icon;
  }
  return CLASS_TREE[line].icon;
};

interface IFormForArgs {
  line: TLine | null;
  tier: number;
  branch: "a" | "b" | null;
}

export const formFor = (props: IFormForArgs): ClassForm => {
  const { line, tier, branch } = props;
  if (!line || tier === 0) {
    return ClassForm.Novice;
  }
  if (isSecret(line)) {
    const idx = Math.min(Math.max(tier - 1, 0), 3);
    return SECRET_TREE[line].forms[idx];
  }
  if (tier >= 4) {
    if (branch) {
      return CLASS_TREE[line].branches[branch];
    }
    return CLASS_TREE[line].forms[2];
  }
  return CLASS_TREE[line].forms[tier - 1];
};

interface IAdvancementPendingArgs {
  line: TLine | null;
  level: number;
  branch: "a" | "b" | null;
}

export const advancementPending = (
  props: IAdvancementPendingArgs,
): "class" | "branch" | null => {
  const { line, level, branch } = props;
  if (level >= 5 && line == null) {
    return "class";
  }
  if (line != null && isSecret(line)) {
    return null; // secret lines have no T4 branch and aren't offered at Lv.5
  }
  if (level >= 50 && line != null && branch == null) {
    return "branch";
  }
  return null;
};
