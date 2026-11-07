import { useMemo } from 'react';
import { isInPlay, liveWeekPoints } from '../utils/live';

// "If it ended right now": this week's points with games in progress counted as
// they stand. Appears only while something is being played.
export default function LiveStandings({ games, entries, members, currentUser }) {
  const rows = useMemo(() => liveWeekPoints(entries, games, members), [entries, games, members]);
  const inPlay = games.filter(isInPlay).length;
  if (inPlay === 0 || rows.length === 0) return null;

  return (
    <div className="rounded-card border border-line bg-white shadow-sm mb-6 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-paper/30">
        <h2 className="font-display text-base font-semibold text-ink flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          Live this week
        </h2>
        <span className="text-xs text-muted">{inPlay} game{inPlay === 1 ? '' : 's'} in play</span>
      </div>
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="text-xs text-muted border-b border-line">
            <th className="px-4 py-2 font-semibold">Member</th>
            <th className="px-2 py-2 font-semibold text-right">Final</th>
            <th className="px-2 py-2 font-semibold text-right">Live</th>
            <th className="px-2 py-2 font-semibold text-right hidden sm:table-cell">Covering</th>
            <th className="px-4 py-2 font-semibold text-right">If it ended now</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userName} className={`border-b border-line last:border-0 ${r.userName === currentUser ? 'bg-paper/40' : ''}`}>
              <td className="px-4 py-2 font-medium">{r.userName}</td>
              <td className="px-2 py-2 text-right text-muted">{r.final}</td>
              <td className="px-2 py-2 text-right text-emerald-700">{r.live > 0 ? `+${r.live}` : '—'}</td>
              <td className="px-2 py-2 text-right text-muted hidden sm:table-cell">{r.covering}–{r.behind}</td>
              <td className="px-4 py-2 text-right font-display font-bold text-ink">{r.final + r.live}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-2 text-[11px] text-muted">
        Counts picks as they stand right now (lock bonuses included). Official points update when games finish.
      </p>
    </div>
  );
}
