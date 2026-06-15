import type { IProfile } from "./profile";
import { ClassLine, SecretLine, isSecret, type TLine } from "./classes";

export interface IAdvanceResult {
  ok: boolean;
  error?: string;
}

const MAIN_LINES = Object.values(ClassLine) as string[];
const SECRET_LINES = Object.values(SecretLine) as string[];

interface IChooseClassArgs {
  profile: IProfile;
  line: string;
  level: number;
  unlockedSecrets: string[];
}

// Initial class pick (Lv.5+): a main line, or an unlocked secret. Sets line, clears branch.
export const chooseClass = (props: IChooseClassArgs): IAdvanceResult => {
  const { profile, line, level, unlockedSecrets } = props;
  if (MAIN_LINES.includes(line)) {
    if (level < 5) {
      return { ok: false, error: "Reach level 5 before choosing a class." };
    }
    profile.line = line as ClassLine;
    profile.branch = undefined;
    return { ok: true };
  }
  if (SECRET_LINES.includes(line)) {
    if (!unlockedSecrets.includes(line)) {
      return { ok: false, error: `Secret class "${line}" is locked.` };
    }
    profile.line = line as SecretLine;
    profile.branch = undefined;
    return { ok: true };
  }
  return { ok: false, error: `Unknown class "${line}".` };
};

interface IRespecClassArgs {
  profile: IProfile;
  line: string;
  level: number;
}

// Respec an existing main class below Lv.50. Sets line, clears branch.
export const respecClass = (props: IRespecClassArgs): IAdvanceResult => {
  const { profile, line, level } = props;
  if (!MAIN_LINES.includes(line)) {
    return { ok: false, error: `Unknown class "${line}".` };
  }
  if (level >= 50) {
    return { ok: false, error: "Cannot respec at level 50." };
  }
  profile.line = line as ClassLine;
  profile.branch = undefined;
  return { ok: true };
};

interface IChooseBranchArgs {
  profile: IProfile;
  branch: string;
  level: number;
}

// T4 branch pick (Lv.50+, main line, not locked). Sets branch.
export const chooseBranch = (props: IChooseBranchArgs): IAdvanceResult => {
  const { profile, branch, level } = props;
  if (branch !== "a" && branch !== "b") {
    return { ok: false, error: `Branch must be "a" or "b".` };
  }
  if (!profile.line) {
    return { ok: false, error: "Choose a class first." };
  }
  if (isSecret(profile.line as TLine)) {
    return { ok: false, error: "Secret classes have no branch." };
  }
  if (level < 50) {
    return { ok: false, error: "Reach level 50 before branching." };
  }
  if (profile.branch) {
    return { ok: false, error: "Branch already chosen (locked)." };
  }
  profile.branch = branch;
  return { ok: true };
};
