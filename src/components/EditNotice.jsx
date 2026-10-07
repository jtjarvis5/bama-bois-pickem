import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import { canon, pickText, whenText } from './admin/shared';

// Shown to a member when the league admin changed their picks (so nothing
// changes behind their back). Each notice can be dismissed; dismissals are
// remembered on this device only.

const storageKey = (user, leagueId) => `editNoticeDismissed:${leagueId}:${user}`;

function readDismissed(key) {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
}
function writeDismissed(key, ids) {
  try { localStorage.setItem(key, JSON.stringify(ids.slice(-100))); } catch { /* private mode: fine */ }
}

export default function EditNotice({ token, leagueId, userName, gamesByWeek = {} }) {
  const key = storageKey(userName, leagueId);
  const [edits, setEdits] = useState([]);
  const [dismissed, setDismissed] = useState(() => readDismissed(key));

  useEffect(() => { setDismissed(readDismissed(key)); }, [key]);

  useEffect(() => {
    if (!token || !leagueId) { setEdits([]); return undefined; }
    let live = true;
    api.myPickEdits(token, leagueId)
      .then((rows) => { if (live) setEdits(rows || []); })
      .catch(() => { if (live) setEdits([]); }); // a notice is never worth an error message
    return () => { live = false; };
  }, [token, leagueId]);

  const items = useMemo(() => edits
    .filter((e) => !dismissed.includes(String(e.id)))
    .map((e) => {
      const before = canon(e.before_picks);
      const after = canon(e.after_picks);
      const ids = [...new Set([...Object.keys(before), ...Object.keys(after)])]
        .filter((id) => JSON.stringify(before[id]) !== JSON.stringify(after[id]));
      return { e, before, after, ids };
    })
    .filter((x) => x.ids.length > 0)
    .slice(0, 3), [edits, dismissed]);

  const dismiss = useCallback((id) => {
    const next = [...dismissed, String(id)];
    setDismissed(next);
    writeDismissed(key, next);
  }, [dismissed, key]);

  if (items.length === 0) return null;

  return (
    <div className="mb-4 space-y-2" data-testid="edit-notice">
      {items.map(({ e, before, after, ids }) => {
        const games = {};
        (gamesByWeek[e.week] || []).forEach((g) => { games[String(g.id)] = g; });
        return (
          <div key={e.id} role="status" className="rounded-card border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <p className="text-xs text-blue-900">
                <strong>{e.admin_user}</strong> (league admin) updated your Week {e.week} picks
                <span className="text-blue-900/70"> · {whenText(e.changed_at)}</span>
              </p>
              <button type="button" onClick={() => dismiss(e.id)} aria-label="Dismiss this notice"
                className="shrink-0 text-xs font-medium text-blue-900 underline">
                Got it
              </button>
            </div>
            <ul className="mt-2 space-y-0.5 text-xs text-blue-900/80">
              {ids.map((id) => {
                const g = games[id];
                return (
                  <li key={id}>
                    <span className="text-blue-950">{g ? `${g.awayAbbr} @ ${g.homeAbbr}` : `Game ${id}`}</span>
                    : {pickText(g, before[id])} → {pickText(g, after[id])}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
