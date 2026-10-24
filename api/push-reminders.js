// Reminder job: nudges members who still have unpicked games kicking off soon
// (default: within the next 5 hours; override with ?hours=N, 1-96). Meant to be
// called hourly by a free scheduler such as cron-job.org with the header
//   Authorization: Bearer <CRON_SECRET>
// A device is nudged at most once per 6 hours. See sql/06_push.sql.
//
// Environment variables (Vercel > Settings > Environment Variables):
//   PUSH_SECRET         same long string you put in sql/06_push.sql
//   VAPID_PUBLIC_KEY    from `npx web-push generate-vapid-keys`
//   VAPID_PRIVATE_KEY   from the same command (keep private)
//   VAPID_SUBJECT       mailto:you@example.com
//   CRON_SECRET         any long random string; the scheduler sends it as a Bearer token
//   SUPABASE_URL / SUPABASE_ANON_KEY   optional: fall back to the VITE_ ones the site already has
//   PUSH_TIMEZONE       optional, default America/Chicago
//   PUSH_WINDOW_HOURS   optional, default 5

const TZ = () => process.env.PUSH_TIMEZONE || 'America/Chicago';

export function buildMessage(row) {
  const n = row.missing;
  const when = new Date(row.next_kickoff).toLocaleString('en-US', {
    timeZone: TZ(), weekday: 'short', hour: 'numeric', minute: '2-digit',
  });
  return {
    title: `Picks due${row.leagues ? ` — ${row.leagues}` : ''}`,
    body: `${n} game${n === 1 ? ' still needs' : 's still need'} your pick. First kickoff ${when}.`,
    url: '/',
  };
}

/** rpc(fn, args) -> data; send(subscription, payloadString) -> promise. Both injected so this is testable. */
export async function runReminders({ rpc, send, secret, hours = 5 }) {
  const rows = (await rpc('app_push_targets', { p_secret: secret, p_hours: hours })) || [];
  const sent = [];
  const dead = [];
  let failed = 0;
  for (const row of rows) {
    try {
      await send(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify(buildMessage(row)),
      );
      sent.push(row.endpoint);
    } catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) dead.push(row.endpoint);
      else failed += 1;
    }
  }
  if (sent.length) await rpc('app_push_mark_sent', { p_secret: secret, p_endpoints: sent });
  if (dead.length) await rpc('app_push_prune', { p_secret: secret, p_endpoints: dead });
  return { targets: rows.length, sent: sent.length, pruned: dead.length, failed };
}

async function supabaseRpc(fn, args) {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase URL / anon key are not set');
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify(args),
  });
  const body = await r.text();
  if (!r.ok) throw new Error(`${fn} failed (${r.status}): ${body.slice(0, 200)}`);
  return body ? JSON.parse(body) : null;
}

export default async function handler(req, res) {
  const cron = process.env.CRON_SECRET;
  if (!cron) return res.status(500).json({ error: 'CRON_SECRET is not set' });
  if (req.headers.authorization !== `Bearer ${cron}`) return res.status(401).json({ error: 'unauthorized' });

  const { PUSH_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!PUSH_SECRET || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    return res.status(500).json({ error: 'PUSH_SECRET and the VAPID_* variables must all be set' });
  }
  try {
    const { default: webpush } = await import('web-push');
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const asked = Number(new URL(req.url || '/', 'http://x').searchParams.get('hours'));
    const hours = Number.isFinite(asked) && asked >= 1 && asked <= 96 ? Math.floor(asked) : Number(process.env.PUSH_WINDOW_HOURS) || 5;
    const result = await runReminders({
      hours,
      rpc: supabaseRpc,
      send: (sub, payload) => webpush.sendNotification(sub, payload, { TTL: 6 * 3600 }),
      secret: PUSH_SECRET,
    });
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err).slice(0, 300) });
  }
}
