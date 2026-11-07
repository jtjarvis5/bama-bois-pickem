import { liveSpreadStatus, liveTotalStatus } from '../utils/live';

const TONE = {
  good: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  bad: 'text-red-700 bg-red-50 border-red-200',
  even: 'text-muted bg-paper/60 border-line',
};
const MARK = { good: '✓', bad: '✗', even: '•' };

function Row({ label, status }) {
  if (!status) return null;
  return (
    <div className={`flex items-center gap-2 text-xs font-medium px-2.5 py-1.5 rounded-lg border ${TONE[status.tone]}`}>
      <span aria-hidden="true" className="font-bold">{MARK[status.tone]}</span>
      <span className="uppercase tracking-wide text-[10px] opacity-70">{label}</span>
      <span>{status.text}</span>
    </div>
  );
}

// How the shown person's picks are doing on a game that is being played right
// now. Renders nothing for games that are not in progress or not picked.
export default function LivePickStatus({ game, pick }) {
  const spread = liveSpreadStatus(pick, game);
  const total = liveTotalStatus(pick, game);
  if (!spread && !total) return null;
  return (
    <div className="flex flex-col gap-1.5 mb-3" aria-live="polite">
      <Row label="Spread" status={spread} />
      <Row label="Total" status={total} />
    </div>
  );
}
