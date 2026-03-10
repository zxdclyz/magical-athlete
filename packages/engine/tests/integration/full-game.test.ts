import { describe, it, expect } from 'vitest';
import { GameController } from '../../src/game.js';
import { createInitialState } from '../../src/state.js';
import type { Player, GameState } from '../../src/types.js';

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isAI: false,
    hand: [],
    usedRacers: [],
  }));
}

describe('GameController', () => {
  it('should start game from LOBBY to DRAFTING', () => {
    const controller = new GameController();
    const state = createInitialState(makePlayers(2));
    const result = controller.processAction(state, 'p1', { type: 'START_GAME' });

    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('DRAFTING');
    expect(result.state.draftOrder.length).toBeGreaterThan(0);
  });

  it('should reject start game with fewer than 2 players', () => {
    const controller = new GameController();
    const state = createInitialState(makePlayers(1));
    const result = controller.processAction(state, 'p1', { type: 'START_GAME' });

    expect(result.error).toBeDefined();
  });

  it('should process draft picks through to RACE_SETUP', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(2));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;

    const racers = state.availableRacers.slice();
    // Complete all draft picks (2 players × 5 picks = 10)
    for (let i = 0; i < 10; i++) {
      const playerId = state.draftOrder[state.draftCurrentIndex];
      const result = controller.processAction(state, playerId, {
        type: 'MAKE_DECISION',
        decision: { type: 'DRAFT_PICK', racerName: racers[i] },
      });
      expect(result.error).toBeUndefined();
      state = result.state;
    }

    expect(state.phase).toBe('RACE_SETUP');
    expect(state.players[0].hand).toHaveLength(5);
    expect(state.players[1].hand).toHaveLength(5);
  });

  it('should process race setup through to RACING', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(2));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;

    // Draft all picks
    const racers = state.availableRacers.slice();
    for (let i = 0; i < 10; i++) {
      const playerId = state.draftOrder[state.draftCurrentIndex];
      state = controller.processAction(state, playerId, {
        type: 'MAKE_DECISION',
        decision: { type: 'DRAFT_PICK', racerName: racers[i] },
      }).state;
    }

    // Both players choose racers
    const p1Racer = state.players[0].hand[0];
    const p2Racer = state.players[1].hand[0];

    state = controller.processAction(state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'CHOOSE_RACE_RACER', racerName: p1Racer },
    }).state;

    state = controller.processAction(state, 'p2', {
      type: 'MAKE_DECISION',
      decision: { type: 'CHOOSE_RACE_RACER', racerName: p2Racer },
    }).state;

    expect(state.phase).toBe('RACING');
    expect(state.activeRacers).toHaveLength(2);
  });

  it('should execute turns and detect race end', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(2));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;

    // Quick draft
    const racers = state.availableRacers.slice();
    for (let i = 0; i < 10; i++) {
      const playerId = state.draftOrder[state.draftCurrentIndex];
      state = controller.processAction(state, playerId, {
        type: 'MAKE_DECISION',
        decision: { type: 'DRAFT_PICK', racerName: racers[i] },
      }).state;
    }

    // Race setup
    const p1Racer = state.players[0].hand[0];
    const p2Racer = state.players[1].hand[0];
    state = controller.processAction(state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'CHOOSE_RACE_RACER', racerName: p1Racer },
    }).state;
    state = controller.processAction(state, 'p2', {
      type: 'MAKE_DECISION',
      decision: { type: 'CHOOSE_RACE_RACER', racerName: p2Racer },
    }).state;

    // Run turns until race ends (force dice = 6 for speed)
    let turnCount = 0;
    while (state.phase === 'RACING' && turnCount < 50) {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      const result = controller.processAction(state, currentPlayerId, {
        type: 'MAKE_DECISION',
        decision: { type: 'ROLL_DICE', value: 6 },
      });
      if (result.error) break;
      state = result.state;
      turnCount++;
    }

    // Race should have ended and moved to RACE_SETUP for race 2
    expect(state.phase).toBe('RACE_SETUP');
    expect(state.currentRace).toBe(2);
    expect(state.scores['p1']).toBeGreaterThan(0); // At least one player scored
  });

  it('should complete 4 races and end the game', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(2));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;

    // Draft
    const racers = state.availableRacers.slice();
    for (let i = 0; i < 10; i++) {
      const playerId = state.draftOrder[state.draftCurrentIndex];
      state = controller.processAction(state, playerId, {
        type: 'MAKE_DECISION',
        decision: { type: 'DRAFT_PICK', racerName: racers[i] },
      }).state;
    }

    // Play 4 races
    for (let race = 0; race < 4; race++) {
      // Race setup — pick unused racers
      const p1Available = state.players[0].hand.filter(r => !state.players[0].usedRacers.includes(r));
      const p2Available = state.players[1].hand.filter(r => !state.players[1].usedRacers.includes(r));

      if (p1Available.length === 0 || p2Available.length === 0) break;

      state = controller.processAction(state, 'p1', {
        type: 'MAKE_DECISION',
        decision: { type: 'CHOOSE_RACE_RACER', racerName: p1Available[0] },
      }).state;
      state = controller.processAction(state, 'p2', {
        type: 'MAKE_DECISION',
        decision: { type: 'CHOOSE_RACE_RACER', racerName: p2Available[0] },
      }).state;

      // Run turns
      let turnCount = 0;
      while (state.phase === 'RACING' && turnCount < 50) {
        const currentPlayerId = state.turnOrder[state.currentTurnIndex];
        const result = controller.processAction(state, currentPlayerId, {
          type: 'MAKE_DECISION',
          decision: { type: 'ROLL_DICE', value: 6 },
        });
        if (result.error) break;
        state = result.state;
        turnCount++;
      }
    }

    expect(state.phase).toBe('GAME_OVER');
    // Both players should have scores
    expect(state.scores['p1']).toBeGreaterThan(0);
    expect(state.scores['p2']).toBeGreaterThan(0);
  });
});
