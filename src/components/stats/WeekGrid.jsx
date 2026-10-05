import { HEAT, Section, Panel, StarIcon, ScrollX, plural } from './ui';

// 0 points is its own quiet neutral; anything above spreads across the ramp.
function bucketFor(points, max) {
  if (points <= 0) return null;
  const idx = Math.ceil((points / Math.max(1, max)) * HEAT.length) - 1;
  return HEAT[Math.min(HEAT.length - 1, Math.max(0, idx))];
}

/** Points per member per week: who is consistent, who is streaky, who won each week. */
export default function WeekGrid({ grid, order, focus, totals }) {
  const { weeks, points, winners, weeksWon, maxPoints } = grid;
  if (!weeks.length) return null;

  return (
    <Section
      title="Week by week"
      hint="Points earned each week. Darker means more. A star marks the week's winner."
    >
      <Panel className="p-4">
        <ScrollX endKey={weeks.length}>
          <table className="border-separate border-spacing-[2px] text-xs">
            <caption className="sr-only">Points earned by each member in each graded week, with weeks won</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="sticky left-0 z-10 bg-white text-left font-semibold pr-3 py-1 min-w-[5.5rem]">Member</th>
                {weeks.map(({ week, complete }) => (
                  <th key={week} scope="col" className="font-semibold w-11 min-w-[2.75rem] py-1 text-center">
                    W{week}
                    {!complete && <span className="block text-[10px] font-normal text-muted/80">live</span>}
                  </th>
                ))}
                <th scope="col" className="font-semibold text-center px-2 py-1">Total</th>
                <th scope="col" className="font-semibold text-center px-2 py-1">Weeks won</th>
              </tr>
            </thead>
            <tbody>
              {order.map((m) => (
                <tr key={m}>
                  <th
                    scope="row"
                    className={`sticky left-0 z-10 bg-white text-left pr-3 py-0.5 text-sm whitespace-nowrap ${m === focus ? 'font-semibold text-ink' : 'font-medium text-ink'}`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${m === focus ? 'bg-crimson' : 'bg-transparent'}`} aria-hidden="true" />
                      {m}
                    </span>
                  </th>
                  {weeks.map(({ week, complete }) => {
                    const pts = points[m][week];
                    const bucket = bucketFor(pts, maxPoints);
                    const won = winners[week].includes(m);
                    const label = `${m}, week ${week}: ${plural(pts, 'point')}${won ? (complete ? ', won the week' : ', leading this week') : ''}`;
                    return (
                      <td key={week} className="p-0">
                        <div
                          role="img"
                          title={label}
                          aria-label={label}
                          className="relative h-9 grid place-items-center rounded-[4px] text-sm font-semibold"
                          style={bucket ? { background: bucket.bg, color: bucket.fg } : { background: '#F1EFEC', color: '#6B6F76', fontWeight: 500 }}
                        >
                          {pts}
                          {won && (
                            <StarIcon
                              filled={complete}
                              className="absolute top-0.5 right-0.5 w-2.5 h-2.5"
                            />
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="text-center font-display font-bold text-sm text-ink px-2">{totals[m] ?? 0}</td>
                  <td className="text-center text-sm text-ink px-2">{weeksWon[m] || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-2">
            Fewer points
            <span className="inline-flex gap-0.5" aria-hidden="true">
              {HEAT.map((h) => <span key={h.bg} className="w-4 h-3 rounded-[2px]" style={{ background: h.bg }} />)}
            </span>
            More
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StarIcon className="w-3 h-3 text-ink" /> Won the week
          </span>
          <span className="inline-flex items-center gap-1.5">
            <StarIcon filled={false} className="w-3 h-3 text-ink" /> Leading a week still in progress
          </span>
        </div>
      </Panel>
    </Section>
  );
}
