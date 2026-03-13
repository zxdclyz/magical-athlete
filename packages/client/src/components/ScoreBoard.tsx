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
    <div className="score-board">
      <h4>得分</h4>
      {sorted.map(p => (
        <div key={p.id} className={`score-row ${p.id === playerId ? 'is-me' : ''}`}>
          <span>{p.name}</span>
          <span>{gameState.scores[p.id] ?? 0} 分</span>
        </div>
      ))}
    </div>
  );
}
