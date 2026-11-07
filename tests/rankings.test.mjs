import { pickRankings } from '../src/utils/rankings.js';
let fails = 0; const check = (n, ok, x) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + JSON.stringify(x)}`); if (!ok) fails++; };
const poll = (name, ...teams) => ({ poll: name, ranks: teams.map((school, i) => ({ school, rank: i + 1 })) });
const data = [
  { week: 1, polls: [poll('AP Top 25', 'Texas', 'Georgia'), poll('Coaches Poll', 'Georgia', 'Texas')] },
  { week: 9, polls: [poll('AP Top 25', 'Ohio State', 'Texas'), poll('Coaches Poll', 'Texas')] },
  { week: 10, polls: [poll('AP Top 25', 'Ohio State', 'Indiana'), poll('Playoff Committee Rankings', 'Indiana', 'Ohio State')] },
  { week: 11, polls: [poll('AP Top 25', 'Indiana', 'Ohio State'), poll('Playoff Committee Rankings', 'Ohio State', 'Indiana')] },
];
check('before the committee ranks: AP Top 25', pickRankings(data, 9).Texas === 2 && pickRankings(data, 9)['Ohio State'] === 1);
check("week 1 uses that week's AP poll", pickRankings(data, 1).Texas === 1);
check('first committee release: Playoff rankings win over AP', pickRankings(data, 10).Indiana === 1 && pickRankings(data, 10)['Ohio State'] === 2);
check('next week uses the new committee rankings', pickRankings(data, 11)['Ohio State'] === 1);
check('week with no poll yet falls back to the latest earlier one (committee)', pickRankings(data, 12)['Ohio State'] === 1);
check('week 0 uses the earliest poll', pickRankings(data, 0).Texas === 1);
check('only AP released, no committee -> AP', pickRankings([{ week: 10, polls: [poll('AP Top 25', 'A', 'B')] }], 10).A === 1);
check('garbage in -> empty, never throws', JSON.stringify(pickRankings(null, 5)) === '{}' && JSON.stringify(pickRankings([], 5)) === '{}' && JSON.stringify(pickRankings([{ week: 1, polls: [] }], 1)) === '{}');
console.log(fails ? `${fails} FAILED` : 'rankings: all passed'); process.exit(fails ? 1 : 0);
