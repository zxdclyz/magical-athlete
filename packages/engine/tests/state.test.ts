import { describe, it, expect } from 'vitest';
import { createInitialState, generateDraftOrder, getDraftsPerPlayer } from '../src/state.js';
import type { Player } from '../src/types.js';

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isAI: false,
    hand: [],
    usedRacers: [],
  }));
}

describe('getDraftsPerPlayer', () => {
  it('should return correct counts for 2-5 players', () => {
    expect(getDraftsPerPlayer(2)).toBe(5);
    expect(getDraftsPerPlayer(3)).toBe(4);
    expect(getDraftsPerPlayer(4)).toBe(3);
    expect(getDraftsPerPlayer(5)).toBe(2);
  });

  it('should throw for invalid player counts', () => {
    expect(() => getDraftsPerPlayer(1)).toThrow();
    expect(() => getDraftsPerPlayer(6)).toThrow();
  });
});

describe('generateDraftOrder', () => {
  it('should generate snake order for 3 players', () => {
    const order = generateDraftOrder(['a', 'b', 'c'], 4);
    // Round 1: a, b, c
    // Round 2: c, b, a
    // Round 3: a, b, c
    // Round 4: c, b, a
    expect(order).toEqual([
      'a', 'b', 'c',
      'c', 'b', 'a',
      'a', 'b', 'c',
      'c', 'b', 'a',
    ]);
  });

  it('should generate snake order for 2 players', () => {
    const order = generateDraftOrder(['a', 'b'], 5);
    expect(order).toEqual([
      'a', 'b',
      'b', 'a',
      'a', 'b',
      'b', 'a',
      'a', 'b',
    ]);
  });
});

describe('createInitialState', () => {
  it('should create valid initial state for 3 players', () => {
    const players = makePlayers(3);
    const state = createInitialState(players);

    expect(state.phase).toBe('LOBBY');
    expect(state.players).toHaveLength(3);
    expect(state.availableRacers).toHaveLength(36);
    expect(state.currentRace).toBe(1);
    expect(state.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(state.pendingDecision).toBeNull();
    expect(state.eventLog).toEqual([]);
  });

  it('should have gold and silver chip stacks', () => {
    const state = createInitialState(makePlayers(2));
    expect(state.goldChipValues.length).toBeGreaterThan(0);
    expect(state.silverChipValues.length).toBeGreaterThan(0);
    // Gold should be sorted descending
    for (let i = 1; i < state.goldChipValues.length; i++) {
      expect(state.goldChipValues[i - 1]).toBeGreaterThanOrEqual(state.goldChipValues[i]);
    }
  });
});
