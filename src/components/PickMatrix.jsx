import React from 'react';
import { LEAGUE_MEMBERS } from '../utils/leaderboard';

export default function PickMatrix({ games, allLeaguePicks }) {
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
          {games.map((game) => (
            <tr key={game.id} className="border-b border-line last:border-0">
              <td className="p-3 text-xs text-ink whitespace-nowrap">
                {game.awayAbbr} @ {game.homeAbbr}
              </td>
              {LEAGUE_MEMBERS.map((member) => {
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
          ))}
        </tbody>
      </table>
    </div>
  );
}
