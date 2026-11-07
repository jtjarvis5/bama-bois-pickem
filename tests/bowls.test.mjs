import { bowlWeekFor, getCurrentWeekString, BOWL_ANCHOR } from '../src/utils/getCurrentWeek.js';
import { weekLabel, isBowlWeek, FIRST_BOWL_WEEK } from '../src/utils/weekLabel.js';
let fails = 0; const check = (n, ok, x) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + JSON.stringify(x)}`); if (!ok) fails++; };

check('labels', weekLabel(10) === 'Week 10' && weekLabel(15) === 'Week 15' && weekLabel(16) === 'Bowls 1' && weekLabel(22) === 'Bowls 7');
check('isBowlWeek', !isBowlWeek(15) && isBowlWeek(16));
check('Sat Dec 19 evening CT -> Bowls 1 (week 16)', bowlWeekFor('2026-12-20T01:00:00Z') === 16);
check('Sun night Dec 20 11pm CT (Mon UTC) -> still week 16', bowlWeekFor('2026-12-21T05:00:00Z') === 16);
check('Mon Dec 21 6am UTC (midnight CT) -> week 17', bowlWeekFor('2026-12-21T06:00:00Z') === 17);
check('Dec 31 -> week 18', bowlWeekFor('2026-12-31T20:00:00Z') === 18);
check('Jan 1 2027 -> week 18', bowlWeekFor('2027-01-02T01:00:00Z') === 18);
check('Jan 8 2027 -> week 19', bowlWeekFor('2027-01-09T01:00:00Z') === 19);
check('title game Jan 25 2027 -> week 22 (last)', bowlWeekFor('2027-01-26T01:00:00Z') === 22);
check('way past the end clamps to 22', bowlWeekFor('2027-03-01T00:00:00Z') === 22);
check('before the anchor clamps to 16', bowlWeekFor('2026-12-12T20:00:00Z') === 16);
check('first bowl week is 16', FIRST_BOWL_WEEK === 16 && BOWL_ANCHOR.toISOString() === '2026-12-14T06:00:00.000Z');

// getCurrentWeekString at specific dates
const RealDate = Date;
const at = (iso) => { global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])); } static now() { return new RealDate(iso).getTime(); } }; return getCurrentWeekString(); };
check('Nov 7 -> Week 10', at('2026-11-07T20:00:00Z') === 'Week 10');
check('Dec 10 -> Week 15', at('2026-12-10T20:00:00Z') === 'Week 15');
check('Dec 22 -> Bowls 2 (Week 17)', at('2026-12-22T20:00:00Z') === 'Week 17');
check('Feb -> last bowl week', at('2027-02-10T20:00:00Z') === 'Week 22');
global.Date = RealDate;
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
