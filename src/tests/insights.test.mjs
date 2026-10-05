// Run:  npx tsx tests/insights.test.mjs     (or any runner that resolves extensionless imports)
import { calculateSeasonStandings } from '../src/utils/leaderboard.js';
import { buildWeeklySeries } from '../src/utils/analytics.js';
import {
  buildPickEvents, summarizeMembers, buildWeekGrid, rankMembers, ordinal,
  buildSuperlatives, describeStanding, winRate, formatRecord,
} from '../src/utils/insights.js';

let fails = 0;
const check = (name, cond, info) => { console.log((cond ? 'PASS' : 'FAIL') + '  ' + name + (cond ? '' : '  -> ' + JSON.stringify(info))); if (!cond) fails++; };

// deterministic RNG so a failure is reproducible
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

function randomLeague(seed) {
  const r = rng(seed);
  const pickOf = (arr) => arr[Math.floor(r() * arr.length)];
  const members = ['Alice', 'Bob', 'Cara', 'Dan', 'Eve', 'Finn'].slice(0, 3 + Math.floor(r() * 4));
  const gamesByWeek = {};
  const seasonPicks = [];
  const weeks = [1, 2, 3, 4];
  weeks.forEach((week) => {
    const n = 6 + Math.floor(r() * 12);                 // 6..17 games -> lock bonus 1 or 2
    const games = [];
    for (let i = 0; i < n; i++) {
      const final = r() < 0.85;
      const homeSpread = pickOf([-10.5, -7, -3, -0.5, 0, 2.5, 6, 14]);   // includes 0 (pick'em)
      games.push({
        id: week * 100 + i, status: final ? 'FINAL' : 'UPCOMING',
        startDate: new Date(Date.UTC(2026, 8, week * 7, 12 + i)).toISOString(),
        homeSpread, awaySpread: homeSpread === 0 ? 0 : -homeSpread,
        overUnder: r() < 0.15 ? null : pickOf([41, 44.5, 48, 55.5, 60]),
        homeScore: final ? Math.floor(r() * 45) : null, awayScore: final ? Math.floor(r() * 45) : null,
      });
    }
    gamesByWeek[week] = games;
    members.forEach((m) => {
      if (r() < 0.1) return;                              // skipped the week
      const picks = {};
      let spreadLockUsed = false, totalLockUsed = false;
      games.forEach((g) => {
        if (r() < 0.2) return;                            // skipped the game
        const p = {};
        if (r() < 0.9) p.spread = pickOf(['home', 'away']);
        if (r() < 0.8) p.total = pickOf(['over', 'under']);
        if (p.spread && !spreadLockUsed && r() < 0.15) { r() < 0.3 ? (p.isLock = true) : (p.spreadLock = true); spreadLockUsed = true; }
        if (p.total && !totalLockUsed && r() < 0.15) { p.totalLock = true; totalLockUsed = true; }
        picks[g.id] = p;
      });
      seasonPicks.push({ user_name: m, week, league_id: 1, picks });
    });
  });
  return { members, gamesByWeek, seasonPicks };
}

// ---- 1 & 2: cross-check against Season Standings and the existing weekly series (200 random leagues)
let mismatchStandings = null, mismatchWeekly = null, mismatchRecord = null, n = 0;
for (let seed = 1; seed <= 200; seed++) {
  const { members, gamesByWeek, seasonPicks } = randomLeague(seed);
  const standings = calculateSeasonStandings(seasonPicks, gamesByWeek, members);
  const events = buildPickEvents(seasonPicks, gamesByWeek, members);
  const sums = summarizeMembers(events, members);
  standings.forEach((s) => {
    n++;
    const mine = sums[s.userName];
    if (mine.points !== s.totalPoints && !mismatchStandings) mismatchStandings = { seed, member: s.userName, insights: mine.points, standings: s.totalPoints };
    const w = mine.spread.wins + mine.total.wins, l = mine.spread.losses + mine.total.losses, p = mine.spread.pushes + mine.total.pushes;
    if ((w !== s.wins || l !== s.losses || p !== s.pushes) && !mismatchRecord) mismatchRecord = { seed, member: s.userName, insights: [w, l, p], standings: [s.wins, s.losses, s.pushes] };
    const lockBonusSum = mine.lockBonusPoints;
    if (lockBonusSum !== s.lockBonuses * (s.lockBonuses ? lockBonusFor(gamesByWeek, seasonPicks, s.userName, events) : 0) && false) { /* bonus value varies per week; covered via points */ }
  });
  const grid = buildWeekGrid(events, gamesByWeek, members);
  const { series } = buildWeeklySeries(seasonPicks, gamesByWeek, members);
  members.forEach((m) => series[m].forEach(({ week, weekPoints }) => {
    if (grid.points[m][week] !== weekPoints && !mismatchWeekly) mismatchWeekly = { seed, m, week, grid: grid.points[m][week], series: weekPoints };
  }));
}
function lockBonusFor() { return 0; }
check(`points match Season Standings (${n} member-seasons)`, !mismatchStandings, mismatchStandings);
check('W-L-P records match Season Standings', !mismatchRecord, mismatchRecord);
check('weekly points match the existing weekly series', !mismatchWeekly, mismatchWeekly);

// ---- 3: crowd classification, handcrafted
{
  const game = { id: 1, status: 'FINAL', startDate: '2026-09-05T18:00:00Z', homeScore: 30, awayScore: 10, homeSpread: -3, awaySpread: 3, overUnder: 50 };
  const rows = ['A', 'B', 'C', 'D'].map((m, i) => ({ user_name: m, week: 1, picks: { 1: { spread: i < 3 ? 'home' : 'away', total: i < 2 ? 'over' : 'under' } } }));
  const ev = buildPickEvents(rows, { 1: [game] }, ['A', 'B', 'C', 'D']);
  const get = (m, k) => ev.find((e) => e.member === m && e.kind === k);
  check('majority spread pick is "with"', get('A', 'spread').crowd === 'with');
  check('minority spread pick is "against"', get('D', 'spread').crowd === 'against');
  check('2-2 total split has no crowd', get('A', 'total').crowd === null && get('C', 'total').crowd === null);
  check('favorite/underdog roles', get('A', 'spread').role === 'fav' && get('D', 'spread').role === 'dog');
  const two = buildPickEvents(rows.slice(0, 2), { 1: [game] }, ['A', 'B']);
  check('fewer than 3 pickers: no crowd', two.every((e) => e.crowd === null));
  const excluded = buildPickEvents(rows, { 1: [game] }, ['A', 'B']);
  check('non-members excluded', excluded.every((e) => ['A', 'B'].includes(e.member)));
}

// ---- 4: streaks (kickoff order, pushes neutral)
{
  const mk = (id, h, a, hs = -3) => ({ id, status: 'FINAL', startDate: `2026-09-0${id}T18:00:00Z`, homeScore: h, awayScore: a, homeSpread: hs, awaySpread: -hs, overUnder: null });
  // home -3: 30-10 covers, 20-10 covers, 10-10 loses, 13-10 push, 30-0 covers, 30-0 covers
  const games = [mk(1, 30, 10), mk(2, 20, 10), mk(3, 10, 10), mk(4, 13, 10), mk(5, 30, 0), mk(6, 30, 0)];
  const picks = Object.fromEntries(games.map((g) => [g.id, { spread: 'home' }]));
  const ev = buildPickEvents([{ user_name: 'A', week: 1, picks }], { 1: games }, ['A']);
  const s = summarizeMembers(ev, ['A']).A;
  check('current streak ignores a push and counts back to the loss', s.currentStreak.type === 'win' && s.currentStreak.length === 2, s.currentStreak);
  check('longest win streak', s.longestWinStreak === 2, s.longestWinStreak);
  check('record', formatRecord(s.spread) === '4-1-1', formatRecord(s.spread));
}

// ---- 5: ranks, ordinals, standing description
{
  const standings = [{ userName: 'A', totalPoints: 10 }, { userName: 'B', totalPoints: 8 }, { userName: 'C', totalPoints: 8 }, { userName: 'D', totalPoints: 2 }];
  const r = rankMembers(standings);
  check('ties share a rank and the next rank skips', r.B.rank === 2 && r.C.rank === 2 && r.B.tied && r.D.rank === 4 && !r.A.tied, r);
  check('ordinals', [1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal).join() === '1st,2nd,3rd,4th,11th,12th,13th,21st,22nd,101st,111th', [1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal));
  check('leader is "ahead of second"', JSON.stringify(describeStanding('A', standings).gap) === JSON.stringify({ kind: 'ahead', by: 2, of: 'B' }));
  check('chaser is "behind the leader"', JSON.stringify(describeStanding('D', standings).gap) === JSON.stringify({ kind: 'behind', by: 8, of: 'A' }));
  check('tied for the lead is "level"', describeStanding('B', [{ userName: 'A', totalPoints: 8 }, { userName: 'B', totalPoints: 8 }]).gap.kind === 'level');
  check('unknown member -> null', describeStanding('Z', standings) === null);
}

// ---- 6: week grid winners / weeks won
{
  const mk = (id, week, final) => ({ id, status: final ? 'FINAL' : 'UPCOMING', startDate: `2026-09-0${week}T18:00:00Z`, homeScore: final ? 30 : null, awayScore: final ? 10 : null, homeSpread: -3, awaySpread: 3, overUnder: null });
  const gamesByWeek = { 1: [mk(1, 1, true), mk(2, 1, true)], 2: [mk(3, 2, true), mk(4, 2, false)] };
  const picks = (side1, side2) => ({ 1: { spread: side1 }, 2: { spread: side2 } });
  const rows = [
    { user_name: 'A', week: 1, picks: { 1: { spread: 'home' }, 2: { spread: 'home' } } },
    { user_name: 'B', week: 1, picks: { 1: { spread: 'home' }, 2: { spread: 'away' } } },
    { user_name: 'A', week: 2, picks: { 3: { spread: 'away' } } },
    { user_name: 'B', week: 2, picks: { 3: { spread: 'home' } } },
  ];
  const ev = buildPickEvents(rows, gamesByWeek, ['A', 'B']);
  const g = buildWeekGrid(ev, gamesByWeek, ['A', 'B']);
  check('week 1 winner is A', JSON.stringify(g.winners[1]) === '["A"]', g.winners);
  check('unfinished week lists a leader but awards no week win', JSON.stringify(g.winners[2]) === '["B"]' && g.weeksWon.B === 0 && g.weeksWon.A === 1, g);
  check('complete flags', g.weeks[0].complete === true && g.weeks[1].complete === false);
  const allZero = buildWeekGrid(buildPickEvents([{ user_name: 'A', week: 1, picks: { 1: { spread: 'away' } } }], { 1: [mk(1, 1, true)] }, ['A']), { 1: [mk(1, 1, true)] }, ['A']);
  check('a week where nobody scored has no winner', allZero.winners[1].length === 0 && allZero.weeksWon.A === 0);
  const none = buildWeekGrid([], {}, ['A']);
  check('empty season', none.weeks.length === 0 && none.maxPoints === 0);
}

// ---- 7: superlatives respect sample sizes
{
  const members = ['A', 'B'];
  const summaries = summarizeMembers([], members);
  const grid = buildWeekGrid([], {}, members);
  check('no data -> no superlatives', buildSuperlatives(summaries, grid, members).length === 0);
  summaries.A.spread = { wins: 6, losses: 2, pushes: 0 };   // 8 decided, 75%
  summaries.B.spread = { wins: 3, losses: 5, pushes: 0 };
  const sup = buildSuperlatives(summaries, grid, members);
  check('best-vs-spread names the right member', sup.find((x) => x.key === 'spread')?.names.join() === 'A', sup);
  summaries.B.spread = { wins: 6, losses: 2, pushes: 0 };
  const tied = buildSuperlatives(summaries, grid, members).find((x) => x.key === 'spread');
  check('ties name everyone tied', tied.names.join() === 'A,B', tied);
  summaries.A.spread = { wins: 3, losses: 1, pushes: 0 };    // only 4 decided: below the threshold
  check('too few picks -> not eligible', buildSuperlatives(summaries, grid, members).find((x) => x.key === 'spread')?.names.join() === 'B');
  check('winRate/formatRecord edge cases', winRate({ wins: 0, losses: 0, pushes: 3 }) === null && formatRecord({ wins: 1, losses: 2, pushes: 0 }) === '1-2');
}

console.log(fails ? `\n${fails} FAILED` : '\ninsights: all passed');
process.exit(fails ? 1 : 0);
