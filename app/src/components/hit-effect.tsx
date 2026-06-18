import { type IHitEffect, EffectKind } from "../use-scene-director";
import { slotPos } from "../mob-slots";

interface IProps {
  effects: IHitEffect[];
}

const CLASS_FOR: Record<EffectKind, string> = {
  [EffectKind.Slash]: "hit-effect",
  [EffectKind.Zap]: "hit-zap",
  [EffectKind.Arrow]: "hit-arrow",
  [EffectKind.Glyph]: "hit-glyph",
};

const HitEffects = (props: IProps) => {
  const { effects } = props;
  return (
    <div className="hit-effects" aria-hidden="true">
      {effects.map(e => (
        <span key={e.id} className={CLASS_FOR[e.kind]} style={slotPos(e.slot)} />
      ))}
    </div>
  );
};

export default HitEffects;
