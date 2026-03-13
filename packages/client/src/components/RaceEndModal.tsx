import type { GameState, GameEvent, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { ScoreBoard } from './ScoreBoard.tsx';
import { getRacerImageUrl } from '../assets/racerImages.ts';

interface RaceEndModalProps {
  gameState: GameState;
  playerId: string;
  isHost: boolean;
  onContinue: () => void;
}

export function RaceEndModal({ gameState, playerId, isHost, onContinue }: RaceEndModalProps) {
  const finishers = gameState.activeRacers
    .filter(r => r.finished)
    .sort((a, b) => (a.finishOrder ?? 99) - (b.finishOrder ?? 99));

  return (
    <div className="race-end-overlay">
      <div className="race-end-modal">
        <h2 style={{ color: '#ffd700', fontWeight: 900, textAlign: 'center', marginBottom: '16px' }}>
          第 {gameState.currentRace}/4 场比赛结束！
        </h2>
        <div className="race-end-results">
          {finishers.map(r => {
            const owner = gameState.players.find(p => p.id === r.playerId);
            const card = RACER_CARDS[r.racerName];
            const medals = ['🥇', '🥈', '🥉'];
            return (
              <div key={r.racerName} className={`race-end-row ${r.finishOrder === 1 ? 'first' : ''}`}>
                <span className="race-end-medal">{medals[(r.finishOrder ?? 4) - 1] ?? `#${r.finishOrder}`}</span>
                <img src={getRacerImageUrl(r.racerName)} alt={card.displayNameCn} className="race-end-avatar" width={44} height={44} />
                <div>
                  <div className="race-end-racer">{card.displayNameCn}</div>
                  <div className="race-end-owner">{owner?.name}{owner?.id === playerId ? ' (你)' : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: '16px' }}>
          <ScoreBoard gameState={gameState} playerId={playerId} />
        </div>
        {isHost ? (
          <button
            className="btn-primary"
            style={{ marginTop: '20px', fontSize: '16px', padding: '14px 36px', width: '100%' }}
            onClick={onContinue}
          >
            {gameState.currentRace >= 4 ? '查看最终结果' : '下一场比赛'}
          </button>
        ) : (
          <p style={{ marginTop: '20px', color: '#888', fontWeight: 700, textAlign: 'center' }}>等待房主继续...</p>
        )}
      </div>
    </div>
  );
}
