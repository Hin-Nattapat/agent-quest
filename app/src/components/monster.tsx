import type { IScene } from "../scene";

interface IProps {
  scene: IScene;
}

const Monster = (props: IProps) => {
  const { scene } = props;
  return (
    <div className="monster-unit">
      <span className="monster-name">{scene.monster}</span>
      <span
        className={`sprite monster monster-${scene.theme}`}
        aria-label={scene.monster}
      />
    </div>
  );
};

export default Monster;
