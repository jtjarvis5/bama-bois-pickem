// Every call to the accounts / leagues / picks tables goes through here.
// The browser has no direct access to those tables any more (see
// sql/03_security_phase2.sql) -- it calls server-side functions that check the
// session token, verify PINs and passwords, enforce kickoff locks, and hide
// other members' picks until their games start.

import { supabase } from '../supabaseClient';

async function rpc(fn, args = {}) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
}

// The database raises short codes; this turns them into sentences for people.
const MESSAGES = {
  not_logged_in: 'Your session has expired. Please log in again.',
  game_locked: 'That game has already kicked off, so its picks can no longer be changed.',
  wrong_password: 'Incorrect league password.',
  too_many_attempts: 'Too many failed attempts. Try again in 15 minutes.',
  name_taken: 'A profile with that name already exists.',
  invalid_name: 'Please enter a valid name.',
  invalid_pin: 'The PIN must be exactly 4 digits.',
  not_a_member: 'Join this league before making picks.',
  league_not_found: 'That league no longer exists.',
};

export function errorCode(err) {
  return err?.message && MESSAGES[err.message] ? err.message : null;
}

export function friendlyError(err) {
  return MESSAGES[err?.message] || err?.message || 'Something went wrong.';
}

// ---- accounts ----
export const listUsers = () => rpc('app_list_users');

export async function login(name, pin) {
  const rows = await rpc('app_login', { p_name: name, p_pin: pin });
  return rows?.[0] || null; // null = wrong name or PIN
}

export async function register(name, pin) {
  const rows = await rpc('app_register', { p_name: name, p_pin: pin });
  return rows?.[0] || null;
}

export async function whoami(token) {
  const rows = await rpc('app_whoami', { p_token: token });
  return rows?.[0] || null;
}

export const logout = (token) => rpc('app_logout', { p_token: token });

// ---- leagues ----
export const listLeagues = () => rpc('app_list_leagues');
export const leagueMembers = (leagueId) => rpc('app_league_members', { p_league_id: leagueId });
export const myLeagueIds = (token) => rpc('app_my_leagues', { p_token: token });

export async function createLeague(token, name, sport, password) {
  const rows = await rpc('app_create_league', {
    p_token: token, p_name: name, p_sport: sport, p_password: password || null,
  });
  return rows?.[0] || null;
}

export const joinLeague = (token, leagueId, password) =>
  rpc('app_join_league', { p_token: token, p_league_id: leagueId, p_password: password || null });

// ---- picks ----
export const savePicks = (token, leagueId, week, picks) =>
  rpc('app_save_picks', { p_token: token, p_league_id: leagueId, p_week: week, p_picks: picks });

export const getWeekPicks = (token, leagueId, week) =>
  rpc('app_get_week_picks', { p_token: token || null, p_league_id: leagueId, p_week: week });

export const getSeasonPicks = (token, leagueId) =>
  rpc('app_get_season_picks', { p_token: token || null, p_league_id: leagueId });
