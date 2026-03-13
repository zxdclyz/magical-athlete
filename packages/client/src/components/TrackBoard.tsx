import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameState, TrackSpace, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { getRacerImageUrl } from '../assets/racerImages.ts';

const PLAYER_COLORS = ['#e81e3c', '#3b82f6', '#2ecc40', '#ffd700', '#cc5de8'];

/** A-side colors cycling (from the original board image) */
const A_COLORS = ['#e81e3c', '#3b82f6', '#2ecc40', '#ff9800', '#e91e9c'];

function getSpaceColor(space: TrackSpace, index: number, side: 'mild' | 'wild'): string {
  if (space.type === 'start') return '#ffffff';
  if (space.type === 'star') return '#ffc107';
  if (space.type === 'trip') return '#e91e9c';
  if (space.type === 'arrow') return space.arrowDistance! > 0 ? '#2ecc40' : '#e81e3c';
  if (side === 'mild') return A_COLORS[index % A_COLORS.length];
  return '#ffffff';
}

function getSpaceLabel(space: TrackSpace): string | null {
  if (space.type === 'start') return 'start';
  if (space.type === 'star') return '1 POINT';
  if (space.type === 'trip') return 'STUN';
  if (space.type === 'arrow') return `MOVE ${space.arrowDistance! > 0 ? '' : ''}${space.arrowDistance}`;
  if (space.index > 0 && space.index % 5 === 0) return `${space.index}`;
  return null;
}

function getLabelColor(space: TrackSpace, bg: string): string {
  if (space.type === 'start' || space.type === 'star') return '#000';
  if (bg === '#ffffff') return '#000';
  return '#fff';
}

// ---- Layout constants (matching original board proportions ~2.6:1) ----
const SQ = 36;        // square size
const GAP = 1;        // gap between adjacent squares
const PAD = 8;        // board edge padding
const CORNER_R = 18;  // board corner radius
const BORDER = 3;     // outer + inner border width
const START_W = SQ * 2; // start space is double width (like original)

// Winner/runner-up zone dimensions
const FZ_R1 = 16;  // winner circle radius
const FZ_R2 = 14;  // runner-up circle radius

interface SpaceRect { x: number; y: number; w: number; h: number; }

function layoutSpaces(trackLength: number): SpaceRect[] {
  const rects: SpaceRect[] = [];

  // Inner area origin (inside outer + inner border + padding)
  const ox = PAD + BORDER * 2 + 6;
  const oy = PAD + BORDER * 2 + 4;
  const fzWidth = FZ_R1 * 2 + 16;

  const startX = ox + fzWidth;

  // Top row: space 0 (start, double width) + spaces 1..13
  rects.push({ x: startX, y: oy, w: START_W, h: SQ });
  const topRowX = startX + START_W + GAP;
  for (let i = 1; i <= 13; i++) {
    rects.push({ x: topRowX + (i - 1) * (SQ + GAP), y: oy, w: SQ, h: SQ });
  }

  // Right column: spaces 14, 15
  const rightX = topRowX + 12 * (SQ + GAP);
  const midY = oy + SQ + GAP;
  rects.push({ x: rightX, y: midY, w: SQ, h: SQ });
  rects.push({ x: rightX, y: midY + SQ + GAP, w: SQ, h: SQ });

  // Bottom row: spaces 16..28 going right to left
  const bottomY = midY + 2 * (SQ + GAP);
  for (let i = 0; i < 13; i++) {
    rects.push({ x: rightX - i * (SQ + GAP), y: bottomY, w: SQ, h: SQ });
  }

  return rects.slice(0, trackLength);
}

// --- Effect animation variants for Framer Motion ---
const effectVariants: Record<string, any> = {
  'racer-hopping': {
    scale: [1, 1.15, 1],
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  'racer-glow': {
    filter: [
      'drop-shadow(0 0 0px #ffd700)',
      'drop-shadow(0 0 10px #ffd700)',
      'drop-shadow(0 0 0px #ffd700)',
      'drop-shadow(0 0 10px #ffd700)',
      'drop-shadow(0 0 0px #ffd700)',
    ],
    transition: { duration: 0.6, ease: 'easeInOut' },
  },
  'racer-swap': {
    scale: [1, 1.3, 1],
    transition: { duration: 0.8, ease: 'easeInOut' },
  },
  'racer-warp': {
    scale: [1, 0, 0, 1],
    opacity: [1, 0, 0, 1],
    transition: { duration: 0.6, times: [0, 0.4, 0.5, 1] },
  },
  'racer-tripped-anim': {
    x: [0, -4, 4, -3, 3, 0],
    opacity: [1, 0.5],
    transition: { duration: 0.5 },
  },
  'racer-eliminate': {
    scale: [1, 0],
    opacity: [1, 0],
    rotate: [0, 360],
    transition: { duration: 0.8 },
  },
  'racer-finish': {
    scale: [1, 1.3, 1, 1.2, 1],
    filter: [
      'drop-shadow(0 0 0px #ffd700)',
      'drop-shadow(0 0 14px #ffd700)',
      'drop-shadow(0 0 4px #ffd700)',
      'drop-shadow(0 0 10px #ffd700)',
      'drop-shadow(0 0 0px #ffd700)',
    ],
    transition: { duration: 1.0 },
  },
};

interface TrackBoardProps {
  gameState: GameState;
  playerId: string;
  animPositions?: Record<string, number>;
  playerIndex?: Record<string, number>;
  activeEffects?: Record<string, string>;
}

export function TrackBoard({ gameState, playerId, animPositions, playerIndex, activeEffects }: TrackBoardProps) {
  const track = gameState.track;
  const side = gameState.trackConfig.side;
  const racers = gameState.activeRacers.filter(r => !r.eliminated);
  const rects = useMemo(() => layoutSpaces(track.length), [track.length]);

  const racersByPos: Record<number, typeof racers> = {};
  const finishedRacers: typeof racers = [];
  const finishIndex = track.length - 1;
  for (const r of racers) {
    const pos = animPositions?.[r.racerName] ?? (r.finished ? finishIndex : r.position);
    if (r.finished && pos >= finishIndex) {
      // Racer has finished and animation has reached the finish — show on podium
      finishedRacers.push(r);
    } else {
      if (!racersByPos[pos]) racersByPos[pos] = [];
      racersByPos[pos].push(r);
    }
  }

  const sideName = side === 'mild' ? 'A-SIDE' : 'B-SIDE';

  // Board dimensions from layout
  const allRects = rects;
  const maxX = Math.max(...allRects.map(r => r.x + r.w)) + PAD + BORDER * 2 + 4;
  const maxY = Math.max(...allRects.map(r => r.y + r.h)) + PAD + BORDER * 2 + 4;
  const svgW = maxX;
  const svgH = maxY;

  // Track strip borders
  const topFirst = rects[0];
  const topLast = rects[13];
  const cornerTop = rects[14];
  const cornerBot = rects[15];
  const botFirst = rects[16];
  const botLast = rects[28];

  // Finish zone position
  const fzX = PAD + BORDER * 2 + FZ_R1 + 8;
  const boardMidY = svgH / 2;

  // Top strip outline
  const topStripX = (topFirst?.x ?? 0) - 3;
  const topStripY = (topFirst?.y ?? 0) - 3;
  const topStripW = (topLast?.x ?? 0) + SQ - (topFirst?.x ?? 0) + 6;
  const topStripH = SQ + 6;

  // Bottom strip outline
  const botStripX = (botLast?.x ?? 0) - 3;
  const botStripY = (botFirst?.y ?? 0) - 3;
  const botStripW = (botFirst?.x ?? 0) + SQ - (botLast?.x ?? 0) + 6;
  const botStripH = SQ + 6;

  // Right column outline
  const colX = (cornerTop?.x ?? 0) - 3;
  const colY = (cornerTop?.y ?? 0) - 3;
  const colW = SQ + 6;
  const colH = (cornerBot?.y ?? 0) + SQ - (cornerTop?.y ?? 0) + 6;

  // Build flat list of racer render data with computed positions
  const racerRenderData: Array<{
    racer: typeof racers[number];
    cx: number;
    cy: number;
    tokenR: number;
    isMe: boolean;
    pColor: string;
    ownerName: string;
    card: any;
    effectKey: string;
  }> = [];

  for (const [posStr, posRacers] of Object.entries(racersByPos)) {
    const pos = Number(posStr);
    const rect = rects[pos];
    if (!rect) continue;
    const count = posRacers.length;
    const tokenR = Math.min(13, (rect.h - 4) / 2);
    const spread = count > 1 ? Math.min(tokenR * 1.8, (rect.w + 20) / count) : 0;
    const groupW = (count - 1) * spread;
    const baseCx = rect.x + rect.w / 2;
    const baseCy = rect.y + rect.h / 2;

    posRacers.forEach((r, stackIdx) => {
      const pIdx = playerIndex?.[r.playerId] ?? 0;
      const owner = gameState.players.find(p => p.id === r.playerId);
      racerRenderData.push({
        racer: r,
        cx: baseCx + (-groupW / 2 + stackIdx * spread),
        cy: baseCy,
        tokenR,
        isMe: r.playerId === playerId,
        pColor: PLAYER_COLORS[pIdx] ?? '#888',
        ownerName: owner?.name ?? '',
        card: RACER_CARDS[r.racerName],
        effectKey: activeEffects?.[r.racerName] ?? '',
      });
    });
  }

  return (
    <div className="track-board">
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', height: 'auto', maxHeight: '32vh' }}>
        {/* Board background */}
        <rect x={BORDER / 2} y={BORDER / 2} width={svgW - BORDER} height={svgH - BORDER}
          rx={CORNER_R} fill="#000" stroke="#fff" strokeWidth={BORDER} />
        <rect x={BORDER + 3} y={BORDER + 3} width={svgW - BORDER * 2 - 6} height={svgH - BORDER * 2 - 6}
          rx={CORNER_R - 4} fill="none" stroke="#fff" strokeWidth={1.5} />

        {/* Track strip outlines */}
        <rect x={topStripX} y={topStripY} width={topStripW} height={topStripH} rx={4} fill="none" stroke="#fff" strokeWidth={2} />
        <rect x={botStripX} y={botStripY} width={botStripW} height={botStripH} rx={4} fill="none" stroke="#fff" strokeWidth={2} />
        <rect x={colX} y={colY} width={colW} height={colH} rx={4} fill="none" stroke="#fff" strokeWidth={2} />

        {/* Center title */}
        <text x={svgW / 2 - 10} y={boardMidY - 2}
          fill="#fff" fontSize="32" textAnchor="middle" fontWeight="900" fontStyle="italic"
          fontFamily="'Georgia', 'Times New Roman', serif">
          Magical Athlete
        </text>
        <text x={svgW * 0.72} y={boardMidY + 16}
          fill="#fff" fontSize="9" textAnchor="middle" fontWeight="700" opacity="0.6">
          {sideName}
        </text>

        {/* Finish zone: winner / runner up */}
        <g>
          <line x1={fzX} y1={boardMidY - FZ_R1 - 6} x2={fzX} y2={boardMidY + FZ_R2 + 6}
            stroke="#fff" strokeWidth="2" />
          <circle cx={fzX} cy={boardMidY - FZ_R1 - 6} r={FZ_R1} fill="#000" stroke="#fff" strokeWidth="2.5" />
          <text x={fzX} y={boardMidY - FZ_R1 - 9} fill="#fff" fontSize="5.5" textAnchor="middle" fontWeight="900">winner</text>
          <circle cx={fzX} cy={boardMidY + FZ_R2 + 6} r={FZ_R2} fill="#000" stroke="#fff" strokeWidth="2" />
          <text x={fzX} y={boardMidY + FZ_R2 + 2} fill="#fff" fontSize="4.5" textAnchor="middle" fontWeight="900">runner</text>
          <text x={fzX} y={boardMidY + FZ_R2 + 8} fill="#fff" fontSize="4.5" textAnchor="middle" fontWeight="900">up</text>
        </g>

        {/* Finished racers on podium */}
        {finishedRacers.sort((a, b) => (a.finishOrder ?? 99) - (b.finishOrder ?? 99)).map((r, i) => {
          if (i >= 2) return null;
          const fx = fzX;
          const fy = i === 0 ? boardMidY - FZ_R1 - 6 : boardMidY + FZ_R2 + 6;
          const cr = i === 0 ? FZ_R1 - 2 : FZ_R2 - 2;
          return (
            <g key={r.racerName}>
              <clipPath id={`finish-clip-${r.racerName}`}>
                <circle cx={fx} cy={fy} r={cr} />
              </clipPath>
              <image href={getRacerImageUrl(r.racerName)}
                x={fx - cr} y={fy - cr} width={cr * 2} height={cr * 2}
                clipPath={`url(#finish-clip-${r.racerName})`} />
            </g>
          );
        })}

        {/* Spaces */}
        {track.map((space, i) => {
          const rect = rects[i];
          if (!rect) return null;
          const color = getSpaceColor(space, i, side);
          const label = getSpaceLabel(space);
          const lColor = getLabelColor(space, color);
          const isStart = space.type === 'start';

          return (
            <g key={i}>
              <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} rx={2}
                fill={color} />
              {label && (
                <text x={rect.x + rect.w / 2} y={rect.y + rect.h / 2 + (isStart ? 4 : 3)}
                  fill={lColor} fontSize={isStart ? 11 : 7.5} textAnchor="middle"
                  fontWeight="900" fontStyle={isStart ? 'italic' : 'normal'}>
                  {label}
                </text>
              )}
            </g>
          );
        })}

        {/* Racer tokens — Framer Motion for smooth position interpolation + effects */}
        <AnimatePresence>
          {racerRenderData.map(({ racer: r, cx, cy, tokenR, isMe, pColor, ownerName, card, effectKey }) => {
            const variant = effectVariants[effectKey];
            return (
              <motion.g
                key={r.racerName}
                // Animate x/y position — smooth tween, no spring overshoot
                animate={{
                  x: cx,
                  y: cy,
                  opacity: r.tripped ? 0.5 : 1,
                  ...(variant ?? {}),
                }}
                transition={{
                  x: { type: 'tween', duration: 0.25, ease: 'easeOut' },
                  y: { type: 'tween', duration: 0.25, ease: 'easeOut' },
                  opacity: { duration: 0.3 },
                }}
                // Eliminated racers shrink out
                exit={{ scale: 0, opacity: 0, transition: { duration: 0.5 } }}
              >
                {/* Background circle */}
                <circle r={tokenR + 2} fill="#111" stroke={pColor} strokeWidth={isMe ? 3 : 2} />
                {/* Avatar */}
                <clipPath id={`racer-clip-${r.racerName}`}>
                  <circle r={tokenR} />
                </clipPath>
                <image
                  href={getRacerImageUrl(r.racerName)}
                  x={-tokenR * 1.2} y={-tokenR * 1.2} width={tokenR * 2.4} height={tokenR * 2.4}
                  clipPath={`url(#racer-clip-${r.racerName})`}
                  preserveAspectRatio="xMidYMin slice"
                />
                {/* Name below token */}
                <text y={tokenR + 9} textAnchor="middle" fill={pColor}
                  fontSize={5} fontWeight="800">
                  {ownerName.slice(0, 4)}
                </text>
                {r.tripped && (
                  <text y={tokenR + 16} textAnchor="middle" fill="#ff6600" fontSize={6} fontWeight="800">STUN</text>
                )}
                <title>{ownerName}（{card.displayNameCn}）{r.tripped ? ' — 被绊倒' : ''}</title>
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
    </div>
  );
}

export { layoutSpaces as calculateSpaceCoords };
