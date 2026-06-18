import { useEffect } from "react";
import { assetUrl } from "./assets-base";
import type { ISpriteSet } from "./sprites";

// Decode every frame of a sprite set once so background-image swaps during the walk/attack cycle
// hit a ready, cached image instead of flashing while the browser lazily fetches/decodes each frame.
export const usePreload = (set: ISpriteSet | undefined): void => {
  useEffect(() => {
    if (!set) {
      return;
    }
    // Attack frames included so the first cast/strike doesn't flash an undecoded frame.
    const urls = [
      ...Object.values(set.idle),
      ...Object.values(set.walk).flat(),
      ...(set.attack ?? []),
    ];
    for (const url of urls) {
      const img = new Image();
      img.src = assetUrl(url);
    }
  }, [set]);
};
