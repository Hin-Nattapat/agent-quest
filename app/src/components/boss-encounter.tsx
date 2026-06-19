import { useEffect } from "react";
import { GameEventType, type IGameEvent } from "../game-events";
import type { SceneTheme } from "../scene";
import { bossSet } from "../boss";
import { useSpriteFrame } from "../use-sprite-frame";
import { assetUrl } from "../assets-base";
import LootToast from "./loot-toast";

interface IProps {
  encounter: IGameEvent;
  theme: SceneTheme;
}

const BOSS_FPS = 6;

const BossEncounter = (props: IProps) => {
  const { encounter, theme } = props;
  const set = bossSet(theme);
  const frames = set?.idle ?? [];
  const frame = useSpriteFrame(frames, BOSS_FPS, frames.length > 1);

  // Decode the idle frames so the first cycle doesn't flash (the defeat/flee motion is CSS on .boss).
  useEffect(() => {
    if (!set) {
      return;
    }
    for (const url of set.idle) {
      const img = new Image();
      img.src = assetUrl(url);
    }
  }, [set]);

  const outcome = encounter.type === GameEventType.BossFled ? "fled" : "defeated";
  const bg = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";

  return (
    <div className={`boss-encounter boss-${outcome}`}>
      <div className={`sprite boss${artClass}`} style={bg} aria-label="boss" />
      {encounter.type === GameEventType.BossDefeated && (
        <LootToast items={encounter.items} />
      )}
    </div>
  );
};

export default BossEncounter;
