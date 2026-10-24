import { picksDue } from '../utils/picksDue';

// "You still have picks to make" nudge on the Games tab.
export default function PicksDueBanner({ week, games, picks }) {
  const due = picksDue(games, picks);
  if (due.missing === 0) return null;
  const when = due.nextMissingKickoff.toLocaleString('en-US', {
    weekday: 'short', hour: 'numeric', minute: '2-digit',
  });
  return (
    <div role="status" data-testid="picks-due" className="mb-4 rounded-card border border-amber-300 bg-amber-50 px-4 py-2.5">
      <span className="text-xs text-amber-900">
        <strong>Week {week}:</strong> {due.missing} game{due.missing === 1 ? '' : 's'} still need{due.missing === 1 ? 's' : ''} your pick.
        {' '}First one kicks off {when}.
      </span>
    </div>
  );
}
