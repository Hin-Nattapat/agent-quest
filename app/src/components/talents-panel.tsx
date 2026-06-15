import { useState } from "react";
import type { IState } from "../../../core/state";
import type { TClientAction } from "../actions";
import { AdvanceKind } from "../advance";
import ClassPicker from "./class-picker";
import TalentTree from "./talent-tree";
import BranchConfirm from "./branch-confirm";

interface IProps {
  state: IState;
  dispatch: (action: TClientAction) => void;
}

const TalentsPanel = (props: IProps) => {
  const { state, dispatch } = props;
  const klass = state.class;
  const advance = klass?.advance;
  const [respecOpen, setRespecOpen] = useState(false);
  const [confirmBranch, setConfirmBranch] = useState<"a" | "b" | null>(null);

  const pickClass = (line: string) => {
    dispatch({ type: "action", name: "setClass", line });
    setRespecOpen(false);
  };

  // No class chosen yet (Lv.5+): just the picker — there is no tree to show.
  if (advance?.kind === AdvanceKind.Class) {
    return (
      <div className="panel-body talents-panel">
        <div className="panel-head">Choose your class</div>
        <ClassPicker options={advance.options} onPick={pickClass} />
      </div>
    );
  }

  const tree = klass?.tree;
  if (!tree) {
    return (
      <div className="panel-body talents-panel">
        <div className="panel-empty">Reach level 5 to choose a class.</div>
      </div>
    );
  }

  return (
    <div className="panel-body talents-panel">
      <TalentTree
        tree={tree}
        tier={klass?.tier ?? 0}
        branch={klass?.branch ?? null}
        onPickBranch={advance?.kind === AdvanceKind.Branch ? setConfirmBranch : undefined}
      />

      {advance?.kind === AdvanceKind.Respec ? (
        <div className="advance-foot">
          {respecOpen ? (
            <ClassPicker
              options={advance.options}
              onPick={pickClass}
              onCancel={() => setRespecOpen(false)}
            />
          ) : (
            <button
              type="button"
              className="advance-btn"
              onClick={() => setRespecOpen(true)}
            >
              Change class
            </button>
          )}
        </div>
      ) : null}

      {confirmBranch ? (
        <BranchConfirm
          formName={tree.branches?.[confirmBranch] ?? confirmBranch}
          onConfirm={() => {
            dispatch({ type: "action", name: "setBranch", branch: confirmBranch });
            setConfirmBranch(null);
          }}
          onCancel={() => setConfirmBranch(null)}
        />
      ) : null}
    </div>
  );
};

export default TalentsPanel;
