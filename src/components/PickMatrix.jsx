import React from 'react';
import { LEAGUE_MEMBERS } from '../utils/leaderboard';
import { isGameLocked } from '../utils/getCurrentWeek';

function LockGlyph() {
  return (
    <svg className="inline-block w-3 h-3 text-muted/60" viewBox="0 0 12 12" fill="none">
      <rect x="2.5" y="5.5" width="7" height="5" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export default function PickMatrix({ games, allLeaguePicks, currentUser }) {
  const picksByMember = {};
  allLeaguePicks.forEach((row) => {
    picksByMember[row.user_name] = row.picks || {};
  });

  return (
    <div className="rounded-card border border-line bg-white overflow-hidden overflow-x-auto">
      <table className="w-full text-sm text-left border-collapse">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="p-3 font-medium">Matchup</th>
            {LEAGUE_MEMBERS.map(member => (
              <th key={member} className="p-3 font-medium text-center">{member}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => {
            const locked = isGameLocked(game.startDate);
            return (
              <tr key={game.id} className="border-b border-line last:border-0">
                <td className="p-3 text-xs text-ink whitespace-nowrap">
                  {game.awayAbbr} @ {game.homeAbbr}
                </td>
                {LEAGUE_MEMBERS.map((member) => {
                  const isSelf = member === currentUser;

                  // Fairness: hide everyone else's picks for a game until
                  // it actually kicks off, so nobody can copy a pick.
                  // You can always see your own column.
                  if (!locked && !isSelf) {
                    return (
                      <td key={member} className="p-3 text-center">
                        <LockGlyph />
                      </td>
                    );
                  }

                  const pick = picksByMember[member]?.[game.id];
                  if (!pick?.spread && !pick?.total) {
                    return <td key={member} className="p-3 text-center text-muted">–</td>;
                  }
                  const teamName = pick.spread
                    ? (pick.spread === 'home' ? game.homeAbbr : game.awayAbbr)
                    : null;
                  const totalLetter = pick.total ? (pick.total === 'over' ? 'O' : 'U') : null;
                  return (
                    <td key={member} className={`p-3 text-center font-medium ${pick.isLock ? 'text-crimson' : 'text-ink'}`}>
                      {teamName || '–'}{totalLetter ? ` / ${totalLetter}` : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
