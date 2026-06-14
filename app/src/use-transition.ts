import { useEffect, useRef, useState } from "react";
import type { IScene } from "./scene";

export const TRANSITION_MS = 1200;

export interface ITransitionView {
  active: boolean;
  label: string | null;
}

// Fire a transition only when we have a previous theme and it actually changed — `null` prev means
// first mount (no "from" world), so it stays quiet on load. Pure so the decision is unit-tested.
export const shouldTransition = (prevTheme: string | null, nextTheme: string): boolean => {
  return prevTheme !== null && prevTheme !== nextTheme;
};

// Plays a one-shot transition whenever the scene THEME changes (never on first mount).
export const useTransition = (scene: IScene): ITransitionView => {
  const prevTheme = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [view, setView] = useState<ITransitionView>({ active: false, label: null });

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  useEffect(() => {
    const prev = prevTheme.current;
    prevTheme.current = scene.theme;
    if (!shouldTransition(prev, scene.theme)) {
      return; // first mount, or no real change
    }
    setView({ active: true, label: scene.label });
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setView(v => ({ active: false, label: v.label }));
    }, TRANSITION_MS);
    // `scene.label` is intentionally read fresh when the theme flips, not a dep.
  }, [scene.theme]);

  return view;
};
