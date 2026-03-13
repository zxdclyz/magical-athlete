import { describe, it, expect } from 'vitest';
import { assignRaceChips, getRaceResults, getFinalWinners } from '../../src/phases/scoring.js';
import { createInitialState } from '../../src/state.js';
import type { GameState, Player, ActiveRacer } from '../../src/types.js';

function makeRaceEndState(racers: Partial<ActiveRacer>[], overrides?: Partial<GameState>): GameState {
  const players: Player[] = racers.map((r, i) => ({
    id: `p${i + 1}`, name: `P${i + 1}`, isAI: false,
    hand: [r.racerName!], usedRacers: [r.racerName!],
  }));
  const state = createInitialState(players);
  state.players = players;
  state.phase = 'RACE_END' as any;
  state.turnOrder = players.map(p => p.id);
  state.activeRacers = racers.map((r, i) => ({
    racerName: r.racerName!, playerId: `p${i + 1}`,
    position: r.position ?? 0, tripped: false,
    finished: r.finished ?? false, finishOrder: r.finishOrder ?? null,
    eliminated: r.eliminated ?? false,
  }));
  return { ...state, ...overrides };
}

describe('Scoring', () => {
  describe('assignRaceChips', () => {
    it('should give gold chip to 1st place and silver to 2nd', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist', position: 19, finished: true, finishOrder: 1 },
        { racerName: 'blimp', position: 19, finished: true, finishOrder: 2 },
        { racerName: 'coach', position: 10 },
      ]);
      state.currentRace = 1;

      const result = assignRaceChips(state);
      expect(result.state.scores['p1']).toBe(7); // gold[0] = 7
      expect(result.state.scores['p2']).toBe(4); // silver[0] = 4
      expect(result.state.scores['p3']).toBe(0);
    });

    it('should use correct chip values for each race', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist', position: 19, finished: true, finishOrder: 1 },
        { racerName: 'blimp', position: 19, finished: true, finishOrder: 2 },
      ]);
      state.currentRace = 3; // 3rd race: gold[2]=5, silver[2]=2

      const result = assignRaceChips(state);
      expect(result.state.scores['p1']).toBe(5);
      expect(result.state.scores['p2']).toBe(2);
    });

    it('should add to existing scores (bronze chips accumulated)', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist', position: 19, finished: true, finishOrder: 1 },
        { racerName: 'blimp', position: 19, finished: true, finishOrder: 2 },
      ]);
      state.currentRace = 1;
      state.scores['p1'] = 3; // already had bronze chips

      const result = assignRaceChips(state);
      expect(result.state.scores['p1']).toBe(10); // 3 + 7
    });

    it('should record race winner', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist', position: 19, finished: true, finishOrder: 1 },
        { racerName: 'blimp', position: 19, finished: true, finishOrder: 2 },
      ]);
      state.currentRace = 1;

      const result = assignRaceChips(state);
      expect(result.state.raceWinners).toContain('alchemist');
    });
  });

  describe('getRaceResults', () => {
    it('should return 1st and 2nd place racers', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist', position: 19, finished: true, finishOrder: 2 },
        { racerName: 'blimp', position: 19, finished: true, finishOrder: 1 },
        { racerName: 'coach', position: 10 },
      ]);

      const results = getRaceResults(state);
      expect(results.first).toBe('blimp');
      expect(results.second).toBe('alchemist');
    });

    it('should handle case where only 1 finisher (rest eliminated)', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist', position: 19, finished: true, finishOrder: 1 },
        { racerName: 'blimp', position: 5, eliminated: true },
      ]);

      const results = getRaceResults(state);
      expect(results.first).toBe('alchemist');
      expect(results.second).toBeNull();
    });
  });

  describe('getFinalWinners', () => {
    it('should return player with highest score', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist' },
        { racerName: 'blimp' },
      ]);
      state.scores = { p1: 15, p2: 20 };

      const winners = getFinalWinners(state);
      expect(winners).toEqual(['p2']);
    });

    it('should return multiple winners on tie', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist' },
        { racerName: 'blimp' },
        { racerName: 'coach' },
      ]);
      state.scores = { p1: 15, p2: 15, p3: 5 };

      const winners = getFinalWinners(state);
      expect(winners).toHaveLength(2);
      expect(winners).toContain('p1');
      expect(winners).toContain('p2');
    });

    it('should handle all tied', () => {
      const state = makeRaceEndState([
        { racerName: 'alchemist' },
        { racerName: 'blimp' },
      ]);
      state.scores = { p1: 10, p2: 10 };

      const winners = getFinalWinners(state);
      expect(winners).toHaveLength(2);
    });
  });
});
