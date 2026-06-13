const BUTTONS = ["Hero", "Talents", "Items", "Codex"];

const NavBar = () => {
  return (
    <div className="nav-bar">
      {BUTTONS.map(label => (
        <button key={label} className="nav-btn" type="button" disabled>
          {label}
        </button>
      ))}
    </div>
  );
};

export default NavBar;
