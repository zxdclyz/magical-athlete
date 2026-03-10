import { useState } from 'react';

interface LobbyProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
}

export function Lobby({ onCreateRoom, onJoinRoom }: LobbyProps) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');

  return (
    <div className="page" style={{ paddingTop: '80px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5em', marginBottom: '40px' }}>Magical Athlete</h1>

      <div style={{ marginBottom: '32px' }}>
        <input
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ marginRight: '12px', width: '200px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ background: '#16213e', padding: '24px', borderRadius: '12px', minWidth: '280px' }}>
          <h3 style={{ marginBottom: '16px' }}>Create Room</h3>
          <button
            className="btn-primary"
            onClick={() => name && onCreateRoom(name)}
            disabled={!name}
          >
            Create New Game
          </button>
        </div>

        <div style={{ background: '#16213e', padding: '24px', borderRadius: '12px', minWidth: '280px' }}>
          <h3 style={{ marginBottom: '16px' }}>Join Room</h3>
          <input
            placeholder="Room Code"
            value={joinId}
            onChange={e => setJoinId(e.target.value.toUpperCase())}
            style={{ marginBottom: '12px', width: '140px', textAlign: 'center', letterSpacing: '2px' }}
          />
          <br />
          <button
            className="btn-primary"
            onClick={() => name && joinId && onJoinRoom(joinId, name)}
            disabled={!name || !joinId}
          >
            Join Game
          </button>
        </div>
      </div>
    </div>
  );
}
