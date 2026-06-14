import type { IScene } from "../scene";
import { slotRight } from "../mob-slots";

interface IProps {
  scene: IScene;
  anim: string;
  hp: number; // 0..1 cosmetic
  slot: number; // pack index → horizontal position
}

const Monster = (props: IProps) => {
  const { scene, anim, hp, slot } = props;
  // spawn-pop rides the wrapper so it never fights the sprite's own m-die/m-attack transform.
  return (
    <div className="monster-unit mob-spawn" style={{ right: slotRight(slot) }}>
      <div className="monster-hp">
        <i style={{ width: `${Math.max(0, Math.min(1, hp)) * 100}%` }} />
      </div>
      <span
        className={`sprite monster monster-${scene.theme} m-${anim}`}
        aria-label={scene.monster}
      />
    </div>
  );
};

export default Monster;
