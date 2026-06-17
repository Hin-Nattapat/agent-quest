import { useEffect } from "react";
import type { IScene } from "../scene";
import { MonsterAnim } from "../combat";
import { slotPos } from "../mob-slots";
import { monsterSet, monsterFrames } from "../monsters";
import { useSpriteFrame } from "../use-sprite-frame";
import { assetUrl } from "../assets-base";

interface IProps {
  scene: IScene;
  anim: MonsterAnim;
  hp: number; // 0..1 cosmetic
  slot: number; // pack index → horizontal position
}

const MONSTER_FPS = 6;

const Monster = (props: IProps) => {
  const { scene, anim, hp, slot } = props;
  const set = monsterSet(scene.theme);
  const attacking = anim === MonsterAnim.Attack && Boolean(set?.attack.length);
  const frames = monsterFrames(set, anim);
  const frame = useSpriteFrame(frames, MONSTER_FPS, frames.length > 1);

  // Decode idle+attack frames once so the first swap doesn't flash (usePreload is hero-set shaped).
  useEffect(() => {
    if (!set) {
      return;
    }
    for (const url of [...set.idle, ...set.attack]) {
      const img = new Image();
      img.src = assetUrl(url);
    }
  }, [set]);

  const bg = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  // Keep m-hurt (flash) / m-die (fade) over the sprite; drop the m-attack lunge when real attack
  // frames carry the motion themselves.
  const animClass = attacking ? "" : ` m-${anim}`;
  const hpPct = Math.max(0, Math.min(1, hp)) * 100;
  return (
    <div className="monster-unit mob-spawn" style={slotPos(slot)}>
      <div className="monster-hp">
        <i style={{ width: `${hpPct}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme}${animClass}${artClass}`}
        style={bg}
        aria-label={scene.monster}
      />
    </div>
  );
};

export default Monster;
