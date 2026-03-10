import type { GameState } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { getRacerImageUrl } from '../assets/racerImages.ts';

interface TrackProps {
  gameState: GameState;
  playerId: string;
}

function getSpaceColor(type: string): string {
  switch (type) {
    case 'start': return '#2d6a4f';
    case 'finish': return '#e94560';
    case 'arrow': return '#e9c46a';
    case 'trip': return '#f77f00';
    case 'star': return '#9b5de5';
    default: return '#1a3a6a';
  }
}

export function Track({ gameState, playerId }: TrackProps) {
  const track = gameState.track;
  const racers = gameState.activeRacers.filter(r => !r.eliminated);

  // Group racers by position
  const racersByPos: Record<number, typeof racers> = {};
  for (const r of racers) {
    const pos = r.finished ? track.length - 1 : r.position;
    if (!racersByPos[pos]) racersByPos[pos] = [];
    racersByPos[pos].push(r);
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <h3 style={{ marginBottom: '8px' }}>
        Race {gameState.currentRace} — {gameState.trackConfig.name} ({gameState.trackConfig.side})
      </h3>
      <div style={{
        display: 'flex',
        gap: '2px',
        overflowX: 'auto',
        padding: '8px 0',
      }}>
        {track.map((space, i) => {
          const here = racersByPos[i] ?? [];
          return (
            <div key={i} style={{
              minWidth: '48px',
              background: getSpaceColor(space.type),
              borderRadius: '6px',
              padding: '4px',
              textAlign: 'center',
              fontSize: '10px',
              position: 'relative',
            }}>
              <div style={{ color: '#fff', fontWeight: 'bold', marginBottom: '2px' }}>
                {i}
              </div>
              {space.type !== 'normal' && (
                <div style={{ color: '#ddd', fontSize: '9px' }}>
                  {space.type === 'arrow' ? `→${space.arrowDistance}` : space.type}
                </div>
              )}
              {here.map(r => {
                const isMe = r.playerId === playerId;
                const card = RACER_CARDS[r.racerName];
                return (
                  <div key={r.racerName} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px',
                    background: isMe ? '#e94560' : '#555',
                    borderRadius: '4px',
                    padding: '1px 3px',
                    margin: '2px 0',
                    opacity: r.tripped ? 0.5 : 1,
                  }}
                    title={`${card.displayName}${r.tripped ? ' (tripped)' : ''}${r.finished ? ' (finished)' : ''}`}
                  >
                    <img
                      src={getRacerImageUrl(r.racerName)}
                      alt={card.displayName}
                      style={{ width: '20px', height: '20px', borderRadius: '3px', objectFit: 'cover' }}
                    />
                    <span style={{ color: '#fff', fontSize: '8px', fontWeight: isMe ? 'bold' : 'normal' }}>
                      {card.displayName.slice(0, 4)}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
