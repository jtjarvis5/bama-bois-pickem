import React, { useState } from 'react';
import bcrypt from 'bcryptjs';
import { supabase } from '../lib/supabaseClient';

export default function PinModal({ selectedUser, onSuccess, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Fetch user hash from Supabase
    const { data: user, error: fetchError } = await supabase
      .from('users')
      .select('pin_hash')
      .eq('id', selectedUser.id)
      .single();

    if (fetchError || !user) {
      setError('User record not found');
      setLoading(false);
      return;
    }

    // Compare PIN input against database hash
    const isValid = bcrypt.compareSync(pin, user.pin_hash);

    if (isValid) {
      // Save user session in localStorage
      localStorage.setItem('currentUser', JSON.stringify(selectedUser));
      onSuccess(selectedUser);
    } else {
      setError('Incorrect PIN. Try again.');
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3>Logging in as {selectedUser.name}</h3>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            maxLength={4}
            placeholder="Enter 4-digit PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="submit" disabled={loading || pin.length < 4}>
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
            <button type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
