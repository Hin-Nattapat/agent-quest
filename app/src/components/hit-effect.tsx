import { type IHitEffect, EffectKind } from "../use-scene-director";
import { slotPos } from "../mob-slots";

interface IProps {
  effects: IHitEffect[];
}

const HitEffects = (props: IProps) => {
  const { effects } = props;
  return (
    <div className="hit-effects" aria-hidden="true">
      {effects.map(e => {
        const cls = e.kind === EffectKind.Zap ? "hit-zap" : "hit-effect";
        return <span key={e.id} className={cls} style={slotPos(e.slot)} />;
      })}
    </div>
  );
};

export default HitEffects;
