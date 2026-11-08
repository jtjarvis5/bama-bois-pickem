import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import { getCachedGamesByWeek } from '../services/gameCache';
import { SEASON_YEAR } from '../utils/getCurrentWeek';
import { calculateSeasonStandings } from '../utils/leaderboard';
import { buildWeeklySeries } from '../utils/analytics';
import { buildPickEvents, summarizeMembers } from '../utils/insights';
import { streakTag } from '../utils/badges';
import { combineLeagues, buildCalendarSeries, calendarWeekStart, leagueLabels } from '../utils/combined';
import { buildSportSplit, buildWeeklyWinners, rankByPoints } from '../utils/crossLeague';
import RaceChart from './stats/RaceChart';
import StreakTag from './StreakTag';
import { SportSplit, WeeklyWinners, HeadToHead } from './CombinedSections';

const RELOAD_MS = 60 * 1000;

// What only makes sense across leagues: one overall leaderboard (each league's
// share of the points), who is better at which sport, a race on a shared
// calendar, who won each week overall, and head to head between any two members.
// Per-league detail (awards, week grid, style tables) stays on each league's
// own Stats tab, where it means something.
export default function CombinedPage({ token, leagues = [], viewer, currentUser }) {
  const [data, setData] = useState(null); // [{ league, picks, gamesByWeek, members }]
  const [skipped, setSkipped] = useState([]);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const [raceSport, setRaceSport] = useState('ALL');
  const leagueKey = leagues.map((l) => l.id).join(',');

  const load = useCallback(async () => {
    const results = await Promise.all(leagues.map(async (league) => {
      try {
        const [picks, gamesByWeek, members] = await Promise.all([
          api.getSeasonPicks(token, league.id),
          getCachedGamesByWeek(SEASON_YEAR, league.sport),
          api.leagueMembers(league.id),
        ]);
        return { league, picks: picks || [], gamesByWeek: gamesByWeek || {}, members: members || [] };
      } catch (err) {
        return { league, failed: true };
      }
    }));
    const loaded = results.filter((r) => !r.failed);
    // Only leagues the viewer plays in (or that don't record members at all).
    const mine = loaded.filter((r) => (
      !viewer || r.members.length === 0 || r.members.includes(viewer) || r.picks.some((p) => p.user_name === viewer)
    ));
    return { mine, failed: results.filter((r) => r.failed).map((r) => r.league.name), hidden: loaded.length - mine.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leagueKey, viewer]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const { mine, failed } = await load();
        if (cancelled) return;
        setData(mine);
        setSkipped(failed);
        setError(mine.length === 0 ? 'No leagues to combine yet.' : '');
      } catch (err) {
        if (!cancelled) setError(String(err?.message || err));
      }
    };
    run();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') run(); }, RELOAD_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [load, tick]);

  const model = useMemo(() => {
    if (!data || data.length === 0) return null;
    const combined = combineLeagues(data);
    const { members } = combined;
    const labels = leagueLabels(data);

    // Per-league points and who actually played in each league (for dashes).
    const columns = data.map((d) => {
      const own = calculateSeasonStandings(d.picks, d.gamesByWeek, members);
      const played = new Set([...d.members, ...d.picks.map((p) => p.user_name)]);
      return {
        key: d.league.id,
        label: labels[d.league.id],
        sport: d.league.sport,
        played,
        points: Object.fromEntries(own.map((s) => [s.userName, s.totalPoints])),
      };
    });

    const standings = calculateSeasonStandings(combined.seasonPicks, combined.gamesByWeek, members)
      .filter((s) => members.includes(s.userName))
      .sort((a, b) => b.totalPoints - a.totalPoints || a.userName.localeCompare(b.userName));
    const ranks = rankByPoints(Object.fromEntries(standings.map((s) => [s.userName, s.totalPoints])));
    const order = standings.map((s) => s.userName);

    const events = buildPickEvents(combined.seasonPicks, combined.gamesByWeek, members);
    const summaries = summarizeMembers(events, members);
    const split = buildSportSplit(data, members);
    const perUnit = buildWeeklySeries(combined.seasonPicks, combined.gamesByWeek, members);
    const winners = buildWeeklyWinners({ units: combined.units, perUnit, members, startOf: calendarWeekStart });
    return { combined, standings, ranks, order, columns, summaries, events, split, perUnit, winners, labels };
  }, [data]);

  const race = useMemo(() => {
    if (!model) return null;
    const sports = new Set(model.combined.units.map((u) => u.league.sport));
    const include = raceSport === 'ALL' ? () => true : (u) => u.league.sport === raceSport;
    return { sports: [...sports], ...buildCalendarSeries({
      units: model.combined.units, perUnit: model.perUnit, members: model.combined.members, include,
    }) };
  }, [model, raceSport]);

  if (!model) {
    return (
      <div className="rounded-card border border-line bg-white p-8 text-center text-sm text-muted">
        {error || 'Loading your leagues...'}
      </div>
    );
  }

  const { combined, standings, ranks, order, columns, summaries, events, split, winners, labels } = model;
  const leaderPoints = standings[0]?.totalPoints ?? 0;
  const partial = skipped.length > 0;

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-ink mb-1">Overall leaderboard</h2>
      <p className="text-xs text-muted mb-3 max-w-prose">
        {data.length === 1 ? 'One league so far. ' : `Points from ${data.length} leagues added together. `}
        Each league still scores on its own; this just adds them up.
        <button type="button" onClick={() => setTick((t) => t + 1)} className="ml-2 underline">Refresh</button>
      </p>
      {partial && (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm px-3 py-2 mb-3">
          Could not load {skipped.join(', ')}, so these totals are partial.
        </div>
      )}

      <div className="rounded-card border border-line bg-white overflow-hidden overflow-x-auto shadow-sm mb-10">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-paper/30 text-xs text-muted">
              <th className="p-3 font-semibold uppercase tracking-wider">Rank</th>
              <th className="p-3 font-semibold uppercase tracking-wider">Member</th>
              {columns.map((c) => (
                <th key={c.key} className="p-3 font-semibold uppercase tracking-wider text-right">{c.label}</th>
              ))}
              <th className="p-3 font-semibold uppercase tracking-wider text-right">Total</th>
              <th className="p-3 font-semibold uppercase tracking-wider text-right">Behind</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const r = ranks[s.userName];
              return (
                <tr key={s.userName} className={`border-b border-line last:border-0 ${s.userName === viewer ? 'bg-paper/40' : ''}`}>
                  <td className="p-3 font-display font-semibold text-ink">{r.tied ? 'T' : ''}{r.rank}</td>
                  <td className="p-3 font-medium whitespace-nowrap">
                    {s.userName}
                    <StreakTag tag={streakTag(summaries[s.userName])} />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="p-3 text-right text-muted">
                      {c.played.has(s.userName) ? (c.points[s.userName] ?? 0) : '-'}
                    </td>
                  ))}
                  <td className="p-3 text-right font-display font-bold text-lg text-ink">{s.totalPoints}</td>
                  <td className="p-3 text-right text-muted">{leaderPoints - s.totalPoints > 0 ? leaderPoints - s.totalPoints : '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SportSplit split={split} columns={columns} members={order} viewer={viewer} />

      {race && race.weeks.length > 0 && (
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-xs text-muted">Weeks run Tuesday to Monday, so both sports share one timeline.</p>
            {race.sports.length > 1 && (
              <div className="flex gap-1.5 shrink-0">
                {['ALL', ...race.sports].map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setRaceSport(sp)}
                    aria-pressed={raceSport === sp}
                    className={`px-3 py-1 rounded-full border text-xs font-medium ${
                      raceSport === sp ? 'bg-ink text-white border-ink' : 'border-line text-muted hover:border-ink/30'}`}
                  >
                    {sp === 'ALL' ? 'Both' : sp}
                  </button>
                ))}
              </div>
            )}
          </div>
          <RaceChart weeks={race.weeks} series={race.series} order={order} focus={order.includes(currentUser) ? currentUser : null} weekName={race.weekName} />
        </div>
      )}

      <WeeklyWinners winners={winners} order={order} viewer={viewer} />

      <HeadToHead combined={combined} events={events} members={order} viewer={viewer} labels={labels} />
    </div>
  );
}
