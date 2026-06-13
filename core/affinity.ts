import { EventType, AgentAction, type INormalizedEvent } from "./events";
import { ClassLine, SecretLine, isSecret, type TLine } from "./classes";
import { isNight } from "./streak";

const MAGE_EXT = [".go", ".sql", ".rs", ".yaml", ".yml"];
const RANGER_EXT = [".tsx", ".jsx", ".css", ".scss", ".html", ".vue"];
const SAGE_EXT = [".md", ".mdx"];

const hasExt = (file: string | undefined, exts: string[]): boolean => {
  return file != null && exts.some(ext => file.endsWith(ext));
};

// Each event contributes to at most one line (delegate wins over a failed delegate, etc.).
export const lineForEvent = (e: INormalizedEvent): ClassLine | null => {
  if (e.action === AgentAction.Delegate) {
    return ClassLine.Sage;
  }
  if (e.type === EventType.ActionFail) {
    return ClassLine.Rogue;
  }
  if (e.type !== EventType.Action) {
    return null;
  }
  if (e.action === AgentAction.Run) {
    return ClassLine.Mage;
  }
  if (e.action === AgentAction.Read || e.action === AgentAction.Search) {
    return ClassLine.Rogue;
  }
  if (e.action === AgentAction.Edit || e.action === AgentAction.Write) {
    if (hasExt(e.file, RANGER_EXT)) {
      return ClassLine.Ranger;
    }
    if (hasExt(e.file, MAGE_EXT) || e.file?.endsWith("Dockerfile")) {
      return ClassLine.Mage;
    }
    if (hasExt(e.file, SAGE_EXT)) {
      return ClassLine.Sage;
    }
  }
  return null;
};

export const computeAffinity = (
  events: INormalizedEvent[],
): Record<ClassLine, number> => {
  const counts: Record<ClassLine, number> = {
    [ClassLine.Mage]: 0,
    [ClassLine.Ranger]: 0,
    [ClassLine.Rogue]: 0,
    [ClassLine.Sage]: 0,
  };
  let total = 0;
  for (const e of events) {
    const line = lineForEvent(e);
    if (line) {
      counts[line]++;
      total++;
    }
  }
  if (total === 0) {
    return counts;
  }
  const affinity = { ...counts };
  for (const line of Object.keys(affinity) as ClassLine[]) {
    affinity[line] = counts[line] / total;
  }
  return affinity;
};

// Which events feed a line's base passive. Main lines reuse affinity's signal; secret lines
// each have a narrow thematic predicate (so a secret is never strictly stronger than a main line).
export const isPassiveSignal = (line: TLine, e: INormalizedEvent): boolean => {
  if (!isSecret(line)) {
    return lineForEvent(e) === line;
  }
  switch (line) {
    case SecretLine.Maestro:
      return e.action === AgentAction.Delegate;
    case SecretLine.NightOwl:
      return e.type === EventType.Action && isNight(e.ts);
    case SecretLine.Ascetic:
      return e.action === AgentAction.Read || e.action === AgentAction.Edit;
    case SecretLine.Gremlin:
      return e.type === EventType.ActionFail;
    case SecretLine.Trickster:
      return false;
  }
};
