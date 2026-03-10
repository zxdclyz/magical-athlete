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

/** Run the full draft, always picking the first available racer. */
function draftAll(controller: GameController, state: GameState): GameState {
  while (state.phase === 'DRAFTING') {
    const playerId = state.draftOrder[state.draftCurrentIndex];
    const pick = state.availableRacers[0];
    const result = controller.processAction(state, playerId, {
      type: 'MAKE_DECISION',
      decision: { type: 'DRAFT_PICK', racerName: pick },
    });
    expect(result.error).toBeUndefined();
    state = result.state;
  }
  return state;
}

/** Both players choose their first available racer for a race. */
function raceSetup(controller: GameController, state: GameState): GameState {
  for (const p of state.players) {
    const available = p.hand.filter(r => !p.usedRacers.includes(r));
    if (available.length === 0) break;
    const result = controller.processAction(state, p.id, {
      type: 'MAKE_DECISION',
      decision: { type: 'CHOOSE_RACE_RACER', racerName: available[0] },
    });
    expect(result.error).toBeUndefined();
    state = result.state;
  }
  return state;
}

describe('GameController', () => {
  it('should start game from LOBBY to DRAFTING', () => {
    const controller = new GameController();
    const state = createInitialState(makePlayers(3));
    const result = controller.processAction(state, 'p1', { type: 'START_GAME' });

    expect(result.error).toBeUndefined();
    expect(result.state.phase).toBe('DRAFTING');
    expect(result.state.draftOrder.length).toBeGreaterThan(0);
    expect(result.state.availableRacers.length).toBe(6); // 3 players → flip 6
  });

  it('should reject start game with fewer than 2 players', () => {
    const controller = new GameController();
    const state = createInitialState(makePlayers(1));
    const result = controller.processAction(state, 'p1', { type: 'START_GAME' });
    expect(result.error).toBeDefined();
  });

  it('should process draft picks through to RACE_SETUP', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(3));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;
    state = draftAll(controller, state);

    expect(state.phase).toBe('RACE_SETUP');
    expect(state.players[0].hand).toHaveLength(4);
    expect(state.players[1].hand).toHaveLength(4);
    expect(state.players[2].hand).toHaveLength(4);
  });

  it('should process race setup through to RACING (simultaneous)', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(3));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;
    state = draftAll(controller, state);
    state = raceSetup(controller, state);

    expect(state.phase).toBe('RACING');
    expect(state.activeRacers).toHaveLength(3);
  });

  it('should execute turns and detect race end', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(3));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;
    state = draftAll(controller, state);
    state = raceSetup(controller, state);

    // Run turns until race ends (force dice = 6 for speed)
    let turnCount = 0;
    while (state.phase === 'RACING' && turnCount < 100) {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      const result = controller.processAction(state, currentPlayerId, {
        type: 'MAKE_DECISION',
        decision: { type: 'ROLL_DICE', value: 6 },
      });
      if (result.error) break;
      state = result.state;
      turnCount++;
    }

    expect(state.phase).toBe('RACE_SETUP');
    expect(state.currentRace).toBe(2);
  });

  it('should complete 4 races and end the game', () => {
    const controller = new GameController();
    let state = createInitialState(makePlayers(3));
    state = controller.processAction(state, 'p1', { type: 'START_GAME' }).state;
    state = draftAll(controller, state);

    for (let race = 0; race < 4; race++) {
      state = raceSetup(controller, state);

      let turnCount = 0;
      while (state.phase === 'RACING' && turnCount < 100) {
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
  });
});
