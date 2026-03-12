import { describe, it, expect } from 'vitest';
import {
  rollDice,
  executeMovement,
  executeTurn,
  advanceTurn,
  applyTrackSpaceEffect,
  checkRaceEnd,
} from '../../src/phases/racing.js';
import { createInitialState } from '../../src/state.js';
import type { GameState, Player, ActiveRacer, TrackSpace } from '../../src/types.js';

function makeRacingState(overrides?: Partial<GameState>): GameState {
  const players: Player[] = [
    { id: 'p1', name: 'P1', isAI: false, hand: ['alchemist', 'banana'], usedRacers: ['alchemist'] },
    { id: 'p2', name: 'P2', isAI: false, hand: ['blimp', 'coach'], usedRacers: ['blimp'] },
  ];
  const state = createInitialState(players);
  state.players = players;
  state.phase = 'RACING';
  state.turnOrder = ['p1', 'p2'];
  state.currentTurnIndex = 0;
  state.activeRacers = [
    { racerName: 'alchemist', playerId: 'p1', position: 0, tripped: false, finished: false, finishOrder: null, eliminated: false },
    { racerName: 'blimp', playerId: 'p2', position: 0, tripped: false, finished: false, finishOrder: null, eliminated: false },
  ];
  return { ...state, ...overrides };
}

describe('Racing Phase - Basic Turn', () => {
  describe('rollDice', () => {
    it('should return a value between 1 and 6', () => {
      for (let i = 0; i < 100; i++) {
        const value = rollDice();
        expect(value).toBeGreaterThanOrEqual(1);
        expect(value).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('executeMovement', () => {
    it('should move racer forward by dice value', () => {
      const state = makeRacingState();
      const result = executeMovement(state, 'p1', 4);

      expect(result.state.activeRacers[0].position).toBe(4);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'RACER_MOVING', racerName: 'alchemist', from: 0, to: 4 })
      );
    });

    it('should not move past the finish line', () => {
      const state = makeRacingState();
      state.activeRacers[0].position = 27; // one before finish
      const result = executeMovement(state, 'p1', 5);

      expect(result.state.activeRacers[0].position).toBe(28); // capped at finish
    });

    it('should mark racer as finished when reaching finish', () => {
      const state = makeRacingState();
      state.activeRacers[0].position = 26;
      const result = executeMovement(state, 'p1', 3);

      const racer = result.state.activeRacers.find(r => r.playerId === 'p1')!;
      expect(racer.finished).toBe(true);
      expect(racer.finishOrder).toBe(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'RACER_FINISHED', racerName: 'alchemist', place: 1 })
      );
    });

    it('should assign correct finish order for 2nd place', () => {
      const state = makeRacingState();
      // p1 already finished
      state.activeRacers[0].finished = true;
      state.activeRacers[0].finishOrder = 1;
      state.activeRacers[0].position = 28;
      // p2 about to finish
      state.activeRacers[1].position = 26;
      const result = executeMovement(state, 'p2', 3);

      const racer = result.state.activeRacers.find(r => r.playerId === 'p2')!;
      expect(racer.finished).toBe(true);
      expect(racer.finishOrder).toBe(2);
    });

    it('should emit RACER_PASSED events for racers along the path', () => {
      const state = makeRacingState();
      state.activeRacers[1].position = 3; // blimp at position 3
      const result = executeMovement(state, 'p1', 5); // alchemist moves 0→5, passes blimp at 3

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'RACER_PASSED', movingRacer: 'alchemist', passedRacer: 'blimp', space: 3 })
      );
    });

    it('should emit RACER_STOPPED event at destination', () => {
      const state = makeRacingState();
      const result = executeMovement(state, 'p1', 3);

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'RACER_STOPPED', racerName: 'alchemist', space: 3 })
      );
    });
  });

  describe('applyTrackSpaceEffect', () => {
    it('should apply arrow effect as a separate move (not warp)', () => {
      const state = makeRacingState();
      state.track = [
        ...state.track.slice(0, 3),
        { index: 3, type: 'arrow' as const, arrowDistance: 3 },
        ...state.track.slice(4),
      ];
      state.trackConfig = { ...state.trackConfig, spaces: state.track };
      state.activeRacers[0].position = 3;

      const result = applyTrackSpaceEffect(state, 'alchemist');

      // Should emit RACER_MOVING, not RACER_WARPED
      expect(result.events.some(e => e.type === 'RACER_MOVING')).toBe(true);
      expect(result.events.some(e => e.type === 'RACER_WARPED')).toBe(false);
      // Should be marked as non-main move
      const moveEvent = result.events.find(e => e.type === 'RACER_MOVING') as any;
      expect(moveEvent.isMainMove).toBe(false);
      // Racer should be at position 6
      expect(result.state.activeRacers[0].position).toBe(6);
    });

    it('should apply trip effect', () => {
      const state = makeRacingState();
      state.track = [
        ...state.track.slice(0, 5),
        { index: 5, type: 'trip' as const },
        ...state.track.slice(6),
      ];
      state.trackConfig = { ...state.trackConfig, spaces: state.track };
      state.activeRacers[0].position = 5;

      const result = applyTrackSpaceEffect(state, 'alchemist');
      expect(result.state.activeRacers[0].tripped).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'RACER_TRIPPED', racerName: 'alchemist' })
      );
    });

    it('should not apply effect on normal space', () => {
      const state = makeRacingState();
      state.activeRacers[0].position = 2;
      const result = applyTrackSpaceEffect(state, 'alchemist');
      expect(result.state).toEqual(state);
      expect(result.events).toHaveLength(0);
    });
  });

  describe('tripped racer', () => {
    it('should skip the main movement for a tripped racer and untrip them', () => {
      const state = makeRacingState();
      state.activeRacers[0].tripped = true;

      const result = executeTurn(state, 'p1', 4);
      // Tripped racer skips, position unchanged
      const racer = result.state.activeRacers.find(r => r.playerId === 'p1')!;
      expect(racer.position).toBe(0);
      expect(racer.tripped).toBe(false); // untripped after skipping
    });

    it('should skip main move but still emit TURN_START/TURN_END when tripped', () => {
      const state = makeRacingState();
      state.activeRacers[0].tripped = true;
      const result = executeTurn(state, 'p1');

      expect(result.events.some(e => e.type === 'TURN_START')).toBe(true);
      expect(result.events.some(e => e.type === 'TURN_END')).toBe(true);
      // Should NOT have a DICE_ROLLED event (main move skipped)
      expect(result.events.some(e => e.type === 'DICE_ROLLED')).toBe(false);
      // Should be untripped after
      const racer = result.state.activeRacers.find(r => r.playerId === 'p1')!;
      expect(racer.tripped).toBe(false);
    });
  });

  describe('advanceTurn', () => {
    it('should advance to the next player', () => {
      const state = makeRacingState();
      const newState = advanceTurn(state);
      expect(newState.currentTurnIndex).toBe(1);
    });

    it('should wrap around to the first player', () => {
      const state = makeRacingState();
      state.currentTurnIndex = 1;
      const newState = advanceTurn(state);
      expect(newState.currentTurnIndex).toBe(0);
    });

    it('should skip finished racers', () => {
      const state = makeRacingState();
      // p2 finished, so after p1 turn it should wrap back to p1
      state.activeRacers[1].finished = true;
      const newState = advanceTurn(state);
      expect(newState.currentTurnIndex).toBe(0); // back to p1
    });

    it('should skip eliminated racers', () => {
      const state = makeRacingState();
      state.activeRacers[1].eliminated = true;
      const newState = advanceTurn(state);
      expect(newState.currentTurnIndex).toBe(0); // back to p1
    });
  });

  describe('checkRaceEnd', () => {
    it('should end race when only 1 racer remains (M.O.U.T.H. rule)', () => {
      const state = makeRacingState();
      state.activeRacers[0].finished = true;
      state.activeRacers[0].finishOrder = 1;
      // Only 1 active racer left → race ends
      expect(checkRaceEnd(state)).toBe(true);
    });

    it('should end race when 2 racers have finished', () => {
      const state = makeRacingState();
      state.activeRacers[0].finished = true;
      state.activeRacers[0].finishOrder = 1;
      state.activeRacers[1].finished = true;
      state.activeRacers[1].finishOrder = 2;
      expect(checkRaceEnd(state)).toBe(true);
    });

    it('should end race when all racers are finished or eliminated', () => {
      const state = makeRacingState();
      state.activeRacers[0].finished = true;
      state.activeRacers[0].finishOrder = 1;
      state.activeRacers[1].eliminated = true;
      expect(checkRaceEnd(state)).toBe(true);
    });
  });

  describe('executeTurn (integration)', () => {
    it('should complete a full turn: roll → move → advance', () => {
      const state = makeRacingState();
      const result = executeTurn(state, 'p1', 3); // fixed dice for testing

      const racer = result.state.activeRacers.find(r => r.playerId === 'p1')!;
      expect(racer.position).toBe(3);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'DICE_ROLLED', playerId: 'p1', value: 3 })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'TURN_START', playerId: 'p1' })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'TURN_END', playerId: 'p1' })
      );
    });
  });
});
