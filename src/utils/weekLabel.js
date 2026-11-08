// CFB regular-season weeks are 0-15. Bowl season (including the playoff) is
// filed as extra weeks 16 and up so it reuses everything weeks already do:
// picks, locks, freezes, standings, recap. Bowl week 1 is week 16.
export const FIRST_BOWL_WEEK = 16;
export const BOWL_WEEKS = 7;

export const isBowlWeek = (w) => Number(w) >= FIRST_BOWL_WEEK;

export function weekLabel(w) {
  const n = Number(w);
  return isBowlWeek(n) ? `Bowls ${n - FIRST_BOWL_WEEK + 1}` : `Week ${n}`;
}

// How the stats pages name a week. Normally "W5" in tight columns and
// "Week 5" in full; the combined (all-leagues) page supplies its own names,
// since its weeks are a league's week, e.g. "NFL W5" / "CFB Week 10".
export const defaultWeekName = { short: (w) => `W${w}`, long: weekLabel };
