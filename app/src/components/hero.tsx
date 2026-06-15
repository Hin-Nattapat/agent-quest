import { HeroAnim } from "../combat";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, heroFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";

interface IProps {
  line: string;
  tier: number;
  anim: HeroAnim;
}

const WALK_FPS = 10;

const Hero = (props: IProps) => {
  const { line, tier, anim } = props;
  const set = heroSpriteSet(line, tier);
  const frames = set ? heroFrames(set, anim) : [];
  const frame = useSpriteFrame(frames, WALK_FPS, anim === HeroAnim.Wander);
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
