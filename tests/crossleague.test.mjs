import { combineLeagues, calendarWeekStart, buildCalendarSeries, leagueLabels } from '../src/utils/combined.js';
import { buildWeeklySeries } from '../src/utils/analytics.js';
import { buildPickEvents } from '../src/utils/insights.js';
import { buildSportSplit, buildHeadToHead } from '../src/utils/crossLeague.js';
let fails = 0; const check = (n, ok, x) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + JSON.stringify(x)}`); if (!ok) fails++; };

let gid = 5000;
const g = (startDate, o = {}) => ({ id: ++gid, status: 'FINAL', startDate, homeSpread: -3, awaySpread: 3, overUnder: 50, homeScore: 35, awayScore: 20, ...o });
const cfb1 = [g('2026-10-31T16:00:00Z'), g('2026-10-31T19:00:00Z')];
const nfl9 = [g('2026-11-05T01:15:00Z'), g('2026-11-08T18:00:00Z')]; // Thu night + Sunday
const cfb2 = [g('2026-11-07T16:00:00Z'), g('2026-11-07T20:00:00Z')];
const P = (games, a, b) => Object.fromEntries(games.map((x, i) => [x.id, i === 0 ? a : b]));
const data = [
  { league: { id: 1, name: 'Bama Bois', sport: 'CFB' }, members: ['Jack', 'Noah'], gamesByWeek: { 1: cfb1, 2: cfb2 }, picks: [
    { user_name: 'Jack', week: 1, picks: P(cfb1, { spread: 'home', total: 'over' }, { spread: 'home', total: 'over' }) },
    { user_name: 'Noah', week: 1, picks: P(cfb1, { spread: 'home', total: 'under' }, { spread: 'away', total: 'over' }) },
    { user_name: 'Jack', week: 2, picks: P(cfb2, { spread: 'away' }, { spread: 'home' }) },
    { user_name: 'Noah', week: 2, picks: P(cfb2, { spread: 'home' }, { spread: 'home' }) },
  ] },
  { league: { id: 2, name: 'Bama Bois', sport: 'NFL' }, members: ['Jack', 'Noah'], gamesByWeek: { 9: nfl9 }, picks: [
    { user_name: 'Jack', week: 9, picks: P(nfl9, { spread: 'away' }, { spread: 'away' }) },
    { user_name: 'Noah', week: 9, picks: P(nfl9, { spread: 'home' }, { spread: 'home' }) },
  ] },
];

// calendar weeks (Tue-Mon, Central): Oct 31 (Sat) and Nov 5-8 are different weeks; Nov 7 same as Nov 5.
const ws = (iso) => calendarWeekStart(Date.parse(iso));
check('Sat Oct 31 -> Tue Oct 27', new Date(ws('2026-10-31T16:00:00Z')).toISOString().slice(0, 10) === '2026-10-27');
check('Thu night Nov 5 (01:15Z = Wed Nov 4 7:15pm CT) -> Tue Nov 3', new Date(ws('2026-11-05T01:15:00Z')).toISOString().slice(0, 10) === '2026-11-03');
check('Mon night game still in the same Tue-Mon week', ws('2026-11-10T01:00:00Z') === ws('2026-11-03T20:00:00Z'));
check('Tuesday 12:30am Central starts the next week', ws('2026-11-10T06:30:00Z') !== ws('2026-11-10T05:30:00Z'));

const combined = combineLeagues(data);
const perUnit = buildWeeklySeries(combined.seasonPicks, combined.gamesByWeek, combined.members);
const all = buildCalendarSeries({ units: combined.units, perUnit, members: combined.members });
check('3 league-weeks fall into 2 calendar weeks (CFB1 | NFL9 + CFB2)', all.weeks.length === 2, all.weeks);
const lastPts = (r, m) => r.series[m][r.series[m].length - 1].cumulative;
const standingsSum = (m) => perUnit.series[m].reduce((a, p) => a + p.weekPoints, 0);
check('calendar series ends at the same total as the unit series', ['Jack', 'Noah'].every((m) => lastPts(all, m) === standingsSum(m)), all.series);
const cfbOnly = buildCalendarSeries({ units: combined.units, perUnit, members: combined.members, include: (u) => u.league.sport === 'CFB' });
check('sport filter: CFB only -> 2 calendar weeks of CFB points', cfbOnly.weeks.length === 2 && lastPts(cfbOnly, 'Jack') <= lastPts(all, 'Jack'));
const nflOnly = buildCalendarSeries({ units: combined.units, perUnit, members: combined.members, include: (u) => u.league.sport === 'NFL' });
check('NFL only -> 1 calendar week; filtered totals add up', nflOnly.weeks.length === 1 && lastPts(cfbOnly, 'Jack') + lastPts(nflOnly, 'Jack') === lastPts(all, 'Jack'));
check('week names read "Oct 27" / "Week of Oct 27"', all.weekName.short(1) === 'Oct 27' && all.weekName.long(1) === 'Week of Oct 27', [all.weekName.short(1), all.weekName.long(1)]);
check('empty is safe', buildCalendarSeries({}).weeks.length === 0);

// labels
check('labels: unique sports -> sport names', JSON.stringify(leagueLabels(data)) === JSON.stringify({ 1: 'CFB', 2: 'NFL' }), leagueLabels(data));
const dup = [{ league: { id: 1, name: 'Alpha', sport: 'CFB' } }, { league: { id: 2, name: 'Beta', sport: 'CFB' } }, { league: { id: 3, name: 'Gamma', sport: 'NFL' } }];
check('labels: duplicate sport -> league names', JSON.stringify(leagueLabels(dup)) === JSON.stringify({ 1: 'Alpha', 2: 'Beta', 3: 'NFL' }), leagueLabels(dup));
const dupName = [{ league: { id: 1, name: 'Same', sport: 'CFB' } }, { league: { id: 2, name: 'Same', sport: 'CFB' } }];
check('labels: duplicate names too -> disambiguated', new Set(Object.values(leagueLabels(dupName))).size === 2, leagueLabels(dupName));

// sport split
const split = buildSportSplit(data, ['Jack', 'Noah']);
check('split: one summary set per league', split.length === 2 && split[0].summaries.Jack && split[1].summaries.Noah);
check('split: Jack CFB spread record 1-2 (wk1 two home wins? 35-20 home -3 covers; wk2 away loses, home wins)', (() => { const s = split[0].summaries.Jack.spread; return s.wins === 3 && s.losses === 1; })(), split[0].summaries.Jack.spread);
check('split: Jack NFL spread 0-2', split[1].summaries.Jack.spread.losses === 2 && split[1].summaries.Jack.spread.wins === 0, split[1].summaries.Jack.spread);

// head to head
const events = buildPickEvents(combined.seasonPicks, combined.gamesByWeek, combined.members);
const h = buildHeadToHead({ combined, events, a: 'Jack', b: 'Noah', labels: leagueLabels(data) });
check('h2h: overall points are the sum of the two leagues\' own scoring', h.overall.Jack.points + h.overall.Noah.points > 0 && h.byLeague.reduce((s, l) => s + l.Jack.points, 0) === h.overall.Jack.points, h.overall);
check('h2h: has both leagues', h.byLeague.map((l) => l.label).sort().join() === 'CFB,NFL', h.byLeague.map((l) => l.label));
// shared bets: CFB wk1 g1 spread agree(home/home) ; total over/under disagree (Jack over wins, Noah under loses 55>50);
check('h2h: shared games counted per bet type, agreement and disagreements', h.shared.games >= 8 && h.shared.agree > 0 && h.shared.disagree > 0 && h.shared.agree + h.shared.disagree === h.shared.games, h.shared);
check('h2h: disagreements split between the two (no push here)', h.shared.aWins + h.shared.bWins === h.shared.disagree, h.shared);
check('h2h: league-weeks won add up to played weeks (3)', h.weeks.a + h.weeks.b + h.weeks.tied === 3, h.weeks);
const solo = buildHeadToHead({ combined, events, a: 'Jack', b: 'Nobody' });
check('h2h: member with no picks is safe', solo.overall.Nobody.points === 0 && solo.shared.games === 0);

// ---- weekly winners + ranks
import { buildWeeklyWinners, rankByPoints } from '../src/utils/crossLeague.js';
{
  const comb = combineLeagues(data);
  const perUnit = buildWeeklySeries(comb.seasonPicks, comb.gamesByWeek, comb.members);
  const w = buildWeeklyWinners({ units: comb.units, perUnit, members: comb.members, startOf: calendarWeekStart });
  check('winners: one row per completed calendar week (Oct27 week, Nov3 week with NFL Thu + CFB Sat)', w.rows.length === 2, w.rows.map((r) => new Date(r.start).toISOString().slice(0, 10)));
  check('winners: week of Nov 3 adds CFB wk2 and NFL wk9 points together', (() => { const r = w.rows.find((x) => new Date(x.start).toISOString().slice(0, 10) === '2026-11-03'); const sum = (m) => perUnit.series[m].filter((pt) => pt.week !== 1).reduce((a, pt) => a + pt.weekPoints, 0); return r && r.points.Jack === sum('Jack') && r.points.Noah === sum('Noah'); })(), w.rows);
  check('winners: tally equals number of weeks with a winner', Object.values(w.tally).reduce((a, b) => a + b, 0) >= 2, w.tally);
  const live = combineLeagues([{ ...data[0], gamesByWeek: { 1: cfb1, 2: cfb2.map((x, i) => (i ? { ...x, status: 'UPCOMING' } : x)) } }, data[1]]);
  const pu = buildWeeklySeries(live.seasonPicks, live.gamesByWeek, live.members);
  const wl = buildWeeklyWinners({ units: live.units, perUnit: pu, members: live.members, startOf: calendarWeekStart });
  check('winners: a week with an unfinished game is not listed yet', wl.rows.length === 1, wl.rows.length);
  const r = rankByPoints({ A: 5, B: 5, C: 2 });
  check('rankByPoints shares ties', r.A.rank === 1 && r.A.tied && r.B.tied && r.C.rank === 3 && !r.C.tied, r);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
