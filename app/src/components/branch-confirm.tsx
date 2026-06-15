interface IProps {
  formName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Two-step guard before locking a T4 branch (the choice is permanent).
const BranchConfirm = (props: IProps) => {
  const { formName, onConfirm, onCancel } = props;
  return (
    <div className="advance-confirm">
      <span>Lock branch {formName}? This is permanent.</span>
      <div className="advance-confirm-row">
        <button type="button" className="advance-btn" onClick={onConfirm}>
          Confirm
        </button>
        <button type="button" className="advance-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default BranchConfirm;
