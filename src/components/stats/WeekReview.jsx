import { useState } from 'react';
import { buildWeeklyChalk, findBiggestUpset, rankWeekPerformance } from '../../utils/analytics';
import { isGameLocked } from '../../utils/getCurrentWeek';
import { Section, Panel } from './ui';

function ChalkBar({ leftLabel, leftPct, rightLabel, rightPct, winner }) {
  // winner: 'left' | 'right' | null. The winning side is filled crimson once graded.
  const leftWon = winner === 'left';
  const rightWon = winner === 'right';
  return (
    <div>
      <div className="flex h-2.5 rounded-full overflow-hidden bg-line gap-0.5">
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

/** One week at a glance: who had the best and worst week, the upset, and how the league split. */
export default function WeekReview({ weeks, seasonPicks, gamesByWeek, members }) {
  // `weeks` is a list of week numbers; whether the chosen week is still in play comes from its games.
  const [picked, setPicked] = useState(null);
  const latest = weeks[weeks.length - 1];
  const activeWeek = weeks.includes(picked) ? picked : latest;

  const weekGames = gamesByWeek[activeWeek] || [];
  const weekPicks = seasonPicks.filter((p) => Number(p.week) === Number(activeWeek));
  const ranking = rankWeekPerformance(weekPicks, weekGames, members);
  const topPts = ranking.length ? ranking[0].points : 0;
  const lowPts = ranking.length ? ranking[ranking.length - 1].points : 0;
  const bestNames = ranking.filter((r) => r.points === topPts).map((r) => r.userName);
  const worstNames = ranking.filter((r) => r.points === lowPts).map((r) => r.userName);
  const showBestWorst = topPts > 0 && topPts !== lowPts;

  const inProgress = weekGames.some((g) => g.status !== 'FINAL');

  const chalk = buildWeeklyChalk(weekPicks, weekGames);
  const upset = findBiggestUpset(chalk);

  // The game the league was most evenly split on (only once it has kicked off).
  const divided = chalk
    .filter((g) => isGameLocked(g.startDate) && g.spreadChalk && g.spreadChalk.homeCount + g.spreadChalk.awayCount >= 4)
    .sort((a, b) => Math.abs(a.spreadChalk.homeCount - a.spreadChalk.awayCount) - Math.abs(b.spreadChalk.homeCount - b.spreadChalk.awayCount))[0];

  return (
    <Section
      title="Week in review"
      action={
        <select
          aria-label="Week to review"
          value={activeWeek}
          onChange={(e) => setPicked(Number(e.target.value))}
          className="bg-white border border-line rounded-full px-3 py-1.5 text-sm font-medium text-ink focus:outline-none focus:ring-2 focus:ring-crimson/30"
        >
          {weeks.map((w) => <option key={w} value={w}>Week {w}</option>)}
        </select>
      }
    >
      {showBestWorst ? (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Panel className="p-4">
            <div className="text-xs text-muted mb-1">{inProgress ? 'Leading this week' : 'Best week'}</div>
            <div className="font-display text-base font-semibold text-crimson">{bestNames.join(', ')}</div>
            <div className="text-xs text-muted mt-0.5">{topPts} pts</div>
          </Panel>
          <Panel className="p-4">
            <div className="text-xs text-muted mb-1">{inProgress ? 'Trailing this week' : 'Roughest week'}</div>
            <div className="font-display text-base font-semibold text-ink">{worstNames.join(', ')}</div>
            <div className="text-xs text-muted mt-0.5">{lowPts} pts</div>
          </Panel>
        </div>
      ) : (
        <Panel className="p-4 mb-4 text-sm text-muted">
          No separation yet this week: nobody has points, or everyone is tied.
        </Panel>
      )}

      {(upset || divided) && (
        <Panel className="mb-4 divide-y divide-line">
          {upset && (
            <div className="px-4 py-3 text-sm text-ink">
              <span className="text-muted">Biggest upset &middot; </span>
              {upset.majorityWrongPct}% of the league took{' '}
              <span className="font-semibold">{upset.winningSpreadTeam === 'home' ? upset.awayTeam : upset.homeTeam}</span>
              , and <span className="font-semibold">{upset.winningSpreadTeam === 'home' ? upset.homeTeam : upset.awayTeam}</span> covered instead.
            </div>
          )}
          {divided && (
            <div className="px-4 py-3 text-sm text-ink">
              <span className="text-muted">Most divided &middot; </span>
              <span className="font-semibold">{divided.awayTeam} @ {divided.homeTeam}</span>
              {' '}split {divided.spreadChalk.awayCount}&ndash;{divided.spreadChalk.homeCount}.
            </div>
          )}
        </Panel>
      )}

      <Panel className="p-4">
        <h3 className="font-display text-base font-semibold text-ink">Where the league landed</h3>
        <p className="text-xs text-muted mt-0.5 mb-4">Pick splits appear once a game kicks off, so nothing is revealed early.</p>
        <div className="space-y-5">
          {chalk.map((g) => {
            const started = isGameLocked(g.startDate);
            const game = weekGames.find((x) => x.id === g.gameId);
            return (
              <div key={g.gameId}>
                <div className="text-sm font-medium text-ink mb-1.5">{g.awayAbbr} @ {g.homeAbbr}</div>
                {!started ? (
                  <div className="text-xs text-muted">Hidden until kickoff.</div>
                ) : !g.spreadChalk ? (
                  <div className="text-xs text-muted">No spread picks were made.</div>
                ) : (
                  <div className="space-y-2.5">
                    <ChalkBar
                      leftLabel={g.awayAbbr} leftPct={g.spreadChalk.awayPct}
                      rightLabel={g.homeAbbr} rightPct={g.spreadChalk.homePct}
                      winner={g.winningSpreadTeam === 'away' ? 'left' : g.winningSpreadTeam === 'home' ? 'right' : null}
                    />
                    {g.totalChalk && (
                      <ChalkBar
                        leftLabel="Over" leftPct={g.totalChalk.overPct}
                        rightLabel="Under" rightPct={g.totalChalk.underPct}
                        winner={game?.winningTotal === 'over' ? 'left' : game?.winningTotal === 'under' ? 'right' : null}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>
    </Section>
  );
}
