import { existsSync, readFileSync, watch } from "fs";
import { join } from "path";
import { homedir } from "os";
import { refreshStateText } from "../core/reduce";

const HOME = process.env.AGENTRPG_HOME || join(homedir(), ".agentrpg");
const PORT = Number(process.env.AGENTRPG_PORT) || 7070;
const DIST = join(import.meta.dir, "dist");

// Raw state.json text (atomic writes from the reducer mean reads are never partial); null if absent.
export const readState = (home: string): string | null => {
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

// Reduce-then-read (the journal "catch up"); the logic lives in core so the extension shares it.
export const refreshState = refreshStateText;

// state.json is pretty-printed (multi-line); SSE requires a `data:` prefix on EVERY line,
// otherwise the browser's EventSource only keeps the first line and JSON.parse fails.
export const sseMessage = (stateJson: string): string => {
  const data = stateJson
    .split("\n")
    .map(line => `data: ${line}`)
    .join("\n");
  return `event: state\n${data}\n\n`;
};

if (import.meta.main) {
  const encoder = new TextEncoder();
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();

  const push = (text: string | null) => {
    if (!text) {
      return;
    }
    const frame = encoder.encode(sseMessage(text));
    for (const controller of clients) {
      try {
        controller.enqueue(frame);
      } catch {
        clients.delete(controller);
      }
    }
  };
  const pushReduced = () => push(refreshState(HOME));
  const pushRead = () => push(readState(HOME));

  // A journal change re-reduces (agents without a statusline — Codex — never reduce themselves), with
  // a trailing reduce past the ~2s throttle so the last burst lands. A state.json change is pushed
  // read-only — keeping reduce off that path stops our own reduce-write from looping back.
  const DEBOUNCE_MS = 50;
  const TRAILING_MS = 2100;
  let reduceTimer: ReturnType<typeof setTimeout> | null = null;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;
  let readTimer: ReturnType<typeof setTimeout> | null = null;
  const onJournal = () => {
    if (reduceTimer) {
      clearTimeout(reduceTimer);
    }
    reduceTimer = setTimeout(pushReduced, DEBOUNCE_MS);
    if (trailingTimer) {
      clearTimeout(trailingTimer);
    }
    trailingTimer = setTimeout(pushReduced, TRAILING_MS);
  };
  const onState = () => {
    if (readTimer) {
      clearTimeout(readTimer);
    }
    readTimer = setTimeout(pushRead, DEBOUNCE_MS);
  };
  watch(HOME, (_event, filename) => {
    if (filename === "state.json") {
      onState();
    }
  });
  const journal = join(HOME, "journal");
  if (existsSync(journal)) {
    watch(journal, (_event, filename) => {
      if (filename && filename.endsWith(".ndjson")) {
        onJournal();
      }
    });
  }

  Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === "/events") {
        let self: ReadableStreamDefaultController<Uint8Array>;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            self = controller;
            clients.add(controller);
            const text = refreshState(HOME);
            if (text) {
              controller.enqueue(encoder.encode(sseMessage(text)));
            }
          },
          cancel() {
            clients.delete(self);
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            connection: "keep-alive",
          },
        });
      }
      const rel = url.pathname === "/" ? "/index.html" : url.pathname;
      const file = Bun.file(join(DIST, rel));
      if (await file.exists()) {
        return new Response(file);
      }
      return new Response(Bun.file(join(DIST, "index.html"))); // SPA fallback
    },
  });
  console.log(`agent-quest app on http://localhost:${PORT}`);
}
