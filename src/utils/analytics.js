import { lockBonusValue, hasSpreadLock, hasTotalLock } from './scoring';

// The win/loss/push formula itself is still a separate copy from
// leaderboard.js/PickMatrix.jsx/App.jsx (deliberate -- see the note in
// StatsPage.jsx history). The lock-bonus rule, which actually changes
// between those files now, is shared via scoring.js instead.

function gradeSpread(pick, game) {
  if (!pick?.spread || !game || game.status !== 'FINAL') return null;
  const homeMargin = game.homeScore - game.awayScore;
  const spreadCovered = pick.spread === 'home'
    ? homeMargin + game.homeSpread
    : -homeMargin + game.awaySpread;
  if (spreadCovered > 0) return 'win';
  if (spreadCovered < 0) return 'loss';
  return 'push';
}

function gradeTotal(pick, game) {
  if (!pick?.total || !game || game.status !== 'FINAL' || game.overUnder == null) return null;
  const totalPts = game.homeScore + game.awayScore;
  if (totalPts === game.overUnder) return 'push';
  const hit = (pick.total === 'over' && totalPts > game.overUnder) ||
              (pick.total === 'under' && totalPts < game.overUnder);
  return hit ? 'win' : 'loss';
}

function findGame(weekGames, gameId) {
  return weekGames.find((g) => g.id.toString() === gameId.toString());
}

/**
 * Per-member points earned in one specific week (not cumulative). Used for
 * both the season chart (called once per week) and the weekly best/worst
 * ranking (called once for the selected week).
 */
function pointsForWeek(weekPicksRows, weekGames, memberName) {
  const row = weekPicksRows.find((r) => r.user_name === memberName);
  if (!row || !row.picks) return 0;
  const bonusValue = lockBonusValue(weekGames);
  let points = 0;
  Object.keys(row.picks).forEach((gameId) => {
    const pick = row.picks[gameId];
    const game = findGame(weekGames, gameId);
    if (!game) return;
    if (gradeSpread(pick, game) === 'win') {
      points += 1;
      if (hasSpreadLock(pick)) points += bonusValue;
    }
    if (gradeTotal(pick, game) === 'win') {
      points += 1;
      if (hasTotalLock(pick)) points += bonusValue;
    }
  });
  return points;
}

/**
 * Cumulative points per member across the season, week by week -- the data
 * behind the season trend chart. Only counts weeks that have at least one
 * FINAL game, so an upcoming/empty week doesn't show as a flat zero point
 * on the x-axis.
 */
export function buildWeeklySeries(seasonPicks = [], gamesByWeek = {}, membersList = []) {
  const weeks = Object.keys(gamesByWeek)
    .map(Number)
    .filter((w) => (gamesByWeek[w] || []).some((g) => g.status === 'FINAL'))
    .sort((a, b) => a - b);

  const series = {};
  membersList.forEach((member) => {
    let cumulative = 0;
    series[member] = weeks.map((week) => {
      const weekPicksRows = seasonPicks.filter((p) => Number(p.week) === week);
      const weekPoints = pointsForWeek(weekPicksRows, gamesByWeek[week] || [], member);
      cumulative += weekPoints;
      return { week, weekPoints, cumulative };
    });
  });

  return { weeks, series };
}

/** Best-to-worst ranking of a single week's point totals. */
export function rankWeekPerformance(weekPicksRows = [], weekGames = [], membersList = []) {
  return membersList
    .map((userName) => ({ userName, points: pointsForWeek(weekPicksRows, weekGames, userName) }))
    .sort((a, b) => b.points - a.points);
}

/** Spread record and total record, kept separate (season standings blends them into one number). */
export function buildSplitRecords(seasonPicks = [], gamesByWeek = {}, membersList = []) {
  const records = {};
  membersList.forEach((m) => {
    records[m] = { ats: { wins: 0, losses: 0, pushes: 0 }, total: { wins: 0, losses: 0, pushes: 0 } };
  });

  seasonPicks.forEach((row) => {
    if (!records[row.user_name] || !row.picks) return;
    const weekGames = gamesByWeek[row.week] || [];
    Object.keys(row.picks).forEach((gameId) => {
      const pick = row.picks[gameId];
      const game = findGame(weekGames, gameId);
      if (!game) return;
      const spreadResult = gradeSpread(pick, game);
      if (spreadResult === 'win') records[row.user_name].ats.wins += 1;
      else if (spreadResult === 'loss') records[row.user_name].ats.losses += 1;
      else if (spreadResult === 'push') records[row.user_name].ats.pushes += 1;

      const totalResult = gradeTotal(pick, game);
      if (totalResult === 'win') records[row.user_name].total.wins += 1;
      else if (totalResult === 'loss') records[row.user_name].total.losses += 1;
      else if (totalResult === 'push') records[row.user_name].total.pushes += 1;
    });
  });

  return records;
}

/** Per-game consensus for one week: what % of the league took each side. */
export function buildWeeklyChalk(weekPicksRows = [], weekGames = []) {
  return weekGames.map((game) => {
    let homeCount = 0, awayCount = 0, overCount = 0, underCount = 0;

    weekPicksRows.forEach((row) => {
      const pick = row.picks?.[game.id];
      if (!pick) return;
      if (pick.spread === 'home') homeCount += 1;
      else if (pick.spread === 'away') awayCount += 1;
      if (pick.total === 'over') overCount += 1;
      else if (pick.total === 'under') underCount += 1;
    });

    const spreadTotal = homeCount + awayCount;
    const totalTotal = overCount + underCount;

    return {
      gameId: game.id,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      awayAbbr: game.awayAbbr,
      homeAbbr: game.homeAbbr,
      status: game.status,
      startDate: game.startDate,
      winningSpreadTeam: game.winningSpreadTeam,
      spreadChalk: spreadTotal > 0 ? {
        homePct: Math.round((homeCount / spreadTotal) * 100),
        awayPct: Math.round((awayCount / spreadTotal) * 100),
        homeCount, awayCount,
      } : null,
      totalChalk: totalTotal > 0 ? {
        overPct: Math.round((overCount / totalTotal) * 100),
        underPct: Math.round((underCount / totalTotal) * 100),
        overCount, underCount,
      } : null,
    };
  });
}

/** The FINAL game where the biggest majority of the league picked the losing side. */
export function findBiggestUpset(weeklyChalk = []) {
  let worst = null;
  weeklyChalk.forEach((g) => {
    if (g.status !== 'FINAL' || !g.spreadChalk || !g.winningSpreadTeam || g.winningSpreadTeam === 'push') return;
    const losingSide = g.winningSpreadTeam === 'home' ? 'away' : 'home';
    const losingPct = losingSide === 'home' ? g.spreadChalk.homePct : g.spreadChalk.awayPct;
    if (losingPct > 50 && (!worst || losingPct > worst.majorityWrongPct)) {
      worst = { ...g, majorityWrongPct: losingPct };
    }
  });
  return worst;
}
