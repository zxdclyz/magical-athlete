import type { TrackConfig, TrackSpace } from './types.js';

function makeSpace(index: number, type: TrackSpace['type'] = 'normal', arrowDistance?: number): TrackSpace {
  return { index, type, ...(arrowDistance !== undefined ? { arrowDistance } : {}) };
}

// TODO: 格子数据是占位的，需要根据实际赛道图片校准
function generateMildTrack(): TrackSpace[] {
  const spaces: TrackSpace[] = [];
  spaces.push(makeSpace(0, 'start'));
  for (let i = 1; i <= 18; i++) {
    spaces.push(makeSpace(i, 'normal'));
  }
  spaces.push(makeSpace(19, 'finish'));
  return spaces;
}

// TODO: 格子数据是占位的，需要根据实际赛道图片校准
function generateWildTrack(): TrackSpace[] {
  return [
    makeSpace(0, 'start'),
    makeSpace(1, 'normal'),
    makeSpace(2, 'normal'),
    makeSpace(3, 'arrow', 3),
    makeSpace(4, 'normal'),
    makeSpace(5, 'normal'),
    makeSpace(6, 'trip'),
    makeSpace(7, 'normal'),
    makeSpace(8, 'star'),
    makeSpace(9, 'normal'),
    makeSpace(10, 'normal'),
    makeSpace(11, 'normal'),
    makeSpace(12, 'normal'),
    makeSpace(13, 'arrow', -2),
    makeSpace(14, 'normal'),
    makeSpace(15, 'trip'),
    makeSpace(16, 'star'),
    makeSpace(17, 'normal'),
    makeSpace(18, 'normal'),
    makeSpace(19, 'finish'),
  ];
}

const TRACK_CONFIGS: Record<string, TrackConfig> = {
  mild: { name: 'Track - Mild', side: 'mild', secondCornerIndex: 12, spaces: generateMildTrack() },
  wild: { name: 'Track - Wild', side: 'wild', secondCornerIndex: 12, spaces: generateWildTrack() },
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
