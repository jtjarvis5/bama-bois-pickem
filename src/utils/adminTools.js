// Pure helpers behind the league-admin tools: who has picked, the reminder
// text, the CSV exports and PIN generation. Nothing here talks to the server or
// the page, so it is all covered by tests/admin.test.mjs.

import { hasSpreadLock, hasTotalLock } from './scoring';
import { calculateSeasonStandings } from './leaderboard';
import { buildPickEvents, buildWeekGrid, rankMembers } from './insights';

const kickoffMs = (game) => new Date(game.startDate).getTime();

// ---- 1. who has picked -----------------------------------------------------

/**
 * One entry per member for a week.
 *   rows  = [{ user_name, picks }]   (from app_admin_week_picks; picks is {} for no picks)
 *   games = the week's games
 * `picked` counts games with at least a spread or a total pick; `missingUpcoming`
 * counts games they have NOT picked that haven't kicked off yet (the ones they can
 * still fix themselves).
 */
export function summarizeWeek(rows = [], games = [], now = Date.now()) {
  const total = games.length;
  const out = rows.map(({ user_name: member, picks }) => {
    const p = picks || {};
    let picked = 0;
    let spread = 0;
    let totals = 0;
    let missingUpcoming = 0;
    games.forEach((g) => {
      const e = p[String(g.id)];
      const has = Boolean(e && (e.spread || e.total));
      if (has) picked += 1;
      if (e?.spread) spread += 1;
      if (e?.total) totals += 1;
      if (!has && kickoffMs(g) > now) missingUpcoming += 1;
    });
    const entries = Object.values(p);
    return {
      member, picked, total, spread, totals, missingUpcoming,
      spreadLock: entries.some((e) => e && hasSpreadLock(e)),
      totalLock: entries.some((e) => e && hasTotalLock(e)),
      state: total > 0 && picked === total ? 'done' : picked === 0 ? 'none' : 'partial',
    };
  });
  // Fewest picks first, so the people to chase are at the top.
  return out.sort((a, b) => a.picked - b.picked || a.member.localeCompare(b.member));
}

/** The next game that hasn't kicked off, or null. */
export function nextKickoff(games = [], now = Date.now()) {
  const upcoming = games.filter((g) => kickoffMs(g) > now).sort((a, b) => kickoffMs(a) - kickoffMs(b));
  return upcoming[0] || null;
}

/**
 * Text to paste into the group chat. Only members who can still act (they have
 * at least one unpicked game that hasn't started) are named. Returns null when
 * nobody needs a nudge, or when every game has already kicked off.
 */
export function buildReminder({ leagueName, week, summary, games, now = Date.now() }) {
  const next = nextKickoff(games, now);
  if (!next) return null;
  const waiting = summary.filter((s) => s.missingUpcoming > 0);
  if (waiting.length === 0) return null;

  const names = waiting.map((s) => `${s.member} (${s.picked}/${s.total})`).join(', ');
  const when = new Date(kickoffMs(next)).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
  return [
    `📣 ${leagueName ? `${leagueName} — ` : ''}Week ${week} picks reminder`,
    `Still waiting on: ${names}`,
    `Next kickoff: ${when}`,
  ].join('\n');
}

// ---- 2. CSV ----------------------------------------------------------------

/**
 * One CSV cell. Text that starts with = + - @ (or a tab / carriage return) is
 * prefixed with an apostrophe so a spreadsheet can't run it as a formula
 * (member names are typed by users). Numbers are written as numbers.
 */
export function csvCell(value) {
  if (value == null) return '';
  let s = String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

const sideName = (game, side) => (side === 'home' ? game.homeTeam : game.awayTeam);
const resultLabel = (r) => (r === 'win' ? 'Win' : r === 'loss' ? 'Loss' : r === 'push' ? 'Push' : '');

/**
 * Every pick ever made in the league, one row per game per member, with the
 * result and points each pick earned (using the same grading as the standings).
 *   seasonRows = [{ user_name, week, picks }]   (unredacted, from app_admin_season_picks)
 */
export function buildPicksCsv(seasonRows = [], gamesByWeek = {}, members = []) {
  const events = buildPickEvents(seasonRows, gamesByWeek, members);
  const eventAt = new Map(events.map((e) => [`${e.member}|${e.week}|${e.gameId}|${e.kind}`, e]));

  const out = [];
  seasonRows.forEach(({ user_name: member, week, picks }) => {
    const w = Number(week);
    const games = gamesByWeek[w] || [];
    Object.entries(picks || {}).forEach(([gameId, pick]) => {
      if (!pick || (!pick.spread && !pick.total)) return;
      const game = games.find((g) => String(g.id) === String(gameId));
      const sp = eventAt.get(`${member}|${w}|${gameId}|spread`);
      const tt = eventAt.get(`${member}|${w}|${gameId}|total`);
      const graded = Boolean(sp || tt);
      out.push({
        sortWeek: w,
        sortTime: game ? kickoffMs(game) : Number.MAX_SAFE_INTEGER,
        member,
        row: [
          w,
          member,
          game ? `${game.awayTeam} @ ${game.homeTeam}` : `Game ${gameId}`,
          game?.startDate ?? '',
          pick.spread && game ? sideName(game, pick.spread) : pick.spread ? (pick.spread === 'home' ? 'Home' : 'Away') : '',
          pick.spread && game ? (pick.spread === 'home' ? game.homeSpread : game.awaySpread) : '',
          pick.spread ? (hasSpreadLock(pick) ? 'Yes' : '') : '',
          resultLabel(sp?.result),
          pick.total ? (pick.total === 'over' ? 'Over' : 'Under') : '',
          pick.total && game ? game.overUnder : '',
          pick.total ? (hasTotalLock(pick) ? 'Yes' : '') : '',
          resultLabel(tt?.result),
          game && game.status === 'FINAL' ? `${game.awayScore}-${game.homeScore}` : '',
          graded ? (sp?.points ?? 0) + (tt?.points ?? 0) : '',
        ],
      });
    });
  });

  out.sort((a, b) => a.sortWeek - b.sortWeek || a.sortTime - b.sortTime || a.member.localeCompare(b.member));
  return toCsv(
    ['Week', 'Member', 'Game', 'Kickoff (UTC)', 'Spread pick', 'Spread line', 'Spread lock', 'Spread result',
      'Total pick', 'Total line', 'Total lock', 'Total result', 'Final score (away-home)', 'Points'],
    out.map((o) => o.row),
  );
}

/** Season standings with weeks won, matching the Standings and Stats tabs. */
export function buildStandingsCsv(seasonRows = [], gamesByWeek = {}, members = []) {
  const standings = calculateSeasonStandings(seasonRows, gamesByWeek, members)
    .filter((s) => members.includes(s.userName));
  const ranks = rankMembers(standings);
  const events = buildPickEvents(seasonRows, gamesByWeek, members);
  const grid = buildWeekGrid(events, gamesByWeek, members);
  return toCsv(
    ['Rank', 'Member', 'Points', 'Wins', 'Losses', 'Pushes', 'Lock bonuses hit', 'Weeks won'],
    standings.map((s) => [
      `${ranks[s.userName].tied ? 'T' : ''}${ranks[s.userName].rank}`,
      s.userName, s.totalPoints, s.wins, s.losses, s.pushes, s.lockBonuses, grid.weeksWon[s.userName] || 0,
    ]),
  );
}

export const slug = (text) =>
  String(text || 'league').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'league';

/** Saves text as a file in the browser (UTF-8 with a BOM so Excel reads it correctly). */
export function downloadCsv(filename, text) {
  const blob = new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---- 3. PIN ----------------------------------------------------------------

/** A random 4-digit PIN (leading zeros allowed) using the browser's secure generator. */
export function randomPin(cryptoObj = globalThis.crypto) {
  const buf = new Uint32Array(1);
  // Rejection sampling: 2^32 is not a multiple of 10,000, so a plain modulo would favour low PINs.
  const limit = Math.floor(0x100000000 / 10000) * 10000;
  let n;
  do { cryptoObj.getRandomValues(buf); n = buf[0]; } while (n >= limit);
  return String(n % 10000).padStart(4, '0');
}

export const isValidPin = (pin) => /^[0-9]{4}$/.test(String(pin ?? ''));
