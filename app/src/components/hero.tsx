import { HeroAnim, attackStyleFor, isRanged } from "../combat";
import { Facing } from "../facing";
import { heroSpriteSet, directionalFrames } from "../sprites";
import { usePreload } from "../use-preload";
import SpriteFrames from "./sprite-frames";

interface IProps {
  line: string;
  tier: number;
  branch: string | null;
  anim: HeroAnim;
  icon: string;
  aura: string | null;
}

const ATTACK_FPS = 15; // ~9 attack frames over the ranged pulse (CAST_MS 600ms in the director)

const Hero = (props: IProps) => {
  const { line, tier, branch, anim, icon, aura } = props;
  const set = heroSpriteSet(line, tier, branch);
  usePreload(set);
  const attacking = anim === HeroAnim.Attack && Boolean(set?.attack);
  const ranged = isRanged(attackStyleFor(line));
  // The battle hero stands facing east (idle frame) and only cycles frames on attack; its bob/sway
  // is CSS (.hero-farming/.hero-idle). No wander-walk — it used to slide backward while farming.
  const battleFrames = set ? directionalFrames(set, Facing.East, false) : [];
  const frames = attacking ? (set?.attack ?? []) : battleFrames;
  const artClass = frames.length > 0 ? " has-art" : "";
  // Ranged attack stands (the `cast` class drops the .hero-attack dash); a melee attack keeps the
  // dash class AND cycles the stab frames (transform + sprite frames are independent).
  const animClass = attacking && ranged ? "cast" : anim;
  return (
    <div
      className={`sprite hero hero-${line} hero-${animClass}${artClass}${aura ? ` aura-${aura}` : ""}`}
      data-emoji={icon}
      aria-label="hero"
    >
      <SpriteFrames frames={frames} fps={ATTACK_FPS} playing={attacking} />
    </div>
  );
};

export default Hero;
