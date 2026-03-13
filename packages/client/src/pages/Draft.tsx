import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import type { GameState, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { RacerCard } from '../components/RacerCard.tsx';
import { getRacerImageUrl } from '../assets/racerImages.ts';

const PLAYER_COLORS = ['#e81e3c', '#3b82f6', '#2ecc40', '#ffd700', '#cc5de8'];

interface DraftProps {
  gameState: GameState;
  playerId: string;
  onAction: (action: any) => void;
}

export function Draft({ gameState, playerId, onAction }: DraftProps) {
  const currentDrafter = gameState.draftOrder[gameState.draftCurrentIndex];
  const isMyTurn = currentDrafter === playerId;
  const currentPlayer = gameState.players.find(p => p.id === currentDrafter);

  const handlePick = (racerName: RacerName) => {
    if (!isMyTurn) return;
    onAction({
      type: 'MAKE_DECISION',
      decision: { type: 'DRAFT_PICK', racerName },
    });
  };

  const playerCount = gameState.players.length;
  const picksPerRound = playerCount * 2;
  const currentRound = Math.floor(gameState.draftCurrentIndex / picksPerRound) + 1;
  const totalRounds = Math.ceil(gameState.draftOrder.length / picksPerRound);

  // Build set of cards currently in available pool (for layoutId sharing)
  const availableSet = new Set(gameState.availableRacers);

  return (
    <LayoutGroup>
      <div className="page draft-page" style={{ position: 'relative' }}>
        <div className="rainbow-bar" />

        <div className="draft-header">
          <h1 style={{ color: '#ffd700', fontWeight: 900, margin: 0 }}>选角阶段</h1>
          <div className="draft-round-info">
            <span className="draft-round-badge">第 {currentRound}/{totalRounds} 轮</span>
            <span className="draft-pick-count">第 {gameState.draftCurrentIndex + 1}/{gameState.draftOrder.length} 选</span>
          </div>
        </div>

        <div className="draft-turn-bar" style={{
          background: isMyTurn ? '#e81e3c' : '#1a171e',
          border: isMyTurn ? '3px solid #e81e3c' : '3px solid #35303b',
        }}>
          {isMyTurn ? (
            <span style={{ color: '#fff', fontWeight: 900, fontSize: '16px' }}>轮到你选角！</span>
          ) : (
            <span style={{ fontWeight: 700 }}>
              等待 <span style={{ color: PLAYER_COLORS[gameState.players.findIndex(p => p.id === currentDrafter)] ?? '#fff' }}>
                {currentPlayer?.name ?? '玩家'}
              </span> 选择...
            </span>
          )}
        </div>

        {/* All players' hands */}
        <div className="draft-players-section">
          <h3 style={{ fontWeight: 800, color: '#ffd700', marginBottom: '12px' }}>各玩家手牌</h3>
          <div className="draft-players-grid">
            {gameState.players.map((p, idx) => {
              const pColor = PLAYER_COLORS[idx] ?? '#888';
              const isMe = p.id === playerId;
              const isTurn = p.id === currentDrafter;
              const handCards = p.hand.filter((h: any) => h !== 'hidden');

              return (
                <div
                  key={p.id}
                  className={`draft-player-hand ${isTurn ? 'is-drafting' : ''} ${isMe ? 'is-me' : ''}`}
                  style={{ '--player-color': pColor } as React.CSSProperties}
                >
                  <div className="draft-player-header">
                    <span className="draft-player-name" style={{ color: pColor }}>{p.name}</span>
                    {isMe && <span className="badge-me">你</span>}
                    {isTurn && <span className="badge-drafting">选角中</span>}
                    <span className="draft-hand-count">{handCards.length} 张</span>
                  </div>
                  <div className="draft-hand-cards">
                    {handCards.length === 0 ? (
                      <div className="draft-empty-hand">暂无手牌</div>
                    ) : (
                      handCards.map((name: RacerName) => {
                        const card = RACER_CARDS[name];
                        // Only use layoutId for cards NOT in the available pool
                        // (cards in the pool have their own layoutId from the grid below)
                        const isInPool = availableSet.has(name);
                        return (
                          <motion.div
                            key={name}
                            layoutId={isInPool ? undefined : `draft-card-${name}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                            className="draft-hand-card draft-hand-card-hoverable"
                          >
                            <img src={getRacerImageUrl(name)} alt={card.displayNameCn} width={40} height={40} />
                            <span className="draft-card-name">{card.displayNameCn}</span>
                            <div className="draft-hand-tooltip">
                              <div className="draft-hand-tooltip-name">{card.displayNameCn}</div>
                              <div className="draft-hand-tooltip-ability">{card.abilityTextCn}</div>
                              <div className="draft-hand-tooltip-tagline">{card.taglineCn}</div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Available racers */}
        <div className="draft-available-section">
          <h3 style={{ fontWeight: 800, color: '#ff6600', marginBottom: '8px' }}>可选角色</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
            <AnimatePresence>
              {gameState.availableRacers.map(name => (
                <motion.div
                  key={name}
                  layoutId={`draft-card-${name}`}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                >
                  <RacerCard
                    racerName={name}
                    size="small"
                    clickable={isMyTurn}
                    onClick={() => handlePick(name)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </LayoutGroup>
  );
}
