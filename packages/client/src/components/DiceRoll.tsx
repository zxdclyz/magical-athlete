import { useState, useEffect } from 'react';

const DICE_DOTS: Record<number, string> = {
  1: '\u2680', 2: '\u2681', 3: '\u2682',
  4: '\u2683', 5: '\u2684', 6: '\u2685',
};

interface DiceRollProps {
  onRoll: (value: number) => void;
  disabled?: boolean;
}

export function DiceRoll({ onRoll, disabled }: DiceRollProps) {
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!rolling) return;
    let frame = 0;
    const maxFrames = 10;
    const interval = setInterval(() => {
      setDisplay(Math.floor(Math.random() * 6) + 1);
      frame++;
      if (frame >= maxFrames) {
        clearInterval(interval);
        const final = Math.floor(Math.random() * 6) + 1;
        setDisplay(final);
        setRolling(false);
        onRoll(final);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [rolling, onRoll]);

  const handleClick = () => {
    if (disabled || rolling) return;
    setRolling(true);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
      <div
        className={`dice-face ${rolling ? 'dice-rolling' : ''}`}
        style={{ cursor: disabled ? 'default' : 'pointer' }}
        onClick={handleClick}
      >
        {display > 0 ? DICE_DOTS[display] : '?'}
      </div>
      {!disabled && !rolling && (
        <button className="btn-primary" onClick={handleClick} style={{ fontSize: '16px', padding: '12px 24px' }}>
          Roll Dice!
        </button>
      )}
      {rolling && (
        <span style={{ color: '#e9c46a', fontWeight: 'bold' }}>Rolling...</span>
      )}
    </div>
  );
}
