import { describe, it, expect } from 'vitest';
import {
  createInitialState,
  generateFullDraftOrder,
  generateSnakeDraftOrder,
  getFlipCount,
  flipDraftCards,
} from '../src/state.js';
import type { Player, RacerName } from '../src/types.js';

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isAI: false,
    hand: [],
    usedRacers: [],
  }));
}

describe('getFlipCount', () => {
  it('should return 2x player count', () => {
    expect(getFlipCount(3)).toBe(6);
    expect(getFlipCount(4)).toBe(8);
    expect(getFlipCount(5)).toBe(10);
  });
});

describe('generateSnakeDraftOrder', () => {
  it('should produce forward then reverse', () => {
    const order = generateSnakeDraftOrder(['a', 'b', 'c']);
    expect(order).toEqual(['a', 'b', 'c', 'c', 'b', 'a']);
  });
});

describe('generateFullDraftOrder', () => {
  it('should produce 2 rounds for 3 players (12 picks total, 4 per player)', () => {
    const order = generateFullDraftOrder(['a', 'b', 'c'], 3);
    // Round 1: a b c c b a (6 picks)
    // Round 2 (rotated start): b c a a c b (6 picks)
    expect(order).toHaveLength(12);
    // Each player picks exactly 4 times
    expect(order.filter(id => id === 'a')).toHaveLength(4);
    expect(order.filter(id => id === 'b')).toHaveLength(4);
    expect(order.filter(id => id === 'c')).toHaveLength(4);
  });

  it('should produce 2-player variant order (16 picks total, 8 per player)', () => {
    const order = generateFullDraftOrder(['a', 'b'], 2);
    expect(order).toHaveLength(16);
    expect(order.filter(id => id === 'a')).toHaveLength(8);
    expect(order.filter(id => id === 'b')).toHaveLength(8);
  });
});

describe('flipDraftCards', () => {
  it('should flip the correct number of cards', () => {
    const all: RacerName[] = ['alchemist', 'banana', 'centaur', 'duelist', 'egg', 'genius'];
    const flipped = flipDraftCards(all, [], 4);
    expect(flipped).toHaveLength(4);
  });

  it('should not include already drafted cards', () => {
    const all: RacerName[] = ['alchemist', 'banana', 'centaur', 'duelist', 'egg', 'genius'];
    const flipped = flipDraftCards(all, ['alchemist', 'banana'], 4);
    expect(flipped).toHaveLength(4);
    expect(flipped).not.toContain('alchemist');
    expect(flipped).not.toContain('banana');
  });
});

describe('createInitialState', () => {
  it('should create valid initial state for 3 players', () => {
    const players = makePlayers(3);
    const state = createInitialState(players);

    expect(state.phase).toBe('LOBBY');
    expect(state.players).toHaveLength(3);
    expect(state.availableRacers).toHaveLength(0); // empty until draft starts
    expect(state.currentRace).toBe(1);
    expect(state.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
    expect(state.pendingDecision).toBeNull();
    expect(state.raceSetupChoices).toEqual({});
  });

  it('should have gold and silver chip stacks', () => {
    const state = createInitialState(makePlayers(2));
    expect(state.goldChipValues.length).toBeGreaterThan(0);
    expect(state.silverChipValues.length).toBeGreaterThan(0);
    for (let i = 1; i < state.goldChipValues.length; i++) {
      expect(state.goldChipValues[i - 1]).toBeGreaterThanOrEqual(state.goldChipValues[i]);
    }
  });
});
