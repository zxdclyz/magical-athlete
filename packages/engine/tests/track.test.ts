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

  it('mild track should have 29 spaces (start + 27 normal + finish)', () => {
    const track = createTrack('mild');
    expect(track.spaces).toHaveLength(29);
    expect(track.spaces[0].type).toBe('start');
    expect(track.spaces[28].type).toBe('finish');
    // All middle spaces are normal
    for (let i = 1; i <= 27; i++) {
      expect(track.spaces[i].type).toBe('normal');
    }
  });

  it('wild track should have 29 spaces with correct special spaces', () => {
    const track = createTrack('wild');
    expect(track.spaces).toHaveLength(29);

    // Stars (1 POINT)
    expect(track.spaces[1].type).toBe('star');
    expect(track.spaces[13].type).toBe('star');

    // Trips (STUN)
    expect(track.spaces[6].type).toBe('trip');
    expect(track.spaces[17].type).toBe('trip');
    expect(track.spaces[25].type).toBe('trip');

    // Arrows (MOVE)
    expect(track.spaces[8].type).toBe('arrow');
    expect(track.spaces[8].arrowDistance).toBe(3);
    expect(track.spaces[12].type).toBe('arrow');
    expect(track.spaces[12].arrowDistance).toBe(1);
    expect(track.spaces[19].type).toBe('arrow');
    expect(track.spaces[19].arrowDistance).toBe(-2);
    expect(track.spaces[20].type).toBe('arrow');
    expect(track.spaces[20].arrowDistance).toBe(2);
    expect(track.spaces[27].type).toBe('arrow');
    expect(track.spaces[27].arrowDistance).toBe(-4);
  });

  it('both tracks should have same length', () => {
    const mild = createTrack('mild');
    const wild = createTrack('wild');
    expect(mild.spaces.length).toBe(wild.spaces.length);
  });

  it('should have secondCornerIndex within bounds', () => {
    for (const id of ['mild', 'wild']) {
      const track = createTrack(id);
      expect(track.secondCornerIndex).toBeGreaterThan(0);
      expect(track.secondCornerIndex).toBeLessThan(track.spaces.length - 1);
    }
  });
});
