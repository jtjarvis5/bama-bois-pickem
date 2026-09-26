export const LEAGUE_MEMBERS = ['Austin', 'Bama1', 'Bama2', 'Bama3', 'Bama4'];

export function calculateStandings(allLeaguePicks, games) {
  const completedGames = {};
  games.forEach((game) => {
    if (game.status === 'FINAL' && game.winningSpreadTeam) {
      completedGames[game.id] = { winningTeam: game.winningSpreadTeam };
    }
  });

  const standings = LEAGUE_MEMBERS.map((memberName) => {
    const userRow = allLeaguePicks.find((p) => p.user_name === memberName);
    const userPicks = userRow?.picks || {};
    let wins = 0, losses = 0, pushes = 0, lockWon = false, lockLost = false;

    Object.entries(userPicks).forEach(([gameId, pick]) => {
      const gameResult = completedGames[gameId];
      if (!gameResult || !pick?.spread) return;

      if (gameResult.winningTeam === 'push') pushes += 1;
      else if (gameResult.winningTeam === pick.spread) {
        wins += 1;
        if (pick.isLock) lockWon = true;
      } else {
        losses += 1;
        if (pick.isLock) lockLost = true;
      }
    });

    const totalPoints = wins * 1 + (lockWon ? 1 : 0);
    return { userName: memberName, wins, losses, pushes, lockWon, lockLost, totalPoints };
  });

  return standings.sort((a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins);
}
