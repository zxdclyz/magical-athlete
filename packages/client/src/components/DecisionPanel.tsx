import type { GameState, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { getRacerImageUrl } from '../assets/racerImages.ts';

interface DecisionPanelProps {
  gameState: GameState;
  playerId: string;
  onAction: (action: any) => void;
}

function racerDisplay(name: RacerName): string {
  return RACER_CARDS[name]?.displayNameCn ?? name;
}

export function DecisionPanel({ gameState, playerId, onAction }: DecisionPanelProps) {
  const pending = gameState.pendingDecision;
  if (!pending || pending.playerId !== playerId) return null;

  const request = pending.request;

  const makeDecision = (decision: any) => {
    onAction({ type: 'MAKE_DECISION', decision });
  };

  return (
    <div className="decision-panel">
      {request.type === 'CHOOSE_RACE_RACER' && (
        <div>
          <h3>选择本场比赛的角色</h3>
          <div className="decision-buttons">
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
          <h3>使用{racerDisplay(request.racerName)}的技能？</h3>
          <p>{request.abilityDescription}</p>
          <div className="decision-buttons">
            <button className="btn-primary" onClick={() => makeDecision({ type: 'USE_ABILITY', use: true })}>是</button>
            <button className="btn-secondary" onClick={() => makeDecision({ type: 'USE_ABILITY', use: false })}>否</button>
          </div>
        </div>
      )}

      {request.type === 'CHOOSE_TARGET_RACER' && (
        <div>
          <h3>{request.reason}</h3>
          <div className="decision-buttons">
            {request.targets.map(name => (
              <button key={name} className="btn-primary" onClick={() => makeDecision({ type: 'CHOOSE_TARGET_RACER', targetRacer: name })}>
                {racerDisplay(name)}
              </button>
            ))}
            <button className="btn-secondary" onClick={() => makeDecision({ type: 'CHOOSE_TARGET_RACER', targetRacer: request.racerName })}>
              放弃
            </button>
          </div>
        </div>
      )}

      {request.type === 'CHOOSE_TARGET_SPACE' && (
        <div>
          <h3>{request.reason}</h3>
          <div className="decision-buttons">
            {request.spaces.map(space => (
              <button key={space} className="btn-primary" onClick={() => makeDecision({ type: 'CHOOSE_TARGET_SPACE', targetSpace: space })}>
                第 {space} 格
              </button>
            ))}
            <button className="btn-secondary" onClick={() => makeDecision({ type: 'CHOOSE_TARGET_SPACE', targetSpace: -1 })}>
              放弃
            </button>
          </div>
        </div>
      )}

      {request.type === 'PREDICT_DICE' && (
        <div>
          <h3>预测你的骰子点数</h3>
          <div className="decision-buttons">
            {[1,2,3,4,5,6].map(n => (
              <button key={n} className="btn-primary" onClick={() => makeDecision({ type: 'PREDICT_DICE', prediction: n })}
                style={{ width: '48px', height: '48px', fontSize: '20px', padding: 0, borderRadius: '10px' }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'PREDICT_WINNER' && (
        <div>
          <h3>预测比赛获胜者</h3>
          <div className="decision-buttons">
            {request.candidates.map(name => (
              <button key={name} className="btn-primary" onClick={() => makeDecision({ type: 'PREDICT_WINNER', targetRacer: name })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src={getRacerImageUrl(name)} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} />
                {racerDisplay(name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'CHOOSE_COPIED_ABILITY' && (
        <div>
          <h3>选择要复制的技能</h3>
          <div className="decision-buttons">
            {request.candidates.map(name => (
              <button key={name} className="btn-primary" onClick={() => makeDecision({ type: 'CHOOSE_COPIED_ABILITY', racerName: name })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <img src={getRacerImageUrl(name)} alt="" style={{ width: 20, height: 20, borderRadius: 4 }} />
                {racerDisplay(name)}
              </button>
            ))}
          </div>
        </div>
      )}

      {request.type === 'REROLL_DICE' && (
        <div>
          <h3>重掷？当前：{request.currentValue}（剩余 {request.rerollsLeft} 次）</h3>
          <div className="decision-buttons">
            <button className="btn-primary" onClick={() => makeDecision({ type: 'REROLL_DICE', reroll: true })}>重掷</button>
            <button className="btn-secondary" onClick={() => makeDecision({ type: 'REROLL_DICE', reroll: false })}>保留</button>
          </div>
        </div>
      )}

      {request.type === 'ROLL_DICE' && (
        <div>
          <h3>掷骰子！</h3>
          <button className="btn-primary dice-roll-btn" onClick={() => {
            const value = Math.floor(Math.random() * 6) + 1;
            makeDecision({ type: 'ROLL_DICE', value });
          }}>
            掷骰
          </button>
        </div>
      )}
    </div>
  );
}
