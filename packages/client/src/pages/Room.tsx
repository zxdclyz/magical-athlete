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
    return <div className="page"><h2>Loading room...</h2></div>;
  }

  const isHost = playerId === roomInfo.hostId;
  const totalPlayers = roomInfo.players.length + roomInfo.aiPlayers.length;
  const canStart = totalPlayers >= 2 && totalPlayers <= 5;

  return (
    <div className="page">
      <h1>Room: {roomInfo.id}</h1>
      <p style={{ marginBottom: '24px', color: '#888' }}>Share this code with friends to join</p>

      <div style={{ background: '#16213e', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
        <h3 style={{ marginBottom: '12px' }}>Players ({totalPlayers}/5)</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {roomInfo.players.map(p => (
            <li key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #0f3460' }}>
              {p.name} {p.id === roomInfo.hostId ? '(Host)' : ''} {p.id === playerId ? '(You)' : ''}
            </li>
          ))}
          {roomInfo.aiPlayers.map(p => (
            <li key={p.id} style={{ padding: '8px 0', borderBottom: '1px solid #0f3460', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{p.name}</span>
              {isHost && (
                <button className="btn-secondary" onClick={() => onRemoveAI(p.id)} style={{ padding: '4px 8px', fontSize: '12px' }}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => onAddAI('easy')} disabled={totalPlayers >= 5}>
            + Easy AI
          </button>
          <button className="btn-secondary" onClick={() => onAddAI('normal')} disabled={totalPlayers >= 5}>
            + Normal AI
          </button>
        </div>
      )}

      {isHost && (
        <button className="btn-primary" onClick={onStartGame} disabled={!canStart} style={{ fontSize: '16px', padding: '12px 32px' }}>
          Start Game
        </button>
      )}

      {!isHost && <p style={{ color: '#888' }}>Waiting for host to start the game...</p>}
    </div>
  );
}
