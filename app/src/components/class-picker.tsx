import { titleCase } from "../view";

interface IProps {
  options: string[];
  onPick: (line: string) => void;
  onCancel?: () => void;
}

// The class-choice buttons, shared by the initial class pick and the respec flow.
const ClassPicker = (props: IProps) => {
  const { options, onPick, onCancel } = props;
  return (
    <div className="advance-options">
      {options.map(line => (
        <button
          key={line}
          type="button"
          className="advance-btn"
          onClick={() => onPick(line)}
        >
          {titleCase(line)}
        </button>
      ))}
      {onCancel ? (
        <button type="button" className="advance-cancel" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </div>
  );
};

export default ClassPicker;
