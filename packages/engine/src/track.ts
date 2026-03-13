import type { TrackConfig, TrackSpace } from './types.js';

function makeSpace(index: number, type: TrackSpace['type'] = 'normal', arrowDistance?: number): TrackSpace {
  return { index, type, ...(arrowDistance !== undefined ? { arrowDistance } : {}) };
}

// Mild track (A-Side): all normal spaces, no special effects
// Numbers on the board (5, 10, 15, 20, 25) are just position markers
function generateMildTrack(): TrackSpace[] {
  const spaces: TrackSpace[] = [];
  spaces.push(makeSpace(0, 'start'));
  for (let i = 1; i <= 27; i++) {
    spaces.push(makeSpace(i, 'normal'));
  }
  spaces.push(makeSpace(28, 'finish'));
  return spaces;
}

// Wild track (B-Side): has special spaces (star, trip, arrow)
// Calibrated from physical board image
function generateWildTrack(): TrackSpace[] {
  const spaces: TrackSpace[] = [];
  for (let i = 0; i <= 28; i++) {
    spaces.push(makeSpace(i, 'normal'));
  }
  spaces[0] = makeSpace(0, 'start');
  spaces[28] = makeSpace(28, 'finish');

  // Star (1 POINT) spaces
  spaces[1] = makeSpace(1, 'star');
  spaces[13] = makeSpace(13, 'star');

  // Trip (STUN) spaces
  spaces[6] = makeSpace(6, 'trip');
  spaces[17] = makeSpace(17, 'trip');
  spaces[25] = makeSpace(25, 'trip');

  // Arrow (MOVE) spaces
  spaces[8] = makeSpace(8, 'arrow', 3);    // MOVE 3
  spaces[12] = makeSpace(12, 'arrow', 1);   // MOVE 1
  spaces[19] = makeSpace(19, 'arrow', -2);  // MOVE -2
  spaces[20] = makeSpace(20, 'arrow', 2);   // MOVE 2
  spaces[27] = makeSpace(27, 'arrow', -4);  // MOVE -4

  return spaces;
}

const TRACK_CONFIGS: Record<string, TrackConfig> = {
  mild: { name: 'Track - Mild', side: 'mild', secondCornerIndex: 14, spaces: generateMildTrack() },
  wild: { name: 'Track - Wild', side: 'wild', secondCornerIndex: 14, spaces: generateWildTrack() },
};

export function createTrack(trackId: string): TrackConfig {
  const config = TRACK_CONFIGS[trackId];
  if (!config) throw new Error(`Unknown track: ${trackId}`);
  return config;
}

export function getDistanceToFinish(track: TrackConfig, position: number): number {
  return Math.max(0, track.spaces.length - 1 - position);
}

export function getSpacesAhead(track: TrackConfig, position: number, distance: number): number {
  const finishIndex = track.spaces.length - 1;
  return Math.min(finishIndex, Math.max(0, position + distance));
}

// 4局比赛交替使用同一条赛道的两面: Mild → Wild → Mild → Wild
export const RACE_TRACK_SEQUENCE = ['mild', 'wild', 'mild', 'wild'];
