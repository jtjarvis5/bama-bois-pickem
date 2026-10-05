import { ordinal, formatRecord, formatPct, winRate, decided } from '../../utils/insights';
import { Section, Panel, plural } from './ui';

function gapSentence(standing) {
  const { gap, size } = standing;
  if (!gap) return `Only member so far`;
  if (gap.kind === 'ahead') return `${plural(gap.by, 'point')} clear of ${gap.of}`;
  if (gap.kind === 'behind') return `${plural(gap.by, 'point')} behind ${gap.of}`;
  return `Level on points with ${gap.of}`;
}

function Tile({ label, value, note }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-white/65">{label}</div>
      <div className="font-display text-2xl font-semibold text-white mt-0.5 [font-variant-numeric:proportional-nums]">{value}</div>
      {note && <div className="text-xs text-white/65 mt-0.5">{note}</div>}
    </div>
  );
}

function streakText(streak) {
  if (!streak.type || streak.length === 0) return { value: '—', note: 'No decided picks yet' };
  return streak.type === 'win'
    ? { value: plural(streak.length, 'win'), note: 'In a row' }
    : { value: plural(streak.length, 'loss', 'losses'), note: 'In a row' };
}

/** The one loud thing on the page: where this member stands right now. */
export function SeasonSnapshot({ member, isViewer, standing, summary }) {
  if (!standing || !summary) return null;
  const title = isViewer ? 'Your season' : `${member}’s season`;
  const streak = streakText(summary.currentStreak);

  return (
    <section className="mb-10 rounded-card bg-crimson-deep text-white p-5 sm:p-6" aria-label={title}>
      <div className="grid gap-6 sm:grid-cols-[minmax(0,13rem)_1fr] sm:items-center">
        <div>
          <h2 className="text-sm text-white/70">{title}</h2>
          <div className="font-display text-6xl font-semibold leading-none mt-2 [font-variant-numeric:proportional-nums]">
            {standing.tied ? 'T-' : ''}{ordinal(standing.rank)}
          </div>
          <p className="text-sm text-white/80 mt-3">
            {gapSentence(standing)}
            <span className="text-white/55"> &middot; {standing.size} in the league</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-t border-white/15 pt-5 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
          <Tile label="Points" value={standing.points} />
          <Tile label="Streak" value={streak.value} note={streak.note} />
          <Tile
            label="Against the spread"
            value={formatPct(winRate(summary.spread))}
            note={decided(summary.spread) ? `${formatRecord(summary.spread)} record` : 'No decided picks yet'}
          />
          <Tile
            label="On totals"
            value={formatPct(winRate(summary.total))}
            note={decided(summary.total) ? `${formatRecord(summary.total)} record` : 'No decided picks yet'}
          />
        </div>
      </div>
    </section>
  );
}

function NameList({ names, viewer }) {
  return names.map((n, i) => (
    <span key={n}>
      {i > 0 && (i === names.length - 1 ? ' & ' : ', ')}
      <span className="font-semibold text-ink">{n}</span>
      {n === viewer && <span className="text-muted"> (you)</span>}
    </span>
  ));
}

/** Short facts about the league -- only the ones with enough picks behind them. */
export function Superlatives({ items, viewer }) {
  if (!items.length) return null;
  return (
    <Section title="Around the league" hint="Standouts so far. They appear once enough picks have been graded to mean something.">
      <Panel>
        <dl className="divide-y divide-line">
          {items.map((item) => (
            <div key={item.key} className="px-4 py-3 grid gap-0.5 sm:grid-cols-[12rem_1fr] sm:gap-4 sm:items-baseline">
              <dt className="text-sm text-muted">{item.title}</dt>
              <dd className="text-sm text-ink">
                <NameList names={item.names} viewer={viewer} />
                <span className="text-muted"> &middot; {item.detail}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
    </Section>
  );
}
