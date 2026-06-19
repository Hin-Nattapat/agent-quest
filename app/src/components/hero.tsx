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

const ATTACK_FPS = 15; // ~9 attack frames over the ranged pulse (CAST_MS 600ms in the director)

const Hero = (props: IProps) => {
  const { line, tier, branch, anim } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const attacking = anim === HeroAnim.Attack && Boolean(set?.attack);
  const ranged = isRanged(attackStyleFor(line));
  // The battle hero stands facing east (idle frame) and only cycles frames on attack; its bob/sway
  // is CSS (.hero-farming/.hero-idle). No wander-walk — it used to slide backward while farming.
  const battleFrames = set ? directionalFrames(set, Facing.East, false) : [];
  const frames = attacking ? (set?.attack ?? []) : battleFrames;
  const frame = useSpriteFrame(frames, ATTACK_FPS, attacking);
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
