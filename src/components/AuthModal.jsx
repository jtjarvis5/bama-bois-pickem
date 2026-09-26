import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function AuthModal({ users, onSuccess, onUserCreated, onClose }) {
  const [mode, setMode] = useState('login'); // 'login' | 'create'
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || users[0]?.name || '');
  const [pin, setPin] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const selectedUserObj = users.find(
        (u) => u.id === selectedUserId || u.name === selectedUserId
      );

      if (!selectedUserObj) {
        setError('Please select a valid user.');
        setLoading(false);
        return;
      }

      const { data, error: fetchErr } = await supabase
        .from('users')
        .select('*')
        .eq('name', selectedUserObj.name)
        .single();

      if (fetchErr || !data) {
        setError('User not found or PIN not set.');
        setLoading(false);
        return;
      }

      if (data.pin !== pin) {
        setError('Incorrect 4-digit PIN.');
        setLoading(false);
        return;
      }

      const loggedInUser = { id: data.id, name: data.name };
      localStorage.setItem('currentUser', JSON.stringify(loggedInUser));
      onSuccess(loggedInUser);
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
    setLoading(false);
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    setError('');
    if (!newName.trim() || newPin.length < 4) {
      setError('Please enter a valid name and a 4-digit PIN.');
      return;
    }
    setLoading(true);

    try {
      const { data, error: createErr } = await supabase
        .from('users')
        .insert([{ name: newName.trim(), pin: newPin.trim() }])
        .select()
        .single();

      if (createErr) {
        if (createErr.code === '23505') {
          throw new Error('A profile with that name already exists.');
        }
        throw createErr;
      }

      const createdUser = { id: data.id, name: data.name };
      localStorage.setItem('currentUser', JSON.stringify(createdUser));
      if (onUserCreated) onUserCreated();
      onSuccess(createdUser);
    } catch (err) {
      setError(err.message || 'Failed to create profile.');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-line p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted hover:text-ink transition-colors p-1 text-xl font-bold"
          aria-label="Close"
        >
          &times;
        </button>

        {mode === 'login' ? (
          <div>
            <h3 className="font-display text-xl font-semibold text-ink mb-1">
              Log In to Your Profile
            </h3>
            <p className="text-xs text-muted mb-6">
              Select your name and enter your 4-digit PIN to submit picks.
            </p>

            {error && (
              <div className="mb-4 text-xs bg-red-50 text-red-600 border border-red-200 p-2.5 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Select User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-crimson"
                >
                  {users.map((u) => (
                    <option key={u.id || u.name} value={u.id || u.name}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-sm text-ink tracking-widest focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-crimson text-white font-medium py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Authenticating…' : 'Log In'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-line text-center">
              <p className="text-xs text-muted">
                Don&rsquo;t have a profile yet?{' '}
                <button
                  onClick={() => {
                    setError('');
                    setMode('create');
                  }}
                  className="text-crimson font-medium hover:underline"
                >
                  Create New Profile
                </button>
              </p>
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-display text-xl font-semibold text-ink mb-1">
              Create New Profile
            </h3>
            <p className="text-xs text-muted mb-6">
              Enter your name and create a 4-digit PIN for future logins.
            </p>

            {error && (
              <div className="mb-4 text-xs bg-red-50 text-red-600 border border-red-200 p-2.5 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Your Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. John"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink mb-1">
                  Create 4-Digit PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full bg-paper border border-line rounded-lg px-3 py-2 text-sm text-ink tracking-widest focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-crimson text-white font-medium py-2.5 rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Creating Profile…' : 'Save & Log In'}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-line text-center">
              <p className="text-xs text-muted">
                Already have a profile?{' '}
                <button
                  onClick={() => {
                    setError('');
                    setMode('login');
                  }}
                  className="text-crimson font-medium hover:underline"
                >
                  Back to Login
                </button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
