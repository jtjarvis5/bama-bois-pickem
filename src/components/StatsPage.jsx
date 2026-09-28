import { useState } from 'react';
import {
  buildWeeklySeries,
  buildSplitRecords,
  buildWeeklyChalk,
  findBiggestUpset,
  rankWeekPerformance,
} from '../utils/analytics';
import { isGameLocked } from '../utils/getCurrentWeek';

const CHART_COLORS = ['#9E1B32', '#2563eb', '#059669', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#4b5563'];

function SeasonChart({ weeks, series, members, currentUser }) {
  const width = Math.max(300, weeks.length * 52);
  const height = 220;
  const pad = { top: 14, right: 18, bottom: 26, left: 30 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxVal = Math.max(
    1,
    ...members.flatMap((m) => (series[m] || []).map((pt) => pt.cumulative))
  );

  const xFor = (i) => pad.left + (weeks.length === 1 ? innerW / 2 : (i / (weeks.length - 1)) * innerW);
  const yFor = (val) => pad.top + innerH - (val / maxVal) * innerH;
  const ticks = [0, 0.5, 1].map((f) => Math.round(maxVal * f));

  return (
    <div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ minWidth: width }} className="w-full h-auto block">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={yFor(t)} y2={yFor(t)} stroke="#E7E5E2" strokeWidth="1" />
              <text x={pad.left - 6} y={yFor(t) + 3} fontSize="10" textAnchor="end" fill="#6B6F76">{t}</text>
            </g>
          ))}
          {weeks.map((w, i) => (
            <text key={w} x={xFor(i)} y={height - 8} fontSize="10" textAnchor="middle" fill="#6B6F76">W{w}</text>
          ))}
          {members.map((member, idx) => {
            const pts = series[member] || [];
            if (!pts.length) return null;
            const color = CHART_COLORS[idx % CHART_COLORS.length];
            const isMe = member === currentUser;
            return (
              <g key={member} opacity={isMe ? 1 : 0.7}>
                <polyline
                  points={pts.map((pt, i) => `${xFor(i)},${yFor(pt.cumulative)}`).join(' ')}
                  fill="none"
                  stroke={color}
                  strokeWidth={isMe ? 3 : 1.75}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {pts.map((pt, i) => (
                  <circle key={pt.week} cx={xFor(i)} cy={yFor(pt.cumulative)} r={isMe ? 3.5 : 2.5} fill={color} />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {members.map((member, idx) => {
          const pts = series[member] || [];
          const total = pts.length ? pts[pts.length - 1].cumulative : 0;
          return (
            <div key={member} className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }} />
              <span className={member === currentUser ? 'font-semibold text-ink' : 'text-muted'}>{member}</span>
              <span className="text-muted">{total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fmtRecord = (r) => `${r.wins}-${r.losses}${r.pushes ? `-${r.pushes}` : ''}`;
const fmtPct = (r) => (r.wins + r.losses > 0 ? `${Math.round((r.wins / (r.wins + r.losses)) * 100)}%` : '—');

function Card({ title, subtitle, children }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {subtitle && <p className="text-xs text-muted mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      <div className="rounded-card border border-line bg-white p-4 shadow-sm">{children}</div>
    </section>
  );
}

function ChalkBar({ leftLabel, leftPct, rightLabel, rightPct, winner }) {
  // winner: 'left' | 'right' | null. The winning side is filled crimson once graded.
  const leftWon = winner === 'left';
  const rightWon = winner === 'right';
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-line">
        <div style={{ width: `${leftPct}%` }} className={leftWon ? 'bg-crimson' : winner ? 'bg-muted/40' : 'bg-crimson/70'} />
        <div style={{ width: `${rightPct}%` }} className={rightWon ? 'bg-crimson' : winner ? 'bg-muted/40' : 'bg-muted/50'} />
      </div>
      <div className="flex justify-between text-[11px] mt-1">
        <span className={leftWon ? 'font-semibold text-crimson' : 'text-muted'}>{leftLabel} {leftPct}%</span>
        <span className={rightWon ? 'font-semibold text-crimson' : 'text-muted'}>{rightPct}% {rightLabel}</span>
      </div>
    </div>
  );
}

export default function StatsPage({ seasonPicks = [], gamesByWeek = {}, allMembers = [], currentUser }) {
  const [statsWeek, setStatsWeek] = useState(null);

  const { weeks, series } = buildWeeklySeries(seasonPicks, gamesByWeek, allMembers);

  if (weeks.length === 0) {
    return (
      <div className="rounded-card border border-line bg-white p-8 text-center text-sm text-muted">
        Stats show up once games have been graded. Check back after the first games finish.
      </div>
    );
  }

  const splitRecords = buildSplitRecords(seasonPicks, gamesByWeek, allMembers);

  const latestWeek = weeks[weeks.length - 1];
  const activeWeek = weeks.includes(statsWeek) ? statsWeek : latestWeek;
  const weekGames = gamesByWeek[activeWeek] || [];
  const weekPicks = seasonPicks.filter((p) => Number(p.week) === Number(activeWeek));

  const ranking = rankWeekPerformance(weekPicks, weekGames, allMembers);
  const topPts = ranking.length ? ranking[0].points : 0;
  const lowPts = ranking.length ? ranking[ranking.length - 1].points : 0;
  const bestNames = ranking.filter((r) => r.points === topPts).map((r) => r.userName);
  const worstNames = ranking.filter((r) => r.points === lowPts).map((r) => r.userName);
  const showBestWorst = topPts > 0 && topPts !== lowPts;

  const chalk = buildWeeklyChalk(weekPicks, weekGames);
  const upset = findBiggestUpset(chalk);

  return (
    <div>
      <Card title="Season trend" subtitle="Cumulative points after each graded week.">
        <SeasonChart weeks={weeks} series={series} members={allMembers} currentUser={currentUser} />
      </Card>

      <Card title="Spread vs. totals" subtitle="Season standings blends these into one number. Here they're separate.">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="text-xs text-muted border-b border-line">
                <th className="py-2 px-1 font-semibold">Member</th>
                <th className="py-2 px-1 font-semibold text-center">Spread</th>
                <th className="py-2 px-1 font-semibold text-center">Total</th>
              </tr>
            </thead>
            <tbody>
              {allMembers.map((m) => {
                const rec = splitRecords[m];
                if (!rec) return null;
                return (
                  <tr key={m} className="border-b border-line last:border-0">
                    <td className={`py-2.5 px-1 ${m === currentUser ? 'font-semibold text-ink' : 'text-ink'}`}>{m}</td>
                    <td className="py-2.5 px-1 text-center">
                      <span className="font-medium">{fmtRecord(rec.ats)}</span>
                      <span className="text-xs text-muted ml-1.5">{fmtPct(rec.ats)}</span>
                    </td>
                    <td className="py-2.5 px-1 text-center">
                      <span className="font-medium">{fmtRecord(rec.total)}</span>
                      <span className="text-xs text-muted ml-1.5">{fmtPct(rec.total)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <section className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">Week in review</h2>
        <select
          value={activeWeek}
          onChange={(e) => setStatsWeek(Number(e.target.value))}
          className="bg-white border border-line rounded-full px-3 py-1.5 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-crimson/30"
        >
          {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
        </select>
      </section>

      {showBestWorst ? (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="rounded-card border border-line bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-muted mb-1">Best week</div>
            <div className="font-display text-base font-semibold text-crimson">{bestNames.join(', ')}</div>
            <div className="text-xs text-muted mt-0.5">{topPts} pts</div>
          </div>
          <div className="rounded-card border border-line bg-white p-4 shadow-sm">
            <div className="text-xs font-medium text-muted mb-1">Roughest week</div>
            <div className="font-display text-base font-semibold text-ink">{worstNames.join(', ')}</div>
            <div className="text-xs text-muted mt-0.5">{lowPts} pts</div>
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-line bg-white p-4 mb-6 text-sm text-muted shadow-sm">
          No separation yet this week: nobody has points, or everyone is tied.
        </div>
      )}

      {upset && (
        <div className="rounded-card border border-crimson/25 bg-crimson/5 p-4 mb-6">
          <div className="text-xs font-medium text-crimson mb-1">Biggest upset</div>
          <div className="text-sm text-ink">
            {upset.majorityWrongPct}% of the league took{' '}
            <span className="font-semibold">
              {upset.winningSpreadTeam === 'home' ? upset.awayTeam : upset.homeTeam}
            </span>
            , and{' '}
            <span className="font-semibold">
              {upset.winningSpreadTeam === 'home' ? upset.homeTeam : upset.awayTeam}
            </span>{' '}
            covered instead.
          </div>
        </div>
      )}

      <Card
        title="Where the league landed"
        subtitle="Pick splits appear once a game kicks off, so nothing is revealed early."
      >
        <div className="space-y-5">
          {chalk.map((g) => {
            const started = isGameLocked(g.startDate);
            const game = weekGames.find((x) => x.id === g.gameId);
            return (
              <div key={g.gameId}>
                <div className="text-sm font-medium text-ink mb-1.5">
                  {g.awayAbbr} @ {g.homeAbbr}
                </div>
                {!started ? (
                  <div className="text-xs text-muted">Hidden until kickoff.</div>
                ) : !g.spreadChalk ? (
                  <div className="text-xs text-muted">No spread picks were made.</div>
                ) : (
                  <div className="space-y-2.5">
                    <ChalkBar
                      leftLabel={g.awayAbbr}
                      leftPct={g.spreadChalk.awayPct}
                      rightLabel={g.homeAbbr}
                      rightPct={g.spreadChalk.homePct}
                      winner={g.winningSpreadTeam === 'away' ? 'left' : g.winningSpreadTeam === 'home' ? 'right' : null}
                    />
                    {g.totalChalk && (
                      <ChalkBar
                        leftLabel="Over"
                        leftPct={g.totalChalk.overPct}
                        rightLabel="Under"
                        rightPct={g.totalChalk.underPct}
                        winner={
                          game?.winningTotal === 'over' ? 'left' : game?.winningTotal === 'under' ? 'right' : null
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
