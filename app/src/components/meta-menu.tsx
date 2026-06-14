import { useState } from "react";
import { PanelId } from "../panels";

interface IProps {
  onOpen: (panel: PanelId) => void;
}

const ITEMS: { id: PanelId; label: string; icon: string }[] = [
  { id: PanelId.Usage, label: "Usage", icon: "📊" },
  { id: PanelId.Settings, label: "Settings", icon: "⚙" },
];

// Tools menu (meta, not part of the game world): a gear in the scene corner that opens a small
// popover. Kept out of the diegetic Hero/Talents/Items/Codex nav.
const MetaMenu = (props: IProps) => {
  const { onOpen } = props;
  const [open, setOpen] = useState(false);

  const choose = (id: PanelId) => {
    onOpen(id);
    setOpen(false);
  };

  return (
    <div className="meta-menu">
      {open ? <div className="meta-backdrop" onClick={() => setOpen(false)} /> : null}
      {open ? (
        <ul className="meta-popover">
          {ITEMS.map(it => (
            <li key={it.id}>
              <button type="button" className="meta-item" onClick={() => choose(it.id)}>
                <span className="meta-icon" aria-hidden="true">
                  {it.icon}
                </span>
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button
        type="button"
        className="meta-gear"
        aria-label="Tools menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        ⚙
      </button>
    </div>
  );
};

export default MetaMenu;
