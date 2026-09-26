import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, 
  Send, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  BarChart3, 
  Share2, 
  Copy, 
  Zap, 
  Flame,
  Users
} from 'lucide-react';

const LEAGUE_MEMBERS = [
  { id: 'tyler', name: 'Tyler (You)', avatar: '🐘', color: 'from-red-600 to-rose-700' },
  { id: 'nick', name: 'Nick', avatar: '🏈', color: 'from-amber-500 to-orange-600' },
  { id: 'mac', name: 'Mac', avatar: '⚡', color: 'from-emerald-500 to-teal-700' },
  { id: 'cam', name: 'Cam', avatar: '🔥', color: 'from-blue-500 to-indigo-700' },
  { id: 'bamabob', name: 'BamaBob', avatar: '🏛️', color: 'from-purple-600 to-pink-700' }
];

const INITIAL_GAMES = [
  {
    id: 1,
    isBama: true,
    homeTeam: 'Alabama Crimson Tide',
    homeAbbr: 'ALA',
    homeLogo: '🐘',
    homeSpread: -13.5,
    awayTeam: 'Georgia Bulldogs',
    awayAbbr: 'UGA',
    awayLogo: '🐶',
    awaySpread: 13.5,
    totalLine: 54.5,
    time: 'Sat 7:30 PM ET',
    network: 'ABC',
    status: 'FINAL',
    homeScore: 41,
    awayScore: 34,
    winningSpreadTeam: 'away'
  },
  {
    id: 2,
    isBama: false,
    homeTeam: 'Tennessee Volunteers',
    homeAbbr: 'TENN',
    homeLogo: '🍊',
    homeSpread: 4.5,
    awayTeam: 'Texas Longhorns',
    awayAbbr: 'TEX',
    awayLogo: '🤘',
    awaySpread: -4.5,
    totalLine: 51.5,
    time: 'Sat 3:30 PM ET',
    network: 'ABC',
    status: 'FINAL',
    homeScore: 24,
    awayScore: 31,
    winningSpreadTeam: 'away'
  },
  {
    id: 3,
    isBama: false,
    homeTeam: 'Michigan Wolverines',
    homeAbbr: 'MICH',
    homeLogo: '〽️',
    homeSpread: -5.5,
    awayTeam: 'Iowa Hawkeyes',
    awayAbbr: 'IOWA',
    awayLogo: '🦅',
    awaySpread: 5.5,
    totalLine: 35.5,
    time: 'Sat 12:00 PM ET',
    network: 'FOX',
    status: 'FINAL',
    homeScore: 20,
    awayScore: 13,
    winningSpreadTeam: 'home'
  },
  {
    id: 4,
    isBama: false,
    homeTeam: 'Florida Gators',
    homeAbbr: 'UF',
    homeLogo: '🐊',
    homeSpread: 3.5,
    awayTeam: 'Ole Miss Rebels',
    awayAbbr: 'MISS',
    awayLogo: '🦈',
    awaySpread: -3.5,
    totalLine: 56.5,
    time: 'Sat 3:30 PM ET',
    network: 'ESPN',
    status: 'FINAL',
    homeScore: 21,
    awayScore: 28,
    winningSpreadTeam: 'away'
  },
  {
    id: 5,
    isBama: false,
    homeTeam: 'Purdue Boilermakers',
    homeAbbr: 'PUR',
    homeLogo: '🚂',
    homeSpread: 27.5,
    awayTeam: 'Notre Dame Fighting Irish',
    awayAbbr: 'ND',
    awayLogo: '☘️',
    awaySpread: -27.5,
    totalLine: 47.5,
    time: 'Sat 3:30 PM ET',
    network: 'NBC',
    status: 'FINAL',
    homeScore: 7,
    awayScore: 42,
    winningSpreadTeam: 'away'
  },
  {
    id: 6,
    isBama: false,
    homeTeam: 'Ohio State Buckeyes',
    homeAbbr: 'OSU',
    homeLogo: '🌰',
    homeSpread: -21.5,
    awayTeam: 'Illinois Fighting Illini',
    awayAbbr: 'ILL',
    awayLogo: '🔶',
    awaySpread: 21.5,
    totalLine: 49.5,
    time: 'Sat 12:00 PM ET',
    network: 'FOX',
    status: 'FINAL',
    homeScore: 38,
    awayScore: 10,
    winningSpreadTeam: 'home'
  },
  {
    id: 7,
    isBama: false,
    homeTeam: 'Iowa State Cyclones',
    homeAbbr: 'ISU',
    homeLogo: '🌪️',
    homeSpread: 8.5,
    awayTeam: 'Utah Utes',
    awayAbbr: 'UTAH',
    awayLogo: '🪶',
    awaySpread: -8.5,
    totalLine: 42.5,
    time: 'Sat 8:00 PM ET',
    network: 'ESPN',
    status: 'FINAL',
    homeScore: 20,
    awayScore: 24,
    winningSpreadTeam: 'home'
  },
  {
    id: 8,
    isBama: false,
    homeTeam: 'California Golden Bears',
    homeAbbr: 'CAL',
    homeLogo: '🐻',
    homeSpread: 1.5,
    awayTeam: 'Clemson Tigers',
    awayAbbr: 'CLEM',
    awayLogo: '🐾',
    awaySpread: -1.5,
    totalLine: 44.5,
    time: 'Sat 10:30 PM ET',
    network: 'ESPN',
    status: 'FINAL',
    homeScore: 17,
    awayScore: 21,
    winningSpreadTeam: 'away'
  },
  {
    id: 9,
    isBama: false,
    homeTeam: 'UCF Knights',
    homeAbbr: 'UCF',
    homeLogo: '⚔️',
    homeSpread: 3.5,
    awayTeam: 'TCU Horned Frogs',
    awayAbbr: 'TCU',
    awayLogo: '🐸',
    awaySpread: -3.5,
    totalLine: 62.5,
    time: 'Sat 7:00 PM ET',
    network: 'FS1',
    status: 'FINAL',
    homeScore: 35,
    awayScore: 34,
    winningSpreadTeam: 'home'
  },
  {
    id: 10,
    isBama: false,
    homeTeam: 'LSU Tigers',
    homeAbbr: 'LSU',
    homeLogo: '🐯',
    homeSpread: -6.5,
    awayTeam: 'Auburn Tigers',
    awayAbbr: 'AUB',
    awayLogo: '🦅',
    awaySpread: 6.5,
    totalLine: 52.5,
    time: 'Sat 6:00 PM ET',
    network: 'ESPN',
    status: 'FINAL',
    homeScore: 27,
    awayScore: 17,
    winningSpreadTeam: 'home'
  }
];

const MOCK_OTHER_PICKS = {
  nick: {
    picks: { 1: 'over', 2: 'away', 3: 'under', 4: 'away', 5: 'over', 6: 'home', 7: 'over', 8: 'under', 9: 'over', 10: 'home' },
    lockGameId: 1,
    tiebreaker: 68
  },
  mac: {
    picks: { 1: 'home', 2: 'over', 3: 'away', 4: 'under', 5: 'away', 6: 'over', 7: 'away', 8: 'under', 9: 'away', 10: 'home' },
    lockGameId: 5,
    tiebreaker: 72
  },
  cam: {
    picks: { 1: 'under', 2: 'home', 3: 'home', 4: 'home', 5: 'over', 6: 'home', 7: 'home', 8: 'home', 9: 'over', 10: 'under' },
    lockGameId: 6,
    tiebreaker: 52
  },
  bamabob: {
    picks: { 1: 'home', 2: 'away', 3: 'under', 4: 'away', 5: 'away', 6: 'home', 7: 'over', 8: 'home', 9: 'home', 10: 'over' },
    lockGameId: 10,
    tiebreaker: 80
  }
};

const SEASON_STANDINGS_BASE = [
  { id: 'nick', name: 'Nick', wins: 38, losses: 14, bamaCorrect: 4, bumCount: 0, streak: 'W3' },
  { id: 'tyler', name: 'Tyler (You)', wins: 35, losses: 17, bamaCorrect: 5, bumCount: 0, streak: 'W1' },
  { id: 'mac', name: 'Mac', wins: 32, losses: 20, bamaCorrect: 3, bumCount: 1, streak: 'L1' },
  { id: 'bamabob', name: 'BamaBob', wins: 31, losses: 21, bamaCorrect: 5, bumCount: 1, streak: 'W2' },
  { id: 'cam', name: 'Cam', wins: 26, losses: 26, bamaCorrect: 2, bumCount: 3, streak: 'L2' }
];

const evaluatePickWinner = (game, pick) => {
  if (!pick) return false;
  const totalPoints = game.homeScore + game.awayScore;
  if (pick === 'over') return totalPoints > game.totalLine;
  if (pick === 'under') return totalPoints < game.totalLine;
  if (pick === 'home' || pick === 'away') return pick === game.winningSpreadTeam;
  return false;
};

const formatPickLabel = (game, pick) => {
  if (pick === 'home') {
    const spreadVal = game.homeSpread > 0 ? '+' + game.homeSpread : '' + game.homeSpread;
    return game.homeAbbr + ' ' + spreadVal;
  }
  if (pick === 'away') {
    const spreadVal = game.awaySpread > 0 ? '+' + game.awaySpread : '' + game.awaySpread;
    return game.awayAbbr + ' ' + spreadVal;
  }
  if (pick === 'over') return 'OVER ' + game.totalLine;
  if (pick === 'under') return 'UNDER ' + game.totalLine;
  return 'No Pick';
};

export default function App() {
  const [selectedWeek, setSelectedWeek] = useState('Week 5');
  const [currentUser, setCurrentUser] = useState('tyler');
  const [activeTab, setActiveTab] = useState('make-picks');

  const getStorage = (key, fallback) => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [userPicks, setUserPicks] = useState(() => getStorage('bama_bois_user_picks', {
    1: 'over', 2: 'away', 3: 'under', 4: 'away', 5: 'away',
    6: 'home', 7: 'over', 8: 'away', 9: 'over', 10: 'home'
  }));

  const [lockGameId, setLockGameId] = useState(() => getStorage('bama_bois_user_lock', 1));
  const [tiebreakerPoint, setTiebreakerPoint] = useState(() => getStorage('bama_bois_user_tb', 75));
  const [isSubmitted, setIsSubmitted] = useState(() => getStorage('bama_bois_user_submitted', true));

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTextContent, setShareTextContent] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('bama_bois_user_picks', JSON.stringify(userPicks));
      localStorage.setItem('bama_bois_user_lock', JSON.stringify(lockGameId));
      localStorage.setItem('bama_bois_user_tb', JSON.stringify(tiebreakerPoint));
      localStorage.setItem('bama_bois_user_submitted', JSON.stringify(isSubmitted));
    } catch (e) {
      console.warn("LocalStorage error:", e);
    }
  }, [userPicks, lockGameId, tiebreakerPoint, isSubmitted]);

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3200);
  };

  const handleSelectPick = (gameId, pickType) => {
    if (isSubmitted) return;
    setUserPicks(prev => ({ ...prev, [gameId]: pickType }));
  };

  const handleSetLock = (gameId) => {
    if (isSubmitted) return;
    setLockGameId(gameId);
    const g = INITIAL_GAMES.find(item => item.id === gameId);
    if (g) {
      triggerToast('🔒 Lock set: ' + g.awayAbbr + ' @ ' + g.homeAbbr);
    }
  };

  const handleToggleSubmit = () => {
    if (isSubmitted) {
      setIsSubmitted(false);
      triggerToast('Unlocked! You can now edit your selections.');
    } else {
      if (Object.keys(userPicks).length < 10) {
        triggerToast('⚠️ Please complete picks for all 10 games!');
        return;
      }
      if (!lockGameId) {
        triggerToast('⚠️ Please select a Lock of the Week!');
        return;
      }
      setIsSubmitted(true);
      triggerToast('🔒 Slate submitted! Best of luck this week.');
    }
  };

  const allUserPicksMap = useMemo(() => {
    return {
      ...MOCK_OTHER_PICKS,
      [currentUser]: {
        picks: userPicks,
        lockGameId,
        tiebreaker: tiebreakerPoint
      }
    };
  }, [userPicks, lockGameId, tiebreakerPoint, currentUser]);

  const consensusData = useMemo(() => {
    const stats = {};
    INITIAL_GAMES.forEach(game => {
      let homeCount = 0;
      let awayCount = 0;
      let overCount = 0;
      let underCount = 0;

      LEAGUE_MEMBERS.forEach(m => {
        const p = allUserPicksMap[m.id]?.picks?.[game.id];
        if (p === 'home') homeCount++;
        if (p === 'away') awayCount++;
        if (p === 'over') overCount++;
        if (p === 'under') underCount++;
      });

      const totalPicks = homeCount + awayCount + overCount + underCount || 1;

      stats[game.id] = { 
        homeCount, awayCount, overCount, underCount,
        homePct: Math.round((homeCount / totalPicks) * 100),
        awayPct: Math.round((awayCount / totalPicks) * 100),
        overPct: Math.round((overCount / totalPicks) * 100),
        underPct: Math.round((underCount / totalPicks) * 100)
      };
    });
    return stats;
  }, [allUserPicksMap]);

  const weeklyScores = useMemo(() => {
    const actualBamaTotal = INITIAL_GAMES[0].homeScore + INITIAL_GAMES[0].awayScore;

    const calculated = LEAGUE_MEMBERS.map(m => {
      const uData = allUserPicksMap[m.id];
      if (!uData || !uData.picks) {
        return { ...m, totalPoints: 0, correctCount: 0, lockHit: false, tbDiff: 999 };
      }

      let points = 0;
      let correct = 0;
      let lockHit = false;

      INITIAL_GAMES.forEach(game => {
        const userChoice = uData.picks[game.id];
        const isWinner = evaluatePickWinner(game, userChoice);

        if (isWinner) {
          correct += 1;
          if (uData.lockGameId === game.id) {
            points += 2;
            lockHit = true;
          } else {
            points += 1;
          }
        }
      });

      const tbDiff = Math.abs((uData.tiebreaker || 0) - actualBamaTotal);

      return {
        ...m,
        totalPoints: points,
        correctCount: correct,
        lockGameId: uData.lockGameId,
        lockHit,
        tbDiff,
        tiebreakerVal: uData.tiebreaker || 0
      };
    });

    calculated.sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return a.tbDiff - b.tbDiff;
    });

    const minPts = Math.min(...calculated.map(c => c.totalPoints));
    return calculated.map((c, index) => ({
      ...c,
      isWinner: index === 0,
      isBum: c.totalPoints === minPts && index === calculated.length - 1
    }));
  }, [allUserPicksMap]);

  const generateSlateText = () => {
    let txt = "🐘 BAMA BOIS PICK 'EM - " + selectedWeek + " SLATE 🐘\n";
    txt += "Pick Spread (Side) OR Over/Under Total for each game!\n";
    txt += "🔒 Don't forget your LOCK OF THE WEEK (2x PTS)!\n";
    txt += "------------------------------------\n";
    INITIAL_GAMES.forEach((g, idx) => {
      const tag = g.isBama ? "🐘 [BAMA] " : "";
      const awaySp = g.awaySpread > 0 ? '+' + g.awaySpread : '' + g.awaySpread;
      const homeSp = g.homeSpread > 0 ? '+' + g.homeSpread : '' + g.homeSpread;
      txt += (idx + 1) + ". " + tag + g.awayTeam + " (" + awaySp + ") @ " + g.homeTeam + " (" + homeSp + ") [O/U " + g.totalLine + "]\n";
    });
    txt += "------------------------------------\n";
    txt += "Tiebreaker: Bama Game Total Points\n\n";
    txt += "👉 Make Picks: https://bama-bois.vercel.app";
    return txt;
  };

  const generateMyPicksText = () => {
    const userObj = LEAGUE_MEMBERS.find(m => m.id === currentUser);
    const userName = userObj ? userObj.name : 'Tyler';
    let txt = "🐘 " + userName + "'s " + selectedWeek + " Picks:\n";
    txt += "------------------------------------\n";
    INITIAL_GAMES.forEach((g, idx) => {
      const pick = userPicks[g.id];
      const isLock = lockGameId === g.id;
      const formatted = formatPickLabel(g, pick);
      const lockStr = isLock ? " 🔒 [LOCK]" : "";
      const bamaStr = g.isBama ? " 🐘" : "";
      txt += (idx + 1) + ". " + formatted + lockStr + bamaStr + "\n";
    });
    txt += "------------------------------------\n";
    txt += "Tiebreaker Total Points: " + tiebreakerPoint + "\n";
    txt += "Roll Tide! 🐘 #BamaBois";
    return txt;
  };

  const generateSummaryText = () => {
    const winner = weeklyScores[0];
    const bum = weeklyScores.find(s => s.isBum);

    let txt = "🏆 BAMA BOIS " + selectedWeek + " RECAP 🏆\n\n";
    txt += "🥇 Weekly Champion: " + winner.name + " (" + winner.totalPoints + " pts, Lock: " + (winner.lockHit ? '✅' : '❌') + ")\n";
    if (bum) {
      txt += "💩 Bum of the Week: " + bum.name + " (" + bum.totalPoints + " pts)\n";
    }
    txt += "\n📊 WEEKLY SCORES:\n";
    weeklyScores.forEach((s, idx) => {
      const badge = s.isWinner ? '👑 ' : s.isBum ? '💩 ' : idx === 1 ? '🥈 ' : idx === 2 ? '🥉 ' : '▫️ ';
      const lockBadge = s.lockHit ? '🔒(2x)' : '❌';
      txt += badge + s.name + ": " + s.totalPoints + " pts (" + s.correctCount + "/10) | Lock: " + lockBadge + "\n";
    });

    txt += "\n🔥 OVERALL STANDINGS:\n";
    SEASON_STANDINGS_BASE.forEach((st, idx) => {
      const bumBadge = st.bumCount > 0 ? " [" + st.bumCount + "x 💩]" : '';
      txt += (idx + 1) + ". " + st.name + ": " + st.wins + "-" + st.losses + bumBadge + "\n";
    });

    txt += "\nRoll Tide! 🐘 Next week's slate drops Wednesday.";
    return txt;
  };

  const openShareModal = (type) => {
    let text = '';
    if (type === 'slate') text = generateSlateText();
    if (type === 'picks') text = generateMyPicksText();
    if (type === 'summary') text = generateSummaryText();
    setShareTextContent(text);
    setShareModalOpen(true);
  };

  const handleCopyClipboard = (text) => {
    navigator.clipboard.writeText(text);
    triggerToast('📋 Copied to clipboard! Ready to paste in group chat.');
  };

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 font-sans pb-20 selection:bg-red-900 selection:text-white">
      
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-5 right-5 z-50 bg-amber-400 text-slate-950 px-4 py-2.5 rounded-2xl shadow-2xl font-black flex items-center gap-2 border border-amber-300 transition-all animate-bounce">
          <Zap className="w-4 h-4 text-red-950 fill-red-950" />
          <span className="text-xs tracking-wide">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0B0F17]/90 border-b border-slate-800/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            
            {/* Branding */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#9E1B32] via-rose-700 to-amber-500 flex items-center justify-center text-xl shadow-lg shadow-red-950/50 ring-1 ring-white/20">
                🐘
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-black tracking-tight italic bg-gradient-to-r from-white via-slate-100 to-amber-200 bg-clip-text text-transparent">
                    BAMA BOIS
                  </h1>
                  <span className="bg-red-950/80 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-red-800/60 uppercase tracking-widest hidden sm:inline-block">
                    Spreads & Totals
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium hidden md:block">Roll Tide Priority • 2x Lock • Over/Under Options</p>
              </div>
            </div>

            {/* Quick Actions & User Switching */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 font-bold hidden sm:inline">Week</span>
                <select 
                  value={selectedWeek} 
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="bg-transparent text-amber-300 text-xs font-black focus:outline-none cursor-pointer"
                >
                  <option className="bg-slate-900 text-slate-200">Week 4</option>
                  <option className="bg-slate-900 text-slate-200">Week 5</option>
                  <option className="bg-slate-900 text-slate-200">Week 6</option>
                  <option className="bg-slate-900 text-slate-200">Week 7</option>
                </select>
              </div>

              {/* User Selector Pill */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl px-2.5 py-1 flex items-center gap-1.5">
                <select
                  value={currentUser}
                  onChange={(e) => setCurrentUser(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer w-24 sm:w-auto truncate"
                >
                  {LEAGUE_MEMBERS.map(m => (
                    <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100">
                      {m.avatar} {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Share Button */}
              <button 
                onClick={() => openShareModal('slate')}
                className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden md:inline">iMessage</span>
              </button>
            </div>

          </div>

          {/* Navigation Tabs */}
          <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between overflow-x-auto gap-1">
            <div className="bg-slate-900/90 border border-slate-800/80 p-1 rounded-2xl flex items-center gap-1 w-full max-w-md">
              <button
                onClick={() => setActiveTab('make-picks')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'make-picks'
                    ? 'bg-gradient-to-r from-red-700 to-rose-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Make Picks</span>
              </button>
              <button
                onClick={() => setActiveTab('leaderboard')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'leaderboard'
                    ? 'bg-gradient-to-r from-red-700 to-rose-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>Leaderboard</span>
              </button>
              <button
                onClick={() => setActiveTab('consensus')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'consensus'
                    ? 'bg-gradient-to-r from-red-700 to-rose-700 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Consensus</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        
        {/* TAB 1: MAKE PICKS */}
        {activeTab === 'make-picks' && (
          <div className="space-y-6">
            
            {/* Banner Status */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSubmitted ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}`}>
                  {isSubmitted ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-100">
                    {isSubmitted ? 'Slate Locked & Submitted' : 'Slate Unlocked — Selection Mode'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isSubmitted ? 'Your picks are saved. Unlock below if you need to modify before kickoff.' : 'Pick spread (side) OR total (O/U) for each of the 10 games.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button
                  onClick={() => openShareModal('picks')}
                  className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center justify-center gap-2 border border-slate-700"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Share My Picks</span>
                </button>
                <button
                  onClick={handleToggleSubmit}
                  className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-lg ${
                    isSubmitted
                      ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30'
                      : 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-950/50'
                  }`}
                >
                  {isSubmitted ? <Unlock className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  <span>{isSubmitted ? 'Unlock Picks' : 'Lock & Submit Slate'}</span>
                </button>
              </div>
            </div>

            {/* Games Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INITIAL_GAMES.map((game) => {
                const currentPick = userPicks[game.id];
                const isLock = lockGameId === game.id;

                return (
                  <div 
                    key={game.id} 
                    className={`bg-slate-900/90 rounded-2xl p-4 border transition-all ${
                      game.isBama 
                        ? 'border-red-800/80 ring-1 ring-red-600/30 shadow-lg shadow-red-950/20' 
                        : 'border-slate-800/90 hover:border-slate-700'
                    }`}
                  >
                    {/* Game Header */}
                    <div className="flex items-center justify-between mb-3 text-[11px] text-slate-400 font-bold">
                      <div className="flex items-center gap-2">
                        {game.isBama && (
                          <span className="bg-red-950 text-red-300 px-2 py-0.5 rounded-full border border-red-800/80 font-black text-[10px]">
                            🐘 BAMA GAME
                          </span>
                        )}
                        <span>{game.time} • {game.network}</span>
                      </div>
                      <button
                        onClick={() => handleSetLock(game.id)}
                        disabled={isSubmitted}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all ${
                          isLock 
                            ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-950/50 ring-2 ring-amber-300' 
                            : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/60'
                        }`}
                      >
                        <Lock className="w-3 h-3" />
                        {isLock ? 'LOCK 2x' : 'Set Lock'}
                      </button>
                    </div>

                    {/* Matchup Header */}
                    <div className="flex items-center justify-between mb-4 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/50">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{game.awayLogo}</span>
                        <span className="font-black text-sm text-slate-100">{game.awayAbbr}</span>
                      </div>
                      <span className="text-xs text-slate-500 font-bold">@</span>
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-slate-100">{game.homeAbbr}</span>
                        <span className="text-xl">{game.homeLogo}</span>
                      </div>
                    </div>

                    {/* Pick Options */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={isSubmitted}
                        onClick={() => handleSelectPick(game.id, 'away')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          currentPick === 'away'
                            ? 'bg-gradient-to-r from-red-900/90 to-rose-900/90 border-red-500 text-white font-black ring-1 ring-red-400'
                            : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300 font-medium'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Away Spread</div>
                        <div className="text-xs font-bold">{game.awayAbbr} {game.awaySpread > 0 ? `+${game.awaySpread}` : game.awaySpread}</div>
                      </button>

                      <button
                        disabled={isSubmitted}
                        onClick={() => handleSelectPick(game.id, 'home')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          currentPick === 'home'
                            ? 'bg-gradient-to-r from-red-900/90 to-rose-900/90 border-red-500 text-white font-black ring-1 ring-red-400'
                            : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300 font-medium'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Home Spread</div>
                        <div className="text-xs font-bold">{game.homeAbbr} {game.homeSpread > 0 ? `+${game.homeSpread}` : game.homeSpread}</div>
                      </button>

                      <button
                        disabled={isSubmitted}
                        onClick={() => handleSelectPick(game.id, 'over')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          currentPick === 'over'
                            ? 'bg-gradient-to-r from-amber-900/80 to-orange-900/80 border-amber-500 text-white font-black ring-1 ring-amber-400'
                            : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300 font-medium'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Total Point</div>
                        <div className="text-xs font-bold">OVER {game.totalLine}</div>
                      </button>

                      <button
                        disabled={isSubmitted}
                        onClick={() => handleSelectPick(game.id, 'under')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          currentPick === 'under'
                            ? 'bg-gradient-to-r from-amber-900/80 to-orange-900/80 border-amber-500 text-white font-black ring-1 ring-amber-400'
                            : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800/60 text-slate-300 font-medium'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Total Point</div>
                        <div className="text-xs font-bold">UNDER {game.totalLine}</div>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tiebreaker Section */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-xl bg-red-950 border border-red-800 flex items-center justify-center text-red-300 font-black">
                  🐘
                </div>
                <div>
                  <h4 className="font-black text-sm text-slate-100">Weekly Tiebreaker</h4>
                  <p className="text-xs text-slate-400">Predict the combined total points scored in the Alabama vs. Georgia game.</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <input
                  type="number"
                  disabled={isSubmitted}
                  value={tiebreakerPoint}
                  onChange={(e) => setTiebreakerPoint(Number(e.target.value))}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-amber-300 font-black text-center text-lg focus:outline-none focus:border-amber-400"
                />
                <div className="text-xs text-slate-400">
                  <span className="font-bold text-slate-200">Total Points Prediction</span>
                  <p>Closest score breaks any ties for weekly 1st place.</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-6">
            
            {/* Header Action */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <div>
                <h3 className="font-black text-sm text-slate-100">{selectedWeek} Standings & Recap</h3>
                <p className="text-xs text-slate-400">Weekly rankings evaluated with 2x points for correct Locks.</p>
              </div>
              <button
                onClick={() => openShareModal('summary')}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Share Recap</span>
              </button>
            </div>

            {/* Weekly Standings Table */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl overflow-x-auto">
              <h4 className="font-black text-xs uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Weekly Leaderboard
              </h4>
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3 text-center">Correct</th>
                    <th className="py-2.5 px-3 text-center">Lock (2x)</th>
                    <th className="py-2.5 px-3 text-center">Tiebreaker Diff</th>
                    <th className="py-2.5 px-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {weeklyScores.map((score, idx) => (
                    <tr key={score.id} className={score.isWinner ? 'bg-amber-500/10' : score.isBum ? 'bg-red-500/10' : ''}>
                      <td className="py-3 px-3 font-black">
                        {idx === 0 ? '👑 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `${idx + 1}th`}
                      </td>
                      <td className="py-3 px-3 font-bold flex items-center gap-2">
                        <span>{score.avatar}</span>
                        <span className={score.id === currentUser ? 'text-amber-300 font-black' : 'text-slate-100'}>
                          {score.name}
                        </span>
                        {score.isBum && <span className="text-xs">💩</span>}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-200">{score.correctCount}/10</td>
                      <td className="py-3 px-3 text-center">
                        {score.lockHit ? (
                          <span className="text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">✅ Hit (+2)</span>
                        ) : (
                          <span className="text-red-400 font-bold bg-red-950/80 px-2 py-0.5 rounded-full border border-red-800">❌ Miss</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 font-mono">{score.tbDiff} pts off</td>
                      <td className="py-3 px-3 text-right font-black text-amber-300 text-sm">{score.totalPoints} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Overall Season Standings */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl overflow-x-auto">
              <h4 className="font-black text-xs uppercase tracking-wider text-red-400 mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4" /> Season Standings
              </h4>
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase font-black text-[10px]">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3 text-center">Record (W-L)</th>
                    <th className="py-2.5 px-3 text-center">Bama Picks</th>
                    <th className="py-2.5 px-3 text-center">Bum Badges</th>
                    <th className="py-2.5 px-3 text-right">Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {SEASON_STANDINGS_BASE.map((st, idx) => (
                    <tr key={st.id}>
                      <td className="py-3 px-3 font-black text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-slate-100">{st.name}</td>
                      <td className="py-3 px-3 text-center font-mono text-slate-200">{st.wins}-{st.losses}</td>
                      <td className="py-3 px-3 text-center text-amber-300 font-bold">{st.bamaCorrect} Correct</td>
                      <td className="py-3 px-3 text-center">
                        {st.bumCount > 0 ? (
                          <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700 font-bold">
                            {'💩'.repeat(st.bumCount)}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-black">
                        <span className={st.streak.startsWith('W') ? 'text-emerald-400' : 'text-red-400'}>
                          {st.streak}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        {/* TAB 3: CONSENSUS */}
        {activeTab === 'consensus' && (
          <div className="space-y-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4">
              <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" /> League Consensus Trends
              </h3>
              <p className="text-xs text-slate-400">See how all 5 league members are leaning across sides and total lines.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INITIAL_GAMES.map((game) => {
                const stats = consensusData[game.id];
                return (
                  <div key={game.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                      <span>{game.awayAbbr} @ {game.homeAbbr}</span>
                      <span className="text-[10px] text-slate-500 font-mono">O/U {game.totalLine}</span>
                    </div>

                    {/* Spread Breakdown Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                        <span>{game.awayAbbr} ({stats.awayCount})</span>
                        <span>{game.homeAbbr} ({stats.homeCount})</span>
                      </div>
                      <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                        <div style={{ width: `${stats.awayPct}%` }} className="bg-blue-600 transition-all"></div>
                        <div style={{ width: `${stats.homePct}%` }} className="bg-rose-600 transition-all"></div>
                      </div>
                    </div>

                    {/* Total Breakdown Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                        <span>OVER ({stats.overCount})</span>
                        <span>UNDER ({stats.underCount})</span>
                      </div>
                      <div className="h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                        <div style={{ width: `${stats.overPct}%` }} className="bg-amber-500 transition-all"></div>
                        <div style={{ width: `${stats.underPct}%` }} className="bg-teal-600 transition-all"></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* Share Modal */}
      {shareModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-sm text-slate-100 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-amber-400" /> Share to Group Chat
              </h3>
              <button 
                onClick={() => setShareModalOpen(false)}
                className="text-slate-400 hover:text-white font-black text-sm p-1"
              >
                ✕
              </button>
            </div>

            <textarea
              readOnly
              rows={10}
              value={shareTextContent}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-300 focus:outline-none resize-none"
            />

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyClipboard(shareTextContent)}
                className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg"
              >
                <Copy className="w-4 h-4" />
                <span>Copy Text</span>
              </button>
              <button
                onClick={() => setShareModalOpen(false)}
                className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
