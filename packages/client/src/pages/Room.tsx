interface RoomInfo {
  id: string;
  hostId: string;
  players: { id: string; name: string; isAI: boolean }[];
  aiPlayers: { id: string; name: string; isAI: boolean; aiDifficulty?: string }[];
  gameStarted: boolean;
}

interface RoomProps {
  roomInfo: RoomInfo | null;
  playerId: string | null;
  onAddAI: (difficulty: 'easy' | 'normal') => void;
  onRemoveAI: (aiId: string) => void;
  onStartGame: () => void;
}

export function Room({ roomInfo, playerId, onAddAI, onRemoveAI, onStartGame }: RoomProps) {
  if (!roomInfo) {
    return <div className="page"><h2>加载房间中…</h2></div>;
  }

  const isHost = playerId === roomInfo.hostId;
  const totalPlayers = roomInfo.players.length + roomInfo.aiPlayers.length;
  const canStart = totalPlayers >= 1 && totalPlayers <= 5;

  return (
    <div className="page">
      <div className="rainbow-bar" />
      <h1 style={{ color: '#ffd700', fontWeight: 900 }}>房间：{roomInfo.id}</h1>
      <p style={{ marginBottom: '24px', color: '#888', fontWeight: 700 }}>将房间号分享给好友即可加入</p>

      <div style={{ background: '#1a171e', padding: '20px', borderRadius: '12px', border: '3px solid #35303b', marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px' }}>
        <h3 style={{ marginBottom: '12px', fontWeight: 800, color: '#ffd700' }}>玩家 ({totalPlayers}/5)</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {roomInfo.players.map(p => (
            <li key={p.id} style={{ padding: '10px 12px', borderBottom: '2px solid #35303b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#fff' }}>{p.name}</span>
              {p.id === roomInfo.hostId && <span style={{ background: '#e81e3c', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>房主</span>}
              {p.id === playerId && <span style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>你</span>}
            </li>
          ))}
          {roomInfo.aiPlayers.map(p => (
            <li key={p.id} style={{ padding: '10px 12px', borderBottom: '2px solid #35303b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700 }}>{p.name} <span style={{ background: '#cc5de8', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>AI</span></span>
              {isHost && (
                <button className="btn-secondary" onClick={() => onRemoveAI(p.id)} style={{ padding: '4px 10px', fontSize: '12px' }}>
                  移除
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn-secondary" onClick={() => onAddAI('easy')} disabled={totalPlayers >= 5}>
            + 简单AI
          </button>
          <button className="btn-secondary" onClick={() => onAddAI('normal')} disabled={totalPlayers >= 5}>
            + 普通AI
          </button>
        </div>
      )}

      {isHost && (
        <button className="btn-primary" onClick={onStartGame} disabled={!canStart} style={{ fontSize: '16px', padding: '14px 36px' }}>
          开始游戏
        </button>
      )}

      {!isHost && <p style={{ color: '#888', fontWeight: 700 }}>等待房主开始游戏...</p>}
    </div>
  );
}
