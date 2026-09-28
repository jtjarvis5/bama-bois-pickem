import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { getWeeklyGames, getCachedGamesByWeek, getCurrentNFLWeek } from './services/gameCache';
import { getCurrentWeekString, isGameLocked } from './utils/getCurrentWeek';
import { calculateSeasonStandings } from './utils/leaderboard';
import { copyPicksToClipboard } from './utils/exportHelpers';
import PickMatrix from './components/PickMatrix';
import AuthModal from './components/AuthModal';
import CreateLeagueModal from './components/CreateLeagueModal';
import JoinLeagueModal from './components/JoinLeagueModal';
import StatsPage from './components/StatsPage';
import { hasSpreadLock, hasTotalLock, lockBonusValue } from './utils/scoring';

// "#7 LSU (2-0)" -- rank and record each appear only when we have them.
function teamLabel(abbr, rank, record) {
  return `${rank ? `#${rank} ` : ''}${abbr}${record ? ` (${record})` : ''}`;
}

function Chevron() {
  return (
    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-white/70" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-3 h-3 text-crimson" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// Helper to evaluate if a pick won, lost, or pushed
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

export default function App() {
  // App & League State
  const [leagues, setLeagues] = useState([{ id: 1, name: 'Bama Bois', sport: 'CFB' }]);
  const [selectedLeagueId, setSelectedLeagueId] = useState(1);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedWeek, setSelectedWeek] = useState(getCurrentWeekString());
  
  // Game & Pick Data
  const [games, setGames] = useState([]);
  const [picks, setPicks] = useState({});
  const [allLeaguePicks, setAllLeaguePicks] = useState([]);
  const [seasonPicks, setSeasonPicks] = useState([]);
  const [gamesByWeek, setGamesByWeek] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [activeTab, setActiveTab] = useState('games');

  // Auth & Modal State
  const [currentUser, setCurrentUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showLeagueModal, setShowLeagueModal] = useState(false);
  const [leagueToJoin, setLeagueToJoin] = useState(null);
  const [usersList, setUsersList] = useState([]);

  const weekNum = parseInt(selectedWeek.split(' ')[1], 10);
  const activeLeague = leagues.find(l => l.id === selectedLeagueId) || leagues[0];

  useEffect(() => {
    async function initLeagues() {
      const { data } = await supabase.from('leagues').select('*').order('id');
      if (data && data.length > 0) setLeagues(data);
    }
    initLeagues();
    fetchUsersList();
  }, []);

  // Keep the week selector honest for whichever sport is active. CFB uses
  // a fixed date table (season dates are known in advance); NFL asks ESPN
  // directly for its current week rather than guessing at dates.
  useEffect(() => {
    async function syncWeekToSport() {
      if (activeLeague?.sport === 'NFL') {
        const nflWeek = await getCurrentNFLWeek();
        if (nflWeek) setSelectedWeek(`Week ${nflWeek}`);
      } else {
        setSelectedWeek(getCurrentWeekString());
      }
    }
    syncWeekToSport();
  }, [activeLeague?.sport]);

  const fetchUsersList = async () => {
    const { data, error } = await supabase.from('users').select('id, name');
    if (!error && data && data.length > 0) {
      setUsersList(data);
      
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          const userExists = data.some(u => u.name === parsed.name);
          if (userExists) {
            setCurrentUser(parsed);
            if (!selectedUser) setSelectedUser(parsed.name);
          } else {
            handleLogout();
          }
        } catch (err) {
          console.error('Failed to parse saved user:', err);
        }
      } else if (!selectedUser) {
        setSelectedUser(data[0].name); 
      }
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
        const liveGames = await getWeeklyGames(2026, weekNum, activeLeague.sport);
        if (liveGames && liveGames.length > 0) {
          setGames(liveGames);
        } else {
          setApiError(`API returned 0 games for Week ${weekNum}.`);
        }
      } catch (err) {
        console.error("Failed to load games:", err);
        setApiError(`API Exception: ${err.message}`);
      }
    }
    if (activeLeague) loadGames();
  }, [weekNum, selectedLeagueId, activeLeague]);

  useEffect(() => {
    async function loadInitialPicks() {
      const { data } = await supabase.from('user_picks')
        .select('*')
        .eq('week', weekNum)
        .eq('league_id', selectedLeagueId);
        
      if (data) {
        setAllLeaguePicks(data);
        const currentUserData = data.find(p => p.user_name === selectedUser);
        setPicks(currentUserData?.picks || {});
      }
    }
    if (selectedUser && selectedLeagueId) loadInitialPicks();

    const picksChannel = supabase
      .channel(`public:user_picks:league_${selectedLeagueId}_week_${weekNum}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_picks', 
        filter: `league_id=eq.${selectedLeagueId}` 
      }, (payload) => {
        const updatedRow = payload.new;
        if (updatedRow.week !== weekNum) return;

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
  }, [weekNum, selectedUser, selectedLeagueId]);

  useEffect(() => {
    async function loadSeasonStandingsData() {
      // Fetch members specifically mapped to this league to keep standings clean
      const [{ data: membersData }, { data: picksData }, cachedByWeek] = await Promise.all([
        supabase.from('league_members').select('user_name').eq('league_id', selectedLeagueId),
        supabase.from('user_picks').select('*').eq('league_id', selectedLeagueId),
        getCachedGamesByWeek(2026, activeLeague.sport),
      ]);
      
      if (picksData) setSeasonPicks(picksData);
      setGamesByWeek(cachedByWeek);
    }
    if (selectedLeagueId) loadSeasonStandingsData();
  }, [weekNum, selectedLeagueId, activeLeague]);

  // Restrict Standings members to those who have joined this specific league
  const [leagueMembers, setLeagueMembers] = useState([]);
  useEffect(() => {
    async function fetchLeagueMembers() {
      const { data } = await supabase.from('league_members').select('user_name').eq('league_id', selectedLeagueId);
      if (data) setLeagueMembers(data.map(m => m.user_name));
    }
    if (selectedLeagueId) fetchLeagueMembers();
  }, [selectedLeagueId, allLeaguePicks]);

  const availableMembers = usersList.map((u) => u.name);
  const activeStandingsMembers = leagueMembers.length > 0 ? leagueMembers : availableMembers;

  const handleLeagueChange = async (newLeagueId) => {
    if (!currentUser) return setShowAuthModal(true);
    
    const targetLeague = leagues.find(l => l.id === newLeagueId);
    if (!targetLeague) return;

    // Check if the current user is a member of this league
    const { data: membership } = await supabase
      .from('league_members')
      .select('*')
      .eq('league_id', newLeagueId)
      .eq('user_name', currentUser.name)
      .single();

    if (!membership) {
      setLeagueToJoin(targetLeague);
    } else {
      setSelectedLeagueId(newLeagueId);
    }
  };

  const saveToSupabase = async (activeUser, newPicks) => {
    setIsSaving(true);
    const lockedId = Object.keys(newPicks).find((id) => hasSpreadLock(newPicks[id]));
    
    const payload = {
      league_id: selectedLeagueId,
      user_name: activeUser,
      week: weekNum,
      picks: newPicks,
      lock_game_id: lockedId ? parseInt(lockedId, 10) : 0,
      tiebreaker: 0,
    };

    try {
      const { error } = await supabase.from('user_picks').upsert(
        payload, { onConflict: 'league_id,user_name,week' }
      );
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save pick:', err);
      alert(`Pick didn't save: ${err.message || 'unknown error'}`);
    }
    setIsSaving(false);
  };

  const handlePick = async (gameId, field, value) => {
    if (!currentUser) return setShowAuthModal(true);
    if (currentUser.name !== selectedUser) setSelectedUser(currentUser.name);

    const newPicks = { ...picks, [gameId]: { ...picks[gameId], [field]: value } };
    setPicks(newPicks);
    await saveToSupabase(currentUser.name, newPicks);
  };

  // Two independent locks per week: one on a spread pick, one on a total
  // pick. Setting a new one only clears the same lock type on other games
  // -- setting a total lock never touches an existing spread lock.
  const toggleLock = async (targetGameId, lockField, hasLockFn) => {
    if (!currentUser) return setShowAuthModal(true);
    if (currentUser.name !== selectedUser) setSelectedUser(currentUser.name);

    const isCurrentlyLocked = hasLockFn(picks[targetGameId]);
    const updatedPicks = {};
    Object.keys(picks).forEach((gameId) => {
      updatedPicks[gameId] = { ...picks[gameId], [lockField]: false };
    });
    if (!isCurrentlyLocked) {
      updatedPicks[targetGameId] = { ...updatedPicks[targetGameId], [lockField]: true };
    }
    setPicks(updatedPicks);
    await saveToSupabase(currentUser.name, updatedPicks);
  };
  const toggleSpreadLock = (gameId) => toggleLock(gameId, 'spreadLock', hasSpreadLock);
  const toggleTotalLock = (gameId) => toggleLock(gameId, 'totalLock', hasTotalLock);

  const standings = calculateSeasonStandings(seasonPicks, gamesByWeek, activeStandingsMembers);
  const spreadLockedId = Object.keys(picks).find((id) => hasSpreadLock(picks[id]));
  const spreadLockedGame = games.find((g) => g.id.toString() === spreadLockedId?.toString());
  const totalLockedId = Object.keys(picks).find((id) => hasTotalLock(picks[id]));
  const totalLockedGame = games.find((g) => g.id.toString() === totalLockedId?.toString());
  const currentBonusValue = lockBonusValue(games);

  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-crimson-deep">
        <div className="max-w-4xl mx-auto px-5 py-6 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl font-semibold text-white tracking-tight">Pick&rsquo;em</h1>
              <p className="text-sm text-white/55 mt-0.5">Spread &amp; total picks</p>
            </div>

            <div>
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/80 hidden sm:inline">
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

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5">
              <div className="relative">
                <select
                  value={selectedLeagueId}
                  onChange={(e) => handleLeagueChange(parseInt(e.target.value, 10))}
                  className="appearance-none bg-white/20 text-white text-sm font-medium rounded-full pl-4 pr-9 py-2 border border-white/15 focus:outline-none focus:ring-2 focus:ring-white/40"
                >
                  {leagues.map(l => <option key={l.id} value={l.id} className="text-ink">{l.name} ({l.sport})</option>)}
                </select>
                <Chevron />
              </div>
              <button 
                onClick={() => {
                  if (!currentUser) setShowAuthModal(true);
                  else setShowLeagueModal(true);
                }}
                className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-full border border-white/15 transition-colors"
                title="Create new league"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M12 5v14m-7-7h14" />
                </svg>
              </button>
            </div>
            
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
                {[...Array(19)].map((_, i) => <option key={i} value={`Week ${i}`} className="text-ink">Week {i}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        <div className="flex gap-2 mb-5">
          {[['games', 'Games'], ['stats', 'Stats']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                activeTab === key ? 'bg-crimson text-white' : 'bg-white border border-line text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'games' && (
        <>
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

        {isSaving && <div className="mb-3 text-xs text-muted font-medium">Saving…</div>}
        {apiError && <div className="mb-4 text-xs text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">{apiError}</div>}

        <div className="mb-4 rounded-card bg-crimson text-white px-4 py-3.5 flex items-center justify-between gap-3 shadow-sm">
          <div className="text-sm min-w-0 space-y-0.5">
            <div>
              <span className="text-white/70">Spread lock ({currentBonusValue > 1 ? `+${currentBonusValue}` : '+1'}) — </span>
              <span className="font-medium">
                {spreadLockedGame ? `${spreadLockedGame.awayTeam} @ ${spreadLockedGame.homeTeam}` : 'Not set yet'}
              </span>
            </div>
            <div>
              <span className="text-white/70">Total lock ({currentBonusValue > 1 ? `+${currentBonusValue}` : '+1'}) — </span>
              <span className="font-medium">
                {totalLockedGame ? `${totalLockedGame.awayTeam} @ ${totalLockedGame.homeTeam}` : 'Not set yet'}
              </span>
            </div>
          </div>
          <button
            onClick={() => copyPicksToClipboard(selectedUser, selectedWeek, picks, games)}
            className="shrink-0 text-sm font-medium text-white border border-white/30 rounded-full px-3.5 py-1.5 hover:bg-white/10 transition-colors"
          >
            Copy picks
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {games.map(game => {
            const lockedByKickoff = isGameLocked(game.startDate);
            const isFinal = game.status === 'FINAL';
            
            const getBtnClass = (type, side) => {
              const isSelected = picks[game.id]?.[type] === side;
              if (!isSelected) return 'flex-1 py-2.5 rounded-lg border border-line text-ink hover:border-ink/30 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white';
              
              if (!isFinal) return 'flex-1 py-2.5 rounded-lg border border-crimson bg-crimson text-white text-sm font-medium transition-colors disabled:opacity-75 disabled:cursor-not-allowed';
              
              const status = getPickStatus(game, picks[game.id], type);
              if (status === 'win') return 'flex-1 py-2.5 rounded-lg border border-emerald-500 bg-emerald-500 text-white text-sm font-medium shadow-sm';
              if (status === 'loss') return 'flex-1 py-2.5 rounded-lg border border-red-500 bg-red-500 text-white text-sm font-medium opacity-80';
              if (status === 'push') return 'flex-1 py-2.5 rounded-lg border border-gray-500 bg-gray-500 text-white text-sm font-medium';
              
              return 'flex-1 py-2.5 rounded-lg border border-crimson bg-crimson text-white text-sm font-medium';
            };

            const cardWrapperClass = isFinal 
              ? 'bg-paper/40 border-line/60 opacity-90'
              : lockedByKickoff 
                ? 'bg-gray-50/80 border-line opacity-80' 
                : 'bg-white border-line shadow-sm';

            return (
              <div key={game.id} className={`rounded-xl border p-4 transition-all ${cardWrapperClass}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted font-medium">{game.time}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted font-medium">
                    {isFinal ? (
                      <><span className="w-1.5 h-1.5 rounded-full bg-ink" />Final</>
                    ) : lockedByKickoff ? (
                      <><LockIcon />Locked</>
                    ) : (
                      <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Upcoming</>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-2 mb-2.5">
                  {game.awayLogo && <img src={game.awayLogo} alt="" className="w-5 h-5 object-contain" />}
                  <span className="text-xs font-medium text-muted">{teamLabel(game.awayAbbr, game.awayRank, game.awayRecord)} @ {teamLabel(game.homeAbbr, game.homeRank, game.homeRecord)}</span>
                  {game.homeLogo && <img src={game.homeLogo} alt="" className="w-5 h-5 object-contain" />}
                </div>

                {(game.homeScore != null && game.awayScore != null) && (
                  <div className="text-sm font-display font-semibold text-ink mb-3 bg-paper/50 py-2 px-3 rounded-lg text-center">
                    {game.awayTeam} <span className="text-crimson mx-1">{game.awayScore}</span> - <span className="text-crimson mx-1">{game.homeScore}</span> {game.homeTeam}
                    {!isFinal && <span className="ml-2 text-[10px] font-sans font-bold text-emerald-600 align-middle">LIVE</span>}
                  </div>
                )}

                <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wide">Spread</div>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    disabled={lockedByKickoff}
                    onClick={() => handlePick(game.id, 'spread', 'away')}
                    className={getBtnClass('spread', 'away')}
                  >
                    {game.awayTeam} {game.awaySpread > 0 ? `+${game.awaySpread}` : game.awaySpread}
                  </button>
                  <span className="text-xs text-muted font-medium">@</span>
                  <button
                    disabled={lockedByKickoff}
                    onClick={() => handlePick(game.id, 'spread', 'home')}
                    className={getBtnClass('spread', 'home')}
                  >
                    {game.homeTeam} {game.homeSpread > 0 ? `+${game.homeSpread}` : game.homeSpread}
                  </button>
                </div>
                <button
                  disabled={lockedByKickoff || !picks[game.id]?.spread}
                  onClick={() => toggleSpreadLock(game.id)}
                  className={`mb-4 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                    hasSpreadLock(picks[game.id]) ? 'bg-ink text-white' : 'border border-line text-muted hover:border-ink/30'
                  }`}
                >
                  {hasSpreadLock(picks[game.id]) ? `Spread locked ✓ (+${currentBonusValue})` : `Lock this spread (+${currentBonusValue})`}
                </button>

                {game.overUnder != null ? (
                  <>
                    <div className="text-xs font-semibold text-muted mb-1.5 uppercase tracking-wide">Total</div>
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        disabled={lockedByKickoff}
                        onClick={() => handlePick(game.id, 'total', 'over')}
                        className={getBtnClass('total', 'over')}
                      >
                        Over {game.overUnder}
                      </button>
                      <button
                        disabled={lockedByKickoff}
                        onClick={() => handlePick(game.id, 'total', 'under')}
                        className={getBtnClass('total', 'under')}
                      >
                        Under {game.overUnder}
                      </button>
                    </div>
                    <button
                      disabled={lockedByKickoff || !picks[game.id]?.total}
                      onClick={() => toggleTotalLock(game.id)}
                      className={`mb-1 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        hasTotalLock(picks[game.id]) ? 'bg-ink text-white' : 'border border-line text-muted hover:border-ink/30'
                      }`}
                    >
                      {hasTotalLock(picks[game.id]) ? `Total locked ✓ (+${currentBonusValue})` : `Lock this total (+${currentBonusValue})`}
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-muted italic mb-1">No total line available for this game.</div>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="font-display text-lg font-semibold text-ink mb-3">Who picked who</h2>
        <PickMatrix
          games={games}
          allLeaguePicks={allLeaguePicks}
          currentUser={selectedUser}
          allMembers={activeStandingsMembers}
        />

        <h2 className="font-display text-lg font-semibold text-ink mt-10 mb-3">Season standings</h2>
        <div className="rounded-card border border-line bg-white overflow-hidden overflow-x-auto shadow-sm">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-paper/30 text-xs text-muted">
                <th className="p-3 font-semibold uppercase tracking-wider">Rank</th>
                <th className="p-3 font-semibold uppercase tracking-wider">Member</th>
                <th className="p-3 font-semibold uppercase tracking-wider">W-L-P</th>
                <th className="p-3 font-semibold uppercase tracking-wider">Lock bonuses</th>
                <th className="p-3 font-semibold uppercase tracking-wider text-right">Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((member, idx) => (
                <tr key={member.userName} className="border-b border-line last:border-0 hover:bg-paper/30 transition-colors">
                  <td className="p-3 font-display font-semibold text-ink">{idx + 1}</td>
                  <td className="p-3 font-medium">{member.userName}</td>
                  <td className="p-3 text-muted">{member.wins}-{member.losses}-{member.pushes}</td>
                  <td className="p-3">
                    {member.lockBonuses > 0
                      ? <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-1 rounded-full text-xs">+{member.lockBonuses}</span>
                      : <span className="text-muted/50">—</span>}
                  </td>
                  <td className="p-3 text-right font-display font-bold text-lg text-ink">{member.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        )}

        {activeTab === 'stats' && (
          <StatsPage
            seasonPicks={seasonPicks}
            gamesByWeek={gamesByWeek}
            allMembers={activeStandingsMembers}
            currentUser={selectedUser}
          />
        )}
      </main>

      {showAuthModal && (
        <AuthModal
          users={usersList}
          onSuccess={(user) => {
            setCurrentUser(user);
            setSelectedUser(user.name);
            setShowAuthModal(false);
          }}
          onUserCreated={fetchUsersList}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {showLeagueModal && (
        <CreateLeagueModal
          currentUser={currentUser}
          onClose={() => setShowLeagueModal(false)}
          onLeagueCreated={(newLeague) => {
            setLeagues((prev) => [...prev, newLeague]);
            setSelectedLeagueId(newLeague.id);
            setShowLeagueModal(false);
          }}
        />
      )}

      {leagueToJoin && (
        <JoinLeagueModal
          league={leagueToJoin}
          currentUser={currentUser}
          onClose={() => setLeagueToJoin(null)}
          onJoined={(joinedLeagueId) => {
            setSelectedLeagueId(joinedLeagueId);
            setLeagueToJoin(null);
          }}
        />
      )}
    </div>
  );
}
