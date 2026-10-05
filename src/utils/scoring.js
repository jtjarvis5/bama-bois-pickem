// Shared by leaderboard.js (Season Standings), PickMatrix.jsx (Who Picked
// Who), App.jsx (pick buttons + lock toggles), and StatsPage/analytics.js.
// The win/loss/push formulas themselves still live separately in each of
// those files (unchanged, not part of this update) -- this module only
// covers the lock-bonus rule specifically, since that's the piece that's
// actually changing here. Keeping it in one place means those four
// consumers can't quietly disagree about how a lock is scored.

/**
 * Bonus points a correct lock is worth, scaled to that week's slate size:
 * +1 per every ~8 games in the week, minimum +1. A typical ~10-game CFB
 * week stays at +1 -- this season's CFB standings so far don't change.
 * A full ~16-game NFL week becomes +2.
 *
 * This is a computed default rather than a stored value on purpose, so a
 * future per-league override (e.g. a custom value saved on the league
 * itself) can short-circuit this function later without anything else
 * needing to change.
 */
export function lockBonusValue(weekGames = []) {
  return Math.max(1, Math.round(weekGames.length / 8));
}

/**
 * Whether a pick has its spread lock set. Falls back to the old `isLock`
 * field from before the two-lock system existed, so picks already made
 * this season keep grading exactly as they did when they were made.
 */
export function hasSpreadLock(pick) {
  return Boolean(pick?.spreadLock ?? pick?.isLock);
}

/** Whether a pick has its total (O/U) lock set. New field, no legacy fallback needed. */
export function hasTotalLock(pick) {
  return Boolean(pick?.totalLock);
}


/**
 * Grades one spread pick against a FINAL game: 'win' | 'loss' | 'push', or
 * null when there is nothing to grade (no pick, game not final).
 */
export function gradeSpread(pick, game) {
  if (!pick?.spread || !game || game.status !== 'FINAL') return null;
  const homeMargin = game.homeScore - game.awayScore;
  const spreadCovered = pick.spread === 'home'
    ? homeMargin + game.homeSpread
    : -homeMargin + game.awaySpread;
  if (spreadCovered > 0) return 'win';
  if (spreadCovered < 0) return 'loss';
  return 'push';
}

/** Same for an over/under pick; null too when the game has no total line. */
export function gradeTotal(pick, game) {
  if (!pick?.total || !game || game.status !== 'FINAL' || game.overUnder == null) return null;
  const totalPts = game.homeScore + game.awayScore;
  if (totalPts === game.overUnder) return 'push';
  const hit = (pick.total === 'over' && totalPts > game.overUnder) ||
              (pick.total === 'under' && totalPts < game.overUnder);
  return hit ? 'win' : 'loss';
}
