import { Section, Panel } from './ui';

const nameList = (names, viewer) => names.map((n, i) => (
  <span key={n}>
    {i > 0 && (i === names.length - 1 ? ' & ' : ', ')}
    <span className="font-semibold text-ink">{n}</span>
    {n === viewer && <span className="text-muted"> (you)</span>}
  </span>
));

/** Streaks and awards. Each needs enough graded picks behind it, so early in the season only a few show. */
export default function TrophyCase({ awards = [], viewer }) {
  if (!awards.length) return null;
  return (
    <Section title="Trophy case" hint="Streaks and awards. They show up once enough picks have been graded to mean something.">
      <Panel>
        <ul className="divide-y divide-line">
          {awards.map((a) => (
            <li key={a.key} className="px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-muted">{a.title}</div>
                <div className="text-sm text-ink">
                  {nameList(a.names, viewer)}
                  <span className="text-muted"> &middot; {a.detail}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </Section>
  );
}
