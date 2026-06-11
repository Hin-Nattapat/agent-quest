export enum ClassLine {
  Mage = "mage",
  Ranger = "ranger",
  Rogue = "rogue",
  Sage = "sage",
}

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

export interface IClassState {
  line: ClassLine | null;
  tier: number;
  form: ClassForm;
  icon: string;
  branch: "a" | "b" | null;
  affinity: Record<string, number>;
  advancement_pending: "class" | "branch" | null;
  base_passive_pct: number;
}

export function tierForLevel(level: number): number {
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
}

export function iconFor(line: ClassLine | null): string {
  if (!line) {
    return "";
  }
  return CLASS_TREE[line].icon;
}

export function formFor(
  line: ClassLine | null,
  tier: number,
  branch: "a" | "b" | null,
): ClassForm {
  if (!line || tier === 0) {
    return ClassForm.Novice;
  }
  if (tier >= 4) {
    if (branch) {
      return CLASS_TREE[line].branches[branch];
    }
    return CLASS_TREE[line].forms[2];
  }
  return CLASS_TREE[line].forms[tier - 1];
}

export function advancementPending(
  line: ClassLine | null,
  level: number,
  branch: "a" | "b" | null,
): "class" | "branch" | null {
  if (level >= 5 && line == null) {
    return "class";
  }
  if (level >= 50 && line != null && branch == null) {
    return "branch";
  }
  return null;
}
