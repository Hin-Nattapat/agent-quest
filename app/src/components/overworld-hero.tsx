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
  xPct: number;
  yPct: number;
}

const WALK_FPS = 10;

const OverworldHero = (props: IProps) => {
  const { line, tier, facing, moving, xPct, yPct } = props;
  const set = heroSpriteSet(line, tier);
  usePreload(set);
  const frames = set ? directionalFrames(set, facing, moving) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, moving);
  const artClass = frame ? " has-art" : "";
  const style = {
    left: `${xPct}%`,
    top: `${yPct}%`,
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
