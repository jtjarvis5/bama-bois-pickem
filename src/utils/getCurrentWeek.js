import { FIRST_BOWL_WEEK, BOWL_WEEKS } from './weekLabel.js';
// One place to roll the app over to a new season (also update WEEK_SCHEDULE below).
export const SEASON_YEAR = 2026;

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Monday Dec 14 2026, 00:00 Central. Bowl games are grouped into weekly
// stages from here (update with SEASON_YEAR each year).
export const BOWL_ANCHOR = new Date('2026-12-14T06:00:00Z');

/** Which bowl week (16-22) a postseason game belongs to, by kickoff date. */
export function bowlWeekFor(startDate) {
  const t = new Date(startDate).getTime();
  const stage = Math.floor((t - BOWL_ANCHOR.getTime()) / WEEK_MS);
  return FIRST_BOWL_WEEK + Math.min(BOWL_WEEKS - 1, Math.max(0, stage));
}

/** Bowl weeks show up in the selector once conference play is wrapping up. */
export const BOWL_SELECTOR_OPENS = new Date('2026-12-01');

const WEEK_SCHEDULE = [
  { week: 0, start: new Date('2026-08-26'), end: new Date('2026-09-02') },
  { week: 1, start: new Date('2026-09-02'), end: new Date('2026-09-09') },
  { week: 2, start: new Date('2026-09-09'), end: new Date('2026-09-16') },
  { week: 3, start: new Date('2026-09-16'), end: new Date('2026-09-23') },
  { week: 4, start: new Date('2026-09-23'), end: new Date('2026-09-30') },
  { week: 5, start: new Date('2026-09-30'), end: new Date('2026-10-07') },
  { week: 6, start: new Date('2026-10-07'), end: new Date('2026-10-14') },
  { week: 7, start: new Date('2026-10-14'), end: new Date('2026-10-21') },
  { week: 8, start: new Date('2026-10-21'), end: new Date('2026-10-28') },
  { week: 9, start: new Date('2026-10-28'), end: new Date('2026-11-04') },
  { week: 10, start: new Date('2026-11-04'), end: new Date('2026-11-11') },
  { week: 11, start: new Date('2026-11-11'), end: new Date('2026-11-18') },
  { week: 12, start: new Date('2026-11-18'), end: new Date('2026-11-25') },
  { week: 13, start: new Date('2026-11-25'), end: new Date('2026-12-02') },
  { week: 14, start: new Date('2026-12-02'), end: new Date('2026-12-09') },
  { week: 15, start: new Date('2026-12-09'), end: BOWL_ANCHOR },
  // Bowl season: weeks 16-22, one per calendar week (Mon-Sun, Central time).
  ...Array.from({ length: BOWL_WEEKS }, (_, i) => ({
    week: FIRST_BOWL_WEEK + i,
    start: new Date(BOWL_ANCHOR.getTime() + i * WEEK_MS),
    end: new Date(BOWL_ANCHOR.getTime() + (i + 1) * WEEK_MS),
  })),
];

// CFB-specific (includes Week 0 for the season-opening weekend).
export function getCurrentWeekString() {
  const now = new Date();
  const current = WEEK_SCHEDULE.find((w) => now >= w.start && now < w.end);
  if (current) return `Week ${current.week}`;
  if (now < WEEK_SCHEDULE[0].start) return `Week ${WEEK_SCHEDULE[0].week}`;
  return `Week ${WEEK_SCHEDULE[WEEK_SCHEDULE.length - 1].week}`;
}

export function isGameLocked(gameStartDate) {
  if (!gameStartDate) return false;
  return new Date() >= new Date(gameStartDate);
}

