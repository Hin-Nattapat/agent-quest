import { useEffect, useSyncExternalStore } from "react";

const MOTION_KEY = "cq.reduceMotion";
const MOTION_EVENT = "cq:reducemotion";

// Effective reduced-motion = the user's explicit in-app pref OR the OS-level setting. Pure so the
// combine rule is unit-tested without a DOM.
export const effectiveReducedMotion = (pref: boolean, os: boolean): boolean => pref || os;

const readPref = (): boolean => {
  try {
    return localStorage.getItem(MOTION_KEY) === "1";
  } catch {
    return false; // webview without storage: just don't persist
  }
};

const osPrefersReduced = (): boolean => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

const writePref = (on: boolean): void => {
  try {
    localStorage.setItem(MOTION_KEY, on ? "1" : "0");
  } catch {
    // ignore: persistence is best-effort
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MOTION_EVENT));
  }
};

// Re-fires the subscriber when EITHER source flips: the in-app toggle (our event) or the OS media
// query. That re-render is what re-runs the animation hooks' rAF effect with a fresh `active`.
const subscribe = (onChange: () => void): (() => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }
  window.addEventListener(MOTION_EVENT, onChange);
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  mq?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener(MOTION_EVENT, onChange);
    mq?.removeEventListener?.("change", onChange);
  };
};

// Reactive effective reduced-motion for the animation hooks (useWander / useSpriteIndex) — they read
// this so an rAF loop actually halts when the user flips the toggle, not just when the OS setting is on.
export const useReducedMotion = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => effectiveReducedMotion(readPref(), osPrefersReduced()),
    () => false,
  );

// The settings toggle: the explicit in-app pref (not the OS setting) plus a setter. Mirrored onto
// <body class="reduce-motion"> so the CSS animation/transition kill-switch tracks it too.
export const useReduceMotion = (): [boolean, () => void] => {
  const pref = useSyncExternalStore(subscribe, readPref, () => false);

  useEffect(() => {
    document.body.classList.toggle("reduce-motion", pref);
  }, [pref]);

  const toggle = (): void => {
    writePref(!readPref());
  };

  return [pref, toggle];
};
