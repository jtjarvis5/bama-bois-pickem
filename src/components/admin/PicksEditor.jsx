import { useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../services/api';
import { isGameLocked } from '../../utils/getCurrentWeek';
import { hasSpreadLock, hasTotalLock } from '../../utils/scoring';
import { byKickoff, canon, same, side } from './shared';

export default function PicksEditor({
  token, leagueId, members = [], games = [], gamesByWeek = {}, defaultWeek, weeks = [],
  week, setWeek, member, setMember, onSaved,
}) {
  const [original, setOriginal] = useState({});
  const [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: 'ok' | 'error', text }
  const loadId = useRef(0);

  const weekGames = useMemo(() => {
    const cached = gamesByWeek[week];
    const list = cached && cached.length ? cached : week === defaultWeek ? games : [];
    return [...list].sort(byKickoff);
  }, [gamesByWeek, games, week, defaultWeek]);

  const gamesByIdForWeek = useMemo(() => {
    const m = {};
    weekGames.forEach((g) => { m[String(g.id)] = g; });
    return m;
  }, [weekGames]);

  // Load the member's real (unhidden) picks for the chosen week.
  useEffect(() => {
    if (!member || week == null) return;
    const id = ++loadId.current;
    setLoading(true);
    setNotice(null);
    api.adminGetPicks(token, leagueId, week, member)
      .then((data) => {
        if (id !== loadId.current) return;
        const picks = data || {};
        setOriginal(picks);
        setDraft(picks);
      })
      .catch((err) => {
        if (id !== loadId.current) return;
        setOriginal({}); setDraft({});
        setNotice({ kind: 'error', text: api.friendlyError(err) });
      })
      .finally(() => { if (id === loadId.current) setLoading(false); });
  }, [token, leagueId, week, member]);

  const dirty = !same(draft, original);

  const setSide = (gameId, field, value) => {
    setDraft((prev) => {
      const cur = { ...(prev[gameId] || {}) };
      if (cur[field] === value) {
        // tapping the chosen side again clears it (and its lock)
        delete cur[field];
        delete cur[field === 'spread' ? 'spreadLock' : 'totalLock'];
        if (field === 'spread') delete cur.isLock;
      } else {
        cur[field] = value;
      }
      return { ...prev, [gameId]: cur };
    });
  };

  // One spread lock and one total lock per week, same as the member screen.
  const toggleLock = (gameId, lockField, hasLockFn) => {
    setDraft((prev) => {
      const wasLocked = hasLockFn(prev[gameId]);
      const next = {};
      Object.keys(prev).forEach((id) => {
        const e = { ...prev[id], [lockField]: false };
        if (lockField === 'spreadLock') e.isLock = false;
        next[id] = e;
      });
      if (!wasLocked) next[gameId] = { ...next[gameId], [lockField]: true };
      return next;
    });
  };

  const save = async () => {
    if (!dirty || saving) return;
    const ok = window.confirm(
      `Save these picks for ${member} (Week ${week})? This changes their picks and is recorded in the admin log.`
    );
    if (!ok) return;
    setSaving(true);
    setNotice(null);
    try {
      await api.adminSavePicks(token, leagueId, week, member, canon(draft));
      const fresh = (await api.adminGetPicks(token, leagueId, week, member)) || {};
      setOriginal(fresh);
      setDraft(fresh);
      setNotice({ kind: 'ok', text: `Saved ${member}'s Week ${week} picks.` });
      onSaved?.();
    } catch (err) {
      setNotice({ kind: 'error', text: api.friendlyError(err) });
    } finally {
      setSaving(false);
    }
  };

  const revert = () => { setDraft(original); setNotice(null); };

  const orphanCount = Object.keys(draft).filter((id) => !gamesByIdForWeek[id] && canon({ [id]: draft[id] })[id]).length;

  return (
    <div>
      <div className="rounded-card border border-line bg-white p-4 shadow-sm mb-5">
        <h2 className="font-display text-lg font-semibold text-ink">Edit picks</h2>
        <p className="text-xs text-muted mt-1 mb-4">
          Set picks for a member who missed the deadline. You can edit games that have already kicked off.
          Every change is recorded in the Log tab.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex-1 text-xs font-semibold text-muted uppercase tracking-wide">
            Member
            <select
              value={member}
              onChange={(e) => setMember(e.target.value)}
              className="mt-1 block w-full border border-line rounded-lg px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink bg-white"
            >
              {members.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <label className="flex-1 text-xs font-semibold text-muted uppercase tracking-wide">
            Week
            <select
              value={week}
              onChange={(e) => setWeek(Number(e.target.value))}
              className="mt-1 block w-full border border-line rounded-lg px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink bg-white"
            >
              {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </label>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className={`mb-4 text-xs p-3 rounded-lg border ${
            notice.kind === 'ok'
              ? 'text-emerald-800 bg-emerald-50 border-emerald-200'
              : 'text-red-600 bg-red-50 border-red-200'
          }`}
        >
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted py-8 text-center">Loading {member}'s picks…</div>
      ) : weekGames.length === 0 ? (
        <div className="text-sm text-muted py-8 text-center">
          No games are saved for Week {week} yet. Open that week on the Games tab once so its games load, then come back.
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {weekGames.map((game) => {
            const pick = draft[game.id] || {};
            const started = isGameLocked(game.startDate);
            const final = game.status === 'FINAL';
            const changed = !same({ [game.id]: draft[game.id] }, { [game.id]: original[game.id] });
            return (
              <div key={game.id} className={`rounded-xl border p-4 bg-white ${changed ? 'border-crimson/50' : 'border-line'}`}>
                <div className="flex items-center justify-between mb-2.5 text-xs text-muted font-medium">
                  <span>{game.awayAbbr} @ {game.homeAbbr}{game.time ? ` · ${game.time}` : ''}</span>
                  <span className="flex items-center gap-2">
                    {changed && <span className="text-crimson font-semibold">Edited</span>}
                    <span>{final ? 'Final' : started ? 'Started' : 'Upcoming'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <button type="button" aria-pressed={pick.spread === 'away'} className={side(pick.spread === 'away')}
                    onClick={() => setSide(game.id, 'spread', 'away')}>
                    {game.awayTeam} {game.awaySpread > 0 ? `+${game.awaySpread}` : game.awaySpread}
                  </button>
                  <button type="button" aria-pressed={pick.spread === 'home'} className={side(pick.spread === 'home')}
                    onClick={() => setSide(game.id, 'spread', 'home')}>
                    {game.homeTeam} {game.homeSpread > 0 ? `+${game.homeSpread}` : game.homeSpread}
                  </button>
                </div>
                <button type="button" disabled={!pick.spread} onClick={() => toggleLock(game.id, 'spreadLock', hasSpreadLock)}
                  className={`mb-3 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    hasSpreadLock(pick) ? 'bg-ink text-white' : 'border border-line text-muted hover:border-ink/30'}`}>
                  {hasSpreadLock(pick) ? 'Spread locked ✓' : 'Lock this spread'}
                </button>

                {game.overUnder != null ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <button type="button" aria-pressed={pick.total === 'over'} className={side(pick.total === 'over')}
                        onClick={() => setSide(game.id, 'total', 'over')}>Over {game.overUnder}</button>
                      <button type="button" aria-pressed={pick.total === 'under'} className={side(pick.total === 'under')}
                        onClick={() => setSide(game.id, 'total', 'under')}>Under {game.overUnder}</button>
                    </div>
                    <button type="button" disabled={!pick.total} onClick={() => toggleLock(game.id, 'totalLock', hasTotalLock)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        hasTotalLock(pick) ? 'bg-ink text-white' : 'border border-line text-muted hover:border-ink/30'}`}>
                      {hasTotalLock(pick) ? 'Total locked ✓' : 'Lock this total'}
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-muted italic">No total line for this game.</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {orphanCount > 0 && (
        <p className="text-xs text-muted mb-3">
          {orphanCount} saved pick{orphanCount === 1 ? '' : 's'} for this week {orphanCount === 1 ? 'is' : 'are'} on
          games that aren't in the list above. They are kept as they are.
        </p>
      )}

      <div className="sticky bottom-3 flex items-center justify-between gap-3 rounded-card border border-line bg-white/95 backdrop-blur p-3 shadow-sm">
        <span className="text-xs text-muted">{dirty ? `Unsaved changes for ${member}` : 'No changes'}</span>
        <span className="flex gap-2">
          <button type="button" onClick={revert} disabled={!dirty || saving}
            className="px-3 py-2 rounded-lg border border-line text-sm font-medium text-ink disabled:opacity-40">
            Undo
          </button>
          <button type="button" onClick={save} disabled={!dirty || saving || loading}
            className="px-4 py-2 rounded-lg bg-crimson text-white text-sm font-semibold disabled:opacity-40">
            {saving ? 'Saving…' : `Save for ${member || '…'}`}
          </button>
        </span>
      </div>

    </div>
  );
}
