import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function AuthModal({ users, onSuccess, onClose, onUserCreated }) {
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Login State
  const [selectedUser, setSelectedUser] = useState(users[0] || null);
  const [pin, setPin] = useState('');
  
  // Register State
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- LOG IN EXISTING USER ---
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setLoading(true);
    setError('');

    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('id', selectedUser.id)
      .single();

    if (fetchError || !user) {
      setError('User not found.');
    } else if (user.pin === pin) {
      localStorage.setItem('currentUser', JSON.stringify(user));
      onSuccess(user);
    } else {
      setError('Incorrect PIN.');
    }
    setLoading(false);
  };

  // --- REGISTER NEW USER ---
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!newName.trim() || newPin.length < 4) {
      setError('Please provide a name and a 4-digit PIN.');
      return;
    }
    setLoading(true);
    setError('');

    // Generate a simple unique ID from name (e.g., "John Doe" -> "john_doe")
    const generatedId = newName.trim().toLowerCase().replace(/\s+/g, '_');

    // Check if ID already exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('id', generatedId)
      .single();

    if (existing) {
      setError('That name is already taken. Try adding an initial.');
      setLoading(false);
      return;
    }

    // Insert new user
    const newUser = {
      id: generatedId,
      name: newName.trim(),
      pin: newPin,
    };

    const { error: insertError } = await supabase
      .from('users')
      .insert([newUser]);

    if (insertError) {
      setError('Could not create profile. Try again.');
    } else {
      // Save session & return
      localStorage.setItem('currentUser', JSON.stringify(newUser));
      if (onUserCreated) onUserCreated(); // Refresh user list in parent
      onSuccess(newUser);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {!isRegistering ? (
          /* LOGIN FORM */
          <form onSubmit={handleLogin}>
            <h3>Select Your Name</h3>
            <select
              value={selectedUser?.id || ''}
              onChange={(e) => setSelectedUser(users.find((u) => u.id === e.target.value))}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>

            <input
              type="password"
              maxLength={4}
              placeholder="Enter 4-digit PIN"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading || pin.length < 4}>
              {loading ? 'Verifying...' : 'Log In'}
            </button>

            <hr />
            <p>
              First time here?{' '}
              <button type="button" onClick={() => { setIsRegistering(true); setError(''); }}>
                Create a Profile
              </button>
            </p>
          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegister}>
            <h3>Create Profile</h3>
            <input
              type="text"
              placeholder="Your Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />

            <input
              type="password"
              maxLength={4}
              placeholder="Create 4-digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
            />

            {error && <p className="error">{error}</p>}

            <button type="submit" disabled={loading || !newName || newPin.length < 4}>
              {loading ? 'Creating...' : 'Save & Log In'}
            </button>

            <hr />
            <p>
              Already have a profile?{' '}
              <button type="button" onClick={() => { setIsRegistering(false); setError(''); }}>
                Back to Login
              </button>
            </p>
          </form>
        )}
        <button type="button" className="close-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
