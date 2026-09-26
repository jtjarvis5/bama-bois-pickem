const WEEK_SCHEDULE = [
  { week: 1, start: new Date('2026-08-26'), end: new Date('2026-09-02') },
  { week: 2, start: new Date('2026-09-02'), end: new Date('2026-09-09') },
  { week: 3, start: new Date('2026-09-09'), end: new Date('2026-09-16') },
  { week: 4, start: new Date('2026-09-16'), end: new Date('2026-09-23') },
  { week: 5, start: new Date('2026-09-23'), end: new Date('2026-09-30') },
  { week: 6, start: new Date('2026-09-30'), end: new Date('2026-10-07') },
  { week: 7, start: new Date('2026-10-07'), end: new Date('2026-10-14') },
  { week: 8, start: new Date('2026-10-14'), end: new Date('2026-10-21') },
  { week: 9, start: new Date('2026-10-21'), end: new Date('2026-10-28') },
  { week: 10, start: new Date('2026-10-28'), end: new Date('2026-11-04') },
  { week: 11, start: new Date('2026-11-04'), end: new Date('2026-11-11') },
  { week: 12, start: new Date('2026-11-11'), end: new Date('2026-11-18') },
  { week: 13, start: new Date('2026-11-18'), end: new Date('2026-11-25') },
  { week: 14, start: new Date('2026-11-25'), end: new Date('2026-12-02') }
];

export function getCurrentWeekString() {
  const now = new Date();
  const current = WEEK_SCHEDULE.find((w) => now >= w.start && now < w.end);
  return current ? `Week ${current.week}` : 'Week 5';
}

export function isGameLocked(gameStartDate) {
  if (!gameStartDate) return false;
  return new Date() >= new Date(gameStartDate);
}
