import type { IScene } from "../scene";

interface IProps {
  scene: IScene;
}

const Monster = (props: IProps) => {
  const { scene } = props;
  return (
    <div className={`sprite monster monster-${scene.theme}`} aria-label={scene.monster} />
  );
};

export default Monster;
