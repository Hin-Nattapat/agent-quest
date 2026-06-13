import { existsSync, readFileSync, watch, type FSWatcher } from "fs";
import { join } from "path";

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

// Watch the home dir (survives the reducer's tmp+rename swap), debounce, emit the raw text.
export const watchState = (
  home: string,
  onJson: (json: string) => void,
): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watcher: FSWatcher = watch(home, (_event, filename) => {
    if (filename !== "state.json") {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      const text = readStateText(home);
      if (text) {
        onJson(text);
      }
    }, 50);
  });
  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    watcher.close();
  };
};
