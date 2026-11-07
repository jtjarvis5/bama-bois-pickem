// Live "who's covering" math. Grading reuses scoring.js (the same formulas as
// the official standings) by treating the current score as if it were final.
import { gradeSpread, gradeTotal, hasSpreadLock, hasTotalLock, lockBonusValue } from './scoring.js';

/** Game with the live overlay applied (scores, clock). Status stays official. */
export function withLive(game, live) {
  if (!live || live.state === 'pre' || game.status === 'FINAL') return game;
  if (live.homeScore == null || live.awayScore == null) return game;
  return {
    ...game,
    homeScore: live.homeScore,
    awayScore: live.awayScore,
    liveDetail: live.detail || '',
    liveState: live.state, // 'in' | 'post'
    livePeriod: live.period,
    liveClockSec: live.clockSec,
  };
}

export const isInPlay = (g) => g.status !== 'FINAL' && g.liveState && g.homeScore != null && g.awayScore != null;

/** Minutes of regulation played (0-60); overtime counts as the full 60. */
export function elapsedMinutes(period, clockSec) {
  if (!period) return 0;
  if (period > 4) return 60;
  const left = Number.isFinite(clockSec) ? Math.min(900, Math.max(0, clockSec)) : 900;
  return Math.min(60, (period - 1) * 15 + (15 - left / 60));
}

const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Spread pick right now: { tone: 'good'|'bad'|'even', text } or null. */
export function liveSpreadStatus(pick, game) {
  if (!pick?.spread || !isInPlay(game)) return null;
  const g = grade(pick, game, gradeSpread);
  if (!g) return null;
  const margin = game.homeScore - game.awayScore;
  const val = Math.abs(pick.spread === 'home' ? margin + game.homeSpread : -margin + game.awaySpread);
  if (g === 'win') return { tone: 'good', text: `Covering by ${fmt(val)}` };
  if (g === 'loss') return { tone: 'bad', text: `Behind by ${fmt(val)}` };
  return { tone: 'even', text: 'Right on the number (push)' };
}

/** Total pick right now, with a pace projection. */
export function liveTotalStatus(pick, game) {
  if (!pick?.total || !isInPlay(game) || game.overUnder == null) return null;
  const pts = game.homeScore + game.awayScore;
  const line = game.overUnder;
  const over = pick.total === 'over';
  if (pts > line) {
    return over
      ? { tone: 'good', text: `Over is in: ${pts} points, line ${fmt(line)}` }
      : { tone: 'bad', text: `Busted: ${pts} points, line ${fmt(line)}` };
  }
  const mins = elapsedMinutes(game.livePeriod, game.liveClockSec);
  if (mins >= 5 && mins < 60) {
    const pace = Math.round((pts / mins) * 60);
    const favors = over ? pace > line : pace < line;
    return { tone: favors ? 'good' : 'bad', text: `${pts} pts, on pace for ${pace} (line ${fmt(line)})` };
  }
  return { tone: 'even', text: `${pts} pts so far (line ${fmt(line)})` };
}

function grade(pick, game, fn) {
  return fn(pick, { ...game, status: 'FINAL' });
}

/**
 * One week of points for each member: `final` from official finals, `live` from
 * games in progress counted as if they ended now (lock bonus included).
 * entries: [{ user_name, picks }]. Same scoring as the season standings.
 */
export function liveWeekPoints(entries = [], games = [], members = []) {
  const bonus = lockBonusValue(games);
  const rows = {};
  const ensure = (name) => (rows[name] ||= { userName: name, final: 0, live: 0, covering: 0, behind: 0 });
  members.forEach(ensure);

  entries.forEach(({ user_name, picks }) => {
    const row = ensure(user_name);
    if (!picks) return;
    games.forEach((game) => {
      const pick = picks[game.id] ?? picks[String(game.id)];
      if (!pick) return;
      const official = game.status === 'FINAL';
      if (!official && !isInPlay(game)) return;
      const g = { ...game, status: 'FINAL' };
      const add = (result, locked) => {
        if (result === 'win') {
          const pts = 1 + (locked ? bonus : 0);
          if (official) row.final += pts; else { row.live += pts; row.covering += 1; }
        } else if (result === 'loss' && !official) row.behind += 1;
      };
      add(gradeSpread(pick, g), hasSpreadLock(pick));
      add(gradeTotal(pick, g), hasTotalLock(pick));
    });
  });

  return Object.values(rows).sort((a, b) => (b.final + b.live) - (a.final + a.live) || b.final - a.final);
}
