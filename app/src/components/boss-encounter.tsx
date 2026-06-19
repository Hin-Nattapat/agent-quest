import { useEffect } from "react";
import { GameEventType, type IGameEvent } from "../game-events";
import type { SceneTheme } from "../scene";
import { MonsterAnim } from "../combat";
import { bossSet, bossName } from "../boss";
import { useSpriteFrame } from "../use-sprite-frame";
import { assetUrl } from "../assets-base";
import type { IBossFightView } from "../use-boss-fight";
import LootToast from "./loot-toast";

interface IProps {
  encounter: IGameEvent;
  theme: SceneTheme;
  fight: IBossFightView;
}

const BOSS_IDLE_FPS = 6; // a slow breathing cycle
const BOSS_ATTACK_FPS = 12; // punch the ~9 attack frames through the strike window so the lunge reads

const BossEncounter = (props: IProps) => {
  const { encounter, theme, fight } = props;
  const set = bossSet(theme);
  const name = bossName(theme);
  // Attack cycles the attack frames; every other state holds the idle cycle (hurt is a CSS flash,
  // die/flee is a CSS transform on the sprite, both over the idle art).
  const attacking = fight.bossAnim === MonsterAnim.Attack && Boolean(set?.attack.length);
  const frames = attacking ? (set?.attack ?? []) : (set?.idle ?? []);
  const fps = attacking ? BOSS_ATTACK_FPS : BOSS_IDLE_FPS;
  const frame = useSpriteFrame(frames, fps, frames.length > 1);

  // Decode idle + attack frames so the first swap doesn't flash.
  useEffect(() => {
    if (!set) {
      return;
    }
    for (const url of [...set.idle, ...set.attack]) {
      const img = new Image();
      img.src = assetUrl(url);
    }
  }, [set]);

  const outcome = encounter.type === GameEventType.BossFled ? "fled" : "defeated";
  // The exit (die/flee) only plays once the trades are over, so the boss fights in place first.
  const outcomeClass = fight.leaving ? ` boss-${outcome}` : "";
  const bg = frame ? { backgroundImage: `url(${assetUrl(frame)})` } : undefined;
  const artClass = frame ? " has-art" : "";
  // boss-hurt is a knockback + flash scaled for the big sprite (the mob's m-hurt is a 7px nudge,
  // invisible at this size).
  const hurtClass = !attacking && fight.bossAnim === MonsterAnim.Hurt ? " boss-hurt" : "";
  const hpPct = Math.max(0, Math.min(1, fight.bossHp)) * 100;
  const showLoot = encounter.type === GameEventType.BossDefeated && fight.leaving;

  return (
    <div className={`boss-encounter${outcomeClass}`}>
      <div className="boss-unit">
        <div className="boss-plate">
          <span className="boss-name">{name}</span>
          <div className="boss-hp">
            <i style={{ width: `${hpPct}%` }} />
          </div>
        </div>
        <div
          className={`sprite boss${hurtClass}${artClass}`}
          style={bg}
          aria-label={name}
        />
        {fight.bossHits.map(id => (
          <span key={id} className="boss-fx" aria-hidden="true" />
        ))}
      </div>
      {showLoot && <LootToast items={encounter.items} />}
    </div>
  );
};

export default BossEncounter;
