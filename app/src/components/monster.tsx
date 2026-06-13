import type { IScene } from "../scene";

interface IProps {
  scene: IScene;
  anim: string;
  hp: number; // 0..1 cosmetic
}

const Monster = (props: IProps) => {
  const { scene, anim, hp } = props;
  return (
    <div className="monster-unit">
      <span className="monster-name">{scene.monster}</span>
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
