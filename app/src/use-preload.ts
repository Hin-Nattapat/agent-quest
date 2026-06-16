import { useEffect } from "react";
import { assetUrl } from "./assets-base";
import type { ISpriteSet } from "./sprites";

// Decode every frame of a sprite set once so background-image swaps during the walk cycle hit a
// ready, cached image instead of flashing while the browser lazily fetches/decodes each frame.
export const usePreload = (set: ISpriteSet | undefined): void => {
  useEffect(() => {
    if (!set) {
      return;
    }
    const urls = [...Object.values(set.idle), ...Object.values(set.walk).flat()];
    for (const url of urls) {
      const img = new Image();
      img.src = assetUrl(url);
    }
  }, [set]);
};
