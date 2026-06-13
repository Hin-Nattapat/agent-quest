import type { IState } from "../../core/state";

export interface ITransport {
  // Calls onState with the latest state, then on every change. Returns an unsubscribe fn.
  subscribe(onState: (state: IState) => void): () => void;
}

// Parse one SSE "state" payload; null on malformed JSON (the UI keeps the last good state).
export function parseStateEvent(data: string): IState | null {
  try {
    return JSON.parse(data) as IState;
  } catch {
    return null;
  }
}

export interface IVsCodeApi {
  postMessage(message: unknown): void;
}

export interface IMessageTarget {
  addEventListener(type: "message", handler: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", handler: (event: MessageEvent) => void): void;
}

// Host posts { type: "state", json } where json is the raw state.json text (same payload SSE sends).
export function postMessageTransport(
  api: IVsCodeApi,
  target: IMessageTarget = window,
): ITransport {
  return {
    subscribe(onState) {
      const handler = (event: MessageEvent) => {
        const message = event.data as { type?: unknown; json?: unknown };
        if (message?.type !== "state" || typeof message.json !== "string") {
          return;
        }
        const state = parseStateEvent(message.json);
        if (state) {
          onState(state);
        }
      };
      target.addEventListener("message", handler);
      api.postMessage({ type: "ready" }); // ask the host for the current state (mount-race fix)
      return () => target.removeEventListener("message", handler);
    },
  };
}

export interface IVsCodeWindow {
  acquireVsCodeApi?: () => IVsCodeApi;
  addEventListener(type: "message", handler: (event: MessageEvent) => void): void;
  removeEventListener(type: "message", handler: (event: MessageEvent) => void): void;
}

// In a VS Code webview, acquireVsCodeApi is injected and may be called only once.
// Everywhere else (browser dev, prod SSE bridge) fall back to the SSE endpoint.
export function selectTransport(win: IVsCodeWindow): ITransport {
  if (typeof win.acquireVsCodeApi === "function") {
    return postMessageTransport(win.acquireVsCodeApi(), win);
  }
  return sseTransport("/events");
}

type TMakeSource = (url: string) => EventSource;

export function sseTransport(
  url: string,
  makeSource: TMakeSource = u => new EventSource(u),
): ITransport {
  return {
    subscribe(onState) {
      const source = makeSource(url);
      source.addEventListener("state", event => {
        const state = parseStateEvent((event as MessageEvent).data);
        if (state) {
          onState(state);
        }
      });
      return () => source.close();
    },
  };
}
