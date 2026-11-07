// Kickoff weather for the pick cards.
//
// Forecasts come from Open-Meteo (free, no API key, browser-friendly). They are
// fetched once per game-cache refresh, for the whole slate in a single request,
// and saved on each game as `game.weather`, so every viewer shares one copy and
// opening a card costs nothing. Forecasts are only trustworthy about a week
// out, so games further away get no weather until they come inside that window.

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // Open-Meteo forecasts ~7 days
const GRACE_MS = 4 * 60 * 60 * 1000; // keep a game's weather while it is being played

export const WIND_ALERT_MPH = 15;
export const GUST_ALERT_MPH = 25;
export const RAIN_ALERT_PCT = 50;

// NFL stadium coordinates by home-team abbreviation (ESPN's abbreviations).
// `dome` is a fallback for when ESPN does not flag the venue as indoor.
export const NFL_VENUES = {
  ARI: { lat: 33.5276, lon: -112.2626, dome: true },
  ATL: { lat: 33.7554, lon: -84.4009, dome: true },
  BAL: { lat: 39.278, lon: -76.6227 },
  BUF: { lat: 42.7738, lon: -78.787 },
  CAR: { lat: 35.2258, lon: -80.8528 },
  CHI: { lat: 41.8623, lon: -87.6167 },
  CIN: { lat: 39.0955, lon: -84.5161 },
  CLE: { lat: 41.5061, lon: -81.6995 },
  DAL: { lat: 32.7473, lon: -97.0945, dome: true },
  DEN: { lat: 39.7439, lon: -105.0201 },
  DET: { lat: 42.34, lon: -83.0456, dome: true },
  GB: { lat: 44.5013, lon: -88.0622 },
  HOU: { lat: 29.6847, lon: -95.4107, dome: true },
  IND: { lat: 39.7601, lon: -86.1639, dome: true },
  JAX: { lat: 30.3239, lon: -81.6373 },
  KC: { lat: 39.0489, lon: -94.4839 },
  LV: { lat: 36.0909, lon: -115.1833, dome: true },
  LAC: { lat: 33.9535, lon: -118.3392 },
  LAR: { lat: 33.9535, lon: -118.3392 },
  MIA: { lat: 25.958, lon: -80.2389 },
  MIN: { lat: 44.9735, lon: -93.2575, dome: true },
  NE: { lat: 42.0909, lon: -71.2643 },
  NO: { lat: 29.9511, lon: -90.0812, dome: true },
  NYG: { lat: 40.8135, lon: -74.0745 },
  NYJ: { lat: 40.8135, lon: -74.0745 },
  PHI: { lat: 39.9008, lon: -75.1675 },
  PIT: { lat: 40.4468, lon: -80.0158 },
  SF: { lat: 37.4032, lon: -121.9695 },
  SEA: { lat: 47.5952, lon: -122.3316 },
  TB: { lat: 27.9759, lon: -82.5033 },
  TEN: { lat: 36.1665, lon: -86.7713 },
  WSH: { lat: 38.9076, lon: -76.8645 },
};

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** Pull a venue's coordinates out of a CFBD /venues record (either field style). */
export function cfbdVenue(v) {
  if (!v) return null;
  const lat = Number(v.location?.y ?? v.latitude);
  const lon = Number(v.location?.x ?? v.longitude);
  const dome = Boolean(v.dome);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return dome ? { name: v.name || null, dome } : null;
  return { name: v.name || null, lat, lon, dome };
}

/** Which hour of an Open-Meteo hourly block is closest to kickoff. */
export function nearestHourIndex(times, kickoffMs) {
  let best = -1;
  let bestGap = Infinity;
  (times || []).forEach((t, i) => {
    const gap = Math.abs(Date.parse(`${t}Z`) - kickoffMs);
    if (gap < bestGap) { bestGap = gap; best = i; }
  });
  // More than 90 minutes from any hour means the forecast does not cover kickoff.
  return bestGap <= 90 * 60 * 1000 ? best : -1;
}

/** One game's weather from an Open-Meteo location block. */
export function weatherFromBlock(block, kickoffMs, asOf) {
  const h = block?.hourly;
  if (!h?.time) return null;
  const i = nearestHourIndex(h.time, kickoffMs);
  if (i < 0) return null;
  const temp = h.temperature_2m?.[i];
  if (!isNum(temp)) return null;
  return {
    dome: false,
    temp: Math.round(temp),
    wind: Math.round(h.wind_speed_10m?.[i] ?? 0),
    gust: Math.round(h.wind_gusts_10m?.[i] ?? 0),
    precip: Math.round(h.precipitation_probability?.[i] ?? 0),
    code: h.weather_code?.[i] ?? 0,
    isDay: h.is_day?.[i] !== 0,
    asOf,
  };
}

function eligible(game, now) {
  if (game.status === 'FINAL') return false;
  const ko = new Date(game.startDate).getTime();
  return Number.isFinite(ko) && ko - now <= WINDOW_MS && ko > now - GRACE_MS;
}

/**
 * Returns the games with `weather` filled in. Never throws and never drops a
 * game: if the forecast call fails, each game keeps the weather it already had.
 * Final games carry no weather.
 *
 * game.venue = { lat, lon, dome } (set when the games are fetched).
 */
export async function attachWeather(games, previousById = {}, opts = {}) {
  const { fetchImpl = (typeof fetch === 'function' ? fetch : null), now = Date.now(), timeoutMs = 6000 } = opts;

  const result = games.map((g) => {
    if (g.status === 'FINAL') {
      const { weather, ...rest } = g; // eslint-disable-line no-unused-vars
      return rest;
    }
    const prev = previousById[g.id]?.weather;
    return prev ? { ...g, weather: prev } : { ...g };
  });

  const toFetch = [];
  result.forEach((g, idx) => {
    if (!g.venue || !eligible(g, now)) return;
    if (g.venue.dome) { result[idx] = { ...g, weather: { dome: true } }; return; }
    if (isNum(g.venue.lat) && isNum(g.venue.lon)) toFetch.push(idx);
  });
  if (toFetch.length === 0 || !fetchImpl) return result;

  const params = new URLSearchParams({
    latitude: toFetch.map((i) => result[i].venue.lat.toFixed(4)).join(','),
    longitude: toFetch.map((i) => result[i].venue.lon.toFixed(4)).join(','),
    hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    timezone: 'UTC',
    forecast_days: '8',
  });

  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(`${FORECAST_URL}?${params}`, controller ? { signal: controller.signal } : undefined);
    if (!res.ok) return result;
    const json = await res.json();
    const blocks = Array.isArray(json) ? json : [json];
    const asOf = new Date(now).toISOString();
    toFetch.forEach((gameIdx, n) => {
      const w = weatherFromBlock(blocks[n], new Date(result[gameIdx].startDate).getTime(), asOf);
      if (w) result[gameIdx] = { ...result[gameIdx], weather: w };
    });
  } catch (err) {
    console.warn('Weather lookup failed; keeping earlier weather:', err.message);
  } finally {
    if (timer) clearTimeout(timer);
  }
  return result;
}

// ---- Display ----

function iconFor(code, isDay) {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code === 1 || code === 2) return isDay ? '⛅' : '☁️';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌫️';
  if (code >= 51 && code <= 57) return '🌦️';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return '🌧️';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️';
  if (code >= 95) return '⛈️';
  return '☁️';
}

const isSnow = (c) => (c >= 71 && c <= 77) || c === 85 || c === 86;
const isWet = (c) => c >= 51; // drizzle, rain, snow, showers, thunderstorms

/** Text + alert flag for a game's saved weather. Null when there is nothing to show. */
export function describeWeather(w) {
  if (!w) return null;
  if (w.dome) return { icon: '🏟️', text: 'Dome', alert: false, why: null };

  const reasons = [];
  if (w.wind >= WIND_ALERT_MPH || w.gust >= GUST_ALERT_MPH) reasons.push('wind');
  if (isSnow(w.code) || (isWet(w.code) && w.precip >= RAIN_ALERT_PCT)) reasons.push(isSnow(w.code) ? 'snow' : 'rain');

  const parts = [`${w.temp}°`, `${w.wind} mph wind`];
  if (w.precip >= 20 || isWet(w.code)) parts.push(`${w.precip}% ${isSnow(w.code) ? 'snow' : 'rain'}`);

  return {
    icon: iconFor(w.code, w.isDay !== false),
    text: parts.join(' · '),
    alert: reasons.length > 0,
    why: reasons.length ? `${reasons.join(' and ')} tends to favor the under` : null,
  };
}
