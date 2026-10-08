import { useEffect, useMemo, useState } from 'react';
import * as api from '../../services/api';
import { buildRecap } from '../../utils/recap';
import { copyText, inputCls } from './shared';

// A ready-to-paste weekly recap for the group chat.

export default function Recap({ token, leagueId, leagueName, week, setWeek, weeks, gamesByWeek, members }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    api.adminSeasonPicks(token, leagueId)
      .then((d) => { if (live) { setRows(d || []); setError(''); } })
      .catch((err) => { if (live) setError(api.friendlyError(err)); });
    return () => { live = false; };
  }, [token, leagueId, tick]);

  const recap = useMemo(
    () => (rows ? buildRecap({ leagueName, week, seasonRows: rows, gamesByWeek, members }) : null),
    [rows, leagueName, week, gamesByWeek, members],
  );

  const copy = async () => {
    if (!recap) return;
    setCopied((await copyText(recap.text)) ? 'Copied. Paste it in the group chat.' : 'Could not copy. Select the text and copy it.');
    setTimeout(() => setCopied(''), 4000);
  };

  return (
    <div>
      <div className="rounded-card border border-line bg-white p-4 shadow-sm mb-4">
        <div className="flex items-end gap-3">
          <label className="flex-1 text-xs font-semibold text-muted uppercase tracking-wide">
            Week
            <select value={week ?? ''} onChange={(e) => setWeek(Number(e.target.value))} className={inputCls}>
              {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setTick((t) => t + 1)}
            className="px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink">Refresh</button>
        </div>
        <p className="text-xs text-muted mt-3">
          Built from the same results as the Stats tab. Only finished games count, so run it after the last game.
        </p>
      </div>
      {error && <div role="alert" className="mb-4 text-xs p-3 rounded-lg border text-red-600 bg-red-50 border-red-200">{error}</div>}
      {!rows && !error ? (
        <div className="text-sm text-muted py-8 text-center">Loading…</div>
      ) : !recap ? (
        !error && <div className="text-sm text-muted py-8 text-center">No finished games with picks for Week {week} yet.</div>
      ) : (
        <div className="rounded-card border border-line bg-white p-4 shadow-sm">
          <pre className="whitespace-pre-wrap break-words text-xs text-ink bg-paper/60 border border-line rounded-lg p-3 mb-3 font-sans" data-testid="recap-text">{recap.text}</pre>
          <button type="button" onClick={copy} className="px-4 py-2 rounded-lg bg-crimson text-white text-sm font-semibold">Copy recap</button>
          {copied && <span role="status" className="ml-3 text-xs text-muted">{copied}</span>}
        </div>
      )}
    </div>
  );
}
