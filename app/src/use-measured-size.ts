import { type RefObject, useEffect, useRef, useState } from "react";

export interface ISize {
  w: number;
  h: number;
}

// Track an element's content box (client width/height), updating on resize via ResizeObserver.
// Returns a ref to attach and the latest size — used to turn percentage poses into pixel transforms.
export const useMeasuredSize = <T extends HTMLElement>(): [
  RefObject<T | null>,
  ISize,
] => {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ISize>({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, size];
};
