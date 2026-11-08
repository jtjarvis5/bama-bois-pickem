// The "week ahead" text the admin pastes into the group chat before a slate
// kicks off: what's on, the lines, the weather, who still owes picks.

import { lockBonusValue } from './scoring.js';
import { describeWeather } from '../services/weather.js';
import { calculateSeasonStandings } from './leaderboard.js';
import { weekLabel } from './weekLabel.js';

const sign = (n) => (n > 0 ? `+${n}` : `${n}`);
const rankTag = (r) => (r ? `#${r} ` : '');

function lineText(g) {
  if (g.homeSpread == null) return 'no line yet';
  if (g.homeSpread === 0) return 'PK';
  const fav = g.homeSpread < 0;
  return `${fav ? (g.homeAbbr || g.homeTeam) : (g.awayAbbr || g.awayTeam)} ${fav ? g.homeSpread : g.awaySpread}`;
}

const gameLabel = (g) => `${rankTag(g.awayRank)}${g.awayTeam} @ ${rankTag(g.homeRank)}${g.homeTeam}`;

/**
 * picksRows: [{ user_name, picks }] for this week (admin view; may be empty).
 * seasonRows: all season picks, used for the standings snapshot.
 * Returns { text, gameCount } or null if there are no games.
 */
export function buildPreview({ leagueName, week, games = [], picksRows = [], members = [], seasonRows = [], gamesByWeek = {}, now = Date.now() }) {
  const slate = [...games]
    .filter((g) => g && g.startDate)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  if (slate.length === 0) return null;

  const upcoming = slate.filter((g) => g.status !== 'FINAL');
  const lines = [];
  lines.push(`🔮 ${leagueName ? `${leagueName} — ` : ''}${weekLabel(week)} preview`);

  const first = (upcoming[0] || slate[0]);
  const bonus = lockBonusValue(slate);
  lines.push(`📅 ${slate.length} games. First kickoff ${first.time}. Picks lock at each game's kickoff.`);
  lines.push(`🔒 Lock bonus this week: +${bonus} each (one spread, one total)`);

  lines.push('', 'The slate:');
  slate.forEach((g) => {
    const wx = g.status === 'FINAL' ? null : describeWeather(g.weather);
    const bits = [g.time, lineText(g)];
    if (g.overUnder != null) bits.push(`O/U ${g.overUnder}`);
    if (wx) bits.push(`${wx.icon} ${wx.text}`);
    lines.push(`• ${gameLabel(g)} — ${bits.join(' · ')}${g.note ? ` (${g.note})` : ''}`);
  });

  // Talking points, only the ones that exist.
  const withLine = slate.filter((g) => g.homeSpread != null);
  const points = [];
  const bothRanked = slate.filter((g) => g.homeRank && g.awayRank)
    .sort((a, b) => (a.homeRank + a.awayRank) - (b.homeRank + b.awayRank))[0];
  if (bothRanked) points.push(`🏟️ Top matchup: ${gameLabel(bothRanked)}`);
  const closest = [...withLine].sort((a, b) => Math.abs(a.homeSpread) - Math.abs(b.homeSpread))[0];
  if (closest && withLine.length > 2) points.push(`🎯 Closest line: ${gameLabel(closest)} (${lineText(closest)})`);
  const biggest = [...withLine].sort((a, b) => Math.abs(b.homeSpread) - Math.abs(a.homeSpread))[0];
  if (biggest && withLine.length > 2 && biggest !== closest) points.push(`💥 Biggest spread: ${gameLabel(biggest)} (${lineText(biggest)})`);
  const totals = slate.filter((g) => g.overUnder != null);
  if (totals.length > 2) {
    const hi = [...totals].sort((a, b) => b.overUnder - a.overUnder)[0];
    const lo = [...totals].sort((a, b) => a.overUnder - b.overUnder)[0];
    points.push(`📈 Highest total: ${gameLabel(hi)} (${hi.overUnder})`);
    if (lo !== hi) points.push(`📉 Lowest total: ${gameLabel(lo)} (${lo.overUnder})`);
  }
  const stormy = upcoming.filter((g) => describeWeather(g.weather)?.alert);
  stormy.slice(0, 4).forEach((g) => {
    const wx = describeWeather(g.weather);
    points.push(`${wx.icon} Weather to watch: ${gameLabel(g)} — ${wx.text} (${wx.why})`);
  });
  if (points.length) lines.push('', 'Keep an eye on:', ...points);

  // Race snapshot.
  if (seasonRows.length) {
    const table = calculateSeasonStandings(seasonRows, gamesByWeek, members)
      .filter((s) => members.includes(s.userName))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
    if (table.length && table[0].totalPoints > 0) {
      lines.push('', 'The race:');
      table.slice(0, 3).forEach((s, i) => lines.push(`${i + 1}. ${s.userName} — ${s.totalPoints}`));
      if (table.length > 1) {
        const gap = table[0].totalPoints - table[1].totalPoints;
        lines.push(gap === 0 ? `${table[0].userName} and ${table[1].userName} are level at the top.`
          : `${table[0].userName} leads ${table[1].userName} by ${gap}.`);
      }
    }
  }

  // Who still owes picks (a game counts once it has a spread or total pick).
  if (picksRows.length || members.length) {
    const ids = upcoming.map((g) => String(g.id));
    const byMember = {};
    picksRows.forEach((r) => { byMember[r.user_name] = r.picks || {}; });
    const owing = members
      .map((m) => {
        const p = byMember[m] || {};
        const done = ids.filter((id) => p[id] && (p[id].spread || p[id].total)).length;
        return { m, done, left: ids.length - done };
      })
      .filter((x) => x.left > 0);
    if (ids.length && owing.length) {
      lines.push('', `⏰ Still need picks: ${owing.map((x) => `${x.m} (${x.done}/${ids.length})`).join(', ')}`);
    } else if (ids.length) {
      lines.push('', '✅ Everyone has picks in for every game.');
    }
  }

  return { text: lines.join('\n'), gameCount: slate.length };
}
