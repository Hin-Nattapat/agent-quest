import { existsSync, readFileSync, watch, type FSWatcher } from "fs";
import { join } from "path";
import { refreshStateText } from "../../../core/reduce";

export { refreshStateText };

// state.json is written atomically (tmp + rename), so a read is never partial; null if absent.
export const readStateText = (home: string): string | null => {
  const path = join(home, "state.json");
  if (!existsSync(path)) {
    return null;
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
};

const DEBOUNCE_MS = 50;
const TRAILING_MS = 2100; // > reduceThrottled's 2000ms window, so the last burst always lands

// Push live state to the UI. A journal change re-reduces (agents without a statusline — Codex —
// never trigger a reduce themselves); a state.json change (e.g. the Claude Code statusline already
// reduced) is pushed read-only. Keeping reduce off the state.json path is what stops our own
// reduce-write from looping back into another reduce.
export const watchState = (
  home: string,
  onJson: (json: string) => void,
): (() => void) => {
  let reduceTimer: ReturnType<typeof setTimeout> | null = null;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let readTimer: ReturnType<typeof setTimeout> | null = null;

  const emitReduced = () => {
    const text = refreshStateText(home);
    if (text) {
      onJson(text);
    }
  };
  const emitRead = () => {
    const text = readStateText(home);
    if (text) {
      onJson(text);
    }
  };

  const onJournal = () => {
    if (reduceTimer) {
      clearTimeout(reduceTimer);
    }
    reduceTimer = setTimeout(emitReduced, DEBOUNCE_MS);
    // The reduce is throttled to ~2s, so a burst can leave its last lines unreduced; one trailing
    // reduce past that window guarantees the HUD catches up even if activity then stops.
    if (trailingTimer) {
      clearTimeout(trailingTimer);
    }
    trailingTimer = setTimeout(emitReduced, TRAILING_MS);
  };
  const onState = () => {
    if (readTimer) {
      clearTimeout(readTimer);
    }
    readTimer = setTimeout(emitRead, DEBOUNCE_MS);
  };

  const watcher: FSWatcher = watch(home, (_event, filename) => {
    if (filename === "state.json") {
      onState();
    }
  });
  const journal = join(home, "journal");
  const journalWatcher: FSWatcher | null = existsSync(journal)
    ? watch(journal, (_event, filename) => {
        if (filename && filename.endsWith(".ndjson")) {
          onJournal();
        }
      })
    : null;

  return () => {
    for (const t of [reduceTimer, trailingTimer, readTimer]) {
      if (t) {
        clearTimeout(t);
      }
    }
    watcher.close();
    journalWatcher?.close();
  };
};
