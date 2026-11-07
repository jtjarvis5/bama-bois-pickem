// Live scores from ESPN's public scoreboard (no key, no quota). ESPN event ids
// are the same ids CFBD and our own game cache use, so scores line up by id.
// Nothing here is saved: it is an overlay for what is on screen. Official
// finals (what standings use) still come from the game cache.

const BASE = {
  CFB: 'https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard',
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
};

const ymd = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

/** ESPN scoreboard JSON -> { [gameId]: { state, homeScore, awayScore, period, clockSec, detail } } */
export function parseEspnEvents(json) {
  const out = {};
  (json?.events || []).forEach((ev) => {
    const comp = ev.competitions?.[0];
    const home = comp?.competitors?.find((c) => c.homeAway === 'home');
    const away = comp?.competitors?.find((c) => c.homeAway === 'away');
    const state = ev.status?.type?.state; // 'pre' | 'in' | 'post'
    if (!home || !away || !state || ev.id == null) return;
    const hs = parseInt(home.score, 10);
    const as = parseInt(away.score, 10);
    out[String(ev.id)] = {
      state,
      homeScore: Number.isFinite(hs) ? hs : null,
      awayScore: Number.isFinite(as) ? as : null,
      period: ev.status?.period ?? null,
      clockSec: Number.isFinite(ev.status?.clock) ? ev.status.clock : null,
      detail: ev.status?.type?.shortDetail || ev.status?.type?.detail || '',
    };
  });
  return out;
}

/** Is it worth polling right now? Only around kickoffs of games not yet official. */
export function shouldPoll(games = [], now = Date.now()) {
  return games.some((g) => {
    if (g.status === 'FINAL') return false;
    const ko = new Date(g.startDate).getTime();
    return Number.isFinite(ko) && ko - now <= 15 * 60 * 1000 && now - ko <= 7 * 60 * 60 * 1000;
  });
}

export async function fetchLiveScores(games, sport = 'CFB', { fetchImpl = fetch, now = Date.now() } = {}) {
  const times = games
    .filter((g) => g.status !== 'FINAL')
    .map((g) => new Date(g.startDate).getTime())
    .filter(Number.isFinite);
  if (times.length === 0) return {};
  const from = ymd(Math.min(...times) - 24 * 3600e3);
  const to = ymd(Math.max(...times) + 24 * 3600e3);
  const params = new URLSearchParams({ dates: `${from}-${to}`, limit: '400' });
  if (sport === 'CFB') params.set('groups', '80'); // FBS
  const res = await fetchImpl(`${BASE[sport] || BASE.CFB}?${params}`);
  if (!res.ok) throw new Error(`ESPN scoreboard ${res.status}`);
  return parseEspnEvents(await res.json());
}
