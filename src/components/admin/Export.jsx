import { useState } from 'react';
import * as api from '../../services/api';
import { buildPicksCsv, buildStandingsCsv, downloadCsv, slug } from '../../utils/adminTools';
import { SEASON_YEAR } from '../../utils/getCurrentWeek';

// Download the league's data as spreadsheets. Reads every pick (not hidden
// ones), so it works the same before and after kickoff.

export default function Export({ token, leagueId, leagueName, gamesByWeek, members }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  const go = async (kind) => {
    setBusy(kind);
    setMsg(null);
    try {
      const rows = (await api.adminSeasonPicks(token, leagueId)) || [];
      const base = `${slug(leagueName)}-${kind}-${SEASON_YEAR}`;
      const text = kind === 'picks'
        ? buildPicksCsv(rows, gamesByWeek, members)
        : buildStandingsCsv(rows, gamesByWeek, members);
      downloadCsv(`${base}.csv`, text);
      setMsg({ kind: 'ok', text: `Downloaded ${base}.csv` });
    } catch (err) {
      setMsg({ kind: 'error', text: api.friendlyError(err) });
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="rounded-card border border-line bg-white p-4 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-ink">Export</h2>
      <p className="text-xs text-muted mt-1 mb-4">
        Spreadsheets you can open in Excel or Google Sheets. Results and points are graded with the same rules as the Standings tab.
        Only games already loaded on the Games tab are graded, so open any missing weeks first.
      </p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={() => go('picks')} disabled={Boolean(busy)}
          className="px-4 py-2.5 rounded-lg bg-crimson text-white text-sm font-semibold disabled:opacity-40">
          {busy === 'picks' ? 'Preparing…' : 'Season picks (CSV)'}
        </button>
        <button type="button" onClick={() => go('standings')} disabled={Boolean(busy)}
          className="px-4 py-2.5 rounded-lg border border-line text-ink text-sm font-semibold disabled:opacity-40">
          {busy === 'standings' ? 'Preparing…' : 'Standings (CSV)'}
        </button>
      </div>
      {msg && (
        <div role="status" className={`mt-4 text-xs p-3 rounded-lg border ${
          msg.kind === 'ok' ? 'text-emerald-800 bg-emerald-50 border-emerald-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
