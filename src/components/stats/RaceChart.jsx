import { useState } from 'react';
import { COLORS, Section, Panel, Segmented, LineKey, ScrollX, niceTicks } from './ui';

const H = 240;
const PAD = { top: 16, right: 92, bottom: 28, left: 34 };
// Up to this many SVG units wide the chart simply scales down to fit a phone;
// beyond it (a long season) it keeps its size and scrolls instead of shrinking text.
const FIT_WIDTH = 520;
const short = (name) => (name.length > 10 ? `${name.slice(0, 9)}…` : name);

/**
 * Cumulative points by week. Instead of one colour per member (eight tangled
 * lines), it uses emphasis: the member being looked at in crimson, the current
 * leader in ink, everyone else in quiet grey. Hover or arrow-keys read out
 * every member for a week; "Table" shows the same numbers as plain text.
 */
export default function RaceChart({ weeks, series, order, focus }) {
  const [view, setView] = useState('chart');
  const [hover, setHover] = useState(null);

  const finalOf = (m) => { const pts = series[m] || []; return pts.length ? pts[pts.length - 1].cumulative : 0; };
  const ranked = [...order].sort((a, b) => finalOf(b) - finalOf(a));
  const leader = ranked[0];
  const focusIsLeader = focus === leader;
  const hasFocus = Boolean(focus) && order.includes(focus);

  const width = Math.max(320, weeks.length * 46 + PAD.left + PAD.right);
  const fits = width <= FIT_WIDTH;
  const innerW = width - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const maxVal = Math.max(1, ...order.map(finalOf));
  const ticks = niceTicks(maxVal);
  const top = ticks[ticks.length - 1];
  const xFor = (i) => PAD.left + (weeks.length === 1 ? innerW / 2 : (i / (weeks.length - 1)) * innerW);
  const yFor = (v) => PAD.top + innerH - (v / top) * innerH;
  const colW = weeks.length === 1 ? innerW : innerW / (weeks.length - 1);

  const pathFor = (m) => (series[m] || []).map((pt, i) => `${xFor(i)},${yFor(pt.cumulative)}`).join(' ');
  const styleFor = (m) => {
    if (hasFocus && m === focus) return { color: COLORS.focus, w: 3.25 };
    if (m === leader) return { color: COLORS.leader, w: 2.25 };
    return { color: COLORS.quiet, w: 1.5 };
  };
  const drawOrder = [
    ...order.filter((m) => m !== leader && m !== focus),
    ...(leader && leader !== focus ? [leader] : []),
    ...(hasFocus ? [focus] : []),
  ];

  const labelled = [];
  if (hasFocus) labelled.push(focus);
  if (leader && !focusIsLeader) {
    const gapPx = hasFocus ? Math.abs(yFor(finalOf(leader)) - yFor(finalOf(focus))) : Infinity;
    if (gapPx >= 15) labelled.push(leader); // close ends would overlap: the legend + hover name the leader instead
  }

  const move = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((px - PAD.left) / Math.max(1, innerW)) * (weeks.length - 1));
    setHover(weeks.length === 1 ? 0 : Math.min(weeks.length - 1, Math.max(0, idx)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setHover((h) => {
        const cur = h == null ? weeks.length - 1 : h;
        return Math.min(weeks.length - 1, Math.max(0, cur + (e.key === 'ArrowRight' ? 1 : -1)));
      });
    } else if (e.key === 'Escape') setHover(null);
  };

  const readout = hover == null ? [] : [...order]
    .map((m) => ({ m, pt: (series[m] || [])[hover] }))
    .filter((r) => r.pt)
    .sort((a, b) => b.pt.cumulative - a.pt.cumulative);

  return (
    <Section
      title="The race"
      hint={hasFocus ? 'Total points after each graded week. Change who is highlighted with the member menu at the top.' : 'Total points after each graded week.'}
      action={<Segmented label="Chart or table" value={view} onChange={setView} options={[['chart', 'Chart'], ['table', 'Table']]} />}
    >
      <Panel className="p-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mb-3 text-xs text-ink">
          {hasFocus && (
            <span className="inline-flex items-center gap-1.5"><LineKey color={COLORS.focus} width={3.25} />{focus}{focusIsLeader ? ' (leading)' : ''}</span>
          )}
          {!focusIsLeader && leader && (
            <span className="inline-flex items-center gap-1.5"><LineKey color={COLORS.leader} width={2.25} />{leader} (leading)</span>
          )}
          <span className="inline-flex items-center gap-1.5"><LineKey color={COLORS.quiet} width={1.5} />Everyone else</span>
        </div>

        {view === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <caption className="sr-only">Total points by member after each graded week</caption>
              <thead>
                <tr className="text-xs text-muted border-b border-line">
                  <th scope="col" className="py-2 pr-3 font-semibold">Member</th>
                  {weeks.map((w) => <th key={w} scope="col" className="py-2 px-2 font-semibold text-right">Week {w}</th>)}
                </tr>
              </thead>
              <tbody>
                {ranked.map((m) => (
                  <tr key={m} className="border-b border-line last:border-0">
                    <th scope="row" className={`py-2 pr-3 text-left ${m === focus ? 'font-semibold text-ink' : 'font-medium text-ink'}`}>{m}</th>
                    {(series[m] || []).map((pt) => (
                      <td key={pt.week} className="py-2 px-2 text-right">
                        {pt.cumulative}
                        <span className="text-xs text-muted ml-1">+{pt.weekPoints}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ScrollX endKey={weeks.length}>
            <div className="relative" style={fits ? undefined : { minWidth: width }}>
              <svg
                viewBox={`0 0 ${width} ${H}`}
                className="w-full h-auto block touch-pan-y"
                role="img"
                tabIndex={0}
                aria-label={`Line chart of total points by week. ${leader ? `${leader} leads with ${finalOf(leader)}.` : ''} Use the left and right arrow keys to read each week, or switch to the table view.`}
                onKeyDown={onKey}
                onFocus={() => setHover((h) => (h == null ? weeks.length - 1 : h))}
                onBlur={() => setHover(null)}
                onPointerMove={move}
                onPointerLeave={() => setHover(null)}
              >
                {ticks.map((t) => (
                  <g key={t}>
                    <line x1={PAD.left} x2={width - PAD.right} y1={yFor(t)} y2={yFor(t)} stroke={COLORS.grid} strokeWidth="1" />
                    <text x={PAD.left - 8} y={yFor(t) + 3.5} fontSize="11" textAnchor="end" fill={COLORS.axis}>{t}</text>
                  </g>
                ))}
                {weeks.map((w, i) => (
                  <text key={w} x={xFor(i)} y={H - 8} fontSize="11" textAnchor="middle" fill={COLORS.axis}>W{w}</text>
                ))}

                {hover != null && (
                  <line x1={xFor(hover)} x2={xFor(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke={COLORS.axis} strokeWidth="1" />
                )}

                {drawOrder.map((m) => {
                  const st = styleFor(m);
                  const pts = series[m] || [];
                  if (!pts.length) return null;
                  const last = pts[pts.length - 1];
                  const emphasised = m === focus || m === leader;
                  return (
                    <g key={m}>
                      <polyline points={pathFor(m)} fill="none" stroke={st.color} strokeWidth={st.w} strokeLinejoin="round" strokeLinecap="round" />
                      {emphasised && (
                        <circle cx={xFor(pts.length - 1)} cy={yFor(last.cumulative)} r="4.5" fill={st.color} stroke="#fff" strokeWidth="2" />
                      )}
                      {hover != null && pts[hover] && (
                        <circle cx={xFor(hover)} cy={yFor(pts[hover].cumulative)} r={emphasised ? 4.5 : 3.5} fill={st.color} stroke="#fff" strokeWidth="2" />
                      )}
                    </g>
                  );
                })}

                {labelled.map((m) => {
                  const pts = series[m] || [];
                  if (!pts.length) return null;
                  return (
                    <text key={m} x={xFor(pts.length - 1) + 11} y={yFor(finalOf(m)) + 4} fontSize="12" fontWeight="600" fill={COLORS.leader}>
                      {short(m)} {finalOf(m)}
                    </text>
                  );
                })}
              </svg>

              {hover != null && (
                <div
                  className="pointer-events-none absolute top-2 z-10 min-w-[9.5rem] rounded-lg border border-line bg-white px-3 py-2 shadow-md"
                  style={{
                    left: `${(xFor(hover) / width) * 100}%`,
                    transform: hover > (weeks.length - 1) / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)',
                  }}
                >
                  <div className="text-xs text-muted mb-1">After week {weeks[hover]}</div>
                  {readout.map(({ m, pt }) => (
                    <div key={m} className="flex items-center gap-2 text-xs leading-5">
                      <LineKey color={styleFor(m).color} width={styleFor(m).w > 2 ? 3 : 2} />
                      <span className={`flex-1 truncate ${m === focus ? 'font-semibold text-ink' : 'text-muted'}`}>{m}</span>
                      <span className="font-semibold text-ink">{pt.cumulative}</span>
                      <span className="text-muted w-7 text-right">+{pt.weekPoints}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollX>
        )}
      </Panel>
    </Section>
  );
}
