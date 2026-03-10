import type { RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { getRacerImageUrl } from '../assets/racerImages.ts';

interface RacerCardProps {
  racerName: RacerName;
  size?: 'small' | 'medium';
  clickable?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

export function RacerCard({ racerName, size = 'medium', clickable, selected, onClick }: RacerCardProps) {
  const card = RACER_CARDS[racerName];
  const isSmall = size === 'small';

  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{
        background: selected ? '#1a3a6a' : '#16213e',
        border: selected ? '2px solid #e94560' : '2px solid #0f3460',
        borderRadius: '8px',
        padding: isSmall ? '8px' : '12px',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'border-color 0.2s, transform 0.1s',
        minWidth: isSmall ? '110px' : '160px',
        ...(clickable ? { ':hover': {} } : {}),
      }}
      onMouseEnter={e => {
        if (clickable) (e.currentTarget as HTMLElement).style.borderColor = '#e94560';
      }}
      onMouseLeave={e => {
        if (clickable && !selected) (e.currentTarget as HTMLElement).style.borderColor = '#0f3460';
      }}
    >
      <img
        src={getRacerImageUrl(racerName)}
        alt={card.displayName}
        style={{
          width: '100%',
          borderRadius: '4px',
          marginBottom: '4px',
          display: 'block',
        }}
      />
      <div style={{ fontWeight: 'bold', fontSize: isSmall ? '12px' : '14px', marginBottom: '2px' }}>
        {card.displayName}
      </div>
      <div style={{ fontSize: '10px', color: '#888' }}>
        {card.displayNameCn}
      </div>
    </div>
  );
}
