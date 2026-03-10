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
      className="racer-card"
      onClick={clickable ? onClick : undefined}
      style={{
        background: selected ? '#1a3a6a' : '#16213e',
        border: selected ? '2px solid #e94560' : '2px solid #0f3460',
        borderRadius: '8px',
        padding: isSmall ? '6px' : '12px',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'border-color 0.2s, transform 0.15s',
        minWidth: isSmall ? '100px' : '150px',
        maxWidth: isSmall ? '120px' : '180px',
      }}
      onMouseEnter={e => {
        if (clickable) {
          (e.currentTarget as HTMLElement).style.borderColor = '#e94560';
          (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
        }
      }}
      onMouseLeave={e => {
        if (clickable && !selected) (e.currentTarget as HTMLElement).style.borderColor = '#0f3460';
        (e.currentTarget as HTMLElement).style.transform = '';
      }}
    >
      <div className="tooltip">
        <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#e94560' }}>
          {card.displayName} ({card.displayNameCn})
        </div>
        <div style={{ color: '#ccc', lineHeight: '1.4' }}>{card.abilityText}</div>
        <div style={{ color: '#e9c46a', fontSize: '11px', marginTop: '4px', fontStyle: 'italic' }}>
          {card.tagline}
        </div>
      </div>
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
      <div style={{ fontWeight: 'bold', fontSize: isSmall ? '11px' : '14px', marginBottom: '2px', textAlign: 'center' }}>
        {card.displayName}
      </div>
      <div style={{ fontSize: '10px', color: '#888', textAlign: 'center' }}>
        {card.displayNameCn}
      </div>
    </div>
  );
}
