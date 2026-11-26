import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../services/api';
import { getSwapCandidates, prepareSwapGame } from '../../services/gameCache';
import { inputCls, whenText } from './shared';
import { weekLabel, isBowlWeek } from '../../utils/weekLabel';

// Swap one game on a week's slate for another. Picks on the removed game are
// cleared (the server does that, in every league of the sport, and logs it).

const lineText = (g) => {
  if (g.homeSpread == null || (g.homeSpread === 0 && g.awaySpread === 0 && g.overUnder == null)) return 'no line';
  const fav = g.homeSpread < 0 ? `${g.homeAbbr} ${g.homeSpread}` : `${g.awayAbbr} ${g.awaySpread}`;
  return `${fav}${g.overUnder != null ? ` · o/u ${g.overUnder}` : ''}`;
};

const label = (g) => `${g.awayTeam} @ ${g.homeTeam}`;

export default function Slate({
  token, leagueId, sport, year, week, setWeek, weeks, weekGames, onChanged,
}) {
  const [rows, setRows] = useState(null);       // who picked what this week
  const [candidates, setCandidates] = useState(null);
  const [loadingCands, setLoadingCands] = useState(false);
  const [removeId, setRemoveId] = useState('');
  const [addId, setAddId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const loadId = useRef(0);

  const editable = sport === 'CFB' && week != null && !isBowlWeek(week);
  const now = Date.now();

  useEffect(() => {
    setCandidates(null); setRemoveId(''); setAddId(''); setError('');
    if (week == null) return undefined;
    const id = ++loadId.current;
    api.adminWeekPicks(token, leagueId, week)
      .then((data) => { if (id === loadId.current) setRows(data || []); })
      .catch(() => { if (id === loadId.current) setRows(null); });
    return undefined;
  }, [token, leagueId, week, weekGames.length]);

  const pickersOf = (g) => (rows || [])
    .filter((r) => { const e = (r.picks || {})[String(g.id)]; return e && (e.spread || e.total); })
    .map((r) => r.user_name);

  const onSlate = useMemo(() => new Set(weekGames.map((g) => String(g.id))), [weekGames]);
  const removable = weekGames.filter((g) => g.status !== 'FINAL' && new Date(g.startDate).getTime() > now);
  const removing = weekGames.find((g) => String(g.id) === String(removeId));
  const addable = (candidates || []).filter((g) => !onSlate.has(String(g.id)));
  const adding = addable.find((g) => String(g.id) === String(addId));
  const affected = removing ? pickersOf(removing) : [];

  const loadCandidates = async () => {
    setLoadingCands(true); setError('');
    try {
      setCandidates(await getSwapCandidates(year, week));
    } catch (err) {
      setError(`Could not load the week's games: ${err.message}`);
    } finally {
      setLoadingCands(false);
    }
  };

  const swap = async () => {
    if (!removing || !adding) return;
    const warning = affected.length
      ? `${affected.join(', ')} already picked ${label(removing)}. Those picks will be deleted. Swap anyway?`
      : `Swap ${label(removing)} for ${label(adding)}?`;
    if (!window.confirm(warning)) return;
    setBusy(true); setError(''); setDone('');
    try {
      const game = await prepareSwapGame(adding);
      const res = await api.adminSwapGame(token, leagueId, week, removing.id, game);
      setDone(`Swapped ${label(removing)} for ${label(adding)}. ${res?.cleared || 0} pick${res?.cleared === 1 ? '' : 's'} cleared.`);
      setRemoveId(''); setAddId(''); setCandidates(null);
      onChanged?.();
    } catch (err) {
      setError(api.friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="rounded-card border border-line bg-white p-4 shadow-sm mb-4">
        <label className="block text-xs font-semibold text-muted uppercase tracking-wide">
          Week
          <select value={week ?? ''} onChange={(e) => setWeek(Number(e.target.value))} className={inputCls}>
            {weeks.map((w) => <option key={w} value={w}>{weekLabel(w)}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted mt-3">
          Swap one game on this week's slate for another. It applies to every league of this sport, and picks on the removed game are deleted.
          Games that have started can't be changed.
        </p>
      </div>

      {error && <div role="alert" className="mb-4 text-xs p-3 rounded-lg border text-red-600 bg-red-50 border-red-200">{error}</div>}
      {done && <div role="status" className="mb-4 text-xs p-3 rounded-lg border text-green-700 bg-green-50 border-green-200">{done}</div>}

      {!editable ? (
        <p className="text-sm text-muted py-6 text-center">Only regular-season college weeks can be changed here.</p>
      ) : (
        <>
          <h3 className="font-display text-base font-semibold text-ink mb-2">1. Remove a game</h3>
          <div className="rounded-card border border-line bg-white divide-y divide-line shadow-sm mb-5">
            {weekGames.length === 0 && <p className="p-3 text-sm text-muted">No games saved for this week yet.</p>}
            {weekGames.map((g) => {
              const locked = !removable.includes(g);
              const who = pickersOf(g);
              return (
                <label key={g.id} className={`flex items-start gap-3 p-3 text-sm ${locked ? 'opacity-50' : 'cursor-pointer'}`}>
                  <input type="radio" name="remove" disabled={locked} checked={String(removeId) === String(g.id)}
                    onChange={() => setRemoveId(String(g.id))} className="mt-1" />
                  <span className="flex-1">
                    <span className="text-ink font-medium">{label(g)}</span>
                    <span className="block text-xs text-muted">
                      {whenText(g.startDate)} · {lineText(g)}
                      {locked ? ' · started' : ''}
                      {!locked && rows ? ` · ${who.length ? `picked by ${who.join(', ')}` : 'no picks yet'}` : ''}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <h3 className="font-display text-base font-semibold text-ink mb-2">2. Choose the replacement</h3>
          {!candidates ? (
            <button type="button" onClick={loadCandidates} disabled={loadingCands}
              className="px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink disabled:opacity-40 mb-5">
              {loadingCands ? 'Loading…' : 'Load this week\'s other games'}
            </button>
          ) : (
            <div className="rounded-card border border-line bg-white divide-y divide-line shadow-sm mb-5 max-h-80 overflow-y-auto">
              {addable.length === 0 && <p className="p-3 text-sm text-muted">No other upcoming FBS games.</p>}
              {addable.map((g) => (
                <label key={g.id} className="flex items-start gap-3 p-3 text-sm cursor-pointer">
                  <input type="radio" name="add" checked={String(addId) === String(g.id)}
                    onChange={() => setAddId(String(g.id))} className="mt-1" />
                  <span className="flex-1">
                    <span className="text-ink font-medium">
                      {g.awayRank ? `#${g.awayRank} ` : ''}{g.awayTeam} @ {g.homeRank ? `#${g.homeRank} ` : ''}{g.homeTeam}
                    </span>
                    <span className="block text-xs text-muted">
                      {whenText(g.startDate)} · {g.hasLine ? lineText(g) : 'no line yet'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {removing && adding && (
            <div className="rounded-card border border-line bg-white p-4 shadow-sm">
              <p className="text-sm text-ink">
                Replace <span className="font-medium">{label(removing)}</span> with <span className="font-medium">{label(adding)}</span>.
              </p>
              {!adding.hasLine && <p className="text-xs text-amber-800 mt-1">This game has no betting line yet, so it has no spread or total to pick yet.</p>}
              {affected.length > 0 && (
                <p className="text-xs text-red-600 mt-1">{affected.join(', ')} will lose their picks on {label(removing)}.</p>
              )}
              <button type="button" onClick={swap} disabled={busy}
                className="mt-3 px-4 py-2 rounded-lg bg-crimson text-white text-sm font-medium disabled:opacity-40">
                {busy ? 'Swapping…' : 'Swap games'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
