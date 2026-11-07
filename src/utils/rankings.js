/**
 * Chooses which poll to show for a week from CFBD's /rankings data (one entry
 * per poll week, each with several polls). Once the College Football Playoff
 * committee has released rankings (from early November), those are used;
 * before that, and for any week the committee hadn't ranked yet, the AP Top 25.
 * Looks back to the most recent poll at or before the week (the earliest poll
 * if the week is earlier than all of them). Returns { team: rank }.
 */
export function pickRankings(data, week) {
  if (!Array.isArray(data)) return {};
  const isCFP = (p) => /playoff/i.test(p?.poll || '');
  const isAP = (p) => p?.poll === 'AP Top 25';
  const candidates = data
    .map((entry) => {
      const polls = (entry.polls || []).filter((p) => p?.ranks?.length);
      return { week: entry.week, poll: polls.find(isCFP) || polls.find(isAP) };
    })
    .filter((e) => e.poll);
  if (candidates.length === 0) return {};

  const atOrBefore = candidates.filter((e) => e.week <= week).sort((a, b) => b.week - a.week);
  const chosen = atOrBefore[0] || [...candidates].sort((a, b) => a.week - b.week)[0];

  const rankMap = {};
  chosen.poll.ranks.forEach((r) => { rankMap[r.school] = r.rank; });
  return rankMap;
}
