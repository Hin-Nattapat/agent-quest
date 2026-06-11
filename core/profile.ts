import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { ClassLine } from "./classes";

export interface IProfile {
  name?: string;
  line?: ClassLine;
  branch?: "a" | "b";
  title?: string;
  theme?: string;
}

export function loadProfile(home: string): IProfile {
  const p = join(home, "profile.json");
  if (!existsSync(p)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(p, "utf8")) as IProfile;
  } catch {
    return {};
  }
}

export function saveProfile(home: string, profile: IProfile): void {
  writeFileSync(join(home, "profile.json"), JSON.stringify(profile, null, 2));
}
