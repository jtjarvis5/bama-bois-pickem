// Run through esbuild (the app's imports have no extensions): see tests/run.sh
import { combineLeagues } from '../src/utils/combined.js';
import { calculateSeasonStandings } from '../src/utils/leaderboard.js';
import { buildPickEvents, summarizeMembers, buildWeekGrid } from '../src/utils/insights.js';
import { buildBadges, streakTag } from '../src/utils/badges.js';
import { buildRecap } from '../src/utils/recap.js';
import { buildPreview } from '../src/utils/preview.js';
let fails = 0; const check = (n, ok, x) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + JSON.stringify(x)}`); if (!ok) fails++; };

// ---- sample data: a CFB week (8 games) and an NFL week (8 games), 4 members
const M = ['Jack', 'Jarrett', 'Nick', 'Noah'];
let gid = 1000;
const mkGame = (o) => ({ id: ++gid, status: 'FINAL', homeTeam: `H${gid}`, awayTeam: `A${gid}`, homeAbbr: `H${gid}`, awayAbbr: `A${gid}`, homeSpread: -3, awaySpread: 3, overUnder: 50, homeScore: 30, awayScore: 20, ...o });
// home covers (-3, wins by 10) and the total (50) goes over (50 pts => push!) use 55 pts
const week = (startIso, n, extra = {}) => Array.from({ length: n }, (_, i) => mkGame({ startDate: new Date(Date.parse(startIso) + i * 3600e3).toISOString(), homeScore: 35, awayScore: 20, ...extra }));
const cfbW1 = week('2026-10-31T16:00:00Z', 8, { time: 'Sat 11:00 AM' });
const cfbW2 = week('2026-11-07T16:00:00Z', 8, { time: 'Sat 11:00 AM' });
const nflW9 = week('2026-11-05T01:15:00Z', 8, { time: 'Thu 8:15 PM' });
// everyone's picks: pick(spread side, total side, lock?)
const picksFor = (games, spread, total, lockIdx = -1) => Object.fromEntries(games.map((g, i) => [g.id, { spread, total, ...(i === lockIdx ? { spreadLock: true } : {}) }]));
const cfbPicks = [
  // Jack: wins every pick in CFB week 1 (home covers, over), Noah loses every spread/total
  { user_name: 'Jack', week: 1, picks: picksFor(cfbW1, 'home', 'over', 0) },
  { user_name: 'Noah', week: 1, picks: picksFor(cfbW1, 'away', 'under') },
  { user_name: 'Nick', week: 1, picks: picksFor(cfbW1, 'home', 'under') },
  { user_name: 'Jarrett', week: 1, picks: picksFor(cfbW1, 'away', 'over') },
  { user_name: 'Jack', week: 2, picks: picksFor(cfbW2, 'home', 'over') },
  { user_name: 'Noah', week: 2, picks: picksFor(cfbW2, 'away', 'under') },
];
const nflPicks = [
  { user_name: 'Jack', week: 9, picks: picksFor(nflW9, 'away', 'under') },
  { user_name: 'Jarrett', week: 9, picks: picksFor(nflW9, 'home', 'over', 2) },
  { user_name: 'Noah', week: 9, picks: picksFor(nflW9, 'home', 'over') },
];
const cfb = { league: { id: 1, name: 'Bama Bois', sport: 'CFB' }, picks: cfbPicks, gamesByWeek: { 1: cfbW1, 2: cfbW2 }, members: M };
const nfl = { league: { id: 2, name: 'Bama Bois', sport: 'NFL' }, picks: nflPicks, gamesByWeek: { 9: nflW9 }, members: ['Jack', 'Jarrett', 'Noah', 'Matt'] };

// ---- combined
const c = combineLeagues([cfb, nfl]);
check('3 league-weeks become synthetic weeks 1..3', Object.keys(c.gamesByWeek).join() === '1,2,3', Object.keys(c.gamesByWeek));
check('weeks are in the order played (CFB wk1 Oct31, NFL wk9 Nov5, CFB wk2 Nov7)', c.units.map((u) => `${u.league.sport}${u.week}`).join() === 'CFB1,NFL9,CFB2', c.units.map((u) => `${u.league.sport}${u.week}`));
check('members are the union (incl. Matt who only plays NFL)', ['Jack', 'Jarrett', 'Nick', 'Noah', 'Matt'].every((m) => c.members.includes(m)) && c.members.length === 5, c.members);
check('week names', c.weekName.long(1) === 'CFB Week 1' && c.weekName.long(2) === 'NFL Week 9' && c.weekName.short(2) === 'NFL 9', [c.weekName.long(1), c.weekName.long(2), c.weekName.short(2)]);
check('every pick row remapped', c.seasonPicks.length === 9 && c.seasonPicks.every((r) => r.week >= 1 && r.week <= 3), c.seasonPicks.length);

const combinedTotals = Object.fromEntries(calculateSeasonStandings(c.seasonPicks, c.gamesByWeek, c.members).map((s) => [s.userName, s.totalPoints]));
const sumOwn = {};
[cfb, nfl].forEach((d) => calculateSeasonStandings(d.picks, d.gamesByWeek, c.members).forEach((s) => { sumOwn[s.userName] = (sumOwn[s.userName] || 0) + s.totalPoints; }));
check('combined points == sum of each league\'s own standings (lock bonus stays per league-week)', c.members.every((m) => (combinedTotals[m] || 0) === (sumOwn[m] || 0)), { combinedTotals, sumOwn });
check('sanity: Jack scored (CFB wins + lock bonus)', combinedTotals.Jack > 16, combinedTotals);

// same sport twice -> labelled by league name
const two = combineLeagues([{ ...cfb, league: { id: 1, name: 'Alpha', sport: 'CFB' } }, { ...cfb, league: { id: 3, name: 'Beta', sport: 'CFB' } }]);
check('two CFB leagues: separate units, labelled by league', Object.keys(two.gamesByWeek).length === 4 && two.weekName.long(1).startsWith('Alpha') , two.units.map((u) => u.league.name));
check('empty input is safe', combineLeagues([]).members.length === 0);

// ---- badges
const events = buildPickEvents(c.seasonPicks, c.gamesByWeek, c.members);
const sums = summarizeMembers(events, c.members);
const grid = buildWeekGrid(events, c.gamesByWeek, c.members);
const { awards, tags } = buildBadges({ events, grid, summaries: sums, members: c.members, gamesByWeek: c.gamesByWeek, weekNameLong: c.weekName.long });
const A = Object.fromEntries(awards.map((a) => [a.key, a]));
check('Jack on a hot streak tag (🔥 N>=3)', /^🔥\d+$/.test(tags.Jack), tags);
check('Noah ice cold tag', /^🧊\d+$/.test(tags.Noah), tags);
check('hot award goes to the longest current streak (Jarrett: 17 straight across both leagues)', A.hot?.names.join() === 'Jarrett' && /17 picks in a row/.test(A.hot.detail), A.hot);
check('perfect week: Jack (8 wins, 0 losses) in CFB wk1 + wk2', A.perfect?.names.join() === 'Jack' && /2 weeks/.test(A.perfect.detail), A.perfect);
check('roughest week uses the combined week name', A.worst && /CFB Week|NFL Week/.test(A.worst.detail), A.worst);
check('streakTag thresholds', streakTag({ currentStreak: { type: 'win', length: 2 } }) === '' && streakTag({ currentStreak: { type: 'win', length: 3 } }) === '🔥3' && streakTag({ currentStreak: { type: 'loss', length: 5 } }) === '🧊5' && streakTag(undefined) === '');
const thin = buildBadges({ events: [], grid: { weeks: [], points: {}, winners: {}, weeksWon: {} }, summaries: Object.fromEntries(M.map((m) => [m, sums.Jack && { ...sums.Nick, currentStreak: { type: null, length: 0 } }])), members: M, gamesByWeek: {} });
check('no sample -> no awards', thin.awards.length === 0, thin.awards);

// ---- recap additions (league = CFB only)
const recap = buildRecap({ leagueName: 'Bama Bois', week: 1, seasonRows: cfbPicks, gamesByWeek: { 1: cfbW1, 2: cfbW2 }, members: M });
check('recap still has the original parts', /recap/.test(recap.text) && /winner: Jack/.test(recap.text) && /Season standings/.test(recap.text));
check('recap: league spread/total rates', /📊 The league went \d+% on spreads and \d+% on totals/.test(recap.text), recap.text);
check('recap: perfect week callout', /🎯 Perfect week: Jack \(16-0\)/.test(recap.text), recap.text);
check('recap: rough week callout (everyone with >=4 picks, someone below the top)', /🥶 Rough week: /.test(recap.text), recap.text);
check('recap: hot streak line', /🔥 Hot: Jack \(\d+ straight\)/.test(recap.text), recap.text);

// crowd burned: 3 people take the same side and all lose
const burnGame = mkGame({ startDate: '2026-11-07T16:00:00Z', homeScore: 10, awayScore: 31 });  // away wins big
const burnPicks = ['Jack', 'Nick', 'Noah'].map((u) => ({ user_name: u, week: 5, picks: { [burnGame.id]: { spread: 'home' } } }))
  .concat([{ user_name: 'Jarrett', week: 5, picks: { [burnGame.id]: { spread: 'away' } } }]);
const burnRecap = buildRecap({ leagueName: 'X', week: 5, seasonRows: burnPicks, gamesByWeek: { 5: [burnGame] }, members: M });
check('recap: crowd got burned when 3+ same side all lose', /The crowd got burned/.test(burnRecap.text) && /3 of you were on it/.test(burnRecap.text), burnRecap.text);

// ---- preview
const slate = [
  mkGame({ status: 'UPCOMING', startDate: '2026-11-14T17:00:00Z', time: 'Sat 11:00 AM', awayTeam: 'Alabama', homeTeam: 'Vanderbilt', awayAbbr: 'ALA', homeAbbr: 'VAN', awayRank: 9, homeRank: null, homeSpread: 10, awaySpread: -10, overUnder: 55.5 }),
  mkGame({ status: 'UPCOMING', startDate: '2026-11-14T20:30:00Z', time: 'Sat 2:30 PM', awayTeam: 'Oregon', homeTeam: 'Ohio State', awayAbbr: 'ORE', homeAbbr: 'OSU', awayRank: 4, homeRank: 2, homeSpread: -2.5, awaySpread: 2.5, overUnder: 46.5, weather: { dome: false, temp: 38, wind: 18, gust: 28, precip: 70, code: 63, isDay: true } }),
  mkGame({ status: 'UPCOMING', startDate: '2026-11-14T23:30:00Z', time: 'Sat 5:30 PM', awayTeam: 'A3', homeTeam: 'H3', homeSpread: -7, awaySpread: 7, overUnder: 41 }),
  mkGame({ status: 'UPCOMING', startDate: '2026-11-15T00:30:00Z', time: 'Sat 6:30 PM', awayTeam: 'A4', homeTeam: 'H4', homeSpread: 0, awaySpread: 0, overUnder: 52, weather: { dome: true } }),
];
const pv = buildPreview({ leagueName: 'Bama Bois', week: 11, games: slate, picksRows: [{ user_name: 'Jack', picks: Object.fromEntries(slate.map((g) => [g.id, { spread: 'home' }])) }, { user_name: 'Nick', picks: { [slate[0].id]: { total: 'over' } } }], members: M, seasonRows: cfbPicks, gamesByWeek: { 1: cfbW1, 2: cfbW2 } });
check('preview header + first kickoff + lock bonus', /preview/.test(pv.text) && /First kickoff Sat 11:00 AM/.test(pv.text) && /Lock bonus this week: \+1/.test(pv.text), pv.text);
check('preview: ranked team names, favourite shown with its line', /#9 Alabama @ Vanderbilt — Sat 11:00 AM · ALA -10/.test(pv.text) && /PK/.test(pv.text), pv.text);
check('preview: top matchup', /Top matchup: #4 Oregon @ #2 Ohio State/.test(pv.text), pv.text);
check('preview: weather alert game and dome', /Weather to watch: #4 Oregon/.test(pv.text) && /wind and rain tends to favor the under/.test(pv.text) && /Dome/.test(pv.text), pv.text);
check('preview: who still needs picks with counts', /Still need picks: Jarrett \(0\/4\), Nick \(1\/4\), Noah \(0\/4\)/.test(pv.text), pv.text);
check('preview: race snapshot', /The race:/.test(pv.text) && /1\. Jack/.test(pv.text), pv.text);
check('preview: no games -> null', buildPreview({ week: 3, games: [] }) === null);
const allIn = buildPreview({ week: 11, games: slate, picksRows: M.map((u) => ({ user_name: u, picks: Object.fromEntries(slate.map((g) => [g.id, { spread: 'home' }])) })), members: M });
check('preview: everyone in', /Everyone has picks in/.test(allIn.text), allIn.text);

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
