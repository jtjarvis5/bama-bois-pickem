import React from 'react';
import { LEAGUE_MEMBERS } from '../utils/leaderboard';

export default function PickMatrix({ games, allLeaguePicks }) {
  const picksByMember = {};
  allLeaguePicks.forEach((row) => {
    picksByMember[row.user_name] = row.picks || {};
  });

  return (
    <div className="overflow-x-auto my-6 border rounded-lg shadow-sm">
      <table className="w-full text-sm text-left border-collapse">
        <thead className="bg-gray-100 text-gray-700">
          <tr>
            <th className="p-3 border-b">Matchup</th>
            {LEAGUE_MEMBERS.map(member => (
              <th key={member} className="p-3 border-b text-center font-bold">{member}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium text-xs whitespace-nowrap">
                {game.awayAbbr} @ {game.homeAbbr}
              </td>
              {LEAGUE_MEMBERS.map((member) => {
                const pick = picksByMember[member]?.[game.id];
                if (!pick?.spread) return <td key={member} className="p-3 text-center text-gray-400">-</td>;
                const teamName = pick.spread === 'home' ? game.homeAbbr : game.awayAbbr;
                return (
                  <td key={member} className={`p-3 text-center font-semibold ${pick.isLock ? 'text-amber-600' : ''}`}>
                    {teamName} {pick.isLock && '🔒'}
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
