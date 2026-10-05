import { Section, Panel } from './ui';
import { formatPct, formatRecord } from '../../utils/insights';

function Meter({ value }) {
  return (
    <span className="block h-1.5 w-full max-w-[4.5rem] rounded-full bg-crimson/10 ml-auto mt-1" aria-hidden="true">
      <span className="block h-full rounded-full bg-crimson" style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
  );
}

function ShareCell({ part, whole, extra = null }) {
  if (!whole) return <td className="p-3 text-right text-muted">—</td>;
  const share = part / whole;
  return (
    <td className="p-3 text-right">
      <span className="font-semibold text-ink">{formatPct(share)}</span>
      <span className="block text-[11px] text-muted whitespace-nowrap">{part} of {whole}</span>
      <Meter value={share} />
      {extra && <span className="block text-[11px] text-muted whitespace-nowrap mt-1">{extra}</span>}
    </td>
  );
}

/**
 * How each member tends to pick, not how well: underdogs vs. favourites,
 * overs vs. unders, and how often they side with the majority. Descriptive --
 * no column here is "better" than another.
 */
export default function StyleTable({ order, summaries, focus }) {
  const rows = order.map((m) => ({ m, s: summaries[m] })).filter(({ s }) =>
    s.dog.wins + s.dog.losses + s.dog.pushes + s.fav.wins + s.fav.losses + s.fav.pushes + s.overs + s.unders > 0);
  if (!rows.length) return null;

  const total = (r) => r.wins + r.losses + r.pushes;

  return (
    <Section
      title="Pick style"
      hint="How each member tends to pick: the share of spread picks on the underdog, of totals on the over, and of picks that matched the league's majority. The line under the crowd share is their record when they went against it. A game needs three pickers to have a majority.">
      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <caption className="sr-only">Pick tendencies by member</caption>
            <thead>
              <tr className="text-xs text-muted border-b border-line">
                <th scope="col" className="p-3 font-semibold">Member</th>
                <th scope="col" className="p-3 font-semibold text-right whitespace-nowrap">Underdogs</th>
                <th scope="col" className="p-3 font-semibold text-right whitespace-nowrap">Overs</th>
                <th scope="col" className="p-3 font-semibold text-right whitespace-nowrap">With the crowd</th>
                </tr>
            </thead>
            <tbody>
              {rows.map(({ m, s }) => {
                const dogs = total(s.dog);
                const favs = total(s.fav);
                const withN = total(s.withCrowd);
                const againstN = total(s.againstCrowd);
                return (
                  <tr key={m} className="border-b border-line last:border-0 align-top">
                    <th scope="row" className={`p-3 text-left ${m === focus ? 'font-semibold' : 'font-medium'} text-ink`}>{m}</th>
                    <ShareCell part={dogs} whole={dogs + favs} />
                    <ShareCell part={s.overs} whole={s.overs + s.unders} />
                    <ShareCell
                      part={withN}
                      whole={withN + againstN}
                      extra={againstN ? `Against: ${formatRecord(s.againstCrowd)}` : null}
                    />
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
