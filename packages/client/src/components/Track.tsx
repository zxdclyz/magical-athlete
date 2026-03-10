import type { GameState } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';

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
                    background: isMe ? '#e94560' : '#555',
                    color: '#fff',
                    borderRadius: '4px',
                    padding: '1px 3px',
                    margin: '2px 0',
                    fontSize: '9px',
                    fontWeight: isMe ? 'bold' : 'normal',
                    opacity: r.tripped ? 0.5 : 1,
                  }}
                    title={`${card.displayName}${r.tripped ? ' (tripped)' : ''}${r.finished ? ' (finished)' : ''}`}
                  >
                    {card.displayName.slice(0, 5)}
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
