import { supabase } from '../supabaseClient';

// CFBD is reached through our own /api/cfbd proxy (api/cfbd.js) so the API
// key stays on the server instead of shipping in the browser bundle.
function cfbd(path, params = {}) {
  return fetch(`/api/cfbd?${new URLSearchParams({ path, ...params })}`);
}

// ==========================================
// COLLEGE FOOTBALL FETCHING (CFBD API)
// ==========================================

/**
 * AP Top 25 for a week, falling back to the most recent poll released at or
 * before that week. One call fetches every poll of the season (no week
 * param), so looking "back" costs nothing extra -- we just pick the right
 * entry. If the requested week is earlier than any poll (e.g. Week 0), we
 * use the earliest one (the preseason poll).
 */
async function fetchRankings(year, week) {
  try {
    let res = await cfbd('rankings', { year, seasonType: 'regular' });
    if (!res.ok) {
      // Defensive: if the no-week form is ever rejected, retry the old way.
      res = await cfbd('rankings', { year, week, seasonType: 'regular' });
      if (!res.ok) return {};
    }
    const data = await res.json();
    if (!Array.isArray(data)) return {};

    const withAP = data
      .map((entry) => ({
        week: entry.week,
        poll: entry.polls?.find((p) => p.poll === 'AP Top 25'),
      }))
      .filter((e) => e.poll?.ranks?.length);
    if (withAP.length === 0) return {};

    const atOrBefore = withAP.filter((e) => e.week <= week).sort((a, b) => b.week - a.week);
    const chosen = atOrBefore[0] || withAP.sort((a, b) => a.week - b.week)[0];

    const rankMap = {};
    chosen.poll.ranks.forEach((r) => { rankMap[r.school] = r.rank; });
    return rankMap;
  } catch (err) {
    console.error('Rankings fetch failed, falling back to Elo/unranked ordering:', err);
    return {};
  }
}

// One call returns every team's record and classification (fbs/fcs/...).
async function fetchRecords(year) {
  try {
    const res = await cfbd('records', { year });
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    (Array.isArray(data) ? data : []).forEach((r) => {
      const t = r.total || {};
      const wins = t.wins ?? 0;
      const losses = t.losses ?? 0;
      const ties = t.ties ?? 0;
      map[r.team] = {
        record: `${wins}-${losses}${ties ? `-${ties}` : ''}`,
        classification: r.classification || null,
      };
    });
    return map;
  } catch (err) {
    console.error('Records fetch failed (records just won\'t display):', err);
    return {};
  }
}

// Unknown classification counts as FBS, so a missing field can never
// silently empty the slate.
const isFBS = (classification) => classification == null || classification === 'fbs';

/**
 * How worth-picking a matchup is. Team strength is the better of AP rank
 * and pregame Elo (so unranked-but-good teams still count when there's no
 * poll), both-ranked gets a bonus, and big spreads shrink the score --
 * a top-5 team beating up on a weak opponent isn't a good pick'em game.
 */
function matchupScore(g, rankMap, spread) {
  const rankPts = (team) => (rankMap[team] ? 26 - rankMap[team] : 0);
  const eloPts = (elo) => (elo ? Math.min(25, Math.max(0, (elo - 1500) / 20)) : 0);
  const homeStrength = Math.max(rankPts(g.homeTeam), eloPts(g.homePregameElo));
  const awayStrength = Math.max(rankPts(g.awayTeam), eloPts(g.awayPregameElo));

  const bothRankedBonus = rankMap[g.homeTeam] && rankMap[g.awayTeam] ? 10 : 0;
  const spreadSize = spread == null ? 10 : Math.abs(spread);
  const competitiveness = 1 / (1 + Math.max(0, spreadSize - 3) / 10);

  return (homeStrength + awayStrength) * competitiveness + bothRankedBonus;
}

// Team logos change essentially never mid-season, so this is cached far
// longer than game data -- one CFBD call gets every FBS team's logo at
// once, and it's reused for a month before asking again.
const LOGO_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function fetchCFBLogosFromAPI() {
  const res = await cfbd('teams/fbs');
  if (!res.ok) return {};
  const teams = await res.json();
  const logoMap = {};
  teams.forEach((t) => {
    if (t.logos && t.logos.length > 0) logoMap[t.school] = t.logos[0];
  });
  return logoMap;
}

async function getCFBLogoMap() {
  const { data: cached } = await supabase
    .from('team_logos')
    .select('logos, fetched_at')
    .eq('sport', 'CFB')
    .maybeSingle();

  if (cached?.logos && Object.keys(cached.logos).length > 0) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < LOGO_TTL_MS) return cached.logos;
  }

  const freshLogos = await fetchCFBLogosFromAPI();
  if (Object.keys(freshLogos).length > 0) {
    await supabase
      .from('team_logos')
      .upsert({ sport: 'CFB', logos: freshLogos, fetched_at: new Date().toISOString() }, { onConflict: 'sport' });
  }
  // Fall back to a stale cached copy over nothing, if the fresh call failed.
  return Object.keys(freshLogos).length > 0 ? freshLogos : (cached?.logos || {});
}

async function fetchCFBGames(year, week, pinnedIds = null) {
  const gamesRes = await cfbd('games', { year, week, seasonType: 'regular' });
  if (!gamesRes.ok) {
    const bodyText = await gamesRes.text().catch(() => '');
    throw new Error(`CFBD /games request failed with status ${gamesRes.status}. ${bodyText.slice(0, 300)}`);
  }
  const gamesData = await gamesRes.json();

  const linesRes = await cfbd('lines', { year, week, seasonType: 'regular' });
  const linesData = linesRes.ok ? await linesRes.json() : [];
  const rankMap = await fetchRankings(year, week);
  const recordsMap = await fetchRecords(year);
  const logoMap = await getCFBLogoMap();

  const linesMap = {};
  if (Array.isArray(linesData)) {
    linesData.forEach(item => {
      const lineObj = item.lines?.find(l => l.provider === 'Bovada') || item.lines?.[0];
      if (lineObj) linesMap[item.id] = { spread: lineObj.spread, overUnder: lineObj.overUnder };
    });
  }

  const formattedEntries = gamesData.map(g => {
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

    const hasLine = linesMap[g.id]?.spread != null;
    const homeClass = g.homeClassification || recordsMap[g.homeTeam]?.classification || null;
    const awayClass = g.awayClassification || recordsMap[g.awayTeam]?.classification || null;

    const game = {
      id: g.id,
      isBama,
      homeTeam: g.homeTeam,
      homeAbbr: g.homeTeam.substring(0, 4).toUpperCase(),
      homeLogo: logoMap[g.homeTeam] || null,
      homeRank: rankMap[g.homeTeam] || null,
      homeRecord: recordsMap[g.homeTeam]?.record || null,
      homeSpread,
      awayTeam: g.awayTeam,
      awayAbbr: g.awayTeam.substring(0, 4).toUpperCase(),
      awayLogo: logoMap[g.awayTeam] || null,
      awayRank: rankMap[g.awayTeam] || null,
      awayRecord: recordsMap[g.awayTeam]?.record || null,
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

    return {
      game,
      fbsVsFbs: isFBS(homeClass) && isFBS(awayClass),
      score: matchupScore(g, rankMap, hasLine ? homeSpread : null),
    };
  });

  const formattedGames = formattedEntries.map((e) => e.game);

  // Pinned slate: the games for this week were already chosen (and people
  // may have picked on them), so skip selection entirely and just return
  // fresh data for exactly those games. /games already contains every game
  // of the week, so this costs no extra CFBD calls.
  if (pinnedIds?.length) {
    const wanted = new Set(pinnedIds.map(String));
    return formattedGames.filter((g) => wanted.has(String(g.id)));
  }

  const bamaGame = formattedGames.find(g => g.isBama);

  // Never feature an FCS opponent (an FCS game can't be a "top game"), then
  // take the highest-scoring matchups. Bama's game stays pinned regardless.
  const rankedOthers = formattedEntries
    .filter((e) => !e.game.isBama && e.fbsVsFbs)
    .sort((a, b) => b.score - a.score)
    .map((e) => e.game);
  const topGames = rankedOthers.slice(0, 9);

  // Importance decides which games make the cut; time decides the order
  // they're displayed in, once selected.
  const byKickoff = (a, b) => new Date(a.startDate) - new Date(b.startDate);
  const chronologicalTop = [...topGames].sort(byKickoff);

  return bamaGame ? [bamaGame, ...chronologicalTop] : rankedOthers.slice(0, 10).sort(byKickoff);
}

// ==========================================
// NFL FETCHING (ESPN PUBLIC API -- no key, no quota)
// ==========================================

// ESPN lists several record types per competitor; we want the overall one.
function overallRecord(competitor) {
  const records = competitor?.records || [];
  const overall = records.find((r) => r.type === 'total' || (r.name || '').toLowerCase() === 'overall');
  return (overall || records[0])?.summary || null;
}

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

    const statusState = event.status?.type?.state; // 'pre' | 'in' | 'post'
    const isCompleted = event.status.type.completed;
    const hasStarted = statusState === 'in' || statusState === 'post' || isCompleted;
    const homeScore = hasStarted ? parseInt(homeTeamData.score, 10) : null;
    const awayScore = hasStarted ? parseInt(awayTeamData.score, 10) : null;

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
      homeLogo: homeTeamData.team.logo || null,
      homeRank: null,
      homeRecord: overallRecord(homeTeamData),
      homeSpread,
      awayTeam: awayTeamData.team.displayName,
      awayAbbr: awayTeamData.team.abbreviation,
      awayLogo: awayTeamData.team.logo || null,
      awayRank: null,
      awayRecord: overallRecord(awayTeamData),
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
  }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
}

async function fetchWeeklyGames(year, week, sport = 'CFB', pinnedIds = null) {
  return sport === 'NFL' ? fetchNFLGames(year, week) : fetchCFBGames(year, week, pinnedIds);
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

/**
 * ESPN (and occasionally CFBD) stop returning betting odds for a game once
 * it's underway or completed -- odds are a pregame feature, not historical
 * data. On top of that, lines can move all week, which raises a fairness
 * question: if the line moves after someone picks, are they graded on what
 * they actually saw? To keep it simple and consistent across the whole
 * league, the line freezes for everyone 24 hours before kickoff -- it can
 * keep tracking the live market before that, but once inside the freeze
 * window it locks to whatever was last cached and stays that way through
 * kickoff, in-progress, and final (when ESPN drops the field entirely).
 */
const FREEZE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours before kickoff

function mergeGameOdds(freshGame, previousGamesById) {
  const prev = previousGamesById[freshGame.id];
  if (!prev) return freshGame;

  const now = Date.now();
  const kickoff = new Date(freshGame.startDate).getTime();
  const isFrozen = now >= kickoff - FREEZE_WINDOW_MS;
  const prevHasRealLine = prev.homeSpread !== 0 || prev.awaySpread !== 0 || prev.overUnder != null;

  const freshHasSpread = freshGame.homeSpread !== 0 || freshGame.awaySpread !== 0;

  let homeSpread, awaySpread, overUnder;
  if (isFrozen && prevHasRealLine) {
    // Inside the freeze window (or past kickoff) -- lock to what we
    // already had, ignore whatever the fresh fetch says entirely.
    homeSpread = prev.homeSpread;
    awaySpread = prev.awaySpread;
    overUnder = prev.overUnder;
  } else {
    // Still tracking the live market -- take the fresh value when it's
    // real, otherwise fall back rather than zeroing out a known-good line.
    homeSpread = freshHasSpread ? freshGame.homeSpread : (prev.homeSpread ?? 0);
    awaySpread = freshHasSpread ? freshGame.awaySpread : (prev.awaySpread ?? 0);
    overUnder = freshGame.overUnder != null ? freshGame.overUnder : (prev.overUnder ?? null);
  }

  const merged = { ...freshGame, homeSpread, awaySpread, overUnder };

  // Records freeze with the line: once inside the window, keep the pregame
  // record instead of one that already includes this game's result.
  if (isFrozen && (prev.homeRecord || prev.awayRecord)) {
    merged.homeRecord = prev.homeRecord ?? merged.homeRecord;
    merged.awayRecord = prev.awayRecord ?? merged.awayRecord;
  }

  if (merged.status === 'FINAL' && merged.homeScore != null && merged.awayScore != null) {
    const homeMargin = merged.homeScore - merged.awayScore;
    if (homeMargin + homeSpread > 0) merged.winningSpreadTeam = 'home';
    else if (homeMargin + homeSpread < 0) merged.winningSpreadTeam = 'away';
    else merged.winningSpreadTeam = 'push';

    if (overUnder != null) {
      const totalPoints = merged.homeScore + merged.awayScore;
      if (totalPoints > overUnder) merged.winningTotal = 'over';
      else if (totalPoints < overUnder) merged.winningTotal = 'under';
      else merged.winningTotal = 'push';
    } else {
      merged.winningTotal = null;
    }
  }

  return merged;
}

/**
 * Whether a CFB week's slate has to stop floating. The "top 9" is re-scored
 * from rankings/Elo/spreads on every refresh, so left alone it can swap a
 * game out after people picked on it -- and a game that leaves the cache
 * takes its picks and points with it. The slate is allowed to float only
 * while it's still harmless: nobody has picked in any league of this sport
 * for this week, and the first game is more than 24h away.
 */
async function isSlateLocked(cachedGames, week, sport) {
  const earliestKickoff = Math.min(...cachedGames.map((g) => new Date(g.startDate).getTime()));
  if (Date.now() >= earliestKickoff - FREEZE_WINDOW_MS) return true;

  const { data: leagueRows, error: leagueErr } = await supabase
    .from('leagues').select('id').eq('sport', sport);
  if (leagueErr) return true; // can't tell -> play it safe and pin
  const leagueIds = (leagueRows || []).map((l) => l.id);
  if (leagueIds.length === 0) return false;

  const { count, error: picksErr } = await supabase
    .from('user_picks')
    .select('id', { count: 'exact', head: true })
    .eq('week', week)
    .in('league_id', leagueIds);
  if (picksErr) return true;
  return (count ?? 0) > 0;
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
  // NFL always shows the full slate, so only CFB needs pinning.
  const pinnedIds = (sport === 'CFB' && cached?.games?.length && await isSlateLocked(cached.games, week, sport))
    ? cached.games.map((g) => g.id)
    : null;

  const freshGames = await fetchWeeklyGames(year, week, sport, pinnedIds);

  // Protect against the odds-disappearing-after-kickoff issue: merge each
  // fresh game against whatever we had cached before, preferring real
  // spread/total values over ones that came back zeroed/missing.
  const previousGamesById = {};
  (cached?.games || []).forEach((g) => { previousGamesById[g.id] = g; });

  // When pinned, keep the cached order, and if CFBD omitted a pinned game
  // this time (rescheduled, API hiccup) keep our last copy rather than
  // letting it -- and its picks -- disappear.
  let slate = freshGames;
  if (pinnedIds) {
    const freshById = {};
    freshGames.forEach((g) => { freshById[g.id] = g; });
    slate = pinnedIds.map((id) => freshById[id] ?? previousGamesById[id]).filter(Boolean);
  }
  const mergedGames = slate.map((g) => mergeGameOdds(g, previousGamesById));

  const { error: writeError } = await supabase
    .from('games_cache')
    .upsert(
      { cache_key: cacheKey, year, week, sport, games: mergedGames, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (writeError) {
    console.error('Failed to write games_cache (check the table/policy exist):', writeError);
  }

  return mergedGames;
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

