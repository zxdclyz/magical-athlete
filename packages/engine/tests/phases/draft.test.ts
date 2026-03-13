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
  it('startDraft should transition to DRAFTING and flip cards', () => {
    const state = createInitialState(makePlayers(3));
    const result = startDraft(state);

    expect(result.state.phase).toBe('DRAFTING');
    expect(result.state.draftOrder.length).toBe(12); // 3 players × 4 picks
    expect(result.state.draftCurrentIndex).toBe(0);
    // Should have flipped 2×3 = 6 cards
    expect(result.state.availableRacers).toHaveLength(6);
  });

  it('should allow the current player to pick a flipped racer', () => {
    const state = createInitialState(makePlayers(3));
    const { state: draftState } = startDraft(state);
    const currentPlayerId = draftState.draftOrder[0]; // p1
    const firstAvailable = draftState.availableRacers[0];

    const result = processDraftPick(draftState, currentPlayerId, firstAvailable);

    expect(result.error).toBeUndefined();
    expect(result.state!.draftCurrentIndex).toBe(1);
    expect(result.state!.availableRacers).not.toContain(firstAvailable);
    const player = result.state!.players.find(p => p.id === currentPlayerId)!;
    expect(player.hand).toContain(firstAvailable);
  });

  it('should reject pick from wrong player', () => {
    const state = createInitialState(makePlayers(3));
    const { state: draftState } = startDraft(state);
    const firstAvailable = draftState.availableRacers[0];
    const currentDrafter = draftState.draftOrder[0];
    // Find a player who is NOT the current drafter
    const wrongPlayer = state.players.find(p => p.id !== currentDrafter)!;
    const result = processDraftPick(draftState, wrongPlayer.id, firstAvailable);
    expect(result.error).toBeDefined();
  });

  it('should reject picking a racer not in the flipped pool', () => {
    const state = createInitialState(makePlayers(3));
    const { state: draftState } = startDraft(state);
    const currentPlayerId = draftState.draftOrder[0];

    // Try to pick a racer that's not in availableRacers
    const notAvailable = 'stickler'; // likely not in the flipped 6
    if (!draftState.availableRacers.includes(notAvailable as any)) {
      const result = processDraftPick(draftState, currentPlayerId, notAvailable as any);
      expect(result.error).toBeDefined();
    }
  });

  it('should flip new cards when round 1 exhausted and finish after all picks', () => {
    const players = makePlayers(3); // 3 players → 12 total picks, 2 rounds of 6
    let state = startDraft(createInitialState(players)).state;

    // Draft all 12 picks
    for (let i = 0; i < 12; i++) {
      const playerId = state.draftOrder[i];
      const pick = state.availableRacers[0]; // always pick first available
      const result = processDraftPick(state, playerId, pick);
      expect(result.error).toBeUndefined();
      state = result.state!;

      // After round 1 (6 picks), new cards should be flipped
      if (i === 5 && state.phase === 'DRAFTING') {
        expect(state.availableRacers.length).toBe(6); // new 6 flipped
      }
    }

    expect(state.phase).toBe('RACE_SETUP');
    // Each player should have 4 racers
    expect(state.players[0].hand).toHaveLength(4);
    expect(state.players[1].hand).toHaveLength(4);
    expect(state.players[2].hand).toHaveLength(4);
  });

  it('startDraft should emit DRAFT_ORDER_ROLLED event for roll-off', () => {
    const state = createInitialState(makePlayers(3));
    const result = startDraft(state);

    const orderEvents = result.events.filter(e => e.type === 'DRAFT_ORDER_ROLLED');
    expect(orderEvents).toHaveLength(1);
    expect(orderEvents[0].type === 'DRAFT_ORDER_ROLLED' && orderEvents[0].rolls).toHaveLength(3);
  });

  it('startDraft should randomize player order via roll-off', () => {
    const state = createInitialState(makePlayers(3));
    const orders = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const result = startDraft(state);
      orders.add(result.state.draftOrder.slice(0, 3).join(','));
    }
    // With random rolls, we should see at least 2 different orderings in 20 tries
    expect(orders.size).toBeGreaterThan(1);
  });
});
