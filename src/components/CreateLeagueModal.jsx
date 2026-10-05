import { useState } from 'react';
import { createLeague, friendlyError } from '../services/api';

export default function CreateLeagueModal({ currentUser, onClose, onLeagueCreated }) {
  const [name, setName] = useState('');
  const [sport, setSport] = useState('CFB');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      // Creates the league and adds you as its first member in one step.
      // The password is hashed on the server.
      const leagueData = await createLeague(currentUser.token, name.trim(), sport, password.trim());
      onLeagueCreated(leagueData);
    } catch (err) {
      console.error('Error creating league:', err);
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line bg-paper/50 flex justify-between items-center">
          <h2 className="font-display font-semibold text-ink">Create new league</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-5">
          {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{error}</div>}
          
          <div className="mb-4">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">League Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sunday Scaries"
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-crimson focus:ring-1 focus:ring-crimson"
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Password (Optional)</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank for open joining"
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-crimson focus:ring-1 focus:ring-crimson"
            />
            <span className="text-[11px] text-muted mt-1 block">Friends will need this password to join your league.</span>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Sport / Slate</label>
            <div className="flex gap-3">
              <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors text-center ${sport === 'CFB' ? 'border-crimson bg-crimson/5 text-crimson' : 'border-line text-muted hover:bg-paper'}`}>
                <input type="radio" name="sport" value="CFB" checked={sport === 'CFB'} onChange={(e) => setSport(e.target.value)} className="hidden" />
                <span className="text-sm font-semibold block">College Football</span>
                <span className="text-xs opacity-80 mt-0.5 block">Saturday slate</span>
              </label>
              <label className={`flex-1 border rounded-lg p-3 cursor-pointer transition-colors text-center ${sport === 'NFL' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-line text-muted hover:bg-paper'}`}>
                <input type="radio" name="sport" value="NFL" checked={sport === 'NFL'} onChange={(e) => setSport(e.target.value)} className="hidden" />
                <span className="text-sm font-semibold block">NFL</span>
                <span className="text-xs opacity-80 mt-0.5 block">Sunday slate</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            className="w-full bg-crimson text-white font-medium text-sm py-2.5 rounded-lg hover:bg-crimson-deep transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create League'}
          </button>
        </form>
      </div>
    </div>
  );
}

