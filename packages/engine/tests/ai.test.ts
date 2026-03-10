import { describe, it, expect } from 'vitest';
import { makeAIDecision } from '../src/ai.js';
import { createInitialState } from '../src/state.js';
import type { GameState, Player, DecisionRequest } from '../src/types.js';

function makeState(): GameState {
  const players: Player[] = [
    { id: 'p1', name: 'P1', isAI: true, hand: ['alchemist', 'blimp'], usedRacers: [] },
    { id: 'p2', name: 'P2', isAI: false, hand: ['coach', 'hare'], usedRacers: [] },
  ];
  const state = createInitialState(players);
  state.players = players;
  state.phase = 'RACING';
  state.activeRacers = [
    { racerName: 'alchemist', playerId: 'p1', position: 5, tripped: false, finished: false, finishOrder: null, eliminated: false },
    { racerName: 'hare', playerId: 'p2', position: 10, tripped: false, finished: false, finishOrder: null, eliminated: false },
  ];
  return state;
}

describe('AI Decision Engine', () => {
  describe('Easy AI', () => {
    it('should return a valid DRAFT_PICK', () => {
      const state = makeState();
      const request: DecisionRequest = { type: 'DRAFT_PICK', availableRacers: ['alchemist', 'blimp', 'coach'] };
      const decision = makeAIDecision(state, request, 'easy');
      expect(decision.type).toBe('DRAFT_PICK');
      if (decision.type === 'DRAFT_PICK') {
        expect(request.availableRacers).toContain(decision.racerName);
      }
    });

    it('should return a valid USE_ABILITY', () => {
      const state = makeState();
      const request: DecisionRequest = { type: 'USE_ABILITY', racerName: 'alchemist', abilityDescription: 'test' };
      const decision = makeAIDecision(state, request, 'easy');
      expect(decision.type).toBe('USE_ABILITY');
    });

    it('should return a valid ROLL_DICE', () => {
      const state = makeState();
      const request: DecisionRequest = { type: 'ROLL_DICE' };
      const decision = makeAIDecision(state, request, 'easy');
      expect(decision.type).toBe('ROLL_DICE');
      if (decision.type === 'ROLL_DICE') {
        expect(decision.value).toBeGreaterThanOrEqual(1);
        expect(decision.value).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('Normal AI', () => {
    it('should draft highest tier racer', () => {
      const state = makeState();
      const request: DecisionRequest = { type: 'DRAFT_PICK', availableRacers: ['sisyphus', 'hare', 'gunk'] };
      const decision = makeAIDecision(state, request, 'normal');
      expect(decision.type).toBe('DRAFT_PICK');
      if (decision.type === 'DRAFT_PICK') {
        expect(decision.racerName).toBe('hare'); // hare has tier 9
      }
    });

    it('should generally accept abilities', () => {
      const state = makeState();
      const request: DecisionRequest = { type: 'USE_ABILITY', racerName: 'alchemist', abilityDescription: 'Move 4?' };
      const decision = makeAIDecision(state, request, 'normal');
      expect(decision.type).toBe('USE_ABILITY');
      if (decision.type === 'USE_ABILITY') {
        expect(decision.use).toBe(true);
      }
    });

    it('should reroll dice below 4', () => {
      const state = makeState();
      const request: DecisionRequest = { type: 'REROLL_DICE', currentValue: 2, rerollsLeft: 1 };
      const decision = makeAIDecision(state, request, 'normal');
      expect(decision.type).toBe('REROLL_DICE');
      if (decision.type === 'REROLL_DICE') {
        expect(decision.reroll).toBe(true);
      }
    });

    it('should not reroll dice of 4 or higher', () => {
      const state = makeState();
      const request: DecisionRequest = { type: 'REROLL_DICE', currentValue: 5, rerollsLeft: 1 };
      const decision = makeAIDecision(state, request, 'normal');
      if (decision.type === 'REROLL_DICE') {
        expect(decision.reroll).toBe(false);
      }
    });

    it('should target the leading racer', () => {
      const state = makeState();
      const request: DecisionRequest = {
        type: 'CHOOSE_TARGET_RACER',
        racerName: 'hypnotist',
        targets: ['alchemist', 'hare'],
        reason: 'Warp to your space',
      };
      const decision = makeAIDecision(state, request, 'normal');
      if (decision.type === 'CHOOSE_TARGET_RACER') {
        expect(decision.targetRacer).toBe('hare'); // hare at position 10 is ahead
      }
    });
  });
});
