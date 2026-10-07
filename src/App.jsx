import { useState, useEffect, useRef, useMemo } from 'react';
import * as api from './services/api';
import { getWeeklyGames, getCachedGamesByWeek, getCurrentNFLWeek } from './services/gameCache';
import { getCurrentWeekString, isGameLocked, SEASON_YEAR } from './utils/getCurrentWeek';
import { calculateSeasonStandings } from './utils/leaderboard';
import { copyPicksToClipboard } from './utils/exportHelpers';
import PickMatrix from './components/PickMatrix';
import AuthModal from './components/AuthModal';
import CreateLeagueModal from './components/CreateLeagueModal';
import JoinLeagueModal from './components/JoinLeagueModal';
import StatsPage from './components/StatsPage';
import AdminPage from './components/AdminPage';
import EditNotice from './components/EditNotice';
import { hasSpreadLock, hasTotalLock, lockBonusValue } from './utils/scoring';

// How often to re-read picks from the server while the tab is open.
const POLL_MS = 15_000;
const SEASON_POLL_MS = 60_000;

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

  // Pick saves are chained so they go out strictly in order. Each save writes
  // the whole picks object, so two overlapping requests could land out of
  // order and let an older object overwrite a newer one.
  const saveChain = useRef(Promise.resolve());
  const pendingSaves = useRef(0);
  const loadedSlateKey = useRef(null); // "league:week" of the games currently on screen
  const [isAdmin, setIsAdmin] = useState(false);       // creator of the selected league
  const [seasonReloadTick, setSeasonReloadTick] = useState(0);
  const [membersReloadTick, setMembersReloadTick] = useState(0);
  // Bumped to force a re-read of this week's picks from the server (e.g.
  // after the server rejects a save and our local picks are out of date).
  const [picksReloadTick, setPicksReloadTick] = useState(0);

  const weekNum = parseInt(selectedWeek.split(' ')[1], 10);
  const activeLeague = leagues.find(l => l.id === selectedLeagueId) || leagues[0];

  // NFL has no Week 0; CFB runs 0-15 (CFBD files Army-Navy under Week 15).
  const weekOptions = activeLeague?.sport === 'NFL'
    ? Array.from({ length: 18 }, (_, i) => i + 1)
    : Array.from({ length: 16 }, (_, i) => i);

  useEffect(() => {
    async function initLeagues() {
      try {
        const data = await api.listLeagues();
        if (data && data.length > 0) setLeagues(data);
      } catch (err) {
        console.error('Failed to load leagues:', err);
      }
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

  const readSavedUser = () => {
    try {
      return JSON.parse(localStorage.getItem('currentUser') || 'null');
    } catch {
      return null;
    }
  };

  const fetchUsersList = async () => {
    let data;
    try {
      data = await api.listUsers();
    } catch (err) {
      console.error('Failed to load users:', err);
      return;
    }
    if (!data || data.length === 0) return;
    setUsersList(data);

    const saved = readSavedUser();
    // A login saved by the old version has no session token; it can't make
    // picks any more, so those users are asked to log in once more.
    let stillValid = Boolean(saved?.token);
    if (stillValid) {
      try {
        stillValid = Boolean(await api.whoami(saved.token));
      } catch {
        stillValid = true; // couldn't reach the server -- don't log anyone out over a blip
      }
    }

    if (stillValid) {
      setCurrentUser(saved);
      setSelectedUser((prev) => prev || saved.name);
    } else {
      if (saved) handleLogout();
      setSelectedUser((prev) => prev || data[0].name);
    }
  };

  const handleLogout = () => {
    const sessionToken = currentUser?.token ?? readSavedUser()?.token;
    if (sessionToken) api.logout(sessionToken).catch(() => {});
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  useEffect(() => {
    let cancelled = false; // a slow response for a week/league we've left must not overwrite the current one
    async function loadGames() {
      // Never leave another week's games on screen: picks tapped there would be
      // saved against the wrong week. (Only clear on a real week/league change,
      // not on a background refresh of the same slate.)
      const slateKey = `${selectedLeagueId}:${weekNum}`;
      if (loadedSlateKey.current !== slateKey) setGames([]);
      try {
        setApiError(null);
        const liveGames = await getWeeklyGames(SEASON_YEAR, weekNum, activeLeague.sport);
        if (cancelled) return;
        if (liveGames && liveGames.length > 0) {
          loadedSlateKey.current = slateKey;
          setGames(liveGames);
        } else {
          setGames([]);
          setApiError(`API returned 0 games for Week ${weekNum}.`);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load games:", err);
        setGames([]);
        setApiError(`API Exception: ${err.message}`);
      }
    }
    if (activeLeague) loadGames();
    return () => { cancelled = true; };
  }, [weekNum, selectedLeagueId, activeLeague]);

  // This week's picks. The server hides other members' picks for any game that
  // hasn't kicked off, so what comes back is already safe to show. There is no
  // live subscription any more (the browser can't read the table directly), so
  // we re-read every POLL_MS while the tab is visible.
  const token = currentUser?.token ?? null;
  useEffect(() => {
    if (!selectedUser || !selectedLeagueId) return;
    let cancelled = false;

    async function load(isInitial) {
      try {
        const data = await api.getWeekPicks(token, selectedLeagueId, weekNum);
        if (cancelled || !data) return;
        setAllLeaguePicks(data);
        // When you're looking at your own picks, what's on screen is already
        // ahead of the server, so only the first read of a week is applied.
        const viewingSelf = Boolean(currentUser) && selectedUser === currentUser.name;
        if (isInitial || !viewingSelf) {
          setPicks(data.find((p) => p.user_name === selectedUser)?.picks || {});
        }
      } catch (err) {
        console.error('Failed to load picks:', err);
      }
    }

    load(true);
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && pendingSaves.current === 0) load(false);
    }, POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [weekNum, selectedUser, selectedLeagueId, token, picksReloadTick]);

  // Whole-season picks for standings and stats.
  useEffect(() => {
    if (!selectedLeagueId || !activeLeague) return;
    let cancelled = false;

    async function loadSeasonStandingsData() {
      try {
        const [picksData, cachedByWeek] = await Promise.all([
          api.getSeasonPicks(token, selectedLeagueId),
          getCachedGamesByWeek(SEASON_YEAR, activeLeague.sport),
        ]);
        if (cancelled) return;
        if (picksData) setSeasonPicks(picksData);
        setGamesByWeek(cachedByWeek);
      } catch (err) {
        console.error('Failed to load season data:', err);
      }
    }

    loadSeasonStandingsData();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') loadSeasonStandingsData();
    }, SEASON_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [weekNum, selectedLeagueId, activeLeague, token, seasonReloadTick]);

  // Is the logged-in person the admin (creator) of this league? The server
  // decides; this only controls whether the Admin tab is shown.
  useEffect(() => {
    let cancelled = false;
    setIsAdmin(false);
    if (!token || !selectedLeagueId) return undefined;
    api.isLeagueAdmin(token, selectedLeagueId)
      .then((yes) => { if (!cancelled) setIsAdmin(yes === true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token, selectedLeagueId]);

  useEffect(() => { if (!isAdmin && activeTab === 'admin') setActiveTab('games'); }, [isAdmin, activeTab]);

  // Restrict Standings members to those who have joined this specific league
  const [leagueMembers, setLeagueMembers] = useState([]);
  useEffect(() => {
    async function fetchLeagueMembers() {
      try {
        const names = await api.leagueMembers(selectedLeagueId);
        if (names) setLeagueMembers(names);
      } catch (err) {
        console.error('Failed to load league members:', err);
      }
    }
    if (selectedLeagueId) fetchLeagueMembers();
  }, [selectedLeagueId, allLeaguePicks, membersReloadTick]);

  const availableMembers = usersList.map((u) => u.name);
  // Everyone shown in Standings, Who Picked Who and Stats. Recorded members
  // first, then anyone who has picks in this league but was never recorded as a
  // member (the original league's members were never written down), so the
  // three views always agree.
  const activeStandingsMembers = useMemo(() => {
    const base = leagueMembers.length > 0 ? leagueMembers : availableMembers;
    const seen = new Set(base);
    const extras = [];
    [...seasonPicks, ...allLeaguePicks].forEach((p) => {
      if (p.user_name && !seen.has(p.user_name)) {
        seen.add(p.user_name);
        extras.push(p.user_name);
      }
    });
    return extras.length ? [...base, ...extras.sort()] : base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueMembers, usersList, seasonPicks, allLeaguePicks]);

  const handleLeagueChange = async (newLeagueId) => {
    if (!currentUser) return setShowAuthModal(true);
    
    const targetLeague = leagues.find(l => l.id === newLeagueId);
    if (!targetLeague) return;

    try {
      const mine = await api.myLeagueIds(currentUser.token);
      if ((mine || []).includes(newLeagueId)) {
        setSelectedLeagueId(newLeagueId);
      } else if (targetLeague.has_password) {
        setLeagueToJoin(targetLeague); // needs the password
      } else {
        await api.joinLeague(currentUser.token, newLeagueId, null); // open league: just join
        setSelectedLeagueId(newLeagueId);
      }
    } catch (err) {
      handleServerError(err);
    }
  };

  // One place to react to a server refusal: say why in plain words, and if the
  // session has gone bad, send the person back to the login screen.
  const handleServerError = (err) => {
    console.error('Server error:', err);
    alert(api.friendlyError(err));
    if (api.errorCode(err) === 'not_logged_in') {
      handleLogout();
      setShowAuthModal(true);
    }
  };

  const saveToSupabase = (activeUser, newPicks) => {
    pendingSaves.current += 1;
    setIsSaving(true);
    // Capture now, so a save queued behind others still goes to the league and
    // week the person was looking at when they tapped.
    const saveToken = currentUser.token;
    const leagueId = selectedLeagueId;
    const week = weekNum;

    const run = async () => {
      try {
        await api.savePicks(saveToken, leagueId, week, newPicks);
      } catch (err) {
        handleServerError(err);
        // Our on-screen picks now contradict the server's copy -- put back
        // what the server actually has.
        setPicksReloadTick((t) => t + 1);
      }
    };

    // run() never rejects, so the chain can't get stuck after a failed save.
    const next = saveChain.current.then(run).finally(() => {
      pendingSaves.current -= 1;
      if (pendingSaves.current === 0) setIsSaving(false);
    });
    saveChain.current = next;
    return next;
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

    // Moving a lock away from a game that has already started would let you
    // dodge a bad result, so it's not allowed (the server refuses it too).
    const heldOnId = Object.keys(picks).find((id) => hasLockFn(picks[id]));
    if (heldOnId && String(heldOnId) !== String(targetGameId)) {
      const heldGame = games.find((g) => String(g.id) === String(heldOnId));
      if (heldGame && isGameLocked(heldGame.startDate)) {
        alert(`Your ${lockField === 'totalLock' ? 'total' : 'spread'} lock is on ${heldGame.awayTeam} @ ${heldGame.homeTeam}, which has already kicked off, so it can't be moved.`);
        return;
      }
    }

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
                {weekOptions.map((w) => <option key={w} value={`Week ${w}`} className="text-ink">Week {w}</option>)}
              </select>
              <Chevron />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        <div className="flex gap-2 mb-5">
          {[['games', 'Games'], ['stats', 'Stats'], ...(isAdmin ? [['admin', 'Admin']] : [])].map(([key, label]) => (
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

        {currentUser && token && selectedLeagueId && (
          <EditNotice token={token} leagueId={selectedLeagueId} userName={currentUser.name} gamesByWeek={gamesByWeek} />
        )}

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

        {activeTab === 'admin' && isAdmin && (
          <AdminPage
            token={token}
            leagueId={selectedLeagueId}
            leagueName={activeLeague?.name}
            members={activeStandingsMembers}
            games={games}
            gamesByWeek={gamesByWeek}
            defaultWeek={weekNum}
            onSaved={() => {
              setPicksReloadTick((t) => t + 1);
              setSeasonReloadTick((t) => t + 1);
            }}
            onMembersChanged={() => {
              setMembersReloadTick((t) => t + 1);
              setPicksReloadTick((t) => t + 1);
              setSeasonReloadTick((t) => t + 1);
            }}
          />
        )}

        {activeTab === 'stats' && (
          <StatsPage
            seasonPicks={seasonPicks}
            gamesByWeek={gamesByWeek}
            allMembers={activeStandingsMembers}
            currentUser={selectedUser}
            viewer={currentUser?.name}
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
