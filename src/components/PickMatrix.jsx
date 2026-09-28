import { isGameLocked } from '../utils/getCurrentWeek';
import { rankWeekPerformance } from '../utils/analytics';

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

function LockGlyph() {
  return (
    <svg className="inline-block w-3.5 h-3.5 text-muted/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export default function PickMatrix({ games = [], allLeaguePicks = [], currentUser, allMembers = [] }) {
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

  // Week totals use the same grading as Season Standings (lock bonus
  // included) and only count FINAL games -- which have already kicked off,
  // so this can never reveal a hidden pick.
  const weekRanking = rankWeekPerformance(allLeaguePicks, games, allMembers);
  const pointsByMember = {};
  weekRanking.forEach((r) => { pointsByMember[r.userName] = r.points; });
  const topPoints = weekRanking.length ? weekRanking[0].points : 0;
  const weekIsOver = games.length > 0 && games.every((g) => g.status === 'FINAL');

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
          {games.map((game) => {
            const locked = isGameLocked(game.startDate);
            return (
              <tr key={game.id} className="border-b border-line last:border-0 hover:bg-paper/30 transition-colors">
                <td className="p-3">
                  <div className="font-semibold text-ink flex items-center gap-1.5">
                    {game.awayLogo && <img src={game.awayLogo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                    <span>{game.awayTeam} @ {game.homeTeam}</span>
                    {game.homeLogo && <img src={game.homeLogo} alt="" className="w-4 h-4 object-contain shrink-0" />}
                  </div>
                  <div className="text-[10px] text-muted font-medium mt-0.5">{game.time}</div>
                </td>
                {allMembers.map((m) => {
                  const isSelf = m === currentUser;

                  // Fairness: hide everyone else's picks for a game until
                  // it actually kicks off, so nobody can copy a pick.
                  // Your own column is always visible to you.
                  if (!locked && !isSelf) {
                    return (
                      <td key={m} className="p-3 text-center">
                        <LockGlyph />
                      </td>
                    );
                  }

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
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-paper/50">
            <td className="p-3 font-semibold text-ink">
              Week total
              <div className="text-[10px] font-medium text-muted mt-0.5">Finished games only</div>
            </td>
            {allMembers.map((m) => {
              const pts = pointsByMember[m] ?? 0;
              const isLeader = topPoints > 0 && pts === topPoints;
              return (
                <td key={m} className="p-3 text-center">
                  <div className={`font-display text-lg font-bold ${isLeader ? 'text-crimson' : 'text-ink'}`}>{pts}</div>
                  {isLeader && (
                    <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-crimson/10 text-crimson">
                      {weekIsOver ? 'Won week' : 'Leading'}
                    </span>
                  )}
                </td>
              );
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
