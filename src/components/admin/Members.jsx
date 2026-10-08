import { useCallback, useEffect, useState } from 'react';
import * as api from '../../services/api';
import { isValidPin, randomPin } from '../../utils/adminTools';
import { inputCls } from './shared';

// Add or remove members and reset a forgotten PIN. Removing someone keeps their
// picks in the database (adding them back restores everything) but hides them
// from Standings, Who Picked Who and Stats.

export default function Members({ token, leagueId, onChanged }) {
  const [rows, setRows] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [pinFor, setPinFor] = useState(null);   // member whose PIN form is open
  const [pin, setPin] = useState('');
  const [result, setResult] = useState(null);   // { kind, text }
  const [toAdd, setToAdd] = useState('');

  const load = useCallback(async () => {
    try {
      const [m, c] = await Promise.all([api.adminMembers(token, leagueId), api.adminCandidates(token, leagueId)]);
      setRows(m || []);
      setCandidates(c || []);
      setToAdd((cur) => ((c || []).includes(cur) ? cur : ''));
      setError('');
    } catch (err) {
      setError(api.friendlyError(err));
    }
  }, [token, leagueId]);
  useEffect(() => { load(); }, [load]);

  const run = async (key, fn, okText) => {
    setBusy(key);
    setResult(null);
    try {
      await fn();
      if (okText) setResult({ kind: 'ok', text: okText });
      await load();
      onChanged?.();
      return true;
    } catch (err) {
      setResult({ kind: 'error', text: api.friendlyError(err) });
      return false;
    } finally {
      setBusy('');
    }
  };

  const remove = (name) => {
    if (!window.confirm(`Remove ${name} from the league? Their picks are kept, but they disappear from Standings and Stats and can't pick until you add them back.`)) return;
    run(`rm-${name}`, () => api.adminRemoveMember(token, leagueId, name), `${name} was removed.`);
  };
  const addBack = (name) =>
    run(`add-${name}`, () => api.adminAddMember(token, leagueId, name), `${name} was added back with their picks.`);

  const setNewPin = async (name) => {
    if (!isValidPin(pin)) { setResult({ kind: 'error', text: 'The PIN must be exactly 4 digits.' }); return; }
    if (!window.confirm(`Set ${name}'s PIN to ${pin}? They will be signed out everywhere.`)) return;
    const used = pin;
    const ok = await run(`pin-${name}`, () => api.adminResetPin(token, leagueId, name, used));
    if (ok) {
      setResult({ kind: 'pin', text: `${name}'s PIN is now ${used}. They were signed out everywhere. Send it to them privately; it is not shown again.` });
      setPinFor(null);
      setPin('');
    }
  };

  const members = (rows || []).filter((r) => r.status === 'member');
  const removed = (rows || []).filter((r) => r.status === 'removed');

  return (
    <div>
      {error && <div role="alert" className="mb-4 text-xs p-3 rounded-lg border text-red-600 bg-red-50 border-red-200">{error}</div>}
      {result && (
        <div role="status" data-testid="members-result"
          className={`mb-4 text-xs p-3 rounded-lg border flex items-start justify-between gap-3 ${
            result.kind === 'error' ? 'text-red-600 bg-red-50 border-red-200' : 'text-emerald-800 bg-emerald-50 border-emerald-200'}`}>
          <span>{result.text}</span>
          {result.kind === 'pin' && (
            <button type="button" onClick={() => setResult(null)} className="font-semibold underline shrink-0">Dismiss</button>
          )}
        </div>
      )}

      <h3 className="font-display text-lg font-semibold text-ink mb-3">Members{rows ? ` (${members.length})` : ''}</h3>
      {!rows ? (
        !error && <div className="text-sm text-muted py-6 text-center">Loading members…</div>
      ) : (
        <div className="rounded-card border border-line bg-white divide-y divide-line shadow-sm mb-6">
          {members.map((m) => (
            <div key={m.user_name} className="p-3" data-testid={`member-${m.user_name}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-medium text-ink">{m.user_name}</span>
                  {m.is_admin && <span className="ml-2 text-[11px] font-semibold text-crimson">Admin</span>}
                  <div className="text-[11px] text-muted">{m.weeks_with_picks} week{m.weeks_with_picks === 1 ? '' : 's'} with picks</div>
                </div>
                {!m.is_admin && (
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => { setPinFor(pinFor === m.user_name ? null : m.user_name); setPin(''); setResult(null); }}
                      className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink hover:border-ink/30">
                      Reset PIN
                    </button>
                    <button type="button" onClick={() => remove(m.user_name)} disabled={Boolean(busy)}
                      className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-red-600 hover:border-red-300 disabled:opacity-40">
                      Remove
                    </button>
                  </div>
                )}
              </div>
              {pinFor === m.user_name && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    inputMode="numeric" autoComplete="off" maxLength={4} placeholder="4 digits" aria-label={`New PIN for ${m.user_name}`}
                    className="w-24 border border-line rounded-lg px-3 py-2 text-sm text-ink bg-white tracking-widest" />
                  <button type="button" onClick={() => setPin(randomPin())}
                    className="px-3 py-2 rounded-lg border border-line text-xs font-semibold text-ink">Generate</button>
                  <button type="button" onClick={() => setNewPin(m.user_name)} disabled={!isValidPin(pin) || Boolean(busy)}
                    className="px-3 py-2 rounded-lg bg-crimson text-white text-xs font-semibold disabled:opacity-40">
                    Set PIN
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {removed.length > 0 && (
        <>
          <h3 className="font-display text-lg font-semibold text-ink mb-3">Removed ({removed.length})</h3>
          <div className="rounded-card border border-line bg-white divide-y divide-line shadow-sm mb-6">
            {removed.map((m) => (
              <div key={m.user_name} className="p-3 flex items-center justify-between gap-3">
                <div>
                  <span className="font-medium text-ink">{m.user_name}</span>
                  <div className="text-[11px] text-muted">{m.weeks_with_picks} week{m.weeks_with_picks === 1 ? '' : 's'} of picks kept</div>
                </div>
                <button type="button" onClick={() => addBack(m.user_name)} disabled={Boolean(busy)}
                  className="px-3 py-1.5 rounded-lg border border-line text-xs font-semibold text-ink hover:border-ink/30 disabled:opacity-40">
                  Add back
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="font-display text-lg font-semibold text-ink mb-3">Add a member</h3>
      <div className="rounded-card border border-line bg-white p-4 shadow-sm">
        {candidates.length === 0 ? (
          <p className="text-sm text-muted">Everyone with an account is already in the league.</p>
        ) : (
          <div className="flex items-end gap-3">
            <label className="flex-1 text-xs font-semibold text-muted uppercase tracking-wide">
              Person
              <select value={toAdd} onChange={(e) => setToAdd(e.target.value)} className={inputCls}>
                <option value="">Choose…</option>
                {candidates.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <button type="button" disabled={!toAdd || Boolean(busy)}
              onClick={() => run(`add-${toAdd}`, () => api.adminAddMember(token, leagueId, toAdd), `${toAdd} was added.`)}
              className="px-4 py-2 rounded-lg bg-crimson text-white text-sm font-semibold disabled:opacity-40">
              Add
            </button>
          </div>
        )}
        <p className="text-xs text-muted mt-3">They need an account first (they can sign up on the login screen).</p>
      </div>
    </div>
  );
}
