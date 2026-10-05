import { useMemo } from 'react';
import { buildWeeklySeries } from '../utils/analytics';
import { calculateSeasonStandings } from '../utils/leaderboard';
import {
  buildPickEvents, summarizeMembers, buildWeekGrid, buildSuperlatives, describeStanding,
} from '../utils/insights';
import { SeasonSnapshot, Superlatives } from './stats/Snapshot';
import RaceChart from './stats/RaceChart';
import WeekGrid from './stats/WeekGrid';
import SkillSplit from './stats/SkillSplit';
import LockTable from './stats/LockTable';
import StyleTable from './stats/StyleTable';
import WeekReview from './stats/WeekReview';

/**
 * The Stats tab. `currentUser` is whichever member the menu at the top is set
 * to (that member is highlighted throughout); `viewer` is the person actually
 * logged in, used only to say "Your season" instead of "Alice's season".
 */
export default function StatsPage({ seasonPicks = [], gamesByWeek = {}, allMembers = [], currentUser, viewer }) {
  const model = useMemo(() => {
    const standings = calculateSeasonStandings(seasonPicks, gamesByWeek, allMembers)
      .filter((s) => allMembers.includes(s.userName));
    const order = standings.map((s) => s.userName);
    const events = buildPickEvents(seasonPicks, gamesByWeek, allMembers);
    const summaries = summarizeMembers(events, allMembers);
    const grid = buildWeekGrid(events, gamesByWeek, allMembers);
    const { weeks, series } = buildWeeklySeries(seasonPicks, gamesByWeek, allMembers);
    const totals = Object.fromEntries(standings.map((s) => [s.userName, s.totalPoints]));
    return {
      standings, order, summaries, grid, weeks, series, totals,
      superlatives: buildSuperlatives(summaries, grid, allMembers),
    };
  }, [seasonPicks, gamesByWeek, allMembers]);

  if (model.weeks.length === 0) {
    return (
      <div className="rounded-card border border-line bg-white p-8 text-center text-sm text-muted">
        Stats show up once games have been graded. Make your picks on the Games tab, then check back after the first games finish.
      </div>
    );
  }

  const { standings, order, summaries, grid, weeks, series, totals, superlatives } = model;
  const focus = allMembers.includes(currentUser) ? currentUser : null;
  const standing = focus ? describeStanding(focus, standings) : null;

  return (
    <div>
      {focus && (
        <SeasonSnapshot
          member={focus}
          isViewer={focus === viewer}
          standing={standing}
          summary={summaries[focus]}
        />
      )}
      <Superlatives items={superlatives} viewer={viewer} />
      <RaceChart weeks={weeks} series={series} order={order} focus={focus} />
      <WeekGrid grid={grid} order={order} focus={focus} totals={totals} />
      <SkillSplit order={order} summaries={summaries} focus={focus} />
      <LockTable order={order} summaries={summaries} focus={focus} />
      <StyleTable order={order} summaries={summaries} focus={focus} />
      <WeekReview weeks={weeks} seasonPicks={seasonPicks} gamesByWeek={gamesByWeek} members={allMembers} />
    </div>
  );
}
