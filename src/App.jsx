import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getWeeklyGames, getCachedGamesByWeek } from './services/gameCache';
import { getCurrentWeekString, isGameLocked } from './utils/getCurrentWeek';
import { calculateSeasonStandings, LEAGUE_MEMBERS } from './utils/leaderboard';
import { copyPicksToClipboard } from './utils/exportHelpers';
import PickMatrix from './components/PickMatrix';
import AuthModal from './components/AuthModal';

function Chevron() {
  return (
    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/70" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [selectedUser, setSelectedUser] = useState('Austin');
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekString());
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState({});
  const [allLeaguePicks, setAllLeaguePicks] = useState([]);
  const [seasonPicks, setSeasonPicks] = useState([]);
  const [gamesByWeek, setGamesByWeek] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState(null);

  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [usersList, setUsersList] = useState([]);

  const weekNum = parseInt(selectedWeek.split(' ')[1], 10);

  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setCurrentUser(parsed);
        setSelectedUser(parsed.name);
      } catch (err) {
        console.error('Failed to parse saved user:', err);
      }
    }
    fetchUsersList();
  }, []);

  const fetchUsersList = async () => {
    const { data, error } = await supabase.from('users').select('id, name');
    if (!error && data && data.length > 0) {
      setUsersList(data);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  useEffect(() => {
    async function loadGames() {
      try {
        setApiError(null);
        const liveGames = await getWeeklyGames(2026, weekNum);
        if (liveGames && liveGames.length > 0) {
          setGames(liveGames);
        } else {
          setApiError(`API returned 0 games for Week ${weekNum}. Check API Key or Season Week.`);
        }
      } catch (err) {
        console.error("Failed to load games:", err);
        const msg = err.message === 'Load failed' 
          ? 'Network request failed. Please check Vercel Environment Variables (API Key) or disable ad-blockers.' 
          : err.message;
        setApiError(`API Exception: ${msg}`);
      }
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

  useEffect(() => {
    async function loadSeasonStandingsData() {
      const [{ data: picksData, error: picksError }, cachedByWeek] = await Promise.all([
        supabase.from('user_picks').select('*'),
        getCachedGamesByWeek(2026),
      ]);
      if (picksError) console.error('Failed to load season picks:', picksError);
      if (picksData) setSeasonPicks(picksData);
      setGamesByWeek(cachedByWeek);
    }
    loadSeasonStandingsData();
  }, [weekNum]);

  const handlePick = async (gameId, field, value) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (currentUser.name !== selectedUser) {
      setSelectedUser(currentUser.name);
    }

    const activeUser = currentUser.name;
    const newPicks = { ...picks, [gameId]: { ...picks[gameId], [field]: value } };
    setPicks(newPicks);
    setIsSaving(true);
    try {
      const { error } = await supabase.from('user_picks').upsert(
        { user_name: activeUser, week: weekNum, picks: newPicks, updated_at: new Date().toISOString() },
        { onConflict: 'user_name,week' }
      );
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save pick:', err);
      alert(`Pick didn't save: ${err.message || 'unknown error'}`);
    }
    setIsSaving(false);
  };

  const handleLockToggle = async (targetGameId) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (currentUser.name !== selectedUser) {
      setSelectedUser(currentUser.name);
    }

    const activeUser = currentUser.name;
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
    try {
      const { error } = await supabase.from('user_picks').upsert(
        { user_name: activeUser, week: weekNum, picks: updatedPicks, updated_at: new Date().toISOString() },
        { onConflict: 'user_name,week' }
      );
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save lock:', err);
      alert(`Lock didn't save: ${err.message || 'unknown error'}`);
    }
    setIsSaving(false);
  };

  const standings = calculateSeasonStandings(seasonPicks, gamesByWeek);
  const lockedGameId = Object.keys(picks).find((id) => picks[id]?.isLock);
  const lockedGame = games.find((g) => g.id.toString() === lockedGameId?.toString());

  const availableMembers = Array.from(
    new Set([...LEAGUE_MEMBERS, ...usersList.map((u) => u.name)])
  );

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-crimson-deep">
        <div className="max-w-4xl mx-auto px-5 py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-white tracking-tight">Bama Bois Pick&rsquo;em</h1>
              <p className="text-sm text-white/55 mt-0.5">Weekly spread &amp; total picks</p>
            </div>

            <div>
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/80">
                    Logged in as <strong className="text-white font-semibold">{currentUser.name}</strong>
                  </span>
                  <button
                    onClick={handleLogout}
                    className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full border border-white/15 transition-colors"
                  >
                    Log Out
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-xs font-medium bg-white text-crimson px-3.5 py-1.5 rounded-full hover:bg-white/90 transition-colors"
                >
                  Log In / Register
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="appearance-none bg-white/10 text-white text-sm font-medium rounded-full pl-4 pr-9 py-2 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                {availableMembers.map(m => <option key={m} value={m} className="text-ink">{m}</option>)}
              </select>
              <Chevron />
            </div>
            <div className="relative">
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(e.target.value)}
                className="appearance-none bg-white/10 text-white text-sm font-medium rounded-full pl-4 pr-9 py-2 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
              >
                {[...Array(14)].map((_, i) => <option key={i} value={`Week ${i + 1}`} className="text-ink">Week {i + 1}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        {!currentUser ? (
          <div className="mb-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-2.5 flex items-center justify-between gap-2">
            <span className="text-xs text-amber-900">
              Viewing in read-only mode. Log in with your PIN to make or update picks.
            </span>
            <button
              onClick={() => setShowAuthModal(true)}
              className="shrink-0 text-xs font-medium bg-amber-900 text-white px-3 py-1 rounded-full hover:bg-amber-800 transition-colors"
            >
              Log In
            </button>
          </div>
        ) : currentUser.name !== selectedUser ? (
          <div className="mb-4 rounded-card border border-blue-200 bg-blue-50 px-4 py-2.5 flex items-center justify-between gap-2">
            <span className="text-xs text-blue-900">
              Viewing <strong>{selectedUser}</strong>&rsquo;s picks. You are logged in as <strong>{currentUser.name}</strong>.
            </span>
            <button
              onClick={() => setSelectedUser(currentUser.name)}
              className="shrink-0 text-xs font-medium bg-blue-800 text-white px-3 py-1 rounded-full hover:bg-blue-700 transition-colors"
            >
              Switch to My Picks
            </button>
          </div>
        ) : null}

        {isSaving && (
          <div className="mb-3 text-xs text-muted">Saving…</div>
        )}

        <div className="mb-4 rounded-card bg-crimson text-white px-4 py-3.5 flex items-center justify-between gap-3">
          <div className="text-sm min-w-0">
            <span className="text-white/70">Lock of the week — </span>
            <span className="font-medium">
              {lockedGame ? `${lockedGame.awayTeam} @ ${lockedGame.homeTeam}` : 'Not set yet'}
            </span>
          </div>
          <button
            onClick={() => copyPicksToClipboard(selectedUser, selectedWeek, picks, games)}
            className="shrink-0 text-sm font-medium text-white border border-white/30 rounded-full px-3.5 py-1.5 hover:bg-white/10 transition-colors"
          >
            Copy picks
          </button>
        </div>

        {apiError && (
          <div className="mb-6 rounded-card border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-900">Debug notice</p>
            <p className="text-sm text-amber-800 mt-0.5">{apiError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-10">
          {games.map(game => {
            const lockedByKickoff = isGameLocked(game.startDate);
            const spreadBtnClass = (side) =>
              `flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                picks[game.id]?.spread === side ? 'bg-crimson border-crimson text-white' : 'border-line text-ink hover:border-ink/30'
              }`;
            const totalBtnClass = (side) =>
              `flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                picks[game.id]?.total === side ? 'bg-crimson border-crimson text-white' : 'border-line text-ink hover:border-ink/30'
              }`;
            const statusLabel = game.status === 'FINAL' ? 'Final' : lockedByKickoff ? 'Locked' : 'Upcoming';
            const statusDot = game.status === 'FINAL' ? 'bg-ink' : lockedByKickoff ? 'bg-crimson' : 'bg-muted/40';

            return (
              <div key={game.id} className={`rounded-card border border-line bg-white p-4 ${lockedByKickoff ? 'opacity-70' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted">{game.time}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
                    {statusLabel}
                  </span>
                </div>

                {game.status === 'FINAL' && (
                  <div className="text-xs text-muted mb-3">
                    {game.awayTeam} {game.awayScore} &ndash; {game.homeScore} {game.homeTeam}
                  </div>
                )}

                <div className="text-xs font-medium text-muted mb-1.5">Spread</div>
                <div className="flex items-center gap-2 mb-4">
                  <button
                    disabled={lockedByKickoff}
                    onClick={() => handlePick(game.id, 'spread', 'away')}
                    className={spreadBtnClass('away')}
                  >
                    {game.awayTeam} {game.awaySpread > 0 ? `+${game.awaySpread}` : game.awaySpread}
                  </button>
                  <span className="text-xs text-muted">@</span>
                  <button
                    disabled={lockedByKickoff}
                    onClick={() => handlePick(game.id, 'spread', 'home')}
                    className={spreadBtnClass('home')}
                  >
                    {game.homeTeam} {game.homeSpread > 0 ? `+${game.homeSpread}` : game.homeSpread}
                  </button>
                </div>

                {game.overUnder != null ? (
                  <>
                    <div className="text-xs font-medium text-muted mb-1.5">Total</div>
                    <div className="flex items-center gap-2 mb-4">
                      <button
                        disabled={lockedByKickoff}
                        onClick={() => handlePick(game.id, 'total', 'over')}
                        className={totalBtnClass('over')}
                      >
                        Over {game.overUnder}
                      </button>
                      <button
                        disabled={lockedByKickoff}
                        onClick={() => handlePick(game.id, 'total', 'under')}
                        className={totalBtnClass('under')}
                      >
                        Under {game.overUnder}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-muted italic mb-4">No total line available for this game.</div>
                )}

                <button
                  disabled={lockedByKickoff || !picks[game.id]?.spread}
                  onClick={() => handleLockToggle(game.id)}
                  className={`w-full py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    picks[game.id]?.isLock ? 'bg-ink text-white' : 'border border-line text-muted hover:border-ink/30'
                  }`}
                >
                  {picks[game.id]?.isLock ? 'Lock of the week' : 'Set as lock'}
                </button>
              </div>
            );
          })}
        </div>

        <h2 className="font-display text-lg font-semibold text-ink mb-3">Who picked who</h2>
        <PickMatrix games={games} allLeaguePicks={allLeaguePicks} currentUser={selectedUser} />

        <h2 className="font-display text-lg font-semibold text-ink mt-10 mb-3">Season standings</h2>
        <div className="rounded-card border border-line bg-white overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="p-3 font-medium">Rank</th>
                <th className="p-3 font-medium">Member</th>
                <th className="p-3 font-medium">W-L-P</th>
                <th className="p-3 font-medium">Lock bonuses</th>
                <th className="p-3 font-medium text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((member, idx) => (
                <tr key={member.userName} className="border-b border-line last:border-0">
                  <td className="p-3 font-display font-semibold text-ink">{idx + 1}</td>
                  <td className="p-3">{member.userName}</td>
                  <td className="p-3 text-muted">{member.wins}-{member.losses}-{member.pushes}</td>
                  <td className="p-3">
                    {member.lockBonuses > 0
                      ? <span className="text-crimson font-medium">+{member.lockBonuses}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="p-3 text-right font-display font-semibold text-lg text-ink">{member.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      {showAuthModal && (
        <AuthModal
          users={
            usersList.length > 0
              ? usersList
              : LEAGUE_MEMBERS.map((m) => ({ id: m.toLowerCase().replace(/\s+/g, '_'), name: m }))
          }
          onSuccess={(user) => {
            setCurrentUser(user);
            setSelectedUser(user.name);
            setShowAuthModal(false);
          }}
          onUserCreated={fetchUsersList}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
