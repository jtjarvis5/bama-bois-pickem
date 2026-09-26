export function calculateSeasonStandings(seasonPicks = [], gamesByWeek = {}, membersList = []) {
  const memberStats = {};

  // 1. Initialize stats for all registered / active members
  membersList.forEach((member) => {
    memberStats[member] = {
      userName: member,
      wins: 0, losses: 0, pushes: 0, lockBonuses: 0, totalPoints: 0,
    };
  });

  // 2. Add historical users (in case someone made picks but was removed from the active list)
  seasonPicks.forEach((p) => {
    if (p.user_name && !memberStats[p.user_name]) {
      memberStats[p.user_name] = {
        userName: p.user_name,
        wins: 0, losses: 0, pushes: 0, lockBonuses: 0, totalPoints: 0,
      };
    }
  });


  // 3. Calculate points and record for each week
  seasonPicks.forEach((userRecord) => {
    const { user_name, week, picks } = userRecord;
    const stats = memberStats[user_name];
    if (!stats || !picks) return;

    const weekGames = gamesByWeek[week] || [];

    Object.keys(picks).forEach((gameId) => {
      const userPick = picks[gameId];
      const game = weekGames.find((g) => g.id.toString() === gameId.toString());

      if (!game || game.status !== 'FINAL') return;

      // Spread check
      if (userPick.spread) {
        const homeMargin = game.homeScore - game.awayScore;
        const spreadCovered =
          userPick.spread === 'home'
            ? homeMargin + game.homeSpread
            : -homeMargin + game.awaySpread;

        if (spreadCovered > 0) {
          stats.wins += 1;
          stats.totalPoints += 1;
          if (userPick.isLock) {
            stats.lockBonuses += 1;
            stats.totalPoints += 1; // Extra point for lock win
          }
        } else if (spreadCovered < 0) {
          stats.losses += 1;
        } else {
          stats.pushes += 1;
        }
      }

      // Total check
      if (userPick.total && game.overUnder != null) {
        const totalPoints = game.homeScore + game.awayScore;
        if (
          (userPick.total === 'over' && totalPoints > game.overUnder) ||
          (userPick.total === 'under' && totalPoints < game.overUnder)
        ) {
          stats.wins += 1;
          stats.totalPoints += 1;
        } else if (totalPoints === game.overUnder) {
          stats.pushes += 1;
        } else {
          stats.losses += 1;
        }
      }
    });
  });

  return Object.values(memberStats).sort(
    (a, b) => b.totalPoints - a.totalPoints || b.wins - a.wins
  );
}
