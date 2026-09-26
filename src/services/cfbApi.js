const CFBD_API_KEY = import.meta.env.VITE_CFBD_API_KEY;
const BASE_URL = 'https://api.collegefootballdata.com';

// Helper function to dynamically figure out the current college football week
function getCurrentWeek() {
  const now = new Date();
  // Approximate Thursday of Week 1 for the 2026 season (August 27, 2026)
  const seasonStart = new Date('2026-08-27T00:00:00Z');
  const diffTime = now - seasonStart;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 1; // Before season starts, default to Week 1
  const calculatedWeek = Math.floor(diffDays / 7) + 1;
  // Cap it between week 1 and 15 to stay safe
  return Math.min(Math.max(calculatedWeek, 1), 15);
}

export async function fetchWeeklyGames(year = 2026, week = getCurrentWeek()) {
  try {
    const gamesRes = await fetch(`${BASE_URL}/games?year=${year}&week=${week}&seasonType=regular`, {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
    });
    const gamesData = await gamesRes.json();

    const linesRes = await fetch(`${BASE_URL}/lines?year=${year}&week=${week}&seasonType=regular`, {
      headers: { Authorization: `Bearer ${CFBD_API_KEY}` }
    });
    const linesData = await linesRes.json();

    const linesMap = {};
    linesData.forEach(item => {
      const lineObj = item.lines?.find(l => l.provider === 'Bovada') || item.lines?.[0];
      if (lineObj) linesMap[item.id] = { spread: lineObj.spread };
    });

    const formattedGames = gamesData.map(g => {
      const line = linesMap[g.id] || { spread: 0 };
      const isBama = g.home_team === 'Alabama' || g.away_team === 'Alabama';
      const homeSpread = line.spread ?? 0;
      const awaySpread = homeSpread !== 0 ? -homeSpread : 0;

      let winningSpreadTeam = null;
      if (g.completed) {
        const homeMargin = g.home_points - g.away_points;
        if (homeMargin + homeSpread > 0) winningSpreadTeam = 'home';
        else if (homeMargin + homeSpread < 0) winningSpreadTeam = 'away';
        else winningSpreadTeam = 'push';
      }

      return {
        id: g.id,
        isBama,
        homeTeam: g.home_team,
        homeAbbr: g.home_team.substring(0, 4).toUpperCase(),
        homeSpread: homeSpread,
        awayTeam: g.away_team,
        awayAbbr: g.away_team.substring(0, 4).toUpperCase(),
        awaySpread: awaySpread,
        startDate: g.start_date,
        time: new Date(g.start_date).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
        status: g.completed ? 'FINAL' : 'UPCOMING',
        winningSpreadTeam
      };
    });

    const bamaGame = formattedGames.find(g => g.isBama);
    const otherGames = formattedGames.filter(g => !g.isBama).slice(0, 9);
    return bamaGame ? [bamaGame, ...otherGames] : formattedGames.slice(0, 10);
  } catch (err) {
    console.error("API Error:", err);
    return [];
  }
}

