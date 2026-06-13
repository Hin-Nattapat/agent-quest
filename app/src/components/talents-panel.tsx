import type { IState } from "../../../core/state";

interface IProps {
  state: IState;
}

const nodeState = (t: number, tier: number): string => {
  if (t === tier) {
    return "current";
  }
  if (t < tier) {
    return "past";
  }
  return "locked";
};

const TalentsPanel = (props: IProps) => {
  const { state } = props;
  const klass = state.class;
  const tree = klass?.tree;
  const tier = klass?.tier ?? 0;
  const branch = klass?.branch ?? null;

  if (!tree) {
    return (
      <div className="panel-body talents-panel">
        <div className="panel-empty">Choose a class (`rpg class …`)</div>
      </div>
    );
  }

  return (
    <div className="panel-body talents-panel">
      <div className="talent-tree">
        {tree.forms.map((form, i) => {
          const t = i + 1;
          return (
            <div key={form} className={`talent-node ${nodeState(t, tier)}`}>
              <span className="tn-tier">T{t}</span>
              <span className="tn-form">{form}</span>
            </div>
          );
        })}
        {tree.branches ? (
          <div className="talent-fork">
            <div
              className={`talent-node branch ${branch === "a" ? "current" : "locked"}`}
            >
              <span className="tn-tier">T4 · a</span>
              <span className="tn-form">{tree.branches.a}</span>
            </div>
            <div
              className={`talent-node branch ${branch === "b" ? "current" : "locked"}`}
            >
              <span className="tn-tier">T4 · b</span>
              <span className="tn-form">{tree.branches.b}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TalentsPanel;
