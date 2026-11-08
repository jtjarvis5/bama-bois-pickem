import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import { getCachedGamesByWeek } from '../services/gameCache';
import { SEASON_YEAR } from '../utils/getCurrentWeek';
import { calculateSeasonStandings } from '../utils/leaderboard';
import { buildPickEvents, summarizeMembers, rankMembers } from '../utils/insights';
import { streakTag } from '../utils/badges';
import { combineLeagues } from '../utils/combined';
import StatsPage from './StatsPage';
import StreakTag from './StreakTag';

const RELOAD_MS = 60 * 1000;

// Everyone's combined season across every league they're in: one leaderboard
// (with each league's share of the points) and the full stats page computed
// over all of it. Totals are exactly the sum of the leagues' own standings.
export default function CombinedPage({ token, leagues = [], viewer, currentUser }) {
  const [data, setData] = useState(null); // [{ league, picks, gamesByWeek, members }]
  const [skipped, setSkipped] = useState([]);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
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
        return { league, failed: api.friendlyError ? api.friendlyError(err) : String(err) };
      }
    }));
    // Only leagues the viewer plays in (or that don't record members at all).
    const mine = results.filter((r) => !r.failed).filter((r) => (
      !viewer || r.members.length === 0 || r.members.includes(viewer) || r.picks.some((p) => p.user_name === viewer)
    ));
    setData(mine);
    setSkipped(results.filter((r) => r.failed).map((r) => r.league.name));
    setError(mine.length === 0 ? 'No leagues to combine yet.' : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, leagueKey, viewer]);

  useEffect(() => {
    let cancelled = false;
    const run = () => load().catch((err) => { if (!cancelled) setError(String(err?.message || err)); });
    run();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') run(); }, RELOAD_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [load, tick]);

  const model = useMemo(() => {
    if (!data || data.length === 0) return null;
    const combined = combineLeagues(data);
    const standings = calculateSeasonStandings(combined.seasonPicks, combined.gamesByWeek, combined.members)
      .filter((s) => combined.members.includes(s.userName))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins || a.userName.localeCompare(b.userName));
    const ranks = rankMembers(standings);

    // Each league's own points, for the breakdown columns.
    const sports = new Set(data.map((d) => d.league.sport));
    const columns = data.map((d) => {
      const own = calculateSeasonStandings(d.picks, d.gamesByWeek, combined.members);
      return {
        key: d.league.id,
        label: sports.size > 1 ? d.league.sport : d.league.name,
        points: Object.fromEntries(own.map((s) => [s.userName, s.totalPoints])),
      };
    });

    const summaries = summarizeMembers(
      buildPickEvents(combined.seasonPicks, combined.gamesByWeek, combined.members), combined.members);
    return { combined, standings, ranks, columns, summaries };
  }, [data]);

  if (!model) {
    return (
      <div className="rounded-card border border-line bg-white p-8 text-center text-sm text-muted">
        {error || 'Loading both leagues…'}
      </div>
    );
  }

  const { combined, standings, ranks, columns, summaries } = model;
  const anyGraded = standings.some((s) => s.wins + s.losses + s.pushes > 0);

  return (
    <div>
      <h2 className="font-display text-lg font-semibold text-ink mb-1">Combined leaderboard</h2>
      <p className="text-xs text-muted mb-3 max-w-prose">
        Points from {data.length === 1 ? 'your league' : `all ${data.length} leagues`} added together{skipped.length ? ` (couldn't load ${skipped.join(', ')})` : ''}.
        Each league still scores on its own; this just adds them up.
        <button type="button" onClick={() => setTick((t) => t + 1)} className="ml-2 underline">Refresh</button>
      </p>

      <div className="rounded-card border border-line bg-white overflow-hidden overflow-x-auto shadow-sm mb-10">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-paper/30 text-xs text-muted">
              <th className="p-3 font-semibold uppercase tracking-wider">Rank</th>
              <th className="p-3 font-semibold uppercase tracking-wider">Member</th>
              {columns.map((c) => (
                <th key={c.key} className="p-3 font-semibold uppercase tracking-wider text-right">{c.label}</th>
              ))}
              <th className="p-3 font-semibold uppercase tracking-wider">W-L-P</th>
              <th className="p-3 font-semibold uppercase tracking-wider text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s) => {
              const r = ranks[s.userName];
              const tag = streakTag(summaries[s.userName]);
              return (
                <tr key={s.userName} className={`border-b border-line last:border-0 ${s.userName === viewer ? 'bg-paper/40' : ''}`}>
                  <td className="p-3 font-display font-semibold text-ink">{r.tied ? 'T' : ''}{r.rank}</td>
                  <td className="p-3 font-medium">
                    {s.userName}
                    <StreakTag tag={tag} />
                  </td>
                  {columns.map((c) => (
                    <td key={c.key} className="p-3 text-right text-muted">{c.points[s.userName] ?? 0}</td>
                  ))}
                  <td className="p-3 text-muted">{s.wins}-{s.losses}-{s.pushes}</td>
                  <td className="p-3 text-right font-display font-bold text-lg text-ink">{s.totalPoints}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {anyGraded && <h2 className="font-display text-lg font-semibold text-ink mb-1">Stats across both leagues</h2>}
      <StatsPage
        seasonPicks={combined.seasonPicks}
        gamesByWeek={combined.gamesByWeek}
        allMembers={combined.members}
        currentUser={currentUser}
        viewer={viewer}
        weekName={combined.weekName}
      />
    </div>
  );
}
