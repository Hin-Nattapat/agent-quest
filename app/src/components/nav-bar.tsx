import { PanelId } from "../panels";

interface IProps {
  onOpen: (panel: PanelId) => void;
}

const BUTTONS: { id: PanelId; label: string }[] = [
  { id: PanelId.Hero, label: "Hero" },
  { id: PanelId.Talents, label: "Talents" },
  { id: PanelId.Items, label: "Items" },
  { id: PanelId.Codex, label: "Codex" },
];

const NavBar = (props: IProps) => {
  const { onOpen } = props;
  return (
    <div className="nav-bar">
      {BUTTONS.map(b => (
        <button key={b.id} className="nav-btn" type="button" onClick={() => onOpen(b.id)}>
          {b.label}
        </button>
      ))}
    </div>
  );
};

export default NavBar;
