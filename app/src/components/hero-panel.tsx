import type { IState } from "../../../core/state";
import { displayName } from "../view";

interface IProps {
  state: IState;
}

const LINES = ["mage", "ranger", "rogue", "sage"];

const HeroPanel = (props: IProps) => {
  const { state } = props;
  const klass = state.class;
  const aff = klass?.affinity ?? {};
  const stats = state.stats;
  const totalActions = Object.values(stats.actions).reduce((a, b) => a + b, 0);

  return (
    <div className="panel-body hero-panel">
      <div className="hero-id">
        <span className="sprite panel-portrait" aria-hidden="true" />
        <div>
          <b className="hp-name">{displayName(state)}</b>
          {state.cosmetics?.title ? (
            <div className="hp-title">the {state.cosmetics.title}</div>
          ) : null}
          <div className="hp-class">
            {klass?.form ?? "Novice"}
            {klass && klass.tier > 0 ? ` · T${klass.tier}` : ""}
          </div>
          <div className="hp-lvl">
            Lv.{state.level} · +{Math.round((klass?.base_passive_pct ?? 0) * 100)}%
            passive
          </div>
        </div>
      </div>

      <div className="hero-cols">
        <section className="hero-col">
          <div className="panel-head">Affinity</div>
          <div className="aff-bars">
            {LINES.map(l => {
              const pct = Math.round((aff[l] ?? 0) * 100);
              return (
                <div key={l} className="aff-row">
                  <span className="aff-label">{l}</span>
                  <div className="aff-bar">
                    <i style={{ width: `${pct}%` }} />
                  </div>
                  <span className="aff-pct">{pct}%</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="hero-col">
          <div className="panel-head">Stats</div>
          <dl className="stat-grid">
            <dt>📝 Prompts</dt>
            <dd>{stats.prompts}</dd>
            <dt>🔧 Actions</dt>
            <dd>{totalActions}</dd>
            <dt>🕑 Sessions</dt>
            <dd>{stats.sessions}</dd>
            <dt>🐉 Bosses</dt>
            <dd>
              {stats.boss_defeated ?? 0} slain · {stats.boss_fled ?? 0} fled
            </dd>
            <dt>🔥 Best streak</dt>
            <dd>{state.streak?.best_days ?? 0}d</dd>
          </dl>
        </section>
      </div>
    </div>
  );
};

export default HeroPanel;
