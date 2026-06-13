import { GameEventType, type IGameEvent } from "../game-events";
import LootToast from "./loot-toast";

interface IProps {
  encounter: IGameEvent;
}

const BossEncounter = (props: IProps) => {
  const { encounter } = props;
  const outcome = encounter.type === GameEventType.BossFled ? "fled" : "defeated";

  return (
    <div className={`boss-encounter boss-${outcome}`}>
      <div className="sprite boss" aria-label="boss" />
      {encounter.type === GameEventType.BossDefeated && (
        <LootToast items={encounter.items} />
      )}
    </div>
  );
};

export default BossEncounter;
