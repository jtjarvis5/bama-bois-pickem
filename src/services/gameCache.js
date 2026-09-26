const CFBD_API_KEY = import.meta.env.VITE_CFBD_API_KEY;
const BASE_URL = 'https://api.collegefootballdata.com';

// In-memory cache to prevent spamming APIs when switching weeks or tabs
const localCache = {}; 

// ==========================================
// COLLEGE FOOTBALL FETCHING (CFBD API)
// ==========================================

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
    console.error('Rankings fetch failed, falling back to unranked ordering:', err);
    return {};
  }
}

function gameImportance(game, rankMap) {
  const homeRank = rankMap[game.homeTeam];
  const awayRank = rankMap[game.awayTeam];
  let score = 0;
  if (homeRank) score += 26 - homeRank;
  if (awayRank) score += 26 - awayRank;
  return score;
}

async function fetchCFBGames(year, week) {
  if (!CFBD_API_KEY) {
    throw new Error('VITE_CFBD_API_KEY is missing at runtime.');
  }

  const gamesRes = await fetch(`${BASE_URL}/games?year=${year}&week=${week}&seasonType=regular`, {
    headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
  });

  if (!gamesRes.ok) throw new Error(`CFBD /games request failed with status ${gamesRes.status}.`);
  const gamesData = await gamesRes.json();

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
      homeSpread,
      awayTeam: g.awayTeam,
      awayAbbr: g.awayTeam.substring(0, 4).toUpperCase(),
      awaySpread,
      overUnder,
      startDate: g.startDate,
      homeScore: g.completed ? g.homePoints : null,
      awayScore: g.completed ? g.awayPoints : null,
      time: new Date(g.startDate).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      status: g.completed ? 'FINAL' : 'UPCOMING',
      winningSpreadTeam,
      winningTotal
    };
  });

  const bamaGame = formattedGames.find(g => g.isBama);
  const otherGames = formattedGames.filter(g => !g.isBama);
  const rankedOthers = [...otherGames].sort((a, b) => gameImportance(b, rankMap) - gameImportance(a, rankMap));
  const topGames = rankedOthers.slice(0, 9);
  
  return bamaGame ? [bamaGame, ...topGames] : rankedOthers.slice(0, 10);
}

// ==========================================
// NFL FETCHING (ESPN PUBLIC API)
// ==========================================

async function fetchNFLGames(year, week) {
  // ESPN API: seasontype=2 is Regular Season
  const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?seasontype=2&week=${week}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN API request failed: ${res.status}`);
  const data = await res.json();
  
  return data.events.map(event => {
    const competition = event.competitions[0];
    const homeTeamData = competition.competitors.find(c => c.homeAway === 'home');
    const awayTeamData = competition.competitors.find(c => c.homeAway === 'away');
    
    const odds = competition.odds ? competition.odds[0] : null;
    let homeSpread = 0;
    
    // Parse ESPN's odds format (e.g., "KC -3.5")
    if (odds && odds.details && odds.details.toUpperCase() !== 'EVEN') {
       const parts = odds.details.split(' ');
       if (parts.length >= 2) {
         const favAbbr = parts[0];
         const spreadValue = parseFloat(parts[1]); 
         
         if (homeTeamData.team.abbreviation === favAbbr) {
            homeSpread = spreadValue; // Home team is favored
         } else {
            homeSpread = -spreadValue; // Away team is favored
         }
       }
    }

    const awaySpread = homeSpread !== 0 ? -homeSpread : 0;
    const overUnder = odds && odds.overUnder ? parseFloat(odds.overUnder) : null;
    
    const isCompleted = event.status.type.completed;
    const homeScore = isCompleted ? parseInt(homeTeamData.score, 10) : null;
    const awayScore = isCompleted ? parseInt(awayTeamData.score, 10) : null;

    let winningSpreadTeam = null;
    let winningTotal = null;

    if (isCompleted && homeScore !== null && awayScore !== null) {
      const homeMargin = homeScore - awayScore;
      if (homeMargin + homeSpread > 0) winningSpreadTeam = 'home';
      else if (homeMargin + homeSpread < 0) winningSpreadTeam = 'away';
      else winningSpreadTeam = 'push';

      if (overUnder != null) {
        const totalPoints = homeScore + awayScore;
        if (totalPoints > overUnder) winningTotal = 'over';
        else if (totalPoints < overUnder) winningTotal = 'under';
        else winningTotal = 'push';
      }
    }

    return {
      id: parseInt(event.id, 10),
      isBama: false, 
      homeTeam: homeTeamData.team.displayName,
      homeAbbr: homeTeamData.team.abbreviation,
      homeSpread,
      awayTeam: awayTeamData.team.displayName,
      awayAbbr: awayTeamData.team.abbreviation,
      awaySpread,
      overUnder,
      startDate: event.date,
      homeScore,
      awayScore,
      time: new Date(event.date).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
      status: isCompleted ? 'FINAL' : 'UPCOMING',
      winningSpreadTeam,
      winningTotal
    };
  });
}

// ==========================================
// EXPORTED WRAPPER FUNCTIONS
// ==========================================

export async function fetchWeeklyGames(year, week, sport = 'CFB') {
  console.log(`Fetching live data for ${sport}: Year ${year}, Week ${week}`);
  if (sport === 'NFL') {
    return fetchNFLGames(year, week);
  }
  return fetchCFBGames(year, week);
}

export async function getWeeklyGames(year, week, sport = 'CFB') {
  const cacheKey = `${sport}-${year}-${week}`;
  if (localCache[cacheKey]) {
    return localCache[cacheKey];
  }
  
  const games = await fetchWeeklyGames(year, week, sport);
  localCache[cacheKey] = games;
  return games;
}

export async function getCachedGamesByWeek(year, sport = 'CFB') {
  const result = {};
  const currentWeekToFetch = 10; // Fetches up to week 10 in parallel to hydrate season standings rapidly
  
  const fetches = [];
  for (let w = 1; w <= currentWeekToFetch; w++) {
    const cacheKey = `${sport}-${year}-${w}`;
    if (localCache[cacheKey]) {
      result[w] = localCache[cacheKey];
    } else {
      fetches.push(
        fetchWeeklyGames(year, w, sport).then(games => {
          localCache[cacheKey] = games;
          result[w] = games;
        }).catch(err => console.error(`Failed caching ${sport} Week ${w}:`, err))
      );
    }
  }

  if (fetches.length > 0) {
    await Promise.all(fetches);
  }

  return result;
}
