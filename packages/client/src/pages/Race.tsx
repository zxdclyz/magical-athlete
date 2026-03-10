import type { GameState, GameEvent } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { Track } from '../components/Track.tsx';
import { EventLog } from '../components/EventLog.tsx';
import { ScoreBoard } from '../components/ScoreBoard.tsx';
import { DecisionPanel } from '../components/DecisionPanel.tsx';
import { DiceRoll } from '../components/DiceRoll.tsx';
import { getRacerImageUrl } from '../assets/racerImages.ts';

interface RaceProps {
  gameState: GameState;
  playerId: string;
  events: GameEvent[];
  onAction: (action: any) => void;
}

export function Race({ gameState, playerId, events, onAction }: RaceProps) {
  const isMyTurn = gameState.turnOrder[gameState.currentTurnIndex] === playerId;
  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);
  const myRacer = gameState.activeRacers.find(r => r.playerId === playerId);

  // Game over screen
  if (gameState.phase === 'GAME_OVER') {
    const sorted = [...gameState.players].sort(
      (a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0)
    );
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '60px' }}>
        <h1>Game Over!</h1>
        <div style={{ margin: '24px auto', maxWidth: '400px' }}>
          {sorted.map((p, i) => {
            const racer = gameState.activeRacers.find(r => r.playerId === p.id);
            return (
              <div key={p.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', marginBottom: '8px',
                background: i === 0 ? '#e9c46a22' : '#16213e',
                border: i === 0 ? '2px solid #e9c46a' : '1px solid #0f3460',
                borderRadius: '8px',
                color: p.id === playerId ? '#e94560' : '#ccc',
                fontWeight: p.id === playerId ? 'bold' : 'normal',
              }}>
                <span>{i === 0 ? '1st ' : `${i + 1}. `}{p.name}</span>
                <span>{gameState.scores[p.id] ?? 0} pts</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Race setup phase — choosing racers
  if (gameState.phase === 'RACE_SETUP') {
    return (
      <div className="page">
        <h1>Race {gameState.currentRace} of 4 — Choose Your Racer</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }} className="race-grid">
          <div>
            <DecisionPanel gameState={gameState} playerId={playerId} onAction={onAction} />
            {(!gameState.pendingDecision || gameState.pendingDecision.playerId !== playerId) && (
              <p style={{ color: '#888', marginTop: '12px' }}>Waiting for other players to choose...</p>
            )}
          </div>
          <ScoreBoard gameState={gameState} playerId={playerId} />
        </div>
      </div>
    );
  }

  // Race end — show results
  if (gameState.phase === 'RACE_END') {
    const finishers = gameState.activeRacers
      .filter(r => r.finished)
      .sort((a, b) => (a.finishOrder ?? 99) - (b.finishOrder ?? 99));

    return (
      <div className="page">
        <h1>Race {gameState.currentRace} Complete!</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }} className="race-grid">
          <div>
            <h3 style={{ marginBottom: '8px' }}>Results</h3>
            {finishers.map(r => {
              const owner = gameState.players.find(p => p.id === r.playerId);
              const card = RACER_CARDS[r.racerName];
              return (
                <div key={r.racerName} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px', marginBottom: '6px',
                  background: '#16213e', borderRadius: '8px',
                  border: r.finishOrder === 1 ? '1px solid #e9c46a' : '1px solid #0f3460',
                }}>
                  <img src={getRacerImageUrl(r.racerName)} alt={card.displayName}
                    style={{ width: '36px', height: '36px', borderRadius: '6px', objectFit: 'cover' }} />
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      #{r.finishOrder} {card.displayName}
                    </div>
                    <div style={{ fontSize: '12px', color: '#888' }}>{owner?.name}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div>
            <ScoreBoard gameState={gameState} playerId={playerId} />
            <div style={{ marginTop: '12px' }}>
              <EventLog events={events} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Racing phase
  const needsRoll = isMyTurn && !gameState.pendingDecision;

  return (
    <div className="page">
      <Track gameState={gameState} playerId={playerId} />

      {/* Turn indicator + dice */}
      <div className={isMyTurn ? 'your-turn' : ''} style={{ marginBottom: '16px', padding: isMyTurn ? '12px' : '0' }}>
        {isMyTurn && !gameState.pendingDecision ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <strong style={{ color: '#e94560', fontSize: '16px' }}>Your turn!</strong>
              {myRacer && (
                <span style={{ color: '#aaa', fontSize: '13px' }}>
                  {RACER_CARDS[myRacer.racerName].displayName} at position {myRacer.position}
                  {myRacer.tripped ? ' (tripped - skip)' : ''}
                </span>
              )}
            </div>
            {!myRacer?.tripped && (
              <DiceRoll
                onRoll={(value) => onAction({ type: 'MAKE_DECISION', decision: { type: 'ROLL_DICE', value } })}
              />
            )}
          </div>
        ) : isMyTurn && gameState.pendingDecision ? (
          <strong style={{ color: '#e94560' }}>Make a decision below</strong>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: '#888' }}>
              Waiting for {currentPlayer?.name ?? 'player'}...
            </span>
            {myRacer && (
              <span style={{ color: '#555', fontSize: '12px' }}>
                | Your racer: {RACER_CARDS[myRacer.racerName].displayName} at {myRacer.position}
              </span>
            )}
          </div>
        )}
      </div>

      <DecisionPanel gameState={gameState} playerId={playerId} onAction={onAction} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }} className="race-grid">
        <ScoreBoard gameState={gameState} playerId={playerId} />
        <EventLog events={events} />
      </div>
    </div>
  );
}
