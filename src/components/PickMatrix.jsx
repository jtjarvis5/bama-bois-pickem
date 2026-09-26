// Helper to evaluate if a pick won, lost, or pushed in the matrix view
function getPickStatus(game, pick, type) {
  if (!game || game.status !== 'FINAL' || !pick) return null;

  if (type === 'spread' && pick.spread) {
    const homeMargin = game.homeScore - game.awayScore;
    const spreadCovered = pick.spread === 'home' 
      ? homeMargin + game.homeSpread 
      : -homeMargin + game.awaySpread;
    
    if (spreadCovered > 0) return 'win';
    if (spreadCovered < 0) return 'loss';
    return 'push';
  }

  if (type === 'total' && pick.total && game.overUnder != null) {
    const totalPoints = game.homeScore + game.awayScore;
    if (pick.total === 'over' && totalPoints > game.overUnder) return 'win';
    if (pick.total === 'under' && totalPoints < game.overUnder) return 'win';
    if (totalPoints === game.overUnder) return 'push';
    return 'loss';
  }

  return null;
}

export default function PickMatrix({ games = [], allLeaguePicks = [], currentUser, allMembers = [] }) {
  // Map picks by username
  const picksByUser = {};
  allLeaguePicks.forEach((row) => {
    picksByUser[row.user_name] = row.picks || {};
  });

  if (!games || games.length === 0) {
    return (
      <div className="rounded-card border border-line bg-white p-6 text-center text-sm text-muted">
        No games available to display matrix.
      </div>
    );
  }

  if (!allMembers || allMembers.length === 0) {
    return (
      <div className="rounded-card border border-line bg-white p-6 text-center text-sm text-muted">
        Waiting for members to join...
      </div>
    );
  }

  const getStatusClasses = (status) => {
    if (status === 'win') return 'text-emerald-600 font-bold';
    if (status === 'loss') return 'text-red-500 line-through opacity-60';
    if (status === 'push') return 'text-gray-500 font-semibold';
    return 'text-ink font-medium';
  };

  return (
    <div className="rounded-card border border-line bg-white overflow-x-auto shadow-sm">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-line bg-paper/50 text-muted">
            <th className="p-3 font-semibold uppercase tracking-wider min-w-[140px]">Game</th>
            {allMembers.map((m) => (
              <th
                key={m}
                className={`p-3 font-semibold uppercase tracking-wider text-center min-w-[90px] ${
                  m === currentUser ? 'text-crimson' : ''
                }`}
              >
                {m} {m === currentUser && '(You)'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id} className="border-b border-line last:border-0 hover:bg-paper/30 transition-colors">
              <td className="p-3">
                <div className="font-semibold text-ink">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-[10px] text-muted font-medium mt-0.5">{game.time}</div>
              </td>
              {allMembers.map((m) => {
                const userPicks = picksByUser[m] || {};
                const gamePick = userPicks[game.id];

                if (!gamePick || (!gamePick.spread && !gamePick.total)) {
                  return (
                    <td key={m} className="p-3 text-center text-muted/30 font-medium">
                      —
                    </td>
                  );
                }

                const spreadStatus = getPickStatus(game, gamePick, 'spread');
                const totalStatus = getPickStatus(game, gamePick, 'total');

                return (
                  <td key={m} className="p-3 text-center">
                    <div className="space-y-1">
                      {gamePick.spread && (
                        <div className={getStatusClasses(spreadStatus)}>
                          {gamePick.spread === 'away' ? game.awayTeam : game.homeTeam}
                        </div>
                      )}
                      {gamePick.total && (
                        <div className={`text-[10px] uppercase tracking-wide ${getStatusClasses(totalStatus)}`}>
                          {gamePick.total} {game.overUnder}
                        </div>
                      )}
                      {gamePick.isLock && (
                        <div className="mt-1">
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            spreadStatus === 'win' ? 'bg-emerald-100 text-emerald-700' : 
                            spreadStatus === 'loss' ? 'bg-red-100 text-red-700 opacity-60' :
                            'bg-crimson/10 text-crimson'
                          }`}>
                            LOCK
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
