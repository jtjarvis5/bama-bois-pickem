import { Section, Panel, ArrowIcon, COLORS } from './ui';
import { decided, formatPct, formatRecord, winRate } from '../../utils/insights';

/**
 * Locks are the only strategic choice in the game: one spread pick and one
 * total pick per week that pay extra when they hit. This shows who picks their
 * locks well -- hit rate on locks vs. on the rest of their picks.
 */
export default function LockTable({ order, summaries, focus }) {
  const rows = order
    .map((m) => ({ m, s: summaries[m] }))
    .filter(({ s }) => s.lock.wins + s.lock.losses + s.lock.pushes > 0)
    .sort((a, b) => b.s.lockBonusPoints - a.s.lockBonusPoints
      || (winRate(b.s.lock) ?? -1) - (winRate(a.s.lock) ?? -1)
      || a.m.localeCompare(b.m));

  if (!rows.length) return null;

  return (
    <Section
      title="Locks"
      hint="A correct lock pays bonus points. “Vs. other picks” compares a member's lock hit rate with the rest of their picks."
    >
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <caption className="sr-only">Lock results by member</caption>
            <thead>
              <tr className="text-xs text-muted border-b border-line">
                <th scope="col" className="p-3 font-semibold">Member</th>
                <th scope="col" className="p-3 font-semibold text-right">Locks</th>
                <th scope="col" className="p-3 font-semibold text-right">Hit rate</th>
                <th scope="col" className="p-3 font-semibold text-right">Vs. other picks</th>
                <th scope="col" className="p-3 font-semibold text-right">Bonus points</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, s }) => {
                const lockRate = winRate(s.lock);
                const otherRate = winRate(s.nonLock);
                const diff = lockRate != null && otherRate != null ? Math.round((lockRate - otherRate) * 100) : null;
                return (
                  <tr key={m} className="border-b border-line last:border-0">
                    <th scope="row" className={`p-3 text-left ${m === focus ? 'font-semibold' : 'font-medium'} text-ink`}>{m}</th>
                    <td className="p-3 text-right text-ink">{formatRecord(s.lock)}</td>
                    <td className="p-3 text-right text-ink">{formatPct(lockRate)}</td>
                    <td className="p-3 text-right">
                      {diff == null || decided(s.lock) === 0 ? (
                        <span className="text-muted">—</span>
                      ) : diff === 0 ? (
                        <span className="text-muted">Same</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium" style={{ color: diff > 0 ? COLORS.good : COLORS.bad }}>
                          <ArrowIcon up={diff > 0} className="w-2.5 h-2.5" />
                          {diff > 0 ? '+' : '−'}{Math.abs(diff)} pts
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right font-display font-semibold text-ink">{s.lockBonusPoints ? `+${s.lockBonusPoints}` : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </Section>
  );
}
