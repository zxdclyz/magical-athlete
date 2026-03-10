import type { GameEvent } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';

function racerDisplay(name: string): string {
  const card = RACER_CARDS[name as keyof typeof RACER_CARDS];
  return card ? card.displayName : name;
}

function formatEvent(event: GameEvent): string | null {
  switch (event.type) {
    case 'DICE_ROLLED':
      return `Rolled a ${event.value}`;
    case 'DICE_MODIFIED':
      return `Dice modified: ${event.originalValue} → ${event.newValue} (${event.reason})`;
    case 'RACER_MOVING':
      return `${racerDisplay(event.racerName)} moves ${event.from} → ${event.to}`;
    case 'RACER_PASSED':
      return `${racerDisplay(event.movingRacer)} passed ${racerDisplay(event.passedRacer)}`;
    case 'RACER_TRIPPED':
      return `${racerDisplay(event.racerName)} tripped!`;
    case 'RACER_WARPED':
      return `${racerDisplay(event.racerName)} warped ${event.from} → ${event.to}`;
    case 'RACER_SWAPPED':
      return `${racerDisplay(event.racer1)} swapped with ${racerDisplay(event.racer2)}`;
    case 'RACER_ELIMINATED':
      return `${racerDisplay(event.racerName)} eliminated by ${racerDisplay(event.byRacer)}!`;
    case 'RACER_FINISHED':
      return `${racerDisplay(event.racerName)} finished in place ${event.place}!`;
    case 'ABILITY_TRIGGERED':
      return `${racerDisplay(event.racerName)}: ${event.description}`;
    case 'POINT_CHIP_GAINED':
      return `Gained ${event.chipType} chip (${event.value} pts)`;
    case 'RACE_ENDED':
      return `--- Race ${event.raceNumber} ended ---`;
    case 'GAME_ENDED':
      return `Game Over!`;
    default:
      return null;
  }
}

interface EventLogProps {
  events: GameEvent[];
}

export function EventLog({ events }: EventLogProps) {
  const displayEvents = events.map(formatEvent).filter(Boolean).slice(-20);

  return (
    <div style={{
      background: '#0d1b2a',
      borderRadius: '8px',
      padding: '12px',
      maxHeight: '200px',
      overflowY: 'auto',
      fontSize: '12px',
      lineHeight: '1.6',
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#888' }}>Event Log</h4>
      {displayEvents.length === 0 ? (
        <div style={{ color: '#555' }}>No events yet...</div>
      ) : (
        displayEvents.map((text, i) => (
          <div key={i} style={{ color: '#ccc', borderBottom: '1px solid #1a2a3a', padding: '2px 0' }}>
            {text}
          </div>
        ))
      )}
    </div>
  );
}
