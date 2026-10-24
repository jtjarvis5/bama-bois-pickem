// How many games in a week the person still has no pick on, among games that
// haven't kicked off (the ones they can still do something about).

export function picksDue(games = [], picks = {}, now = Date.now()) {
  const open = games.filter((g) => new Date(g.startDate).getTime() > now);
  const missing = open.filter((g) => {
    const p = picks?.[g.id] || picks?.[String(g.id)];
    return !(p && (p.spread || p.total));
  });
  const next = [...open].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0] || null;
  return {
    missing: missing.length,
    open: open.length,
    nextKickoff: next ? new Date(next.startDate) : null,
    nextMissingKickoff: missing.length
      ? new Date([...missing].sort((a, b) => new Date(a.startDate) - new Date(b.startDate))[0].startDate)
      : null,
  };
}
