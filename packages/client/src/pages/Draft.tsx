import type { GameState, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { RacerCard } from '../components/RacerCard.tsx';

interface DraftProps {
  gameState: GameState;
  playerId: string;
  onAction: (action: any) => void;
}

export function Draft({ gameState, playerId, onAction }: DraftProps) {
  const currentDrafter = gameState.draftOrder[gameState.draftCurrentIndex];
  const isMyTurn = currentDrafter === playerId;
  const currentPlayer = gameState.players.find(p => p.id === currentDrafter);
  const me = gameState.players.find(p => p.id === playerId);

  const handlePick = (racerName: RacerName) => {
    if (!isMyTurn) return;
    onAction({
      type: 'MAKE_DECISION',
      decision: { type: 'DRAFT_PICK', racerName },
    });
  };

  return (
    <div className="page">
      <h1>Draft Phase</h1>
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p>
          {isMyTurn ? (
            <strong style={{ color: '#e94560' }}>Your turn to pick!</strong>
          ) : (
            <span>Waiting for {currentPlayer?.name ?? 'player'}...</span>
          )}
        </p>
        <p style={{ color: '#888' }}>
          Pick {gameState.draftCurrentIndex + 1} of {gameState.draftOrder.length}
        </p>
      </div>

      {/* My hand */}
      {me && me.hand.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '8px' }}>Your Hand ({me.hand.length})</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {me.hand.map(name => (
              <RacerCard key={name} racerName={name} size="small" />
            ))}
          </div>
        </div>
      )}

      {/* Available racers */}
      <h3 style={{ marginBottom: '8px' }}>Available Racers</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
        {gameState.availableRacers.map(name => (
          <RacerCard
            key={name}
            racerName={name}
            size="small"
            clickable={isMyTurn}
            onClick={() => handlePick(name)}
          />
        ))}
      </div>
    </div>
  );
}
