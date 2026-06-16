import { HeroAnim } from "../combat";
import { Facing } from "../facing";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";
import { usePreload } from "../use-preload";

interface IProps {
  line: string;
  tier: number;
  anim: HeroAnim;
}

const WALK_FPS = 10;

const Hero = (props: IProps) => {
  const { line, tier, anim } = props;
  const set = heroSpriteSet(line, tier);
  usePreload(set);
  const moving = anim === HeroAnim.Wander;
  const frames = set ? directionalFrames(set, Facing.East, moving) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, moving);
  const style = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  return (
    <div
      className={`sprite hero hero-${line} hero-${anim}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default Hero;
