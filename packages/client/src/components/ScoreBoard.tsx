import type { GameState } from '@magical-athlete/engine';

interface ScoreBoardProps {
  gameState: GameState;
  playerId: string;
}

export function ScoreBoard({ gameState, playerId }: ScoreBoardProps) {
  const sorted = [...gameState.players].sort(
    (a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0)
  );

  return (
    <div style={{
      background: '#16213e',
      borderRadius: '8px',
      padding: '12px',
    }}>
      <h4 style={{ margin: '0 0 8px 0' }}>Scores</h4>
      {sorted.map(p => (
        <div key={p.id} style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '4px 0',
          borderBottom: '1px solid #0f3460',
          color: p.id === playerId ? '#e94560' : '#ccc',
          fontWeight: p.id === playerId ? 'bold' : 'normal',
        }}>
          <span>{p.name}</span>
          <span>{gameState.scores[p.id] ?? 0} pts</span>
        </div>
      ))}
    </div>
  );
}
