import type { Facing } from "../facing";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { usePreload } from "../use-preload";
import SpriteFrames from "./sprite-frames";

interface IProps {
  line: string;
  tier: number;
  branch: string | null;
  facing: Facing;
  moving: boolean;
  xPx: number;
  yPx: number;
  icon: string;
  aura: string | null;
}

const WALK_FPS = 6;

const OverworldHero = (props: IProps) => {
  const { line, tier, branch, facing, moving, xPx, yPx, icon, aura } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const frames = set ? directionalFrames(set, facing, moving) : [];
  const artClass = frames.length > 0 ? " has-art" : "";
  const style = {
    transform: `translate3d(${xPx}px, ${yPx}px, 0) translate(-50%, -85%)`,
  };
  return (
    <div
      className={`sprite ow-hero hero-${line}${artClass}${aura ? ` aura-${aura}` : ""}`}
      style={style}
      data-emoji={icon}
      aria-label="hero"
    >
      <SpriteFrames frames={frames} fps={WALK_FPS} playing={moving} />
    </div>
  );
};

export default OverworldHero;
