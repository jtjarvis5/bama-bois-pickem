import { useEffect, useState } from 'react';
import { disablePush, enablePush, isEnabled, isIOS, isStandalone, pushConfigured, pushSupported } from '../services/push';

// "Remind me when picks are due" on this device.

const HIDE_KEY = 'pushPromptHidden';
const read = () => { try { return localStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };
const write = () => { try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* fine */ } };

export default function PushToggle({ token, userName }) {
  const [state, setState] = useState('checking'); // checking | on | off | denied | busy
  const [hidden, setHidden] = useState(read());
  const [note, setNote] = useState('');

  useEffect(() => {
    let live = true;
    setState('checking');
    isEnabled(token).then((on) => {
      if (!live) return;
      setState(on ? 'on' : typeof Notification !== 'undefined' && Notification.permission === 'denied' ? 'denied' : 'off');
    });
    return () => { live = false; };
  }, [token, userName]);

  if (!pushConfigured() || state === 'checking') return null;

  const needsInstall = isIOS() && !isStandalone();
  if (!pushSupported() && !needsInstall) return null;
  if (state !== 'on' && hidden && !needsInstall) return null;

  const turnOn = async () => {
    setNote('');
    setState('busy');
    const r = await enablePush(token);
    if (r === 'enabled') setState('on');
    else {
      setState(r === 'denied' ? 'denied' : 'off');
      setNote(r === 'denied' ? 'Notifications are blocked for this site in your device settings.' : 'Could not turn reminders on. Try again in a moment.');
    }
  };
  const turnOff = async () => {
    setState('busy');
    await disablePush(token);
    setState('off');
  };

  const box = 'mb-4 rounded-card border border-line bg-white px-4 py-2.5 flex items-center justify-between gap-3';
  if (needsInstall) {
    return (
      <div className={box} data-testid="push-install">
        <span className="text-xs text-ink">
          To get pick reminders on iPhone: tap Share, choose <strong>Add to Home Screen</strong>, then open Pick&rsquo;em from your Home Screen.
        </span>
      </div>
    );
  }
  return (
    <div className={box} data-testid="push-toggle">
      <span className="text-xs text-ink">
        {state === 'on' ? 'Pick reminders are on for this device.'
          : state === 'denied' ? 'Pick reminders are blocked in this browser’s settings.'
            : 'Get a notification when you still have picks to make?'}
        {note && <span className="block text-red-600 mt-1">{note}</span>}
      </span>
      <span className="flex items-center gap-2 shrink-0">
        {state === 'on' && (
          <button type="button" onClick={turnOff} className="text-xs font-medium text-muted underline">Turn off</button>
        )}
        {(state === 'off' || state === 'busy') && (
          <>
            <button type="button" onClick={turnOn} disabled={state === 'busy'}
              className="text-xs font-semibold bg-crimson text-white px-3 py-1.5 rounded-full disabled:opacity-50">
              {state === 'busy' ? 'Working…' : 'Turn on'}
            </button>
            <button type="button" aria-label="Hide this" onClick={() => { write(); setHidden(true); }}
              className="text-xs text-muted">✕</button>
          </>
        )}
      </span>
    </div>
  );
}
