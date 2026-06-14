import type { IHitEffect } from "../use-scene-director";
import { slotRight } from "../mob-slots";

interface IProps {
  effects: IHitEffect[];
}

const HitEffects = (props: IProps) => {
  const { effects } = props;
  return (
    <div className="hit-effects" aria-hidden="true">
      {effects.map(e => (
        <span key={e.id} className="hit-effect" style={{ right: slotRight(e.slot) }} />
      ))}
    </div>
  );
};

export default HitEffects;
