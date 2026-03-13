import type { RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { getRacerImageUrl } from '../assets/racerImages.ts';

const PLAYER_COLORS = ['#e81e3c', '#3b82f6', '#2ecc40', '#ffd700', '#cc5de8'];

interface TurnBannerProps {
  playerNames: Record<string, string>;
  playerIndex: Record<string, number>;
  playerRacers: Record<string, RacerName>;
  currentPlayerId: string;
  isMyTurn: boolean;
}

export function TurnBanner({
  playerNames, playerIndex, playerRacers, currentPlayerId, isMyTurn,
}: TurnBannerProps) {
  const pName = playerNames[currentPlayerId] ?? '玩家';
  const racerName = playerRacers[currentPlayerId];
  const racerCn = racerName ? RACER_CARDS[racerName]?.displayNameCn : null;
  const pColor = PLAYER_COLORS[playerIndex[currentPlayerId] ?? 0];

  return (
    <div className={`turn-banner ${isMyTurn ? 'turn-banner-mine' : ''}`}
      style={{ background: pColor }}>
      {racerName && (
        <img src={getRacerImageUrl(racerName)} alt="" className="banner-avatar" width={40} height={40} />
      )}
      <div className="banner-content">
        <div className="banner-icon">{isMyTurn ? '🎯' : '⏳'}</div>
        <div className="banner-text">
          <span className="banner-title">
            {isMyTurn ? '你的回合' : `${pName} 的回合`}
          </span>
          {racerCn && <span className="banner-subtitle">{racerCn}</span>}
        </div>
      </div>
    </div>
  );
}
