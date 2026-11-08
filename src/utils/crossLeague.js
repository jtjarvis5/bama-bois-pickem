// Comparisons that only make sense across leagues: how each member does in each
// sport, and how any two members stack up against each other overall.

import { buildPickEvents, summarizeMembers } from './insights.js';

/** Per league: every member's season summary (records, locks, dog/over share). */
export function buildSportSplit(data = [], members = []) {
  return data.map((d) => ({
    league: d.league,
    summaries: summarizeMembers(buildPickEvents(d.picks, d.gamesByWeek, members), members),
  }));
}

const rec = () => ({ wins: 0, losses: 0, pushes: 0 });
const bump = (r, result) => {
  if (result === 'win') r.wins += 1;
  else if (result === 'loss') r.losses += 1;
  else if (result === 'push') r.pushes += 1;
};

/**
 * Head to head between members `a` and `b`, over everything they both played.
 * `combined` is combineLeagues() output; `events` is buildPickEvents() over it.
 */
export function buildHeadToHead({ combined, events = [], a, b, labels = {} }) {
  const unitById = Object.fromEntries(combined.units.map((u) => [u.id, u]));
  const blank = () => ({ points: 0, spread: rec(), total: rec() });
  const side = { [a]: blank(), [b]: blank() };
  const byLeague = {};   // leagueId -> { label, [a]: blank, [b]: blank }
  const pickAt = { [a]: {}, [b]: {} }; // `${leagueId}:${gameId}:${kind}` -> event
  const weekPoints = {}; // unitId -> { [a]: n, [b]: n, finals }

  events.forEach((e) => {
    if (e.member !== a && e.member !== b) return;
    const u = unitById[e.week];
    if (!u) return;
    const leagueId = u.league.id;
    const L = (byLeague[leagueId] ||= { label: labels[leagueId] || u.league.sport, [a]: blank(), [b]: blank() });
    [side[e.member], L[e.member]].forEach((t) => { t.points += e.points; bump(t[e.kind], e.result); });
    pickAt[e.member][`${leagueId}:${e.gameId}:${e.kind}`] = e;
    const w = (weekPoints[e.week] ||= { [a]: 0, [b]: 0 });
    w[e.member] += e.points;
  });

  // Same game, same bet type, both picked.
  const shared = { games: 0, agree: 0, disagree: 0, aWins: 0, bWins: 0 };
  Object.entries(pickAt[a]).forEach(([key, ea]) => {
    const eb = pickAt[b][key];
    if (!eb) return;
    shared.games += 1;
    if (ea.side === eb.side) { shared.agree += 1; return; }
    shared.disagree += 1;
    if (ea.result === 'win') shared.aWins += 1;
    else if (eb.result === 'win') shared.bWins += 1;
  });

  const weeks = { a: 0, b: 0, tied: 0 };
  Object.values(weekPoints).forEach((w) => {
    if (w[a] > w[b]) weeks.a += 1; else if (w[b] > w[a]) weeks.b += 1; else weeks.tied += 1;
  });

  return { a, b, overall: side, byLeague: Object.values(byLeague), shared, weeks };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Who won each calendar week across all leagues (Tue-Mon, Central), counting
 * both sports' points together. A week is only listed once every league-week
 * that starts in it is fully final, so nobody "wins" a week still being played.
 * `perUnit` is buildWeeklySeries() over the combined data; `startOf(ms)` maps a
 * kickoff time to its calendar-week start.
 */
export function buildWeeklyWinners({ units = [], perUnit, members = [], startOf }) {
  const buckets = new Map(); // start ms -> { unitIds, complete }
  units.forEach((u) => {
    if (!Number.isFinite(u.start)) return;
    const start = startOf(u.start);
    const b = buckets.get(start) || { unitIds: [], complete: true };
    b.unitIds.push(u.id);
    if (!u.games.every((g) => g.status === 'FINAL')) b.complete = false;
    buckets.set(start, b);
  });

  const pointsIn = (m, unitIds) => (perUnit?.series?.[m] || [])
    .filter((pt) => unitIds.includes(pt.week))
    .reduce((sum, pt) => sum + pt.weekPoints, 0);

  const tally = Object.fromEntries(members.map((m) => [m, 0]));
  const rows = [...buckets.entries()]
    .filter(([, b]) => b.complete)
    .sort((a, b) => a[0] - b[0])
    .map(([start, b]) => {
      const points = Object.fromEntries(members.map((m) => [m, pointsIn(m, b.unitIds)]));
      const top = Math.max(0, ...Object.values(points));
      const winners = top > 0 ? members.filter((m) => points[m] === top) : [];
      winners.forEach((m) => { tally[m] += 1; });
      return { start, end: start + 6 * DAY_MS, points, winners, top };
    });
  return { rows, tally };
}

/** 1-based ranks with ties sharing a rank: { name: { rank, tied } } from { name: points }. */
export function rankByPoints(pointsByMember = {}) {
  const entries = Object.entries(pointsByMember);
  return Object.fromEntries(entries.map(([m, p]) => {
    const better = entries.filter(([, q]) => q > p).length;
    const same = entries.filter(([, q]) => q === p).length;
    return [m, { rank: better + 1, tied: same > 1 }];
  }));
}
