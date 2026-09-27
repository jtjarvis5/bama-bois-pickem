import { supabase } from '../supabaseClient';

const CFBD_API_KEY = import.meta.env.VITE_CFBD_API_KEY;
const BASE_URL = 'https://api.collegefootballdata.com';

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
    throw new Error(
      'VITE_CFBD_API_KEY is missing at runtime. In Vercel: Project Settings → ' +
      'Environment Variables → make sure it is set for "Production", then trigger ' +
      'a new deploy -- just saving the env var does not rebuild the app.'
    );
  }

  const gamesRes = await fetch(`${BASE_URL}/games?year=${year}&week=${week}&seasonType=regular`, {
    headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
  });
  if (!gamesRes.ok) {
    const bodyText = await gamesRes.text().catch(() => '');
    throw new Error(`CFBD /games request failed with status ${gamesRes.status}. ${bodyText.slice(0, 200)}`);
  }
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
// NFL FETCHING (ESPN PUBLIC API -- no key, no quota)
// ==========================================

async function fetchNFLGames(year, week) {
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

    if (odds && odds.details && odds.details.toUpperCase() !== 'EVEN') {
      const parts = odds.details.split(' ');
      if (parts.length >= 2) {
        const favAbbr = parts[0];
        const spreadValue = parseFloat(parts[1]);
        homeSpread = homeTeamData.team.abbreviation === favAbbr ? spreadValue : -spreadValue;
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

async function fetchWeeklyGames(year, week, sport = 'CFB') {
  return sport === 'NFL' ? fetchNFLGames(year, week) : fetchCFBGames(year, week);
}

/**
 * Asks ESPN what week it currently considers "current" (its scoreboard
 * endpoint defaults to this when no ?week= is given). Deliberately not a
 * hardcoded date table -- NFL schedules shift by year and there's no
 * reliable way to hand-maintain that, so we just ask the source of truth.
 */
export async function getCurrentNFLWeek() {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard');
    if (!res.ok) return null;
    const data = await res.json();
    return data?.week?.number ?? null;
  } catch (err) {
    console.error('Failed to detect current NFL week:', err);
    return null;
  }
}

// ==========================================
// SHARED SUPABASE CACHE (this is what actually protects your CFBD quota --
// ESPN's NFL endpoint is free/unlimited so NFL doesn't strictly need it,
// but caching it too costs nothing and keeps things consistent)
// ==========================================

const LIVE_TTL_MS = 30 * 60 * 1000;      // 30 min once a game is underway but not final
const IDLE_TTL_MS = 3 * 60 * 60 * 1000;  // 3 hours otherwise

function pickTtl(cachedGames) {
  const now = Date.now();
  const anyInProgress = cachedGames.some(
    (g) => g.status !== 'FINAL' && new Date(g.startDate).getTime() <= now
  );
  return anyInProgress ? LIVE_TTL_MS : IDLE_TTL_MS;
}

export async function getWeeklyGames(year, week, sport = 'CFB') {
  const cacheKey = `${sport}-${year}-${week}`;

  const { data: cached, error: readError } = await supabase
    .from('games_cache')
    .select('games, fetched_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (readError) {
    console.error('games_cache read failed, falling back to a live call:', readError);
  }

  if (cached?.games?.length) {
    const allFinal = cached.games.every((g) => g.status === 'FINAL');
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    const ttl = pickTtl(cached.games);
    if (allFinal || age < ttl) {
      return cached.games;
    }
  }

  // Cache missing or stale -- this is the only branch that spends CFBD
  // quota (for CFB) or hits ESPN (for NFL, which has no quota concern).
  const freshGames = await fetchWeeklyGames(year, week, sport);

  const { error: writeError } = await supabase
    .from('games_cache')
    .upsert(
      { cache_key: cacheKey, year, week, sport, games: freshGames, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (writeError) {
    console.error('Failed to write games_cache (check the table/policy exist):', writeError);
  }

  return freshGames;
}

/**
 * Reads every already-cached week for a season+sport in one query -- no
 * live fetches at all. A week nobody has ever opened has no cache row and
 * is simply skipped, which is safe: picks can't exist for a week whose
 * games were never loaded in the first place.
 */
export async function getCachedGamesByWeek(year, sport = 'CFB') {
  const { data, error } = await supabase
    .from('games_cache')
    .select('week, games')
    .eq('year', year)
    .eq('sport', sport);

  if (error) {
    console.error('Failed to load season game cache for standings:', error);
    return {};
  }

  const byWeek = {};
  (data || []).forEach((row) => {
    byWeek[row.week] = row.games;
  });
  return byWeek;
}
