import { COLORS, Section, Panel } from './ui';
import { decided, formatPct, formatRecord, winRate } from '../../utils/insights';

const SMALL_SAMPLE = 4;

function Diamond({ color }) {
  return <span className="inline-block w-2.5 h-2.5 rotate-45 shrink-0" style={{ background: color }} aria-hidden="true" />;
}
function Dot({ color }) {
  return <span className="inline-block w-3 h-3 rounded-full shrink-0" style={{ background: color }} aria-hidden="true" />;
}

/**
 * Spread vs. totals win rate for each member on one shared scale, with the
 * 50% break-even line marked. A circle is the spread rate, a diamond is the
 * totals rate; the gap between them shows which one a member is better at.
 */
export default function SkillSplit({ order, summaries, focus }) {
  const rows = order
    .map((m) => {
      const s = summaries[m];
      const sr = winRate(s.spread);
      const tr = winRate(s.total);
      const allWins = s.spread.wins + s.total.wins;
      const allDecided = decided(s.spread) + decided(s.total);
      return { m, s, sr, tr, combined: allDecided ? allWins / allDecided : -1 };
    })
    .filter((r) => r.sr != null || r.tr != null)
    .sort((a, b) => b.combined - a.combined || a.m.localeCompare(b.m));

  if (!rows.length) return null;

  const rates = rows.flatMap((r) => [r.sr, r.tr]).filter((v) => v != null).map((v) => v * 100);
  const lo = Math.min(30, Math.floor((Math.min(...rates) - 5) / 10) * 10);
  const hi = Math.max(70, Math.ceil((Math.max(...rates) + 5) / 10) * 10);
  const pos = (rate) => ((rate * 100 - lo) / (hi - lo)) * 100;
  const axis = [];
  for (let t = lo; t <= hi; t += 10) axis.push(t);

  return (
    <Section
      title="Spread vs. totals"
      hint="Win rate on each kind of pick. Past the 50% line you are beating the odds."
    >
      <Panel className="p-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-4 text-xs text-ink">
          <span className="inline-flex items-center gap-1.5"><Dot color={COLORS.spread} />Spread picks</span>
          <span className="inline-flex items-center gap-1.5"><Diamond color={COLORS.total} />Over/under picks</span>
          <span className="inline-flex items-center gap-1.5 text-muted"><span className="w-px h-3 bg-ink/50" aria-hidden="true" />50% is break-even</span>
        </div>

        <div className="grid grid-cols-[5.5rem_1fr] gap-x-3 sm:grid-cols-[7rem_1fr]">
          <div />
          <div className="relative h-4 mb-1 text-[11px] text-muted" aria-hidden="true">
            {axis.map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${((t - lo) / (hi - lo)) * 100}%` }}>{t}%</span>
            ))}
          </div>

          {rows.map(({ m, s, sr, tr }) => {
            const points = [sr, tr].filter((v) => v != null).map(pos);
            const left = Math.min(...points);
            const right = Math.max(...points);
            const faded = (v, rec) => (v != null && decided(rec) < SMALL_SAMPLE ? 0.45 : 1);
            return (
              <div key={m} className="contents">
                <div className={`py-2.5 text-sm truncate ${m === focus ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>{m}</div>
                <div className="py-1.5">
                  <div className="relative h-6">
                    {axis.map((t) => (
                      <span key={t} className="absolute top-0 bottom-0 w-px bg-line" style={{ left: `${((t - lo) / (hi - lo)) * 100}%` }} aria-hidden="true" />
                    ))}
                    <span className="absolute top-0 bottom-0 w-px bg-ink/50" style={{ left: `${pos(0.5)}%` }} aria-hidden="true" />
                    {points.length === 2 && (
                      <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-[#C9C5BE]" style={{ left: `${left}%`, width: `${right - left}%` }} aria-hidden="true" />
                    )}
                    {tr != null && (
                      <span
                        className="absolute top-1/2 w-3 h-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white box-content"
                        style={{ left: `${pos(tr)}%`, background: COLORS.total, opacity: faded(tr, s.total) }}
                        title={`${m}: ${formatPct(tr)} on over/unders (${formatRecord(s.total)})`}
                      />
                    )}
                    {sr != null && (
                      <span
                        className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white box-content"
                        style={{ left: `${pos(sr)}%`, background: COLORS.spread, opacity: faded(sr, s.spread) }}
                        title={`${m}: ${formatPct(sr)} on spread picks (${formatRecord(s.spread)})`}
                      />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-[11px] text-muted mt-0.5">
                    <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: COLORS.spread }} aria-hidden="true" />Spread {formatRecord(s.spread)} &middot; {formatPct(sr)}</span>
                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rotate-45" style={{ background: COLORS.total }} aria-hidden="true" />Totals {formatRecord(s.total)} &middot; {formatPct(tr)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-3">Faded markers are based on fewer than {SMALL_SAMPLE} decided picks.</p>
      </Panel>
    </Section>
  );
}
