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
  { week: 14, start: new Date('2026-12-02'), end: new Date('2026-12-09') }
];

export function getCurrentWeekString() {
  const now = new Date();
  const current = WEEK_SCHEDULE.find((w) => now >= w.start && now < w.end);
  if (current) return `Week ${current.week}`;
  // Outside the whole season (before week 1 kicks off, or after week 14
  // ends) -- clamp to the nearest real week instead of a hardcoded guess.
  if (now < WEEK_SCHEDULE[0].start) return `Week ${WEEK_SCHEDULE[0].week}`;
  return `Week ${WEEK_SCHEDULE[WEEK_SCHEDULE.length - 1].week}`;
}

export function isGameLocked(gameStartDate) {
  if (!gameStartDate) return false;
  return new Date() >= new Date(gameStartDate);
}
