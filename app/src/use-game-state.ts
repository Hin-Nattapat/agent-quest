import { useEffect, useState } from "react";
import type { IState } from "../../core/state";
import type { ITransport } from "./transport";

// Subscribes to the transport (the only outside-world sync) and exposes the latest state.
export function useGameState(transport: ITransport): IState | null {
  const [state, setState] = useState<IState | null>(null);

  useEffect(() => {
    const unsubscribe = transport.subscribe(setState);
    return unsubscribe;
  }, [transport]);

  return state;
}
