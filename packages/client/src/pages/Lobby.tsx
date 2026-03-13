import { useState } from 'react';

interface LobbyProps {
  onCreateRoom: (playerName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  prefillRoomId?: string;
}

export function Lobby({ onCreateRoom, onJoinRoom, prefillRoomId }: LobbyProps) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState(prefillRoomId ?? '');

  return (
    <div className="page" style={{ paddingTop: '60px', textAlign: 'center' }}>
      <div className="rainbow-bar" />
      <h1 style={{ fontSize: '2.8em', marginBottom: '8px', fontWeight: 900, fontStyle: 'italic', color: '#ffd700' }}>
        魔法运动会
      </h1>
      <p style={{ color: '#888', marginBottom: '40px', fontSize: '14px', fontWeight: 700 }}>Magical Athlete</p>

      <div style={{ marginBottom: '32px' }}>
        <label htmlFor="player-name" className="sr-only">你的名字</label>
        <input
          id="player-name"
          name="playerName"
          placeholder="输入你的名字…"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="off"
          style={{ marginRight: '12px', width: '220px' }}
        />
      </div>

      <div style={{ display: 'flex', gap: '24px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <div style={{ background: '#1a171e', padding: '24px', borderRadius: '12px', border: '3px solid #35303b', minWidth: '280px' }}>
          <h3 style={{ marginBottom: '16px', color: '#ffd700', fontWeight: 800 }}>创建房间</h3>
          <button
            className="btn-primary"
            onClick={() => name && onCreateRoom(name)}
            disabled={!name}
          >
            创建新游戏
          </button>
        </div>

        <div style={{ background: '#1a171e', padding: '24px', borderRadius: '12px', border: '3px solid #35303b', minWidth: '280px' }}>
          <h3 style={{ marginBottom: '16px', color: '#3b82f6', fontWeight: 800 }}>加入房间</h3>
          <label htmlFor="room-id" className="sr-only">房间号</label>
          <input
            id="room-id"
            name="roomId"
            placeholder="输入房间号…"
            value={joinId}
            onChange={e => setJoinId(e.target.value.toUpperCase())}
            autoComplete="off"
            spellCheck={false}
            style={{ marginBottom: '12px', width: '140px', textAlign: 'center', letterSpacing: '2px' }}
          />
          <br />
          <button
            className="btn-primary"
            onClick={() => name && joinId && onJoinRoom(joinId, name)}
            disabled={!name || !joinId}
          >
            加入游戏
          </button>
        </div>
      </div>
    </div>
  );
}
