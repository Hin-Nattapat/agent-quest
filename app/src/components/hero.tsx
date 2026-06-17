import { HeroAnim, AttackStyle, attackStyleFor } from "../combat";
import { Facing } from "../facing";
import { assetUrl } from "../assets-base";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { useSpriteFrame } from "../use-sprite-frame";
import { usePreload } from "../use-preload";

interface IProps {
  line: string;
  tier: number;
  branch: string | null;
  anim: HeroAnim;
}

const WALK_FPS = 10;
const CAST_FPS = 15; // 9 cast frames ≈ one cycle over CAST_MS (600ms) in the director

const Hero = (props: IProps) => {
  const { line, tier, branch, anim } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const casting =
    anim === HeroAnim.Attack &&
    attackStyleFor(line) === AttackStyle.Cast &&
    Boolean(set?.cast);
  const moving = anim === HeroAnim.Wander;
  const battleFrames = set ? directionalFrames(set, Facing.East, moving) : [];
  const frames = casting ? (set?.cast ?? []) : battleFrames;
  const playing = casting || moving;
  const fps = casting ? CAST_FPS : WALK_FPS;
  const frame = useSpriteFrame(frames, fps, playing);
  const style = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  // While casting, use a `cast` anim class so the .hero-attack dash keyframe never fires.
  const animClass = casting ? "cast" : anim;
  return (
    <div
      className={`sprite hero hero-${line} hero-${animClass}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default Hero;
