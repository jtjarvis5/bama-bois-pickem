// The weekly recap text the admin pastes into the group chat. Built from the
// same graded events as the Stats tab, so the numbers always match the app.

import { calculateSeasonStandings } from './leaderboard';
import { buildPickEvents, rankMembers } from './insights';

const sideLabel = (game, ev) => {
  if (!game) return `Game ${ev.gameId}`;
  if (ev.kind === 'total') return `${ev.side === 'over' ? 'Over' : 'Under'} ${game.overUnder} (${game.awayAbbr || game.awayTeam} @ ${game.homeAbbr || game.homeTeam})`;
  const home = ev.side === 'home';
  const line = home ? game.homeSpread : game.awaySpread;
  const shown = line > 0 ? `+${line}` : `${line}`;
  return `${home ? game.homeTeam : game.awayTeam} ${shown}`;
};

const names = (list) => list.join(', ');

/**
 * Returns { text, finalGames, totalGames } or null when no game in the week has
 * been graded yet. `seasonRows` = [{ user_name, week, picks }] (real picks).
 */
export function buildRecap({ leagueName, week, seasonRows = [], gamesByWeek = {}, members = [] }) {
  const games = gamesByWeek[week] || [];
  const byId = {};
  games.forEach((g) => { byId[String(g.id)] = g; });
  const finalGames = games.filter((g) => g.status === 'FINAL').length;

  const events = buildPickEvents(seasonRows, gamesByWeek, members).filter((e) => e.week === week);
  if (events.length === 0) return null;

  const stat = {};
  members.forEach((m) => { stat[m] = { points: 0, wins: 0, losses: 0 }; });
  events.forEach((e) => {
    const s = stat[e.member];
    s.points += e.points;
    if (e.result === 'win') s.wins += 1;
    if (e.result === 'loss') s.losses += 1;
  });
  const board = members
    .map((m) => ({ member: m, ...stat[m] }))
    .filter((s) => s.wins + s.losses > 0 || s.points > 0)
    .sort((a, b) => b.points - a.points || b.wins - a.wins || a.member.localeCompare(b.member));
  if (board.length === 0) return null;

  const lines = [];
  lines.push(`🏈 ${leagueName ? `${leagueName} — ` : ''}Week ${week} recap${finalGames < games.length ? ` (${finalGames}/${games.length} games final)` : ''}`);

  const top = board[0].points;
  const winners = board.filter((s) => s.points === top).map((s) => s.member);
  lines.push(`🏆 Week ${winners.length > 1 ? 'winners' : 'winner'}: ${names(winners)} (${top} pt${top === 1 ? '' : 's'})`);

  const ranks = rankMembers(board.map((s) => ({ userName: s.member, totalPoints: s.points, wins: s.wins, losses: s.losses })));
  lines.push('', 'This week:');
  board.forEach((s) => {
    const r = ranks[s.member];
    lines.push(`${r.tied ? 'T' : ''}${r.rank}. ${s.member} — ${s.points} pt${s.points === 1 ? '' : 's'} (${s.wins}-${s.losses})`);
  });

  const lockWins = events.filter((e) => e.isLock && e.result === 'win');
  const lockLosses = events.filter((e) => e.isLock && e.result === 'loss');
  if (lockWins.length || lockLosses.length) {
    lines.push('', 'Locks:');
    lockWins.forEach((e) => lines.push(`✅ ${e.member}: ${sideLabel(byId[String(e.gameId)], e)}`));
    lockLosses.forEach((e) => lines.push(`❌ ${e.member}: ${sideLabel(byId[String(e.gameId)], e)}`));
  }

  const brave = events.filter((e) => e.crowd === 'against' && e.result === 'win' && !e.isLock);
  if (brave.length) {
    lines.push('', 'Won against the crowd:');
    brave.slice(0, 5).forEach((e) => lines.push(`💪 ${e.member}: ${sideLabel(byId[String(e.gameId)], e)}`));
  }

  // Season table and movement since last week.
  const now = calculateSeasonStandings(seasonRows, gamesByWeek, members).filter((s) => members.includes(s.userName));
  const before = calculateSeasonStandings(
    seasonRows.filter((r) => Number(r.week) < week), gamesByWeek, members,
  ).filter((s) => members.includes(s.userName));
  const rankNow = rankMembers(now);
  const rankBefore = rankMembers(before);
  const hadBefore = before.some((s) => s.totalPoints > 0 || s.wins + s.losses > 0);
  lines.push('', 'Season standings:');
  now.slice(0, 8).forEach((s) => {
    const rn = rankNow[s.userName];
    let move = '';
    if (hadBefore) {
      const d = rankBefore[s.userName].rank - rn.rank;
      move = d > 0 ? ` ▲${d}` : d < 0 ? ` ▼${-d}` : '';
    }
    lines.push(`${rn.tied ? 'T' : ''}${rn.rank}. ${s.userName} — ${s.totalPoints}${move}`);
  });
  if (now.length > 8) lines.push(`…and ${now.length - 8} more in the app`);

  return { text: lines.join('\n'), finalGames, totalGames: games.length };
}
