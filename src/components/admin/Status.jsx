import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../services/api';
import { buildReminder, summarizeWeek } from '../../utils/adminTools';
import { inputCls } from './shared';

// Who has picked this week, and a one-tap reminder to paste into the group chat.

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export default function Status({
  token, leagueId, leagueName, week, setWeek, weeks, weekGames, reloadKey, onEdit,
}) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState('');
  const [tick, setTick] = useState(0);
  const loadId = useRef(0);

  useEffect(() => {
    if (week == null) return;
    const id = ++loadId.current;
    setLoading(true);
    setError('');
    api.adminWeekPicks(token, leagueId, week)
      .then((data) => { if (id === loadId.current) setRows(data || []); })
      .catch((err) => { if (id === loadId.current) { setRows(null); setError(api.friendlyError(err)); } })
      .finally(() => { if (id === loadId.current) setLoading(false); });
  }, [token, leagueId, week, reloadKey, tick]);

  const now = Date.now();
  const summary = useMemo(() => summarizeWeek(rows || [], weekGames, now), [rows, weekGames]); // eslint-disable-line react-hooks/exhaustive-deps
  const reminder = useMemo(
    () => buildReminder({ leagueName, week, summary, games: weekGames, now }),
    [leagueName, week, summary, weekGames], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const done = summary.filter((s) => s.state === 'done').length;

  const copy = async () => {
    if (!reminder) return;
    setCopied((await copyText(reminder)) ? 'Copied. Paste it in the group chat.' : 'Could not copy. Select the text above and copy it.');
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
          <button type="button" onClick={() => setTick((t) => t + 1)} disabled={loading}
            className="px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink disabled:opacity-40">
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
        {rows && weekGames.length > 0 && (
          <p className="text-xs text-muted mt-3">
            <span className="font-semibold text-ink">{done}</span> of {summary.length} members have picked every game
            ({weekGames.length} game{weekGames.length === 1 ? '' : 's'}).
          </p>
        )}
      </div>

      {error && <div role="alert" className="mb-4 text-xs p-3 rounded-lg border text-red-600 bg-red-50 border-red-200">{error}</div>}

      {weekGames.length === 0 ? (
        <div className="text-sm text-muted py-8 text-center">
          No games are saved for Week {week} yet. Open that week on the Games tab once so its games load, then come back.
        </div>
      ) : !rows ? (
        !error && <div className="text-sm text-muted py-8 text-center">Loading picks…</div>
      ) : (
        <>
          <div className="rounded-card border border-line bg-white divide-y divide-line shadow-sm mb-4">
            {summary.map((s) => {
              const pct = s.total ? Math.round((s.picked / s.total) * 100) : 0;
              const tone = s.state === 'done' ? 'bg-emerald-500' : s.state === 'none' ? 'bg-red-400' : 'bg-amber-400';
              return (
                <div key={s.member} className="p-3 flex items-center gap-3" data-testid={`status-${s.member}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink truncate">{s.member}</span>
                      <span className="text-xs text-muted shrink-0">
                        {s.state === 'done' ? 'All picked' : s.state === 'none' ? 'No picks' : `${s.picked}/${s.total}`}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-line mt-1.5 overflow-hidden" aria-hidden="true">
                      <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[11px] text-muted mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{s.spread} spread</span>
                      <span>{s.totals} total</span>
                      <span>{s.spreadLock ? 'Spread lock ✓' : 'No spread lock'}</span>
                      <span>{s.totalLock ? 'Total lock ✓' : 'No total lock'}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => onEdit(s.member)}
                    className="shrink-0 px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink hover:border-ink/30">
                    Set picks
                  </button>
                </div>
              );
            })}
          </div>

          <div className="rounded-card border border-line bg-white p-4 shadow-sm">
            <h3 className="font-display text-base font-semibold text-ink mb-2">Reminder</h3>
            {reminder ? (
              <>
                <pre className="whitespace-pre-wrap break-words text-xs text-ink bg-paper/60 border border-line rounded-lg p-3 mb-3 font-sans" data-testid="reminder-text">{reminder}</pre>
                <button type="button" onClick={copy}
                  className="px-4 py-2 rounded-lg bg-crimson text-white text-sm font-semibold">
                  Copy reminder
                </button>
                {copied && <span role="status" className="ml-3 text-xs text-muted">{copied}</span>}
              </>
            ) : (
              <p className="text-sm text-muted">
                Nobody needs a nudge: everyone has picked every upcoming game, or all of this week's games have started.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
