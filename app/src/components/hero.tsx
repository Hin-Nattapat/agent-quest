import { HeroAnim, attackStyleFor, isRanged } from "../combat";
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
const ATTACK_FPS = 15; // ~9 attack frames over the ranged pulse (CAST_MS 600ms in the director)

const Hero = (props: IProps) => {
  const { line, tier, branch, anim } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const attacking = anim === HeroAnim.Attack && Boolean(set?.attack);
  const ranged = isRanged(attackStyleFor(line));
  const moving = anim === HeroAnim.Wander;
  const battleFrames = set ? directionalFrames(set, Facing.East, moving) : [];
  const frames = attacking ? (set?.attack ?? []) : battleFrames;
  const playing = attacking || moving;
  const fps = attacking ? ATTACK_FPS : WALK_FPS;
  const frame = useSpriteFrame(frames, fps, playing);
  const style = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  // Ranged attack stands (the `cast` class drops the .hero-attack dash); a melee attack keeps the
  // dash class AND cycles the stab frames (transform + background-image are independent).
  const animClass = attacking && ranged ? "cast" : anim;
  return (
    <div
      className={`sprite hero hero-${line} hero-${animClass}${artClass}`}
      style={style}
      aria-label="hero"
    />
  );
};

export default Hero;
