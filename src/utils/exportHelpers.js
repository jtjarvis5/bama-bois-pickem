export function copyPicksToClipboard(userName, week, picks, games) {
  let text = `🏈 *${userName}'s ${week} Picks*\n────────────────────\n`;
  games.forEach((game) => {
    const userPick = picks[game.id];
    if (!userPick?.spread) return;
    
    const pickedTeam = userPick.spread === 'home' ? game.homeTeam : game.awayTeam;
    const line = userPick.spread === 'home' ? game.homeSpread : game.awaySpread;
    const formattedLine = line > 0 ? `+${line}` : line;
    const lockIcon = userPick.isLock ? ' 🔒 (LOCK)' : '';
    
    text += `• ${pickedTeam} ${formattedLine}${lockIcon}\n`;
  });
  navigator.clipboard.writeText(text);
  alert("Copied to clipboard!");
}
