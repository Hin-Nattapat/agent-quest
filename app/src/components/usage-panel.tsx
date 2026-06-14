import type { IState } from "../../../core/state";
import { cmdLabel, byCountDesc } from "../view";

interface IProps {
  state: IState;
}

const UsagePanel = (props: IProps) => {
  const { state } = props;
  const stats = state.stats;
  const repos = Object.entries(stats.by_repo ?? {}).sort((a, b) => b[1].xp - a[1].xp);
  const tools = byCountDesc(stats.actions ?? {});
  const maxTool = Math.max(1, ...tools.map(([, n]) => n));
  const cmds = byCountDesc(stats.cmds ?? {});
  const totalActions = tools.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="panel-body usage-panel">
      <section className="usage-section">
        <div className="panel-head">⚔ Realms Conquered</div>
        {repos.length === 0 ? (
          <div className="panel-empty">No realms yet…</div>
        ) : (
          <ul className="repo-list">
            {repos.map(([name, g]) => (
              <li key={name} className="repo-row">
                <span className="repo-name">{name}</span>
                <span className="repo-stat">
                  {g.xp.toLocaleString()} xp · {g.sessions} sessions
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="usage-section">
        <div className="panel-head">🛠 Tool Mix</div>
        <ul className="tool-list">
          {tools.map(([name, n]) => (
            <li key={name} className="tool-row">
              <span className="tool-name">{name}</span>
              <span className="tool-bar">
                <i style={{ width: `${(n / maxTool) * 100}%` }} />
              </span>
              <span className="tool-count">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="usage-section">
        <div className="panel-head">📜 Command Tally</div>
        {cmds.length === 0 ? (
          <div className="panel-empty">No notable deeds logged…</div>
        ) : (
          <ul className="cmd-list">
            {cmds.map(([tag, n]) => (
              <li key={tag} className="cmd-row">
                <span className="cmd-name">{cmdLabel(tag)}</span>
                <span className="cmd-count">{n}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="usage-section">
        <div className="panel-head">📊 Totals</div>
        <dl className="usage-totals">
          <div>
            <dt>Prompts</dt>
            <dd>{stats.prompts}</dd>
          </div>
          <div>
            <dt>Sessions</dt>
            <dd>{stats.sessions}</dd>
          </div>
          <div>
            <dt>Actions</dt>
            <dd>{totalActions}</dd>
          </div>
          <div>
            <dt>Fails</dt>
            <dd>{stats.action_fails ?? 0}</dd>
          </div>
          <div>
            <dt>🐉 Bosses</dt>
            <dd>
              {stats.boss_defeated ?? 0} / {stats.boss_fled ?? 0}
            </dd>
          </div>
          <div>
            <dt>🔥 Best streak</dt>
            <dd>{state.streak?.best_days ?? 0}d</dd>
          </div>
        </dl>
      </section>
    </div>
  );
};

export default UsagePanel;
