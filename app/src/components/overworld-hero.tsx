import type { Facing } from "../facing";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";
import { usePreload } from "../use-preload";

interface IProps {
  line: string;
  tier: number;
  facing: Facing;
  moving: boolean;
  xPx: number;
  yPx: number;
}

const WALK_FPS = 6;

const OverworldHero = (props: IProps) => {
  const { line, tier, facing, moving, xPx, yPx } = props;
  const set = heroSpriteSet(line, tier);
  usePreload(set);
  const frames = set ? directionalFrames(set, facing, moving) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, moving);
  const artClass = frame ? " has-art" : "";
  const style = {
    transform: `translate3d(${xPx}px, ${yPx}px, 0) translate(-50%, -85%)`,
    backgroundImage: frame ? `url(${assetUrl(frame)})` : undefined,
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
