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
