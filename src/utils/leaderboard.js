export const LEAGUE_MEMBERS = ['Austin', 'Bama1', 'Bama2', 'Bama3', 'Bama4'];

function buildCompletedGamesMap(games) {
  const completed = {};
  (games || []).forEach((game) => {
    if (game.status === 'FINAL') {
      completed[game.id] = {
        winningTeam: game.winningSpreadTeam || null,
        winningTotal: game.winningTotal || null,
      };
    }
  });
  return completed;
}

function gradeUserPicks(userPicks, completedGames) {
  let wins = 0, losses = 0, pushes = 0, lockWon = false, lockLost = false;

  Object.entries(userPicks || {}).forEach(([gameId, pick]) => {
    const gameResult = completedGames[gameId];
    if (!gameResult) return;

    // Against-the-spread pick
    if (pick?.spread && gameResult.winningTeam) {
      if (gameResult.winningTeam === 'push') pushes += 1;
      else if (gameResult.winningTeam === pick.spread) {
        wins += 1;
        if (pick.isLock) lockWon = true;
      } else {
        losses += 1;
        if (pick.isLock) lockLost = true;
      }
    }

    // Over/under pick
    if (pick?.total && gameResult.winningTotal) {
      if (gameResult.winningTotal === 'push') pushes += 1;
      else if (gameResult.winningTotal === pick.total) wins += 1;
      else losses += 1;
    }
  });

  return { wins, losses, pushes, lockWon, lockLost };
}

// Single-week standings. Not used by the main standings table anymore
// (that's season-wide now) but kept in case a per-week view is wanted later.
export function calculateStandings(allLeaguePicks, games) {
  const completedGames = buildCompletedGamesMap(games);

  const standings = LEAGUE_MEMBERS.map((memberName) => {
    const userRow = allLeaguePicks.find((p) => p.user_name === memberName);
    const { wins, losses, pushes, lockWon, lockLost } = gradeUserPicks(userRow?.picks, completedGames);
    const totalPoints = wins + (lockWon ? 1 : 0);
    return { userName: memberName, wins, losses, pushes, lockWon, lockLost, totalPoints };
  });

  return standings.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
}

/**
 * Season-long standings: grades every pick a user has ever made against
 * that pick's own week's completed games. gamesByWeek comes from
 * getCachedGamesByWeek() -- a week with no cached games (nobody's opened
 * it) is simply skipped, which is safe since picks can't exist for a week
 * whose games were never loaded.
 */
export function calculateSeasonStandings(allSeasonPicks, gamesByWeek) {
  const completedByWeek = {};
  Object.entries(gamesByWeek || {}).forEach(([week, games]) => {
    completedByWeek[week] = buildCompletedGamesMap(games);
  });

  const standings = LEAGUE_MEMBERS.map((memberName) => {
    let wins = 0, losses = 0, pushes = 0, lockBonuses = 0;

    allSeasonPicks
      .filter((row) => row.user_name === memberName)
      .forEach((row) => {
        const completedGames = completedByWeek[row.week];
        if (!completedGames) return;
        const result = gradeUserPicks(row.picks, completedGames);
        wins += result.wins;
        losses += result.losses;
        pushes += result.pushes;
        if (result.lockWon) lockBonuses += 1;
      });

    const totalPoints = wins + lockBonuses;
    return { userName: memberName, wins, losses, pushes, lockBonuses, totalPoints };
  });

  return standings.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
}
