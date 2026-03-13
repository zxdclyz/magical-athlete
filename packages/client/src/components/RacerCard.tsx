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

  const content = (
    <>
      <div className="tooltip">
        <div style={{ fontWeight: 800, marginBottom: '4px', color: '#e81e3c' }}>
          {card.displayNameCn}（{card.displayName}）
        </div>
        <div style={{ color: '#ccc', lineHeight: '1.4' }}>{card.abilityTextCn}</div>
        <div style={{ color: '#ffd700', fontSize: '11px', marginTop: '4px', fontStyle: 'italic', fontWeight: 700 }}>
          {card.taglineCn}
        </div>
      </div>
      <img
        src={getRacerImageUrl(racerName)}
        alt={card.displayNameCn}
        width={isSmall ? 100 : 150}
        height={isSmall ? 100 : 150}
        style={{
          width: '100%',
          height: 'auto',
          borderRadius: '6px',
          marginBottom: '4px',
          display: 'block',
        }}
      />
      <div style={{ fontWeight: 800, fontSize: isSmall ? '12px' : '14px', marginBottom: '2px', textAlign: 'center' }}>
        {card.displayNameCn}
      </div>
      <div style={{ fontSize: '10px', color: '#888', textAlign: 'center', fontWeight: 700 }}>
        {card.displayName}
      </div>
    </>
  );

  const baseStyle = {
    background: selected ? '#2a1a2e' : '#1a171e',
    border: selected ? '3px solid #e81e3c' : '3px solid #35303b',
    borderRadius: '10px',
    padding: isSmall ? '6px' : '12px',
    minWidth: isSmall ? '100px' : '150px',
    maxWidth: isSmall ? '120px' : '180px',
    color: 'inherit',
    font: 'inherit',
    textAlign: 'left' as const,
  };

  if (clickable) {
    return (
      <button
        type="button"
        className="racer-card racer-card-clickable"
        onClick={onClick}
        style={{ ...baseStyle, cursor: 'pointer' }}
      >
        {content}
      </button>
    );
  }

  return (
    <div className="racer-card" style={{ ...baseStyle, cursor: 'default' }}>
      {content}
    </div>
  );
}
