// Everything the Stats tab shows beyond the basic weekly chart, built from one
// flat list of graded picks ("events"). Every number on the page is derived
// from that list, so the pieces can't disagree with each other -- and the test
// suite checks the list's point totals against the Season Standings.
//
// Only FINAL games are ever graded, and a game that is final has kicked off,
// so nothing here can reveal a pick that is still hidden.

import {
  lockBonusValue, hasSpreadLock, hasTotalLock, gradeSpread, gradeTotal,
} from './scoring';

// ---- small record helpers --------------------------------------------------

export const emptyRecord = () => ({ wins: 0, losses: 0, pushes: 0 });

function addResult(rec, result) {
  if (result === 'win') rec.wins += 1;
  else if (result === 'loss') rec.losses += 1;
  else if (result === 'push') rec.pushes += 1;
}

/** Picks that were actually decided (pushes excluded). */
export const decided = (rec) => rec.wins + rec.losses;

/** Win rate as 0..1, or null when nothing has been decided yet. */
export const winRate = (rec) => (decided(rec) > 0 ? rec.wins / decided(rec) : null);

export const formatRecord = (rec) =>
  `${rec.wins}-${rec.losses}${rec.pushes ? `-${rec.pushes}` : ''}`;

export const formatPct = (rate) => (rate == null ? '—' : `${Math.round(rate * 100)}%`);

// ---- 1. graded pick events -------------------------------------------------

// The side of a two-way split that more than half the pickers took -- null if
// it's a tie or too few people picked for "the crowd" to mean anything.
const MIN_CROWD = 3;
function crowdSide(countA, countB, sideA, sideB) {
  if (countA + countB < MIN_CROWD) return null;
  if (countA > countB) return sideA;
  if (countB > countA) return sideB;
  return null;
}

/**
 * One event per graded pick (a game can produce a spread event and a total
 * event for the same person):
 *   { member, week, gameId, kind: 'spread'|'total', side, result, isLock,
 *     points, startDate, role: 'dog'|'fav'|'even'|null, crowd: 'with'|'against'|null }
 * `points` follows the Season Standings rule: 1 for a win, plus the week's lock
 * bonus when it was the locked pick. Only the given members are included.
 */
export function buildPickEvents(seasonPicks = [], gamesByWeek = {}, members = []) {
  const memberSet = new Set(members);
  const rowsByWeek = {};
  seasonPicks.forEach((row) => {
    if (!row?.picks || !memberSet.has(row.user_name)) return;
    (rowsByWeek[row.week] ||= []).push(row);
  });

  const events = [];
  Object.entries(rowsByWeek).forEach(([weekKey, rows]) => {
    const week = Number(weekKey);
    const weekGames = gamesByWeek[week] || [];
    const bonus = lockBonusValue(weekGames);
    const gameById = new Map(weekGames.map((g) => [String(g.id), g]));

    // How the whole league split on each game.
    const tally = {};
    rows.forEach((row) => {
      Object.entries(row.picks).forEach(([gameId, pick]) => {
        const t = (tally[gameId] ||= { home: 0, away: 0, over: 0, under: 0 });
        if (pick?.spread === 'home' || pick?.spread === 'away') t[pick.spread] += 1;
        if (pick?.total === 'over' || pick?.total === 'under') t[pick.total] += 1;
      });
    });

    rows.forEach((row) => {
      Object.entries(row.picks).forEach(([gameId, pick]) => {
        const game = gameById.get(String(gameId));
        if (!game || game.status !== 'FINAL' || !pick) return;
        const t = tally[gameId];

        const spreadResult = gradeSpread(pick, game);
        if (spreadResult) {
          const line = pick.spread === 'home' ? game.homeSpread : game.awaySpread;
          const majority = crowdSide(t.home, t.away, 'home', 'away');
          const isLock = hasSpreadLock(pick);
          events.push({
            member: row.user_name, week, gameId: String(gameId), kind: 'spread',
            side: pick.spread, result: spreadResult, isLock,
            points: spreadResult === 'win' ? 1 + (isLock ? bonus : 0) : 0,
            startDate: game.startDate,
            role: line > 0 ? 'dog' : line < 0 ? 'fav' : 'even',
            crowd: majority == null ? null : (majority === pick.spread ? 'with' : 'against'),
          });
        }

        const totalResult = gradeTotal(pick, game);
        if (totalResult) {
          const majority = crowdSide(t.over, t.under, 'over', 'under');
          const isLock = hasTotalLock(pick);
          events.push({
            member: row.user_name, week, gameId: String(gameId), kind: 'total',
            side: pick.total, result: totalResult, isLock,
            points: totalResult === 'win' ? 1 + (isLock ? bonus : 0) : 0,
            startDate: game.startDate,
            role: null,
            crowd: majority == null ? null : (majority === pick.total ? 'with' : 'against'),
          });
        }
      });
    });
  });
  return events;
}

// ---- 2. per-member summary -------------------------------------------------

function chronological(a, b) {
  return (new Date(a.startDate) - new Date(b.startDate))
    || (Number(a.gameId) - Number(b.gameId))
    || (a.kind === b.kind ? 0 : a.kind === 'spread' ? -1 : 1);
}

/**
 * Season-long numbers per member: spread / total records, lock performance,
 * pick style (underdogs, overs, with/against the crowd) and streaks.
 * Streaks run over decided picks in kickoff order; a push neither extends nor
 * breaks one.
 */
export function summarizeMembers(events = [], members = []) {
  const out = {};
  members.forEach((m) => {
    out[m] = {
      points: 0,
      spread: emptyRecord(), total: emptyRecord(),
      lock: emptyRecord(), nonLock: emptyRecord(), lockBonusPoints: 0,
      dog: emptyRecord(), fav: emptyRecord(),
      overs: 0, unders: 0,
      withCrowd: emptyRecord(), againstCrowd: emptyRecord(),
      currentStreak: { type: null, length: 0 }, longestWinStreak: 0,
    };
  });

  const sorted = [...events].sort(chronological);
  const runs = {}; // member -> { type, length, bestWin }
  sorted.forEach((e) => {
    const s = out[e.member];
    if (!s) return;
    s.points += e.points;
    addResult(e.kind === 'spread' ? s.spread : s.total, e.result);
    addResult(e.isLock ? s.lock : s.nonLock, e.result);
    if (e.isLock && e.result === 'win') s.lockBonusPoints += e.points - 1;

    if (e.kind === 'spread') {
      if (e.role === 'dog') addResult(s.dog, e.result);
      else if (e.role === 'fav') addResult(s.fav, e.result);
    } else if (e.side === 'over') s.overs += 1;
    else if (e.side === 'under') s.unders += 1;

    if (e.crowd === 'with') addResult(s.withCrowd, e.result);
    else if (e.crowd === 'against') addResult(s.againstCrowd, e.result);

    if (e.result === 'win' || e.result === 'loss') {
      const run = (runs[e.member] ||= { type: null, length: 0, bestWin: 0 });
      if (run.type === e.result) run.length += 1;
      else { run.type = e.result; run.length = 1; }
      if (run.type === 'win') run.bestWin = Math.max(run.bestWin, run.length);
      s.currentStreak = { type: run.type, length: run.length };
      s.longestWinStreak = run.bestWin;
    }
  });
  return out;
}

// ---- 3. week-by-week grid --------------------------------------------------

/**
 * Points per member per graded week, and who won each week.
 * A week is "complete" once every game in it is FINAL; only complete weeks
 * count toward "weeks won" (an unfinished week just shows who is leading).
 */
export function buildWeekGrid(events = [], gamesByWeek = {}, members = []) {
  const weeks = Object.keys(gamesByWeek)
    .map(Number)
    .filter((w) => (gamesByWeek[w] || []).some((g) => g.status === 'FINAL'))
    .sort((a, b) => a - b)
    .map((week) => {
      const games = gamesByWeek[week] || [];
      const finalGames = games.filter((g) => g.status === 'FINAL').length;
      return { week, finalGames, totalGames: games.length, complete: finalGames === games.length };
    });

  const points = {};
  members.forEach((m) => {
    points[m] = {};
    weeks.forEach(({ week }) => { points[m][week] = 0; });
  });
  events.forEach((e) => {
    if (points[e.member] && e.week in points[e.member]) points[e.member][e.week] += e.points;
  });

  const winners = {};
  const weeksWon = {};
  members.forEach((m) => { weeksWon[m] = 0; });
  weeks.forEach(({ week, complete }) => {
    const top = Math.max(0, ...members.map((m) => points[m][week]));
    winners[week] = top > 0 ? members.filter((m) => points[m][week] === top) : [];
    if (complete) winners[week].forEach((m) => { weeksWon[m] += 1; });
  });

  const maxPoints = Math.max(0, ...members.flatMap((m) => weeks.map(({ week }) => points[m][week])));
  return { weeks, points, winners, weeksWon, maxPoints };
}

// ---- 4. ranks --------------------------------------------------------------

/** Standing for each member with ties sharing a rank: { Alice: { rank, tied, points } }. */
export function rankMembers(standings = []) {
  const out = {};
  standings.forEach((s) => {
    const better = standings.filter((o) => o.totalPoints > s.totalPoints).length;
    const same = standings.filter((o) => o.totalPoints === s.totalPoints).length;
    out[s.userName] = { rank: better + 1, tied: same > 1, points: s.totalPoints };
  });
  return out;
}

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}

// ---- 5. superlatives -------------------------------------------------------

// A superlative needs enough picks behind it to mean something. These are
// deliberately modest: early in the season fewer of them show up.
const MIN_DECIDED = 8;
const MIN_LOCKS = 3;
const MIN_AGAINST = 4;

function topBy(members, valueOf) {
  let best = null;
  let names = [];
  members.forEach((m) => {
    const v = valueOf(m);
    if (v == null) return;
    if (best == null || v > best) { best = v; names = [m]; }
    else if (v === best) names.push(m);
  });
  return best == null ? null : { value: best, names };
}

/**
 * Short facts about the league: [{ key, title, names, detail }].
 * Ties name every tied member; an entry is dropped when nobody has enough
 * graded picks yet, or when everyone is level (nothing to single out).
 */
export function buildSuperlatives(summaries, weekGrid, members) {
  const items = [];
  const push = (key, title, top, detail) => {
    if (top && top.names.length <= 3) items.push({ key, title, names: top.names, detail: detail(top) });
  };

  const eligible = (pick, min) => members.filter((m) => decided(pick(summaries[m])) >= min);
  const spreadPool = eligible((s) => s.spread, MIN_DECIDED);
  const totalPool = eligible((s) => s.total, MIN_DECIDED);

  push('spread', 'Best against the spread',
    topBy(spreadPool, (m) => winRate(summaries[m].spread)),
    (t) => `${formatPct(t.value)} on spread picks`);
  push('total', 'Best on totals',
    topBy(totalPool, (m) => winRate(summaries[m].total)),
    (t) => `${formatPct(t.value)} on over/unders`);

  push('locks', 'Best lock picker',
    topBy(eligible((s) => s.lock, MIN_LOCKS), (m) => winRate(summaries[m].lock)),
    (t) => `${formatRecord(summaries[t.names[0]].lock)} on locks`);

  push('streak', 'Longest win streak',
    topBy(members, (m) => (summaries[m].longestWinStreak >= 4 ? summaries[m].longestWinStreak : null)),
    (t) => `${t.value} picks in a row`);

  push('brave', 'Best against the crowd',
    topBy(eligible((s) => s.againstCrowd, MIN_AGAINST), (m) => winRate(summaries[m].againstCrowd)),
    (t) => `${formatRecord(summaries[t.names[0]].againstCrowd)} when going against the majority`);

  // Most contrarian: highest share of crowd-able picks taken against the majority.
  const contrarian = topBy(
    members.filter((m) => {
      const s = summaries[m];
      return s.withCrowd.wins + s.withCrowd.losses + s.withCrowd.pushes
           + s.againstCrowd.wins + s.againstCrowd.losses + s.againstCrowd.pushes >= MIN_DECIDED;
    }),
    (m) => {
      const s = summaries[m];
      const against = s.againstCrowd.wins + s.againstCrowd.losses + s.againstCrowd.pushes;
      const total = against + s.withCrowd.wins + s.withCrowd.losses + s.withCrowd.pushes;
      return against / total;
    });
  push('contrarian', 'Most contrarian', contrarian,
    (t) => `${formatPct(t.value)} of picks against the majority`);

  const mostWeeks = topBy(members, (m) => (weekGrid.weeksWon[m] > 0 ? weekGrid.weeksWon[m] : null));
  push('weeks', 'Most weeks won', mostWeeks,
    (t) => `${t.value} week${t.value === 1 ? '' : 's'}`);

  return items;
}

// ---- 6. the headline numbers for one member --------------------------------

/**
 * Rank, points and the gap to whoever matters: how far behind the leader when
 * you're chasing, how far clear of second when you're leading.
 */
export function describeStanding(member, standings) {
  const ranks = rankMembers(standings);
  const me = ranks[member];
  if (!me) return null;
  const others = standings.filter((s) => s.userName !== member);
  const topOther = others.reduce((best, s) => (best == null || s.totalPoints > best.totalPoints ? s : best), null);

  let gap = null;
  if (topOther) {
    if (me.points > topOther.totalPoints) gap = { kind: 'ahead', by: me.points - topOther.totalPoints, of: topOther.userName };
    else if (me.points < topOther.totalPoints) gap = { kind: 'behind', by: topOther.totalPoints - me.points, of: topOther.userName };
    else gap = { kind: 'level', by: 0, of: topOther.userName };
  }
  return { ...me, size: standings.length, gap };
}
