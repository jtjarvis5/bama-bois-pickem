import { hasSpreadLock, hasTotalLock } from '../../utils/scoring';

export const byKickoff = (a, b) => new Date(a.startDate) - new Date(b.startDate);

// Canonical form, so "no change" is detected reliably (key order and
// false/absent locks don't matter).
export function canon(picks) {
  const out = {};
  Object.keys(picks || {}).sort().forEach((id) => {
    const p = picks[id] || {};
    const e = {};
    if (p.spread) e.spread = p.spread;
    if (p.total) e.total = p.total;
    if (p.spread && hasSpreadLock(p)) e.spreadLock = true;
    if (p.total && hasTotalLock(p)) e.totalLock = true;
    if (Object.keys(e).length) out[id] = e;
  });
  return out;
}
export const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

export function pickText(game, pick) {
  if (!pick) return 'no pick';
  const home = game?.homeAbbr || 'Home';
  const away = game?.awayAbbr || 'Away';
  const parts = [];
  if (pick.spread) parts.push(`${pick.spread === 'home' ? home : away}${hasSpreadLock(pick) ? ' 🔒' : ''}`);
  if (pick.total) parts.push(`${pick.total === 'over' ? 'Over' : 'Under'}${hasTotalLock(pick) ? ' 🔒' : ''}`);
  return parts.length ? parts.join(' · ') : 'no pick';
}

export function whenText(iso) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export const side = (on) =>
  `flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
    on ? 'border-crimson bg-crimson text-white' : 'border-line bg-white text-ink hover:border-ink/30'
  }`;

// The games for a week: the cached list, or the page's live list when it is the open week.
export function gamesForWeek(gamesByWeek, games, week, defaultWeek) {
  const cached = gamesByWeek?.[week];
  const list = cached && cached.length ? cached : week === defaultWeek ? games || [] : [];
  return [...list].sort(byKickoff);
}

export const inputCls =
  'mt-1 block w-full border border-line rounded-lg px-3 py-2 text-sm font-normal normal-case tracking-normal text-ink bg-white';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
