import { describe, it, expect } from 'vitest';
import { startDraft, processDraftPick } from '../../src/phases/draft.js';
import { createInitialState } from '../../src/state.js';
import type { Player } from '../../src/types.js';

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isAI: false,
    hand: [],
    usedRacers: [],
  }));
}

describe('Draft Phase', () => {
  it('startDraft should transition to DRAFTING and generate draft order', () => {
    const state = createInitialState(makePlayers(3));
    const result = startDraft(state);

    expect(result.state.phase).toBe('DRAFTING');
    expect(result.state.draftOrder.length).toBe(12); // 3 players × 4 picks
    expect(result.state.draftCurrentIndex).toBe(0);
  });

  it('should allow the current player to pick a racer', () => {
    const state = createInitialState(makePlayers(3));
    const { state: draftState } = startDraft(state);
    const currentPlayerId = draftState.draftOrder[0]; // p1

    const result = processDraftPick(draftState, currentPlayerId, 'alchemist');

    expect(result.error).toBeUndefined();
    expect(result.state!.draftCurrentIndex).toBe(1);
    expect(result.state!.availableRacers).not.toContain('alchemist');
    const player = result.state!.players.find(p => p.id === currentPlayerId)!;
    expect(player.hand).toContain('alchemist');
  });

  it('should reject pick from wrong player', () => {
    const state = createInitialState(makePlayers(3));
    const { state: draftState } = startDraft(state);
    // First pick is p1, try p2
    const result = processDraftPick(draftState, 'p2', 'alchemist');
    expect(result.error).toBeDefined();
  });

  it('should reject picking unavailable racer', () => {
    const state = createInitialState(makePlayers(3));
    const { state: draftState } = startDraft(state);
    const currentPlayerId = draftState.draftOrder[0];

    const { state: state2 } = processDraftPick(draftState, currentPlayerId, 'alchemist');
    // Next player tries to pick alchemist again
    const nextPlayerId = state2!.draftOrder[1];
    const result = processDraftPick(state2!, nextPlayerId, 'alchemist');
    expect(result.error).toBeDefined();
  });

  it('should transition to RACE_SETUP when all picks complete', () => {
    const players = makePlayers(2); // 2 players × 5 picks = 10 total
    let state = startDraft(createInitialState(players)).state;
    const racers = state.availableRacers.slice();

    for (let i = 0; i < 10; i++) {
      const playerId = state.draftOrder[i];
      const result = processDraftPick(state, playerId, racers[i]);
      expect(result.error).toBeUndefined();
      state = result.state!;
    }

    expect(state.phase).toBe('RACE_SETUP');
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[1].hand).toHaveLength(5);
  });
});
