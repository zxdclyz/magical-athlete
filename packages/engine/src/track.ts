import type { TrackConfig, TrackSpace } from './types.js';

function makeSpace(index: number, type: TrackSpace['type'] = 'normal', arrowDistance?: number): TrackSpace {
  return { index, type, ...(arrowDistance !== undefined ? { arrowDistance } : {}) };
}

function generateMildTrack1(): TrackSpace[] {
  const spaces: TrackSpace[] = [];
  spaces.push(makeSpace(0, 'start'));
  for (let i = 1; i <= 18; i++) {
    spaces.push(makeSpace(i, 'normal'));
  }
  spaces.push(makeSpace(19, 'finish'));
  return spaces;
}

function generateWildTrack1(): TrackSpace[] {
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

function generateMildTrack2(): TrackSpace[] {
  const spaces: TrackSpace[] = [];
  spaces.push(makeSpace(0, 'start'));
  for (let i = 1; i <= 20; i++) {
    spaces.push(makeSpace(i, 'normal'));
  }
  spaces.push(makeSpace(21, 'finish'));
  return spaces;
}

function generateWildTrack2(): TrackSpace[] {
  return [
    makeSpace(0, 'start'),
    makeSpace(1, 'normal'),
    makeSpace(2, 'star'),
    makeSpace(3, 'normal'),
    makeSpace(4, 'normal'),
    makeSpace(5, 'arrow', 2),
    makeSpace(6, 'normal'),
    makeSpace(7, 'trip'),
    makeSpace(8, 'normal'),
    makeSpace(9, 'normal'),
    makeSpace(10, 'normal'),
    makeSpace(11, 'normal'),
    makeSpace(12, 'normal'),
    makeSpace(13, 'normal'),
    makeSpace(14, 'normal'),
    makeSpace(15, 'trip'),
    makeSpace(16, 'normal'),
    makeSpace(17, 'star'),
    makeSpace(18, 'arrow', -3),
    makeSpace(19, 'normal'),
    makeSpace(20, 'normal'),
    makeSpace(21, 'finish'),
  ];
}

const TRACK_CONFIGS: Record<string, TrackConfig> = {
  mild1: { name: 'Track 1 - Mild', side: 'mild', secondCornerIndex: 12, spaces: generateMildTrack1() },
  wild1: { name: 'Track 1 - Wild', side: 'wild', secondCornerIndex: 12, spaces: generateWildTrack1() },
  mild2: { name: 'Track 2 - Mild', side: 'mild', secondCornerIndex: 14, spaces: generateMildTrack2() },
  wild2: { name: 'Track 2 - Wild', side: 'wild', secondCornerIndex: 14, spaces: generateWildTrack2() },
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

export const RACE_TRACK_SEQUENCE = ['mild1', 'wild1', 'mild2', 'wild2'];
