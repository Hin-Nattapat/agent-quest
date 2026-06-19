import type { IScene } from "../scene";
import { MonsterAnim } from "../combat";
import { slotPos } from "../mob-slots";
import { monsterSet, monsterFrames } from "../monsters";
import { useSpriteFrame } from "../use-sprite-frame";
import { usePreloadSprites } from "../use-preload";
import { spriteStyle, hpPercent } from "../view";

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
  usePreloadSprites(set);
  const attacking = anim === MonsterAnim.Attack && Boolean(set?.attack.length);
  const frames = monsterFrames(set, anim);
  const frame = useSpriteFrame(frames, MONSTER_FPS, frames.length > 1);

  const artClass = frame ? " has-art" : "";
  // Keep m-hurt (flash) / m-die (fade) over the sprite; drop the m-attack lunge when real attack
  // frames carry the motion themselves.
  const animClass = attacking ? "" : ` m-${anim}`;
  return (
    <div className="monster-unit mob-spawn" style={slotPos(slot)}>
      <span className="monster-name">{scene.monster}</span>
      <div className="monster-hp">
        <i style={{ width: `${hpPercent(hp)}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme}${animClass}${artClass}`}
        style={spriteStyle(frame)}
        aria-label={scene.monster}
      />
    </div>
  );
};

export default Monster;
