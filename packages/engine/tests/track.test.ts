import { describe, it, expect } from 'vitest';
import { createTrack, getSpacesAhead, getDistanceToFinish } from '../src/track.js';

describe('Track', () => {
  it('should create a mild track with start and finish', () => {
    const track = createTrack('mild');
    expect(track.spaces[0].type).toBe('start');
    expect(track.spaces[track.spaces.length - 1].type).toBe('finish');
    expect(track.spaces.length).toBeGreaterThan(10);
  });

  it('should create both track sides', () => {
    for (const id of ['mild', 'wild']) {
      const track = createTrack(id);
      expect(track.spaces[0].type).toBe('start');
      expect(track.spaces[track.spaces.length - 1].type).toBe('finish');
    }
  });

  it('should throw for unknown track', () => {
    expect(() => createTrack('unknown')).toThrow('Unknown track');
  });

  it('should calculate distance to finish', () => {
    const track = createTrack('mild');
    const lastIndex = track.spaces.length - 1;
    expect(getDistanceToFinish(track, 0)).toBe(lastIndex);
    expect(getDistanceToFinish(track, lastIndex)).toBe(0);
  });

  it('should clamp getSpacesAhead to track bounds', () => {
    const track = createTrack('mild');
    const lastIndex = track.spaces.length - 1;
    expect(getSpacesAhead(track, lastIndex - 2, 10)).toBe(lastIndex);
    expect(getSpacesAhead(track, 2, -10)).toBe(0);
  });

  it('wild track should have special spaces', () => {
    const track = createTrack('wild');
    const types = track.spaces.map(s => s.type);
    expect(types).toContain('arrow');
    expect(types).toContain('trip');
    expect(types).toContain('star');
  });

  it('should have secondCornerIndex within bounds', () => {
    for (const id of ['mild', 'wild']) {
      const track = createTrack(id);
      expect(track.secondCornerIndex).toBeGreaterThan(0);
      expect(track.secondCornerIndex).toBeLessThan(track.spaces.length - 1);
    }
  });
});
