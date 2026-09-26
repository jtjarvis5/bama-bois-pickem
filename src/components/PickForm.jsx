import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import PinModal from './components/PinModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    // Restore session on load
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) setCurrentUser(JSON.parse(savedUser));

    // Fetch available profiles
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('id, name');
    if (data) setUsers(data);
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setShowPinModal(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  const submitPicks = async (week, picks, lockGameId, tiebreaker) => {
    if (!currentUser) return alert('Please log in with your PIN first.');

    // Save picks bound to the logged in user
    const { error } = await supabase
      .from('user_picks')
      .upsert({
        user_id: currentUser.id, // Matches user_id in schema
        week: week,
        picks: picks,
        lock_game_id: lockGameId,
        tiebreaker: tiebreaker,
        submitted_at: new Date()
      }, { onConflict: 'user_id,week' });

    if (error) console.error('Error saving picks:', error);
    else alert('Picks saved successfully!');
  };

  return (
    <div>
      <header>
        {currentUser ? (
          <div>
            <span>Logged in as: <strong>{currentUser.name}</strong></span>
            <button onClick={handleLogout}>Log Out</button>
          </div>
        ) : (
          <div>
            <h3>Select your name to log in:</h3>
            {users.map((user) => (
              <button key={user.id} onClick={() => handleSelectUser(user)}>
                {user.name}
              </button>
            ))}
          </div>
        )}
      </header>

      {showPinModal && (
        <PinModal
          selectedUser={selectedUser}
          onSuccess={(user) => {
            setCurrentUser(user);
            setShowPinModal(false);
          }}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}
