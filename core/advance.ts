import type { IProfile } from "./profile";
import { ClassLine, SecretLine, isSecret, type TLine } from "./classes";

export interface IAdvanceResult {
  ok: boolean;
  error?: string;
}

const MAIN_LINES = Object.values(ClassLine) as string[];
const SECRET_LINES = Object.values(SecretLine) as string[];

// A ts that sorts before any real journal event, used to backfill a legacy class as "active from
// the start" the first time that save records history (so a respec never re-prices its prior XP).
const HISTORY_START = "1970-01-01T00:00:00.000Z";

// Switch the profile to `line`, recording the change on the earn-time history the reducer reads.
// Callers pass the wall-clock `ts`; the reducer prices each event with the class active at its ts.
const adopt = (profile: IProfile, line: TLine, ts?: string): void => {
  if ((profile.history?.length ?? 0) === 0 && profile.line != null) {
    profile.history = [{ ts: HISTORY_START, line: profile.line }];
  }
  profile.line = line;
  profile.branch = undefined;
  if (ts != null) {
    profile.history = [...(profile.history ?? []), { ts, line }];
  }
};

interface IChooseClassArgs {
  profile: IProfile;
  line: string;
  level: number;
  unlockedSecrets: string[];
  ts?: string;
}

// Initial class pick (Lv.5+): a main line, or an unlocked secret. Sets line, clears branch.
export const chooseClass = (props: IChooseClassArgs): IAdvanceResult => {
  const { profile, line, level, unlockedSecrets, ts } = props;
  if (MAIN_LINES.includes(line)) {
    if (level < 5) {
      return { ok: false, error: "Reach level 5 before choosing a class." };
    }
    adopt(profile, line as ClassLine, ts);
    return { ok: true };
  }
  if (SECRET_LINES.includes(line)) {
    if (!unlockedSecrets.includes(line)) {
      return { ok: false, error: `Secret class "${line}" is locked.` };
    }
    adopt(profile, line as SecretLine, ts);
    return { ok: true };
  }
  return { ok: false, error: `Unknown class "${line}".` };
};

interface IRespecClassArgs {
  profile: IProfile;
  line: string;
  unlockedSecrets: string[];
  ts?: string;
}

// Respec an existing class — at any level — into a main line or an unlocked secret. Clears branch.
export const respecClass = (props: IRespecClassArgs): IAdvanceResult => {
  const { profile, line, unlockedSecrets, ts } = props;
  if (MAIN_LINES.includes(line)) {
    adopt(profile, line as ClassLine, ts);
    return { ok: true };
  }
  if (SECRET_LINES.includes(line)) {
    if (!unlockedSecrets.includes(line)) {
      return { ok: false, error: `Secret class "${line}" is locked.` };
    }
    adopt(profile, line as SecretLine, ts);
    return { ok: true };
  }
  return { ok: false, error: `Unknown class "${line}".` };
};

interface IChooseBranchArgs {
  profile: IProfile;
  branch: string;
  level: number;
  ts?: string;
}

// T4 branch pick (Lv.50+, main line, not locked). Sets branch, and — same earn-time history as
// adopt() — records a branch epoch so the reducer can attribute bestiary realms per event instead
// of by the single current branch (a respec must not erase a prior branch's realm counts).
export const chooseBranch = (props: IChooseBranchArgs): IAdvanceResult => {
  const { profile, branch, level, ts } = props;
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
  if ((profile.history?.length ?? 0) === 0 && profile.line != null) {
    profile.history = [{ ts: HISTORY_START, line: profile.line }];
  }
  profile.branch = branch;
  if (ts != null) {
    profile.history = [
      ...(profile.history ?? []),
      { ts, line: profile.line as TLine, branch },
    ];
  }
  return { ok: true };
};
