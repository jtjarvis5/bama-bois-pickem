// Puts several leagues' season data into the shape the Stats tab already
// understands, so the same standings, charts and awards work across all of them.
//
// Every (league, week) becomes its own synthetic week (1, 2, 3... in the order
// the games were played) and keeps its own games. That matters for points: the
// lock bonus depends on how many games were in that league's week, so a
// combined total always equals the sum of the leagues' own standings.

import { weekLabel } from './weekLabel.js';

const SPORT_TAG = { CFB: 'CFB', NFL: 'NFL' };

const firstKickoff = (games = []) => {
  const times = games.map((g) => new Date(g.startDate).getTime()).filter(Number.isFinite);
  return times.length ? Math.min(...times) : Infinity;
};

/**
 * leagueData: [{ league: { id, name, sport }, picks: [{ user_name, week, picks }],
 *                gamesByWeek: { [week]: games[] }, members: string[] }]
 * Returns { seasonPicks, gamesByWeek, members, units, weekName }.
 */
export function combineLeagues(leagueData = []) {
  // One unit per (league, week) that has games.
  const units = [];
  leagueData.forEach((ld) => {
    Object.keys(ld.gamesByWeek || {}).forEach((w) => {
      const games = ld.gamesByWeek[w] || [];
      if (!games.length) return;
      units.push({ league: ld.league, week: Number(w), games, start: firstKickoff(games) });
    });
  });
  units.sort((a, b) => a.start - b.start || a.league.id - b.league.id || a.week - b.week);
  units.forEach((u, i) => { u.id = i + 1; });

  const idFor = {}; // `${leagueId}:${week}` -> synthetic id
  units.forEach((u) => { idFor[`${u.league.id}:${u.week}`] = u.id; });

  const gamesByWeek = {};
  units.forEach((u) => { gamesByWeek[u.id] = u.games; });

  const seasonPicks = [];
  leagueData.forEach((ld) => {
    (ld.picks || []).forEach((row) => {
      const id = idFor[`${ld.league.id}:${Number(row.week)}`];
      if (id) seasonPicks.push({ ...row, week: id });
    });
  });

  const members = [];
  const seen = new Set();
  const addMember = (m) => { if (m && !seen.has(m)) { seen.add(m); members.push(m); } };
  leagueData.forEach((ld) => (ld.members || []).forEach(addMember));
  leagueData.forEach((ld) => (ld.picks || []).forEach((r) => addMember(r.user_name)));

  // Short labels in tight columns ("NFL5"), full ones in menus ("NFL Week 5").
  const sports = new Set(units.map((u) => u.league.sport));
  const byId = Object.fromEntries(units.map((u) => [u.id, u]));
  const tag = (u) => (sports.size > 1 ? (SPORT_TAG[u.league.sport] || u.league.sport) : u.league.name);
  const weekName = {
    short: (id) => { const u = byId[id]; return u ? `${tag(u)} ${u.week >= 16 && u.league.sport === 'CFB' ? `B${u.week - 15}` : u.week}` : `W${id}`; },
    long: (id) => { const u = byId[id]; return u ? `${tag(u)} ${weekLabel(u.week)}` : `Week ${id}`; },
  };

  return { seasonPicks, gamesByWeek, members, units, weekName };
}

// ---- calendar race (shared time axis across sports) ------------------------

const DAY = 24 * 60 * 60 * 1000;

/** Start (UTC ms) of the Tuesday-to-Monday week containing this kickoff, in Central time. */
export function calendarWeekStart(ms) {
  const d = new Date(ms - 6 * 60 * 60 * 1000); // Central standard time; an hour of DST drift never moves a kickoff across a Tuesday
  const sinceTuesday = (d.getUTCDay() + 5) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - sinceTuesday);
}

/**
 * Cumulative points by calendar week, in the shape RaceChart expects.
 * `perUnit` is buildWeeklySeries() over the combined data (one column per
 * league-week). Each league-week lands in the calendar week of its first
 * kickoff. `include(unit)` lets the page filter by sport.
 */
export function buildCalendarSeries({ units = [], perUnit, members = [], include = () => true }) {
  const unitById = Object.fromEntries(units.map((u) => [u.id, u]));
  const used = (perUnit?.weeks || []).filter((id) => unitById[id] && include(unitById[id]));
  const starts = [...new Set(used.map((id) => calendarWeekStart(unitById[id].start)))].sort((a, b) => a - b);
  const bucketOf = Object.fromEntries(used.map((id) => [id, starts.indexOf(calendarWeekStart(unitById[id].start)) + 1]));
  const weeks = starts.map((_, i) => i + 1);

  const series = {};
  members.forEach((m) => {
    const per = Object.fromEntries(weeks.map((b) => [b, 0]));
    (perUnit?.series?.[m] || []).forEach((pt) => { if (bucketOf[pt.week]) per[bucketOf[pt.week]] += pt.weekPoints; });
    let cumulative = 0;
    series[m] = weeks.map((week) => { cumulative += per[week]; return { week, weekPoints: per[week], cumulative }; });
  });

  const label = (b) => new Date(starts[b - 1]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return { weeks, series, weekName: { short: label, long: (b) => `Week of ${label(b)}` } };
}

/** How to name each league in column headings: its sport when that's unambiguous, else its name. */
export function leagueLabels(data = []) {
  const sportCount = {};
  data.forEach((d) => { sportCount[d.league.sport] = (sportCount[d.league.sport] || 0) + 1; });
  const nameCount = {};
  data.forEach((d) => { nameCount[d.league.name] = (nameCount[d.league.name] || 0) + 1; });
  return Object.fromEntries(data.map((d) => [
    d.league.id,
    sportCount[d.league.sport] === 1 ? d.league.sport
      : nameCount[d.league.name] === 1 ? d.league.name
        : `${d.league.name} (${d.league.sport}) #${d.league.id}`,
  ]));
}
