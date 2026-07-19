import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { TLine } from "./classes";

// One entry per time the player adopted a class, stamped when the switch happened. The reducer
// scores each event with whichever class was active at that event's `ts` (earn-time), so a later
// respec never re-prices — or erases — XP earned under a previous class.
export interface IClassEpoch {
  ts: string; // UTC ISO8601, when this class became active
  line: TLine;
  branch?: "a" | "b";
}

export interface IProfile {
  name?: string;
  line?: TLine;
  branch?: "a" | "b";
  history?: IClassEpoch[];
  title?: string;
  theme?: string;
  name_color?: string;
  companion?: string;
  frame?: string;
  aura?: string;
  xyzzy?: boolean;
}

export const loadProfile = (home: string): IProfile => {
  const p = join(home, "profile.json");
  if (!existsSync(p)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(p, "utf8")) as IProfile;
  } catch {
    return {};
  }
};

export const saveProfile = (home: string, profile: IProfile): void => {
  writeFileSync(join(home, "profile.json"), JSON.stringify(profile, null, 2));
};
