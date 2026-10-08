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
  not_admin: 'Only the league admin can do that.',
  too_many_locks: 'Only one spread lock and one total lock are allowed per week.',
  user_not_found: 'That member does not exist.',
  bad_picks: 'Those picks are not valid.',
  removed_from_league: 'You were removed from this league by its admin.',
  member_removed: 'That person was removed from the league. Add them back first.',
  cannot_reset_admin: "A league admin's PIN can only be reset by themselves.",
  cannot_remove_admin: "The league's admin can't be removed.",
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

// ---- league admin (only works for the person who created the league) ----
export const isLeagueAdmin = (token, leagueId) =>
  token ? rpc('app_is_league_admin', { p_token: token, p_league_id: leagueId }) : Promise.resolve(false);

export const adminGetPicks = (token, leagueId, week, user) =>
  rpc('app_admin_get_picks', { p_token: token, p_league_id: leagueId, p_week: week, p_user: user });

export const adminSavePicks = (token, leagueId, week, user, picks) =>
  rpc('app_admin_save_picks', { p_token: token, p_league_id: leagueId, p_week: week, p_user: user, p_picks: picks });

export const adminAudit = (token, leagueId) =>
  rpc('app_admin_audit', { p_token: token, p_league_id: leagueId });

// ---- league admin tools (05_admin_tools.sql) ----
export const adminWeekPicks = (token, leagueId, week) =>
  rpc('app_admin_week_picks', { p_token: token, p_league_id: leagueId, p_week: week });

export const adminSeasonPicks = (token, leagueId) =>
  rpc('app_admin_season_picks', { p_token: token, p_league_id: leagueId });

export const adminMembers = (token, leagueId) =>
  rpc('app_admin_members', { p_token: token, p_league_id: leagueId });

export const adminCandidates = (token, leagueId) =>
  rpc('app_admin_candidates', { p_token: token, p_league_id: leagueId });

export const adminAddMember = (token, leagueId, user) =>
  rpc('app_admin_add_member', { p_token: token, p_league_id: leagueId, p_user: user });

export const adminRemoveMember = (token, leagueId, user) =>
  rpc('app_admin_remove_member', { p_token: token, p_league_id: leagueId, p_user: user });

export const adminResetPin = (token, leagueId, user, newPin) =>
  rpc('app_admin_reset_pin', { p_token: token, p_league_id: leagueId, p_user: user, p_new_pin: newPin });

export const adminLog = (token, leagueId) =>
  rpc('app_admin_log', { p_token: token, p_league_id: leagueId });

// Edits an admin made to MY picks in the last 30 days (for the notice banner).
export const myPickEdits = (token, leagueId) =>
  rpc('app_my_pick_edits', { p_token: token, p_league_id: leagueId });
