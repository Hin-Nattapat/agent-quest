import { existsSync, readFileSync, watch } from "fs";
import { join } from "path";
import { homedir } from "os";

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

  const pushAll = () => {
    const text = readState(HOME);
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

  // Watch the home dir (survives the reducer's tmp+rename swap) and debounce.
  let timer: ReturnType<typeof setTimeout> | null = null;
  watch(HOME, (_event, filename) => {
    if (filename !== "state.json") {
      return;
    }
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(pushAll, 50);
  });

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
            const text = readState(HOME);
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
  console.log(`commit-quest app on http://localhost:${PORT}`);
}
