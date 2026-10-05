// Shared pieces for the Stats tab.
import { useEffect, useRef } from 'react';

// Chart colours. The app is crimson-led, so crimson is the highlight colour
// ("this is you") and everything else steps back. Spread vs. totals needs two
// distinguishable series; blue is the documented slot-1 hue and the pair was
// run through the palette validator (both pass: CVD dE ~25, normal dE ~31,
// >= 3:1 on white). Each also has its own shape, so colour is never the only cue.
export const COLORS = {
  focus: '#9E1B32',   // brand crimson -- the member being looked at
  leader: '#16181A',  // ink -- whoever is ahead
  quiet: '#A8A49C',   // everyone else
  spread: '#9E1B32',
  total: '#2A78D6',
  grid: '#E7E5E2',
  axis: '#6B6F76',
  good: '#006300',    // success text on white
  bad: '#B42318',     // loss text on white (>= 4.5:1)
};

// One-hue crimson ramp for magnitude (light = few points). Lightness steps
// evenly and the in-cell number switches between ink and white to stay >= 4.5:1.
export const HEAT = [
  { bg: '#F4DCE0', fg: '#16181A' },
  { bg: '#E8B3BC', fg: '#16181A' },
  { bg: '#D78695', fg: '#16181A' },
  { bg: '#BF5167', fg: '#FFFFFF' },
  { bg: '#9E1B32', fg: '#FFFFFF' },
  { bg: '#6E1224', fg: '#FFFFFF' },
];

/**
 * Horizontal scroller that opens scrolled to its right-hand end. In the week
 * grid and race chart the right-hand side is what matters most (latest weeks,
 * totals), and the member names stay pinned, so starting there reads right on a
 * phone. Does nothing when the content already fits.
 */
export function ScrollX({ children, className = '', endKey }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [endKey]);
  return <div ref={ref} className={`overflow-x-auto ${className}`}>{children}</div>;
}

export function Section({ title, hint, action, children }) {
  return (
    <section className="mb-10">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {hint && <p className="text-xs text-muted mt-0.5 max-w-prose">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className = '' }) {
  return (
    <div className={`rounded-card border border-line bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-full border border-line bg-white p-0.5 shrink-0">
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            value === key ? 'bg-crimson text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

// Short line used as a legend / tooltip key for line charts.
export function LineKey({ color, width = 2.5 }) {
  return (
    <svg width="16" height="8" viewBox="0 0 16 8" aria-hidden="true" className="shrink-0">
      <line x1="1" y1="4" x2="15" y2="4" stroke={color} strokeWidth={width} strokeLinecap="round" />
    </svg>
  );
}

export function StarIcon({ filled = true, className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
      <path d="M12 2.8l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.6l-5.9 3.2 1.2-6.5L2.5 9.7l6.6-.9z" />
    </svg>
  );
}

export function ArrowIcon({ up, className = '' }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden="true" fill="currentColor">
      {up ? <path d="M6 2l4.2 6.5H1.8z" /> : <path d="M6 10L1.8 3.5h8.4z" />}
    </svg>
  );
}

/** Clean axis ticks: 0..top in equal steps, at most `maxTicks` intervals. */
export function niceTicks(max, maxTicks = 4) {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
  const step = steps.find((s) => Math.ceil(Math.max(max, 1) / s) <= maxTicks) || 1000;
  const top = Math.max(step, Math.ceil(max / step) * step);
  const ticks = [];
  for (let t = 0; t <= top; t += step) ticks.push(t);
  return ticks;
}

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
