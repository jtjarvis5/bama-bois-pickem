import { useEffect, useMemo, useState } from 'react';
import * as api from '../../services/api';
import { buildRecap } from '../../utils/recap';
import { buildPreview } from '../../utils/preview';
import { copyText, inputCls } from './shared';
import { weekLabel } from '../../utils/weekLabel';

// A ready-to-paste weekly recap for the group chat.

export default function Recap({ token, leagueId, leagueName, week, setWeek, weeks, gamesByWeek, weekGames = [], members }) {
  const [mode, setMode] = useState('recap'); // 'recap' | 'preview'
  const [weekRows, setWeekRows] = useState([]);
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

  // Who has picked what this week, for the preview's "still need picks" line.
  useEffect(() => {
    if (mode !== 'preview' || week == null) return undefined;
    let live = true;
    api.adminWeekPicks(token, leagueId, week)
      .then((d) => { if (live) setWeekRows(d || []); })
      .catch(() => { if (live) setWeekRows([]); });
    return () => { live = false; };
  }, [mode, token, leagueId, week, tick]);

  const recap = useMemo(
    () => (rows ? buildRecap({ leagueName, week, seasonRows: rows, gamesByWeek, members }) : null),
    [rows, leagueName, week, gamesByWeek, members],
  );

  const preview = useMemo(
    () => (mode === 'preview'
      ? buildPreview({ leagueName, week, games: weekGames, picksRows: weekRows, members, seasonRows: rows || [], gamesByWeek })
      : null),
    [mode, leagueName, week, weekGames, weekRows, members, rows, gamesByWeek],
  );

  const shown = mode === 'preview' ? preview : recap;

  const copy = async () => {
    if (!shown) return;
    setCopied((await copyText(shown.text)) ? 'Copied. Paste it in the group chat.' : 'Could not copy. Select the text and copy it.');
    setTimeout(() => setCopied(''), 4000);
  };

  return (
    <div>
      <div className="rounded-card border border-line bg-white p-4 shadow-sm mb-4">
        <div role="tablist" aria-label="Recap or preview" className="flex gap-2 mb-4">
          {[['recap', 'Recap (after the games)'], ['preview', 'Preview (before the games)']].map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                mode === key ? 'bg-ink text-white border-ink' : 'border-line text-muted hover:border-ink/30'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-3">
          <label className="flex-1 text-xs font-semibold text-muted uppercase tracking-wide">
            Week
            <select value={week ?? ''} onChange={(e) => setWeek(Number(e.target.value))} className={inputCls}>
              {weeks.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => setTick((t) => t + 1)}
            className="px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink">Refresh</button>
        </div>
        <p className="text-xs text-muted mt-3">
          {mode === 'preview'
            ? 'The week ahead: the slate, lines, weather and who still owes picks. Send it before the first kickoff.'
            : 'Built from the same results as the Stats tab. Only finished games count, so run it after the last game.'}
        </p>
      </div>
      {error && <div role="alert" className="mb-4 text-xs p-3 rounded-lg border text-red-600 bg-red-50 border-red-200">{error}</div>}
      {mode === 'recap' && !rows && !error ? (
        <div className="text-sm text-muted py-8 text-center">Loading…</div>
      ) : !shown ? (
        !error && <div className="text-sm text-muted py-8 text-center">
          {mode === 'preview'
            ? `No games saved for ${weekLabel(week)} yet. Open that week on the Games tab once so its games load, then come back.`
            : `No finished games with picks for ${weekLabel(week)} yet.`}
        </div>
      ) : (
        <div className="rounded-card border border-line bg-white p-4 shadow-sm">
          <pre className="whitespace-pre-wrap break-words text-xs text-ink bg-paper/60 border border-line rounded-lg p-3 mb-3 font-sans" data-testid="recap-text">{shown.text}</pre>
          <button type="button" onClick={copy} className="px-4 py-2 rounded-lg bg-crimson text-white text-sm font-semibold">{mode === 'preview' ? 'Copy preview' : 'Copy recap'}</button>
          {copied && <span role="status" className="ml-3 text-xs text-muted">{copied}</span>}
        </div>
      )}
    </div>
  );
}
