import type { GameState, DecisionRequest, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { useState } from 'react';

interface DecisionPanelProps {
  gameState: GameState;
  playerId: string;
  onAction: (action: any) => void;
}

function racerDisplay(name: RacerName): string {
  return RACER_CARDS[name]?.displayName ?? name;
}

export function DecisionPanel({ gameState, playerId, onAction }: DecisionPanelProps) {
  const [dicePredict, setDicePredict] = useState(1);
  const pending = gameState.pendingDecision;
  if (!pending || pending.playerId !== playerId) return null;

  const request = pending.request;

  const makeDecision = (decision: any) => {
    onAction({ type: 'MAKE_DECISION', decision });
  };

  return (
    <div style={{
      background: '#1a3a6a',
      border: '2px solid #e94560',
      borderRadius: '12px',
      padding: '16px',
      marginBottom: '16px',
    }}>
      {request.type === 'CHOOSE_RACE_RACER' && (
        <div>
          <h3>Choose your racer for this race</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {request.availableRacers.map(name => (
              <button key={name} className="btn-primary" onClick={() => makeDecision({ type: 'CHOOSE_RACE_RACER', racerName: name })}>
                {racerDisplay(name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'USE_ABILITY' && (
        <div>
          <h3>Use {racerDisplay(request.racerName)}'s ability?</h3>
          <p style={{ color: '#aaa', margin: '8px 0' }}>{request.abilityDescription}</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={() => makeDecision({ type: 'USE_ABILITY', use: true })}>Yes</button>
            <button className="btn-secondary" onClick={() => makeDecision({ type: 'USE_ABILITY', use: false })}>No</button>
          </div>
        </div>
      )}

      {request.type === 'CHOOSE_TARGET_RACER' && (
        <div>
          <h3>{request.reason}</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {request.targets.map(name => (
              <button key={name} className="btn-primary" onClick={() => makeDecision({ type: 'CHOOSE_TARGET_RACER', targetRacer: name })}>
                {racerDisplay(name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'CHOOSE_TARGET_SPACE' && (
        <div>
          <h3>{request.reason}</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {request.spaces.map(space => (
              <button key={space} className="btn-primary" onClick={() => makeDecision({ type: 'CHOOSE_TARGET_SPACE', targetSpace: space })}>
                Space {space}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'PREDICT_DICE' && (
        <div>
          <h3>Predict your dice roll (1-6)</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
            <input
              type="number" min={1} max={6} value={dicePredict}
              onChange={e => setDicePredict(Number(e.target.value))}
              style={{ width: '60px', textAlign: 'center' }}
            />
            <button className="btn-primary" onClick={() => makeDecision({ type: 'PREDICT_DICE', prediction: dicePredict })}>
              Predict
            </button>
          </div>
        </div>
      )}

      {request.type === 'PREDICT_WINNER' && (
        <div>
          <h3>Predict the race winner</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {request.candidates.map(name => (
              <button key={name} className="btn-primary" onClick={() => makeDecision({ type: 'PREDICT_WINNER', targetRacer: name })}>
                {racerDisplay(name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'CHOOSE_COPIED_ABILITY' && (
        <div>
          <h3>Choose an ability to copy</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {request.candidates.map(name => (
              <button key={name} className="btn-primary" onClick={() => makeDecision({ type: 'CHOOSE_COPIED_ABILITY', racerName: name })}>
                {racerDisplay(name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'REROLL_DICE' && (
        <div>
          <h3>Reroll? Current value: {request.currentValue} ({request.rerollsLeft} reroll(s) left)</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-primary" onClick={() => makeDecision({ type: 'REROLL_DICE', reroll: true })}>Reroll</button>
            <button className="btn-secondary" onClick={() => makeDecision({ type: 'REROLL_DICE', reroll: false })}>Keep</button>
          </div>
        </div>
      )}

      {request.type === 'ROLL_DICE' && (
        <div>
          <h3>Roll your dice!</h3>
          <button className="btn-primary" onClick={() => {
            const value = Math.floor(Math.random() * 6) + 1;
            makeDecision({ type: 'ROLL_DICE', value });
          }}>
            Roll
          </button>
        </div>
      )}
    </div>
  );
}
