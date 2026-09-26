import { LEAGUE_MEMBERS } from '../utils/leaderboard';

export default function PickMatrix({ games = [], allLeaguePicks = [], currentUser, allMembers }) {
  const members = allMembers && allMembers.length > 0 ? allMembers : LEAGUE_MEMBERS;

  // Map picks by username
  const picksByUser = {};
  allLeaguePicks.forEach((row) => {
    picksByUser[row.user_name] = row.picks || {};
  });

  if (!games || games.length === 0) {
    return (
      <div className="rounded-card border border-line bg-white p-4 text-center text-xs text-muted">
        No games available to display matrix.
      </div>
    );
  }

  return (
    <div className="rounded-card border border-line bg-white overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-line bg-paper/50 text-muted">
            <th className="p-3 font-medium min-w-[140px]">Game</th>
            {members.map((m) => (
              <th
                key={m}
                className={`p-3 font-medium text-center min-w-[90px] ${
                  m === currentUser ? 'text-crimson font-semibold' : ''
                }`}
              >
                {m} {m === currentUser && '(You)'}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id} className="border-b border-line last:border-0 hover:bg-paper/30">
              <td className="p-3">
                <div className="font-medium text-ink">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-[10px] text-muted">{game.time}</div>
              </td>
              {members.map((m) => {
                const userPicks = picksByUser[m] || {};
                const gamePick = userPicks[game.id];

                if (!gamePick || (!gamePick.spread && !gamePick.total)) {
                  return (
                    <td key={m} className="p-3 text-center text-muted/40">
                      —
                    </td>
                  );
                }

                return (
                  <td key={m} className="p-3 text-center">
                    <div className="space-y-0.5">
                      {gamePick.spread && (
                        <div className="font-medium text-ink">
                          {gamePick.spread === 'away' ? game.awayTeam : game.homeTeam}
                        </div>
                      )}
                      {gamePick.total && (
                        <div className="text-[10px] text-muted uppercase">
                          {gamePick.total} {game.overUnder}
                        </div>
                      )}
                      {gamePick.isLock && (
                        <span className="inline-block bg-crimson/10 text-crimson text-[9px] font-semibold px-1.5 py-0.5 rounded">
                          LOCK
                        </span>
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
