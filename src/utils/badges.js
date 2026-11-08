// Awards and streak tags, derived from the same graded pick events as the rest
// of the Stats tab (so they always agree with the standings). Every award has a
// minimum sample so nobody earns one off a single lucky pick.

import { decided, winRate, formatRecord, formatPct, emptyRecord } from './insights.js';
import { weekLabel } from './weekLabel.js';

const MIN_WEEK_PICKS = 4;   // decided picks in a week before perfect/worst-week count
const MIN_STREAK = 3;       // hot/cold streak threshold
const MIN_DOG_PICKS = 8;
const MIN_BAMA_PICKS = 4;

const addResult = (rec, result) => {
  if (result === 'win') rec.wins += 1;
  else if (result === 'loss') rec.losses += 1;
  else if (result === 'push') rec.pushes += 1;
};

/** "W6" for a win streak of 3+, "L4" for a loss streak of 3+, else ''. */
export function streakTag(summary) {
  const s = summary?.currentStreak;
  if (!s || s.length < MIN_STREAK) return '';
  return s.type === 'win' ? `W${s.length}` : s.type === 'loss' ? `L${s.length}` : '';
}

function topBy(members, valueOf, { lowest = false } = {}) {
  let best = null;
  let names = [];
  members.forEach((m) => {
    const v = valueOf(m);
    if (v == null) return;
    if (best == null || (lowest ? v < best : v > best)) { best = v; names = [m]; }
    else if (v === best) names.push(m);
  });
  return best == null ? null : { value: best, names };
}

/**
 * Returns { awards, tags }.
 *  awards: [{ key, title, names, detail }]  (league-wide trophy case)
 *  tags:   { member: 'W6' | 'L4' | '' }
 * `weekNameLong` names a week in details (the combined page passes its own).
 */
export function buildBadges({ events = [], grid, summaries = {}, members = [], gamesByWeek = {}, weekNameLong = weekLabel }) {
  const awards = [];
  const add = (key, title, top, detail) => {
    if (top && top.names.length <= 3) awards.push({ key, title, names: top.names, detail: detail(top) });
  };

  const tags = {};
  members.forEach((m) => { tags[m] = streakTag(summaries[m]); });

  // Hot / cold right now
  const hot = members.filter((m) => summaries[m]?.currentStreak.type === 'win' && summaries[m].currentStreak.length >= MIN_STREAK);
  const cold = members.filter((m) => summaries[m]?.currentStreak.type === 'loss' && summaries[m].currentStreak.length >= MIN_STREAK);
  add('hot', 'On fire right now', topBy(hot, (m) => summaries[m].currentStreak.length),
    (t) => `${t.value} picks in a row`);
  add('cold', 'Ice cold right now', topBy(cold, (m) => summaries[m].currentStreak.length),
    (t) => `${t.value} misses in a row`);

  // Per member, per completed week: decided picks and losses.
  const completeWeeks = new Set((grid?.weeks || []).filter((w) => w.complete).map((w) => w.week));
  const wk = {}; // member -> week -> { wins, losses }
  events.forEach((e) => {
    if (!completeWeeks.has(e.week)) return;
    if (e.result !== 'win' && e.result !== 'loss') return;
    const r = ((wk[e.member] ||= {})[e.week] ||= { wins: 0, losses: 0 });
    if (e.result === 'win') r.wins += 1; else r.losses += 1;
  });

  const perfect = {};
  members.forEach((m) => {
    perfect[m] = Object.values(wk[m] || {}).filter((r) => r.losses === 0 && r.wins >= MIN_WEEK_PICKS).length;
  });
  add('perfect', 'Perfect weeks', topBy(members, (m) => (perfect[m] > 0 ? perfect[m] : null)),
    (t) => `${t.value} week${t.value === 1 ? '' : 's'} without a miss`);

  // Roughest week: fewest points in a finished week, among people who made enough picks.
  let worst = null;
  members.forEach((m) => {
    Object.entries(wk[m] || {}).forEach(([week, r]) => {
      if (r.wins + r.losses < MIN_WEEK_PICKS) return;
      const pts = grid.points[m]?.[week] ?? 0;
      if (worst == null || pts < worst.pts) worst = { pts, entries: [{ m, week: Number(week) }] };
      else if (pts === worst.pts) worst.entries.push({ m, week: Number(week) });
    });
  });
  const bestWeekPts = Math.max(0, ...members.flatMap((m) => Object.keys(wk[m] || {}).map((w) => grid.points[m]?.[w] ?? 0)));
  if (worst && worst.pts < bestWeekPts) {
    // One line per member (their earliest such week); skip when it's a big pile-up.
    const firstFor = new Map();
    worst.entries.forEach((e) => { if (!firstFor.has(e.m) || e.week < firstFor.get(e.m)) firstFor.set(e.m, e.week); });
    if (firstFor.size <= 2) {
      awards.push({
        key: 'worst', title: 'Roughest week',
        names: [...firstFor.keys()],
        detail: [...firstFor.entries()].map(([m, w]) => `${firstFor.size > 1 ? `${m}: ` : ''}${worst.pts} pt${worst.pts === 1 ? '' : 's'} in ${weekNameLong(w)}`).join(', '),
      });
    }
  }

  // Underdog lover: highest share of spread picks on the dog.
  add('dogs', 'Underdog lover',
    topBy(members.filter((m) => {
      const s = summaries[m]; if (!s) return false;
      return n(s.dog) + n(s.fav) >= MIN_DOG_PICKS;
    }), (m) => {
      const s = summaries[m];
      const share = n(s.dog) / (n(s.dog) + n(s.fav));
      return share >= 0.6 ? share : null;
    }),
    (t) => `${formatPct(t.value)} of spread picks on the dog`);

  // Alabama games (CFB only): best and worst record.
  const bama = {};
  members.forEach((m) => { bama[m] = emptyRecord(); });
  events.forEach((e) => {
    const g = (gamesByWeek[e.week] || []).find((x) => String(x.id) === String(e.gameId));
    if (g?.isBama && bama[e.member]) addResult(bama[e.member], e.result);
  });
  const bamaPool = members.filter((m) => decided(bama[m]) >= MIN_BAMA_PICKS);
  const bestBama = topBy(bamaPool, (m) => winRate(bama[m]));
  const worstBama = topBy(bamaPool, (m) => winRate(bama[m]), { lowest: true });
  add('bama-best', 'Best on Bama games', bestBama, (t) => `${formatRecord(bama[t.names[0]])} on Alabama games`);
  if (bestBama && worstBama && worstBama.value < bestBama.value) {
    add('bama-worst', 'Bama blind spot', worstBama, (t) => `${formatRecord(bama[t.names[0]])} on Alabama games`);
  }

  return { awards, tags };
}

const n = (rec) => rec.wins + rec.losses + rec.pushes;
