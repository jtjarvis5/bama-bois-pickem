import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLiveScores, shouldPoll } from '../services/liveScores';
import { withLive } from '../utils/live';

const POLL_MS = 45 * 1000;

// Overlays live scores on the week's games while any game is in (or about to
// be in) play. Polls only while the tab is visible; outside game windows it
// does nothing at all, so quiet days cost no requests.
export function useLiveGames(games, sport) {
  const [live, setLive] = useState({});
  const gamesRef = useRef(games);
  gamesRef.current = games;

  const slateKey = games.map((g) => `${g.id}:${g.status}`).join(',');

  useEffect(() => {
    setLive({});
    if (!games.length) return undefined;
    let cancelled = false;
    let timer = null;

    async function tick() {
      const current = gamesRef.current;
      if (document.visibilityState === 'visible' && shouldPoll(current)) {
        try {
          const scores = await fetchLiveScores(current, sport);
          if (!cancelled) setLive(scores);
        } catch (err) {
          console.warn('Live scores unavailable:', err.message);
        }
      }
      if (!cancelled) timer = setTimeout(tick, POLL_MS);
    }
    tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  // slateKey changes when the week or any game's official status changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slateKey, sport]);

  return useMemo(() => games.map((g) => withLive(g, live[String(g.id)])), [games, live]);
}
