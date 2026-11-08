import { useMemo, useState } from 'react';
import { formatPct } from '../utils/insights';
import { Section, Panel, ScrollX } from './stats/ui';
import { buildHeadToHead, rankByPoints } from '../utils/crossLeague';

const MIN_SAMPLE = 15; // decided picks in a sport before comparing win rates

const recordOf = (s) => {
  if (!s) return { wins: 0, losses: 0, pushes: 0 };
  return {
    wins: s.spread.wins + s.total.wins,
    losses: s.spread.losses + s.total.losses,
    pushes: s.spread.pushes + s.total.pushes,
  };
};
const pctOf = (r) => (r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : null);

// ---------------------------------------------------------------------------
// Who is better at which sport.
// ---------------------------------------------------------------------------
export function SportSplit({ split, columns, members, viewer }) {
  if (columns.length < 2) return null;

  const rows = members.map((m) => {
    const per = split.map((s, i) => {
      const rec = recordOf(s.summaries[m]);
      const decided = rec.wins + rec.losses;
      return { rec, decided, pct: pctOf(rec), points: columns[i].points[m], active: columns[i].played.has(m) };
    });
    // Say who is stronger at what only when both sports have a real sample.
    let note = '';
    if (per.length === 2 && per.every((p) => p.active && p.decided >= MIN_SAMPLE)) {
      const diff = per[0].pct - per[1].pct;
      if (Math.abs(diff) >= 0.05) note = `Better at ${diff > 0 ? columns[0].label : columns[1].label}`;
      else note = 'Even';
    }
    return { m, per, note };
  });
  const ranks = columns.map((c) => rankByPoints(Object.fromEntries(members.filter((m) => c.played.has(m)).map((m) => [m, c.points[m] ?? 0]))));

  return (
    <Section
      title="Who is better at what"
      hint={`Win rate and rank in each league. A comparison needs at least ${MIN_SAMPLE} graded picks in both sports.`}
    >
      <Panel>
        <ScrollX>
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-muted">
                <th className="p-3 font-semibold">Member</th>
                {columns.map((c) => (
                  <th key={c.key} className="p-3 font-semibold text-right whitespace-nowrap">{c.label} win rate</th>
                ))}
                {columns.map((c) => (
                  <th key={`r${c.key}`} className="p-3 font-semibold text-right">{c.label} rank</th>
                ))}
                <th className="p-3 font-semibold">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ m, per, note }) => (
                <tr key={m} className={`border-b border-line last:border-0 ${m === viewer ? 'bg-paper/40' : ''}`}>
                  <td className="p-3 font-medium whitespace-nowrap">{m}</td>
                  {per.map((p, i) => (
                    <td key={i} className="p-3 text-right whitespace-nowrap">
                      {p.active && p.decided > 0 ? (
                        <>
                          {formatPct(p.pct)}
                          <span className="text-xs text-muted ml-1">({p.rec.wins}-{p.rec.losses}{p.decided < MIN_SAMPLE ? ', small sample' : ''})</span>
                        </>
                      ) : <span className="text-muted">-</span>}
                    </td>
                  ))}
                  {per.map((p, i) => {
                    const r = ranks[i][m];
                    return (
                      <td key={`r${i}`} className="p-3 text-right text-muted">
                        {p.active && r ? `${r.tied ? 'T' : ''}${r.rank}` : '-'}
                      </td>
                    );
                  })}
                  <td className="p-3 text-muted whitespace-nowrap">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </Panel>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Overall weekly winners (Tue-Mon weeks, both sports' points added together).
// ---------------------------------------------------------------------------
const fmtDay = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function WeeklyWinners({ winners, order, viewer }) {
  const { rows, tally } = winners;
  if (rows.length === 0) return null;
  const shown = [...rows].reverse(); // newest first
  const leaders = order.filter((m) => tally[m] > 0).sort((a, b) => tally[b] - tally[a]);
  return (
    <Section
      title="Overall weekly winners"
      hint="Each calendar week (Tuesday to Monday) with every league's points added together. A week is listed once all of its games are final."
    >
      {leaders.length > 0 && (
        <p className="text-sm text-ink mb-3">
          <span className="text-muted">Weeks won: </span>
          {leaders.map((m, i) => (
            <span key={m}>
              {i > 0 && ', '}
              <span className="font-semibold">{m}</span> {tally[m]}
            </span>
          ))}
        </p>
      )}
      <Panel>
        <ul className="divide-y divide-line">
          {shown.map((r) => (
            <li key={r.start} className="px-4 py-3 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted whitespace-nowrap">{fmtDay(r.start)} to {fmtDay(r.end)}</span>
              <span className="text-right min-w-0">
                {r.winners.length === 0 ? <span className="text-muted">No points</span> : (
                  <>
                    <span className="font-semibold text-ink">
                      {r.winners.join(' & ')}{r.winners.includes(viewer) ? ' (you)' : ''}
                    </span>
                    <span className="text-muted"> {r.top} pts</span>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Head to head.
// ---------------------------------------------------------------------------
function Rec({ r }) {
  return <>{r.wins}-{r.losses}{r.pushes ? `-${r.pushes}` : ''}</>;
}

export function HeadToHead({ combined, events, members, viewer, labels }) {
  const defaultA = members.includes(viewer) ? viewer : members[0];
  const [a, setA] = useState(defaultA);
  const [b, setB] = useState(members.find((m) => m !== defaultA) || members[0]);
  const safeA = members.includes(a) ? a : members[0];
  const safeB = members.includes(b) && b !== safeA ? b : members.find((m) => m !== safeA);

  const h2h = useMemo(
    () => (safeA && safeB ? buildHeadToHead({ combined, events, a: safeA, b: safeB, labels }) : null),
    [combined, events, safeA, safeB, labels],
  );
  if (members.length < 2 || !h2h) return null;

  const pick = (value, set, other) => (
    <select
      value={value}
      onChange={(e) => set(e.target.value)}
      aria-label="Member"
      className="bg-white border border-line rounded-lg px-3 py-2 text-sm font-medium"
    >
      {members.filter((m) => m !== other).map((m) => <option key={m} value={m}>{m}</option>)}
    </select>
  );

  const { overall, byLeague, shared, weeks } = h2h;
  const Row = ({ label, left, right }) => (
    <tr className="border-b border-line last:border-0">
      <td className="p-3 text-right font-medium">{left}</td>
      <td className="p-3 text-center text-xs text-muted whitespace-nowrap">{label}</td>
      <td className="p-3 font-medium">{right}</td>
    </tr>
  );

  return (
    <Section title="Head to head" hint="Everything the two of you both played, across all leagues.">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {pick(safeA, setA, safeB)}
        <span className="text-sm text-muted">vs</span>
        {pick(safeB, setB, safeA)}
      </div>
      <Panel>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="p-3 text-right font-semibold">{h2h.a}</th>
              <th className="p-3" />
              <th className="p-3 text-left font-semibold">{h2h.b}</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Total points" left={overall[h2h.a].points} right={overall[h2h.b].points} />
            {byLeague.map((L) => (
              <Row key={L.label} label={`${L.label} points`} left={L[h2h.a].points} right={L[h2h.b].points} />
            ))}
            <Row label="Spread record" left={<Rec r={overall[h2h.a].spread} />} right={<Rec r={overall[h2h.b].spread} />} />
            <Row label="Total record" left={<Rec r={overall[h2h.a].total} />} right={<Rec r={overall[h2h.b].total} />} />
            <Row label="League-weeks won" left={weeks.a} right={weeks.b} />
          </tbody>
        </table>
      </Panel>
      <p className="text-sm text-muted mt-3">
        {shared.games === 0
          ? 'No games yet where you both made a pick.'
          : `You both picked ${shared.games} of the same bets and agreed on ${shared.agree}. Of the ${shared.disagree} you split on, ${h2h.a} won ${shared.aWins} and ${h2h.b} won ${shared.bWins}.`}
        {weeks.tied > 0 ? ` ${weeks.tied} league-week${weeks.tied === 1 ? '' : 's'} tied.` : ''}
      </p>
    </Section>
  );
}
