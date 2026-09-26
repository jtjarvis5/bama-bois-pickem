const CFBD_API_KEY = import.meta.env.VITE_CFBD_API_KEY;
const BASE_URL = 'https://api.collegefootballdata.com';

async function fetchRankings(year, week) {
  try {
    const res = await fetch(`${BASE_URL}/rankings?year=${year}&week=${week}&seasonType=regular`, {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
    });
    if (!res.ok) return {};
    const data = await res.json();
    const weekEntry = Array.isArray(data) ? (data.find(d => d.week === week) || data[0]) : null;
    const apPoll = weekEntry?.polls?.find(p => p.poll === 'AP Top 25');
    const rankMap = {};
    apPoll?.ranks?.forEach(r => { rankMap[r.school] = r.rank; });
    return rankMap;
  } catch (err) {
    // No rankings yet (e.g. preseason) shouldn't break the page -- just
    // fall back to whatever order CFBD returned games in.
    console.error('Rankings fetch failed, falling back to unranked ordering:', err);
    return {};
  }
}

// Higher score = bigger matchup: two ranked teams beats one, and a
// higher (closer to #1) rank contributes more than a lower one.
function gameImportance(game, rankMap) {
  const homeRank = rankMap[game.homeTeam];
  const awayRank = rankMap[game.awayTeam];
  let score = 0;
  if (homeRank) score += 26 - homeRank;
  if (awayRank) score += 26 - awayRank;
  return score;
}

export async function fetchWeeklyGames(year, week) {
  if (!CFBD_API_KEY) {
    // This is the #1 cause of "API key isn't working": Vite bakes env vars
    // in at BUILD time. Setting the var in Vercel does nothing until you
    // trigger a fresh deployment after saving it.
    throw new Error(
      'VITE_CFBD_API_KEY is missing at runtime. In Vercel: Project Settings → ' +
      'Environment Variables → make sure VITE_CFBD_API_KEY is set for "Production" ' +
      '(no quotes around the value), then go to Deployments and trigger a new ' +
      'deploy — just saving the env var does not rebuild the app.'
    );
  }

  console.log(`Fetching CFBD data for Year: ${year}, Week: ${week}`);

  const gamesRes = await fetch(`${BASE_URL}/games?year=${year}&week=${week}&seasonType=regular`, {
    headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
  });

  if (!gamesRes.ok) {
    const bodyText = await gamesRes.text().catch(() => '');
    // Status 401/403 = bad or expired key. Status 400 = bad request params.
    throw new Error(`CFBD /games request failed with status ${gamesRes.status}. ${bodyText.slice(0, 200)}`);
  }

  const gamesData = await gamesRes.json();
  console.log("Games Data Received:", gamesData);

  const linesRes = await fetch(`${BASE_URL}/lines?year=${year}&week=${week}&seasonType=regular`, {
    headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
  });
  const linesData = linesRes.ok ? await linesRes.json() : [];

  const rankMap = await fetchRankings(year, week);

  const linesMap = {};
  if (Array.isArray(linesData)) {
    linesData.forEach(item => {
      const lineObj = item.lines?.find(l => l.provider === 'Bovada') || item.lines?.[0];
      if (lineObj) linesMap[item.id] = { spread: lineObj.spread, overUnder: lineObj.overUnder };
    });
  }

  const formattedGames = gamesData.map(g => {
    // NOTE: CFBD's API returns camelCase fields (homeTeam, awayPoints,
    // startDate, ...), not the snake_case names (home_team, away_points,
    // start_date) this was originally written against. That mismatch was
    // the actual bug -- the key and the request were both fine.
    const line = linesMap[g.id] || { spread: 0, overUnder: null };
    const isBama = g.homeTeam === 'Alabama' || g.awayTeam === 'Alabama';
    const homeSpread = line.spread ?? 0;
    const awaySpread = homeSpread !== 0 ? -homeSpread : 0;
    const overUnder = line.overUnder ?? null;

    let winningSpreadTeam = null;
    let winningTotal = null;
    if (g.completed) {
      const homeMargin = g.homePoints - g.awayPoints;
      if (homeMargin + homeSpread > 0) winningSpreadTeam = 'home';
      else if (homeMargin + homeSpread < 0) winningSpreadTeam = 'away';
      else winningSpreadTeam = 'push';

      if (overUnder != null) {
        const totalPoints = g.homePoints + g.awayPoints;
        if (totalPoints > overUnder) winningTotal = 'over';
        else if (totalPoints < overUnder) winningTotal = 'under';
        else winningTotal = 'push';
      }
    }

    return {
      id: g.id,
      isBama,
      homeTeam: g.homeTeam,
      homeAbbr: g.homeTeam.substring(0, 4).toUpperCase(),
      homeSpread: homeSpread,
      awayTeam: g.awayTeam,
      awayAbbr: g.awayTeam.substring(0, 4).toUpperCase(),
      awaySpread: awaySpread,
      overUnder,
      startDate: g.startDate,
      time: new Date(g.startDate).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      status: g.completed ? 'FINAL' : 'UPCOMING',
      winningSpreadTeam,
      winningTotal
    };
  });

  const bamaGame = formattedGames.find(g => g.isBama);
  const otherGames = formattedGames.filter(g => !g.isBama);
  // Rank the rest by matchup importance (ranked teams) instead of
  // whatever arbitrary order CFBD happened to return.
  const rankedOthers = [...otherGames].sort(
    (a, b) => gameImportance(b, rankMap) - gameImportance(a, rankMap)
  );
  const topGames = rankedOthers.slice(0, 9);
  return bamaGame ? [bamaGame, ...topGames] : rankedOthers.slice(0, 10);
}
