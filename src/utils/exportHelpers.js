import { hasSpreadLock, hasTotalLock } from './scoring';

export function copyPicksToClipboard(userName, week, picks, games) {
  let text = `🏈 *${userName}'s ${week} Picks*\n────────────────────\n`;
  games.forEach((game) => {
    const userPick = picks[game.id];
    if (!userPick?.spread && !userPick?.total) return;

    let line = '';
    if (userPick.spread) {
      const pickedTeam = userPick.spread === 'home' ? game.homeTeam : game.awayTeam;
      const spreadLine = userPick.spread === 'home' ? game.homeSpread : game.awaySpread;
      const formattedLine = spreadLine > 0 ? `+${spreadLine}` : spreadLine;
      line += `${pickedTeam} ${formattedLine}`;
    }
    if (userPick.total) {
      const totalLabel = userPick.total === 'over' ? 'Over' : 'Under';
      const ouValue = game.overUnder != null ? ` ${game.overUnder}` : '';
      line += `${line ? ' | ' : ''}${totalLabel}${ouValue}`;
    }
    const locks = [hasSpreadLock(userPick) && 'SPREAD', hasTotalLock(userPick) && 'TOTAL'].filter(Boolean);
    const lockIcon = locks.length ? ` 🔒 (${locks.join(' + ')} LOCK)` : '';

    text += `• ${line}${lockIcon}\n`;
  });
  navigator.clipboard.writeText(text);
  alert("Copied to clipboard!");
}

