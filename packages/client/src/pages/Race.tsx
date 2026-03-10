import type { GameState, GameEvent } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { Track } from '../components/Track.tsx';
import { EventLog } from '../components/EventLog.tsx';
import { ScoreBoard } from '../components/ScoreBoard.tsx';
import { DecisionPanel } from '../components/DecisionPanel.tsx';

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
          {sorted.map((p, i) => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between',
              padding: '12px', marginBottom: '8px',
              background: i === 0 ? '#e9c46a22' : '#16213e',
              border: i === 0 ? '2px solid #e9c46a' : '1px solid #0f3460',
              borderRadius: '8px',
              color: p.id === playerId ? '#e94560' : '#ccc',
              fontWeight: p.id === playerId ? 'bold' : 'normal',
            }}>
              <span>{i === 0 ? '🏆 ' : `${i + 1}. `}{p.name}</span>
              <span>{gameState.scores[p.id] ?? 0} pts</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Race setup phase — choosing racers
  if (gameState.phase === 'RACE_SETUP') {
    return (
      <div className="page">
        <h1>Race {gameState.currentRace} — Choose Your Racer</h1>
        <ScoreBoard gameState={gameState} playerId={playerId} />
        <div style={{ marginTop: '16px' }}>
          <DecisionPanel gameState={gameState} playerId={playerId} onAction={onAction} />
          {!gameState.pendingDecision?.playerId || gameState.pendingDecision.playerId !== playerId ? (
            <p style={{ color: '#888' }}>Waiting for other players to choose...</p>
          ) : null}
        </div>
      </div>
    );
  }

  // Race end — show results
  if (gameState.phase === 'RACE_END') {
    return (
      <div className="page">
        <h1>Race {gameState.currentRace} Complete!</h1>
        <ScoreBoard gameState={gameState} playerId={playerId} />
        <div style={{ marginTop: '16px' }}>
          <h3>Results</h3>
          {gameState.activeRacers
            .filter(r => r.finished)
            .sort((a, b) => (a.finishOrder ?? 99) - (b.finishOrder ?? 99))
            .map(r => (
              <div key={r.racerName} style={{ padding: '8px', borderBottom: '1px solid #0f3460' }}>
                #{r.finishOrder} — {RACER_CARDS[r.racerName].displayName}
                ({gameState.players.find(p => p.id === r.playerId)?.name})
              </div>
            ))}
        </div>
        <EventLog events={events} />
      </div>
    );
  }

  // Racing phase
  return (
    <div className="page">
      <Track gameState={gameState} playerId={playerId} />

      <DecisionPanel gameState={gameState} playerId={playerId} onAction={onAction} />

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
        <div>
          {isMyTurn && !gameState.pendingDecision ? (
            <strong style={{ color: '#e94560' }}>Your turn! Rolling dice...</strong>
          ) : isMyTurn && gameState.pendingDecision ? (
            <strong style={{ color: '#e94560' }}>Make a decision above</strong>
          ) : (
            <span style={{ color: '#888' }}>
              Waiting for {currentPlayer?.name ?? 'player'}...
            </span>
          )}
        </div>
        {myRacer && (
          <div style={{ color: '#aaa', fontSize: '13px' }}>
            Your racer: <strong style={{ color: '#fff' }}>{RACER_CARDS[myRacer.racerName].displayName}</strong>
            {myRacer.tripped ? ' (tripped)' : ''}
            {' '} at position {myRacer.position}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <ScoreBoard gameState={gameState} playerId={playerId} />
        <EventLog events={events} />
      </div>
    </div>
  );
}
