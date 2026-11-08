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
