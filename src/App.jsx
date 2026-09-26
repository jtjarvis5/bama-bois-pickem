import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { fetchWeeklyGames } from './services/cfbApi';
import { getCurrentWeekString, isGameLocked } from './utils/getCurrentWeek';
import { calculateStandings, LEAGUE_MEMBERS } from './utils/leaderboard';
import { copyPicksToClipboard } from './utils/exportHelpers';
import PickMatrix from './components/PickMatrix';

export default function App() {
  const [selectedUser, setSelectedUser] = useState('Austin');
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekString());
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState({});
  const [allLeaguePicks, setAllLeaguePicks] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  const weekNum = parseInt(selectedWeek.replace('Week ', ''), 10) || 5;

  useEffect(() => {
    async function loadGames() {
      const liveGames = await fetchWeeklyGames(2026, 4);
      if (liveGames.length > 0) setGames(liveGames);
    }
    loadGames();
  }, [weekNum]);

  useEffect(() => {
    async function loadInitialPicks() {
      const { data } = await supabase.from('user_picks').select('*').eq('week', weekNum);
      if (data) {
        setAllLeaguePicks(data);
        const currentUserData = data.find(p => p.user_name === selectedUser);
        setPicks(currentUserData?.picks || {});
      }
    }
    loadInitialPicks();

    const picksChannel = supabase
      .channel(`public:user_picks:week_${weekNum}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_picks', filter: `week=eq.${weekNum}` }, (payload) => {
        const updatedRow = payload.new;
        setAllLeaguePicks((prev) => {
          const idx = prev.findIndex(p => p.user_name === updatedRow.user_name);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = updatedRow;
            return copy;
          }
          return [...prev, updatedRow];
        });
        if (updatedRow.user_name === selectedUser) {
          setPicks(updatedRow.picks);
        }
      })
      .subscribe();

    return () => supabase.removeChannel(picksChannel);
  }, [weekNum, selectedUser]);

  const handlePick = async (gameId, spreadChoice) => {
    const newPicks = { ...picks, [gameId]: { ...picks[gameId], spread: spreadChoice } };
    setPicks(newPicks);
    setIsSaving(true);
    await supabase.from('user_picks').upsert(
      { user_name: selectedUser, week: weekNum, picks: newPicks, updated_at: new Date().toISOString() },
      { onConflict: 'user_name,week' }
    );
    setIsSaving(false);
  };

  const handleLockToggle = async (targetGameId) => {
    const isCurrentlyLocked = picks[targetGameId]?.isLock || false;
    const updatedPicks = {};
    Object.keys(picks).forEach((gameId) => {
      updatedPicks[gameId] = { ...picks[gameId], isLock: false };
    });
    if (!isCurrentlyLocked) {
      updatedPicks[targetGameId] = { ...updatedPicks[targetGameId], isLock: true };
    }
    setPicks(updatedPicks);
    setIsSaving(true);
    await supabase.from('user_picks').upsert(
      { user_name: selectedUser, week: weekNum, picks: updatedPicks, updated_at: new Date().toISOString() },
      { onConflict: 'user_name,week' }
    );
    setIsSaving(false);
  };

  const standings = calculateStandings(allLeaguePicks, games);
  const lockedGameId = Object.keys(picks).find((id) => picks[id]?.isLock);
  const lockedGame = games.find((g) => g.id.toString() === lockedGameId?.toString());

  return (
    <div className="max-w-4xl mx-auto p-4 font-sans">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Bama Bois Pick 'Em</h1>
        <div className="flex gap-4 items-center">
          <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="border p-2 rounded">
            {LEAGUE_MEMBERS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="border p-2 rounded">
            {[...Array(14)].map((_, i) => <option key={i} value={`Week ${i + 1}`}>Week {i + 1}</option>)}
          </select>
        </div>
      </header>

      <div className="mb-4 flex justify-between items-center p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <span className="text-sm font-medium text-amber-900">
          {lockedGame ? `🔒 Lock Status: Selected ${lockedGame.homeTeam} vs ${lockedGame.awayTeam}` : '⚠️ Lock Status: No Lock selected yet.'}
        </span>
        <button onClick={() => copyPicksToClipboard(selectedUser, selectedWeek, picks, games)} className="bg-blue-600 text-white px-3 py-1 text-sm rounded hover:bg-blue-700">
          📋 Copy Picks
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {games.map(game => {
          const lockedByKickoff = isGameLocked(game.startDate);
          return (
            <div key={game.id} className={`border p-4 rounded-lg shadow-sm ${lockedByKickoff ? 'opacity-75 bg-gray-50' : 'bg-white'}`}>
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>{game.time}</span>
                {lockedByKickoff && <span className="text-red-500 font-bold">🔒 Kickoff Locked</span>}
              </div>
              <div className="flex justify-between items-center mb-4">
                <button 
                  disabled={lockedByKickoff} 
                  onClick={() => handlePick(game.id, 'away')}
                  className={`flex-1 py-2 rounded border font-semibold ${picks[game.id]?.spread === 'away' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
                >
                  {game.awayTeam} {game.awaySpread > 0 ? `+${game.awaySpread}` : game.awaySpread}
                </button>
                <span className="mx-2 text-gray-400">@</span>
                <button 
                  disabled={lockedByKickoff} 
                  onClick={() => handlePick(game.id, 'home')}
                  className={`flex-1 py-2 rounded border font-semibold ${picks[game.id]?.spread === 'home' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'}`}
                >
                  {game.homeTeam} {game.homeSpread > 0 ? `+${game.homeSpread}` : game.homeSpread}
                </button>
              </div>
              <button
                disabled={lockedByKickoff || !picks[game.id]?.spread}
                onClick={() => handleLockToggle(game.id)}
                className={`w-full py-1 text-sm rounded font-bold transition-colors ${picks[game.id]?.isLock ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} ${(!picks[game.id]?.spread || lockedByKickoff) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {picks[game.id]?.isLock ? '🔒 LOCK OF THE WEEK' : 'Set as Lock'}
              </button>
            </div>
          );
        })}
      </div>

      <h2 className="text-xl font-bold mb-4">Who Picked Who</h2>
      <PickMatrix games={games} allLeaguePicks={allLeaguePicks} />

      <h2 className="text-xl font-bold mt-8 mb-4">Live Standings</h2>
      <table className="w-full text-left border-collapse bg-white shadow-sm rounded-lg overflow-hidden">
        <thead className="bg-gray-100 border-b text-sm text-gray-600">
          <tr>
            <th className="p-3">Rank</th>
            <th className="p-3">Member</th>
            <th className="p-3">W-L-P</th>
            <th className="p-3">Lock Status</th>
            <th className="p-3 text-right">Points</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((member, idx) => (
            <tr key={member.userName} className="border-b">
              <td className="p-3 font-semibold">{idx + 1}</td>
              <td className="p-3">{member.userName}</td>
              <td className="p-3">{member.wins}-{member.losses}-{member.pushes}</td>
              <td className="p-3 text-sm">
                {member.lockWon && <span className="text-green-600 font-bold">WON (+1)</span>}
                {member.lockLost && <span className="text-red-500 font-bold">LOST</span>}
                {!member.lockWon && !member.lockLost && <span className="text-gray-400">PENDING</span>}
              </td>
              <td className="p-3 font-bold text-lg text-right">{member.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
