import type { Facing } from "../facing";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";
import { usePreload } from "../use-preload";
import { spriteStyle } from "../view";

interface IProps {
  line: string;
  tier: number;
  branch: string | null;
  facing: Facing;
  moving: boolean;
  xPx: number;
  yPx: number;
}

const WALK_FPS = 6;

const OverworldHero = (props: IProps) => {
  const { line, tier, branch, facing, moving, xPx, yPx } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const frames = set ? directionalFrames(set, facing, moving) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, moving);
  const artClass = frame ? " has-art" : "";
  const style = {
    transform: `translate3d(${xPx}px, ${yPx}px, 0) translate(-50%, -85%)`,
    ...spriteStyle(frame),
  };
  return (
    <div
      className={`sprite ow-hero hero-${line}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default OverworldHero;
