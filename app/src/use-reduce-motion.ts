import { useEffect, useState } from "react";

const MOTION_KEY = "cq.reduceMotion";

const read = (): boolean => {
  try {
    return localStorage.getItem(MOTION_KEY) === "1";
  } catch {
    return false; // webview without storage: just don't persist
  }
};

// Reduce-motion preference, persisted to localStorage and reflected on <body class="reduce-motion">.
// The body sync lives in an effect keyed on the value, so a persisted preference applies on load —
// not only when the user toggles it (the old inline toggle missed the initial mount).
export const useReduceMotion = (): [boolean, () => void] => {
  const [reduceMotion, setReduceMotion] = useState(read);

  useEffect(() => {
    document.body.classList.toggle("reduce-motion", reduceMotion);
  }, [reduceMotion]);

  const toggle = (): void => {
    setReduceMotion(prev => {
      const next = !prev;
      try {
        localStorage.setItem(MOTION_KEY, next ? "1" : "0");
      } catch {
        // ignore: persistence is best-effort
      }
      return next;
    });
  };

  return [reduceMotion, toggle];
};
