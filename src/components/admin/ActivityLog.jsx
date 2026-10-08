import { useEffect, useMemo, useState } from 'react';
import * as api from '../../services/api';
import { canon, pickText, whenText } from './shared';

// Everything the admin has done in this league: pick edits (with before/after)
// and member actions (PIN resets, adds, removals), newest first.

const ACTIONS = {
  reset_pin: (r) => <><span className="font-medium">{r.admin_user}</span> reset <span className="font-medium">{r.target_user}</span>'s PIN</>,
  add_member: (r) => <><span className="font-medium">{r.admin_user}</span> added <span className="font-medium">{r.target_user}</span></>,
  remove_member: (r) => <><span className="font-medium">{r.admin_user}</span> removed <span className="font-medium">{r.target_user}</span></>,
};

export default function ActivityLog({ token, leagueId, gamesByWeek, reloadKey }) {
  const [edits, setEdits] = useState(null);
  const [actions, setActions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    Promise.all([api.adminAudit(token, leagueId), api.adminLog(token, leagueId)])
      .then(([a, b]) => { if (live) { setEdits(a || []); setActions(b || []); setError(''); } })
      .catch((err) => { if (live) setError(api.friendlyError(err)); });
    return () => { live = false; };
  }, [token, leagueId, reloadKey]);

  const items = useMemo(() => [
    ...(edits || []).map((r) => ({ type: 'edit', at: r.changed_at, key: `e${r.id}`, row: r })),
    ...actions.map((r) => ({ type: 'action', at: r.created_at, key: `a${r.id}`, row: r })),
  ].sort((x, y) => new Date(y.at) - new Date(x.at)), [edits, actions]);

  return (
    <div>
      <h3 className="font-display text-lg font-semibold text-ink mb-3">Admin log</h3>
      {error && <div role="alert" className="mb-4 text-xs p-3 rounded-lg border text-red-600 bg-red-50 border-red-200">{error}</div>}
      {!edits && !error ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <div className="rounded-card border border-line bg-white divide-y divide-line shadow-sm">
          {items.map((it) => it.type === 'edit'
            ? <AuditRow key={it.key} row={it.row} gamesForWeek={gamesByWeek[it.row.week] || []} />
            : (
              <div key={it.key} className="p-3 text-sm text-ink">
                {(ACTIONS[it.row.action] || ((r) => <>{r.action}</>))(it.row)}
                <span className="text-muted"> · {whenText(it.at)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function AuditRow({ row, gamesForWeek }) {
  const gameById = {};
  gamesForWeek.forEach((g) => { gameById[String(g.id)] = g; });
  const before = canon(row.before_picks);
  const after = canon(row.after_picks);
  const ids = [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((id) => JSON.stringify(before[id]) !== JSON.stringify(after[id]));

  return (
    <details className="p-3 text-sm">
      <summary className="cursor-pointer text-ink">
        <span className="font-medium">{row.admin_user}</span> edited{' '}
        <span className="font-medium">{row.target_user}</span>'s Week {row.week}
        <span className="text-muted"> · {ids.length} game{ids.length === 1 ? '' : 's'} · {whenText(row.changed_at)}</span>
      </summary>
      <ul className="mt-2 space-y-1 text-xs text-muted">
        {ids.length === 0 && <li>No pick content changed.</li>}
        {ids.map((id) => {
          const g = gameById[id];
          return (
            <li key={id}>
              <span className="text-ink">{g ? `${g.awayAbbr} @ ${g.homeAbbr}` : `Game ${id}`}</span>
              : {pickText(g, before[id])} → {pickText(g, after[id])}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
