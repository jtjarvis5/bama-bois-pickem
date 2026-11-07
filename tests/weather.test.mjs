import { attachWeather, describeWeather, cfbdVenue, nearestHourIndex } from '../src/services/weather.js';
let fails = 0; const check = (n, ok, x) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : ' -> ' + JSON.stringify(x)}`); if (!ok) fails++; };

const now = Date.parse('2026-11-07T21:00:00Z');
const hour = (iso) => iso.slice(0, 13) + ':00';
const mkBlock = (kickoffIso, o = {}) => {
  const base = Date.parse(kickoffIso);
  const time = [-1, 0, 1].map((d) => new Date(base + d * 3600e3).toISOString().slice(0, 13) + ':00');
  const col = (v) => [v, v, v];
  return { hourly: { time, temperature_2m: col(o.temp ?? 55), precipitation_probability: col(o.p ?? 10), weather_code: col(o.code ?? 0), wind_speed_10m: col(o.w ?? 5), wind_gusts_10m: col(o.g ?? 8), is_day: col(o.day ?? 1) } };
};
const game = (id, ko, extra = {}) => ({ id, startDate: ko, status: 'UPCOMING', venue: { lat: 33.2, lon: -87.5, dome: false }, ...extra });

let calls = [];
const okFetch = (blocks) => async (url) => { calls.push(url); return { ok: true, json: async () => blocks }; };

const g1 = game(1, '2026-11-08T18:00:00.000Z');
const g2 = game(2, '2026-11-08T19:30:00.000Z');
let out = await attachWeather([g1, g2], {}, { now, fetchImpl: okFetch([mkBlock('2026-11-08T18:00:00Z', { temp: 61.6 }), mkBlock('2026-11-08T19:30:00Z', { w: 18, code: 61, p: 80 })]) });
check('one batched request for two games', calls.length === 1 && /latitude=33\.2000%2C33\.2000/.test(calls[0]), calls);
check('temperature rounded', out[0].weather.temp === 62, out[0].weather);
check('second game matched to its own block', out[1].weather.wind === 18 && out[1].weather.precip === 80, out[1].weather);

// single location returns an object, not an array
calls = [];
out = await attachWeather([g1], {}, { now, fetchImpl: async () => ({ ok: true, json: async () => mkBlock('2026-11-08T18:00:00Z', { temp: 40 }) }) });
check('single-location object response works', out[0].weather?.temp === 40, out[0]);

// dome: no fetch needed
calls = [];
out = await attachWeather([game(3, '2026-11-08T18:00:00Z', { venue: { dome: true } })], {}, { now, fetchImpl: okFetch([]) });
check('dome game: marked dome, no request', out[0].weather.dome === true && calls.length === 0, { out, calls });

// beyond 7 days / final / no venue
calls = [];
out = await attachWeather([game(4, '2026-11-20T18:00:00Z'), game(5, '2026-11-08T18:00:00Z', { status: 'FINAL', weather: { temp: 1 } }), { id: 6, startDate: '2026-11-08T18:00:00Z', status: 'UPCOMING' }], {}, { now, fetchImpl: okFetch([]) });
check('far-off game: no request, no weather', calls.length === 0 && !out[0].weather, out[0]);
check('final game: weather removed', !('weather' in out[1]), out[1]);
check('no venue: untouched, game kept', out[2].id === 6 && !out[2].weather, out[2]);

// failure keeps previous weather and every game
const prev = { 1: { ...g1, weather: { dome: false, temp: 50, wind: 3, gust: 4, precip: 0, code: 0, isDay: true } } };
out = await attachWeather([g1], prev, { now, fetchImpl: async () => { throw new Error('down'); } });
check('network failure keeps earlier weather', out[0].weather.temp === 50, out[0]);
out = await attachWeather([g1], prev, { now, fetchImpl: async () => ({ ok: false, status: 500 }) });
check('HTTP error keeps earlier weather', out[0].weather.temp === 50, out[0]);
out = await attachWeather([g1], {}, { now, fetchImpl: async () => ({ ok: true, json: async () => ({ error: true }) }) });
check('garbage response: game kept, no weather', out.length === 1 && !out[0].weather, out);

// kickoff outside the forecast hours -> no weather
out = await attachWeather([g1], {}, { now, fetchImpl: okFetch([mkBlock('2026-11-09T18:00:00Z')]) });
check('forecast not covering kickoff: no weather', !out[0].weather, out[0]);
check('nearestHourIndex', nearestHourIndex(['2026-11-08T17:00', '2026-11-08T18:00'], Date.parse('2026-11-08T18:20:00Z')) === 1);

// display
const d = (o) => describeWeather({ dome: false, temp: 55, wind: 5, gust: 8, precip: 10, code: 0, isDay: true, ...o });
check('calm clear: no alert', d({}).alert === false && d({}).icon === '☀️' && d({}).text === '55° · 5 mph wind', d({}));
check('night clear: moon', d({ isDay: false }).icon === '🌙');
check('wind 15+: alert', d({ wind: 16 }).alert === true);
check('gust 25+: alert', d({ gust: 26 }).alert === true);
check('rain 80%: alert, shows rain %', d({ code: 61, precip: 80 }).alert && /80% rain/.test(d({ code: 61, precip: 80 }).text), d({ code: 61, precip: 80 }));
check('light drizzle chance 30%: no alert', d({ code: 51, precip: 30 }).alert === false);
check('snow: alert', d({ code: 73, precip: 40 }).alert === true && /snow/.test(d({ code: 73, precip: 40 }).text));
check('thunderstorm icon', d({ code: 95, precip: 70 }).icon === '⛈️');
check('dome text', describeWeather({ dome: true }).text === 'Dome');
check('no weather -> null', describeWeather(undefined) === null);

check('cfbd venue (location x/y)', JSON.stringify(cfbdVenue({ name: 'BDS', location: { x: -87.5, y: 33.2 }, dome: false })) === JSON.stringify({ name: 'BDS', lat: 33.2, lon: -87.5, dome: false }));
check('cfbd venue (latitude/longitude)', cfbdVenue({ latitude: 33.2, longitude: -87.5 })?.lat === 33.2);
check('cfbd venue (no coords, dome)', cfbdVenue({ name: 'D', dome: true })?.dome === true);
check('cfbd venue (no coords, outdoor)', cfbdVenue({ name: 'X' }) === null);
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
