// Vercel serverless proxy for the CollegeFootballData API.
//
// Why this exists: anything prefixed VITE_ is baked into the public JS
// bundle, so the old VITE_CFBD_API_KEY could be read by anyone who opened
// devtools and used to burn the monthly quota. The key now lives only here
// (CFBD_API_KEY, no VITE_ prefix) and the browser calls /api/cfbd instead.
//
// It also fixes a quota stampede: responses are cached at Vercel's edge
// (s-maxage) and shared by every visitor, so several people opening a stale
// week at the same moment cost one CFBD call per endpoint, not one each.

const CFBD_BASE = 'https://api.collegefootballdata.com';

// Only the endpoints the app uses, and only the query params each needs.
// Nothing else can be reached through this proxy.
const ROUTES = {
  games:      { params: ['year', 'week', 'seasonType'], sMaxAge: 600 },
  lines:      { params: ['year', 'week', 'seasonType'], sMaxAge: 600 },
  rankings:   { params: ['year', 'week', 'seasonType'], sMaxAge: 1800 },
  records:    { params: ['year'],                       sMaxAge: 1800 },
  'teams/fbs': { params: [],                            sMaxAge: 86400 },
};

const VALID = {
  year: /^\d{4}$/,
  week: /^\d{1,2}$/,
  seasonType: /^(regular|postseason|both)$/,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'GET only' });
  }

  const key = process.env.CFBD_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: 'CFBD_API_KEY is not set on the server. In Vercel: Project Settings → ' +
             'Environment Variables → add CFBD_API_KEY (no VITE_ prefix), then redeploy.',
    });
  }

  const path = String(req.query.path || '');
  const route = ROUTES[path];
  if (!route) return res.status(400).json({ error: `Unknown path "${path}"` });

  const qs = new URLSearchParams();
  for (const name of route.params) {
    const value = req.query[name];
    if (value == null) continue;
    if (!VALID[name].test(String(value))) {
      return res.status(400).json({ error: `Bad value for ${name}` });
    }
    qs.set(name, String(value));
  }

  try {
    const upstream = await fetch(`${CFBD_BASE}/${path}${qs.toString() ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
    });
    const body = await upstream.text();

    // Only successful responses are cached; an error must never be pinned
    // at the edge for ten minutes.
    res.setHeader(
      'Cache-Control',
      upstream.ok
        ? `public, s-maxage=${route.sMaxAge}, stale-while-revalidate=${route.sMaxAge * 6}`
        : 'no-store'
    );
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    return res.status(upstream.status).send(body);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: `Upstream request failed: ${err.message}` });
  }
}
