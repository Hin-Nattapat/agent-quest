import { useEffect } from "react";
import { assetUrl } from "./assets-base";
import type { ISpriteSet } from "./sprites";
import type { IMonsterSet } from "./monsters";

// Decode a list of frame urls once so background-image swaps during a walk/attack cycle hit a ready,
// cached image instead of flashing while the browser lazily fetches/decodes each frame.
const preload = (urls: string[]): void => {
  for (const url of urls) {
    const img = new Image();
    img.src = assetUrl(url);
  }
};

// Hero set: every directional idle + walk frame plus the attack frames.
export const usePreload = (set: ISpriteSet | undefined): void => {
  useEffect(() => {
    if (!set) {
      return;
    }
    preload([
      ...Object.values(set.idle),
      ...Object.values(set.walk).flat(),
      ...(set.attack ?? []),
    ]);
  }, [set]);
};

// Creature set (mob / boss): idle + attack frames.
export const usePreloadSprites = (set: IMonsterSet | undefined): void => {
  useEffect(() => {
    if (!set) {
      return;
    }
    preload([...set.idle, ...set.attack]);
  }, [set]);
};

// A plain frame list (e.g. an NPC idle loop). Re-decodes when the joined urls change.
export const usePreloadFrames = (frames: string[]): void => {
  const key = frames.join("|");
  useEffect(() => {
    preload(frames);
  }, [key]);
};
