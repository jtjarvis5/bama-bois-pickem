import { useState } from 'react';
import { joinLeague, friendlyError } from '../services/api';

export default function JoinLeagueModal({ league, currentUser, onClose, onJoined }) {
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // The password is checked on the server.
      await joinLeague(currentUser.token, league.id, passwordInput);
      onJoined(league.id);
    } catch (err) {
      console.error('Error joining league:', err);
      setError(friendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-ink/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-line bg-paper/50 flex justify-between items-center">
          <h2 className="font-display font-semibold text-ink">Join {league.name}</h2>
          <button onClick={onClose} className="text-muted hover:text-ink text-xl leading-none">&times;</button>
        </div>
        
        <form onSubmit={handleJoin} className="p-5">
          <p className="text-xs text-muted mb-4">
            {league.has_password
              ? <>This league requires a password to join. Enter it below to access picks and standings for <strong>{league.name}</strong>.</>
              : <>Join <strong>{league.name}</strong> to make picks and appear in its standings.</>}
          </p>

          {error && <div className="mb-4 text-xs text-red-600 bg-red-50 p-2.5 rounded border border-red-200">{error}</div>}
          
          {league.has_password && (
            <div className="mb-5">
              <label className="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">League Password</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter password"
                className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-crimson focus:ring-1 focus:ring-crimson"
              />
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-paper text-ink border border-line font-medium text-sm py-2.5 rounded-lg hover:bg-line/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-crimson text-white font-medium text-sm py-2.5 rounded-lg hover:bg-crimson-deep transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Joining...' : 'Join League'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

