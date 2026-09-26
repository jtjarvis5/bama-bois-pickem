import { supabase } from '../supabaseClient';
import { fetchWeeklyGames } from './cfbApi';

// Once any game in the week has kicked off but isn't final yet, refresh
// more often so scores/standings update at a reasonable pace.
const LIVE_TTL_MS = 30 * 60 * 1000;      // 30 minutes
// Otherwise (before kickoff, or once every game is FINAL) there's no need
// to hit CFBD often -- lines barely move and final scores don't change.
const IDLE_TTL_MS = 3 * 60 * 60 * 1000;  // 3 hours

function pickTtl(cachedGames) {
  const now = Date.now();
  const anyInProgress = cachedGames.some(
    (g) => g.status !== 'FINAL' && new Date(g.startDate).getTime() <= now
  );
  return anyInProgress ? LIVE_TTL_MS : IDLE_TTL_MS;
}

/**
 * Shares one CFBD fetch across every viewer of a given week instead of one
 * fetch per page load -- that per-load pattern is what actually burns
 * through the 1,000-call/month free-tier quota. Requires a `games_cache`
 * table in Supabase (see setup SQL).
 */
export async function getWeeklyGames(year, week) {
  const cacheKey = `${year}-${week}`;

  const { data: cached, error: readError } = await supabase
    .from('games_cache')
    .select('games, fetched_at')
    .eq('cache_key', cacheKey)
    .maybeSingle();

  if (readError) {
    console.error('games_cache read failed, falling back to a live CFBD call:', readError);
  }

  if (cached?.games?.length) {
    const allFinal = cached.games.every((g) => g.status === 'FINAL');
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    const ttl = pickTtl(cached.games);

    if (allFinal || age < ttl) {
      console.log(`Serving cached games for ${cacheKey} (age ${Math.round(age / 60000)}m, ttl ${Math.round(ttl / 60000)}m)`);
      return cached.games;
    }
  }

  // Cache missing or stale -- this is the only branch that spends CFBD
  // quota (3 calls: games, lines, rankings).
  console.log(`Cache miss/stale for ${cacheKey} -- calling CFBD live`);
  const freshGames = await fetchWeeklyGames(year, week);

  const { error: writeError } = await supabase
    .from('games_cache')
    .upsert(
      { cache_key: cacheKey, year, week, games: freshGames, fetched_at: new Date().toISOString() },
      { onConflict: 'cache_key' }
    );

  if (writeError) {
    // Not fatal to this page load -- games still render -- but it means
    // the cache never gets populated, so every visitor keeps hitting CFBD
    // directly until the games_cache table/policy is fixed.
    console.error('Failed to write games_cache (check the table and RLS policy exist):', writeError);
  }

  return freshGames;
}

/**
 * Reads every cached week's games for a season in one query -- used for
 * season-long standings. Costs zero CFBD quota since it only reads rows
 * that getWeeklyGames() already wrote to games_cache; weeks nobody has
 * ever opened simply won't have a row (and can't have picks either, since
 * picking requires the games to have loaded first).
 */
export async function getCachedGamesByWeek(year) {
  const { data, error } = await supabase
    .from('games_cache')
    .select('week, games')
    .eq('year', year);

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
