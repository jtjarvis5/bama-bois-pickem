import { parseEspnEvents, shouldPoll, fetchLiveScores } from '../src/services/liveScores.js';
import { withLive, elapsedMinutes, liveSpreadStatus, liveTotalStatus, liveWeekPoints, isInPlay } from '../src/utils/live.js';
let fails = 0; const check = (n, ok, x) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + JSON.stringify(x)}`); if (!ok) fails++; };

const ev = (id, state, hs, as, period, clock, detail) => ({ id: String(id), status: { period, clock, type: { state, shortDetail: detail } }, competitions: [{ competitors: [{ homeAway: 'home', score: String(hs) }, { homeAway: 'away', score: String(as) }] }] });
const parsed = parseEspnEvents({ events: [ev(1, 'in', 17, 10, 2, 312, '5:12 - 2nd'), ev(2, 'pre', 0, 0, 0, 0, 'Sat 6:30 PM'), { id: '3', status: {}, competitions: [] }] });
check('parse live event', parsed['1'].state === 'in' && parsed['1'].homeScore === 17 && parsed['1'].awayScore === 10 && parsed['1'].clockSec === 312 && parsed['1'].detail === '5:12 - 2nd', parsed['1']);
check('parse skips malformed', !('3' in parsed));
check('parse empty/garbage', Object.keys(parseEspnEvents(null)).length === 0 && Object.keys(parseEspnEvents({})).length === 0);

const now = Date.parse('2026-11-07T21:00:00Z');
const G = (o) => ({ id: 1, status: 'UPCOMING', startDate: '2026-11-07T20:30:00Z', homeSpread: -6, awaySpread: 6, overUnder: 52.5, homeScore: null, awayScore: null, ...o });
check('poll: game in progress', shouldPoll([G()], now));
check('poll: kickoff in 10 min', shouldPoll([G({ startDate: '2026-11-07T21:10:00Z' })], now));
check('no poll: kickoff in 2 hours', !shouldPoll([G({ startDate: '2026-11-07T23:00:00Z' })], now));
check('no poll: official final', !shouldPoll([G({ status: 'FINAL' })], now));
check('no poll: long over (8h)', !shouldPoll([G({ startDate: '2026-11-07T12:00:00Z' })], now));

let url = '';
const m = await fetchLiveScores([G()], 'CFB', { now, fetchImpl: async (u) => { url = u; return { ok: true, json: async () => ({ events: [ev(1, 'in', 3, 0, 1, 600, 'x')] }) }; } });
check('fetch: CFB url has FBS group and date range', /college-football/.test(url) && /groups=80/.test(url) && /dates=20261106-20261108/.test(url) && m['1'].homeScore === 3, url);
let threw = false; try { await fetchLiveScores([G()], 'NFL', { fetchImpl: async () => ({ ok: false, status: 500 }) }); } catch { threw = true; }
check('fetch: HTTP error throws (hook logs it)', threw);

// overlay
const live = { state: 'in', homeScore: 14, awayScore: 10, period: 2, clockSec: 0, detail: 'Halftime' };
const lg = withLive(G(), live);
check('overlay sets score, keeps official status', lg.homeScore === 14 && lg.status === 'UPCOMING' && isInPlay(lg), lg);
check('overlay ignores pre / final', withLive(G(), { state: 'pre' }).homeScore === null && withLive(G({ status: 'FINAL', homeScore: 20, awayScore: 3 }), live).homeScore === 20);
check('elapsed: halftime=30, Q4 end=60, OT=60, start=0', elapsedMinutes(2, 0) === 30 && elapsedMinutes(4, 0) === 60 && elapsedMinutes(5, 300) === 60 && elapsedMinutes(1, 900) === 0);

// spread: home -6, home leads 14-10 => margin 4 + (-6) = -2 -> home pick behind by 2; away covering by 2
check('home -6 leading by 4: home pick behind by 2', liveSpreadStatus({ spread: 'home' }, lg).text === 'Behind by 2', liveSpreadStatus({ spread: 'home' }, lg));
check('away +6: covering by 2', liveSpreadStatus({ spread: 'away' }, lg).text === 'Covering by 2' && liveSpreadStatus({ spread: 'away' }, lg).tone === 'good');
const push = withLive(G(), { ...live, homeScore: 16, awayScore: 10 });
check('push', liveSpreadStatus({ spread: 'home' }, push).tone === 'even');
check('half-point margins print one decimal', liveSpreadStatus({ spread: 'home' }, withLive(G({ homeSpread: -6.5, awaySpread: 6.5 }), { ...live, homeScore: 21, awayScore: 10 })).text === 'Covering by 4.5');
check('no pick / not in play -> null', liveSpreadStatus(undefined, lg) === null && liveSpreadStatus({ spread: 'home' }, G()) === null);

// total: 24 points at halftime, line 52.5 => pace 48
check('total pace under favors under', liveTotalStatus({ total: 'under' }, lg).tone === 'good' && /on pace for 48/.test(liveTotalStatus({ total: 'under' }, lg).text), liveTotalStatus({ total: 'under' }, lg));
check('total pace under hurts over', liveTotalStatus({ total: 'over' }, lg).tone === 'bad');
const blown = withLive(G(), { ...live, homeScore: 35, awayScore: 21 });
check('over already in', liveTotalStatus({ total: 'over' }, blown).tone === 'good' && /Over is in/.test(liveTotalStatus({ total: 'over' }, blown).text));
check('under busted', liveTotalStatus({ total: 'under' }, blown).tone === 'bad' && /Busted/.test(liveTotalStatus({ total: 'under' }, blown).text));
check('early game: no pace yet', /pts so far/.test(liveTotalStatus({ total: 'over' }, withLive(G(), { ...live, period: 1, clockSec: 800, homeScore: 3, awayScore: 0 })).text));
check('no total line -> null', liveTotalStatus({ total: 'over' }, withLive(G({ overUnder: null }), live)) === null);

// week points: 10-game-ish slate => bonus 1 (round(n/8))
const games = [
  G({ id: 1 }),                                                   // live 14-10, home -6: away covers
  G({ id: 2, status: 'FINAL', homeScore: 30, awayScore: 20, homeSpread: -3, awaySpread: 3, overUnder: 45 }), // official
  G({ id: 3, startDate: '2026-11-08T01:00:00Z' }),                // not started
].map((g, i) => (i === 0 ? lg : g));
const entries = [
  { user_name: 'A', picks: { 1: { spread: 'away', spreadLock: true, total: 'under' }, 2: { spread: 'home', total: 'over' } } },
  { user_name: 'B', picks: { 1: { spread: 'home' }, 2: { spread: 'away', total: 'under' }, 3: { spread: 'home' } } },
];
const rows = liveWeekPoints(entries, games, ['A', 'B', 'C']);
const by = Object.fromEntries(rows.map((r) => [r.userName, r]));
// A: final game: home -3 won by 10 => spread win(+1), over 50>45 win(+1) => final 2. live: away covering +1 +lock bonus 1 = 2; under 24 vs 52.5 currently winning => +1 => live 3
check('A final 2 (official only)', by.A.final === 2, by.A);
check('A live 3 (spread win + lock bonus + total under)', by.A.live === 3 && by.A.covering === 2, by.A);
check('B final 0, live 0 (behind on live game, lost final)', by.B.final === 0 && by.B.live === 0 && by.B.behind === 1, by.B);
check('unstarted game never counts', by.B.final + by.B.live === 0);
check('members without picks listed with zeros; sorted by total', by.C.final === 0 && rows[0].userName === 'A', rows.map((r) => r.userName));
check('null picks tolerated', liveWeekPoints([{ user_name: 'Z', picks: null }], games, []).length === 1);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
