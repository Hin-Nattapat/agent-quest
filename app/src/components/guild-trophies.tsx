import { REALM_UI } from "../codex/realm-progress";

interface IProps {
  conquered: string[];
}

// Fixed pedestal spots along the guild walls, filled in conquest order. % of the locked stage,
// same technique as GUILD_NPCS. 16 slots for 16 realms.
const TROPHY_SLOTS: { xPct: number; yPct: number }[] = [
  { xPct: 8, yPct: 30 },
  { xPct: 16, yPct: 26 },
  { xPct: 24, yPct: 30 },
  { xPct: 32, yPct: 26 },
  { xPct: 40, yPct: 30 },
  { xPct: 48, yPct: 26 },
  { xPct: 56, yPct: 30 },
  { xPct: 64, yPct: 26 },
  { xPct: 72, yPct: 30 },
  { xPct: 80, yPct: 26 },
  { xPct: 88, yPct: 30 },
  { xPct: 12, yPct: 40 },
  { xPct: 30, yPct: 42 },
  { xPct: 50, yPct: 44 },
  { xPct: 70, yPct: 42 },
  { xPct: 88, yPct: 40 },
];

const GuildTrophies = (props: IProps) => {
  const { conquered } = props;
  return (
    <>
      {conquered.slice(0, TROPHY_SLOTS.length).map((theme, i) => {
        const ui = REALM_UI.find(u => u.theme === theme);
        const slot = TROPHY_SLOTS[i];
        return (
          <div
            key={theme}
            className="guild-trophy"
            style={{ left: `${slot.xPct}%`, top: `${slot.yPct}%` }}
            title={ui?.label ?? theme}
            aria-hidden="true"
          >
            {ui?.icon ?? "🏆"}
          </div>
        );
      })}
    </>
  );
};

export default GuildTrophies;
