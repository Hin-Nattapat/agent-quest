import type { IClassTree } from "../../../core/classes";

interface IProps {
  tree: IClassTree;
  tier: number;
  branch: string | null;
  onPickBranch?: (branch: "a" | "b") => void; // present only when the T4 fork is choosable
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

// The read-only tier ladder + (for main lines) the T4 fork. When onPickBranch is given, the two
// fork nodes become buttons.
const TalentTree = (props: IProps) => {
  const { tree, tier, branch, onPickBranch } = props;
  return (
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
          {(["a", "b"] as const).map(b => {
            const node = (
              <div
                className={`talent-node branch ${branch === b ? "current" : "locked"}`}
              >
                <span className="tn-tier">T4 · {b}</span>
                <span className="tn-form">{tree.branches![b]}</span>
              </div>
            );
            if (!onPickBranch) {
              return <div key={b}>{node}</div>;
            }
            return (
              <button
                key={b}
                type="button"
                className="branch-pick"
                onClick={() => onPickBranch(b)}
              >
                {node}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default TalentTree;
