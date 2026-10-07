import { useMemo, useState } from 'react';
import ActivityLog from './admin/ActivityLog';
import Export from './admin/Export';
import Members from './admin/Members';
import PicksEditor from './admin/PicksEditor';
import Status from './admin/Status';
import { gamesForWeek } from './admin/shared';

// League-admin tools, only shown to the person who created the league (the
// server enforces that too, and logs every change).

const TABS = [
  ['status', 'Status'],
  ['edit', 'Edit'],
  ['members', 'Members'],
  ['export', 'Export'],
  ['log', 'Log'],
];

export default function AdminPage({
  token, leagueId, leagueName, members = [], games = [], gamesByWeek = {}, defaultWeek, onSaved, onMembersChanged,
}) {
  const [tab, setTab] = useState('status');
  const [week, setWeek] = useState(defaultWeek);
  const [member, setMember] = useState('');
  const [bump, setBump] = useState(0); // refreshes Status and Log after any change

  const weeks = useMemo(() => {
    const set = new Set(Object.keys(gamesByWeek).map(Number).filter((n) => !Number.isNaN(n)));
    if (defaultWeek != null) set.add(defaultWeek);
    return [...set].sort((a, b) => a - b);
  }, [gamesByWeek, defaultWeek]);

  const weekGames = useMemo(
    () => gamesForWeek(gamesByWeek, games, week, defaultWeek),
    [gamesByWeek, games, week, defaultWeek],
  );

  // The editor needs a valid member; fall back to the first one.
  const editMember = members.includes(member) ? member : members[0] || '';

  const saved = () => { setBump((b) => b + 1); onSaved?.(); };
  const membersChanged = () => { setBump((b) => b + 1); onMembersChanged?.(); };

  return (
    <div>
      <div role="tablist" aria-label="Admin sections" className="flex gap-1 overflow-x-auto mb-5 border-b border-line">
        {TABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-crimson text-crimson' : 'border-transparent text-muted hover:text-ink'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <Status token={token} leagueId={leagueId} leagueName={leagueName} week={week} setWeek={setWeek}
          weeks={weeks} weekGames={weekGames} reloadKey={bump}
          onEdit={(name) => { setMember(name); setTab('edit'); }} />
      )}
      {tab === 'edit' && (
        <PicksEditor token={token} leagueId={leagueId} members={members} games={games} gamesByWeek={gamesByWeek}
          defaultWeek={defaultWeek} weeks={weeks} week={week} setWeek={setWeek}
          member={editMember} setMember={setMember} onSaved={saved} />
      )}
      {tab === 'members' && <Members token={token} leagueId={leagueId} onChanged={membersChanged} />}
      {tab === 'export' && (
        <Export token={token} leagueId={leagueId} leagueName={leagueName} gamesByWeek={gamesByWeek} members={members} />
      )}
      {tab === 'log' && <ActivityLog token={token} leagueId={leagueId} gamesByWeek={gamesByWeek} reloadKey={bump} />}
    </div>
  );
}
