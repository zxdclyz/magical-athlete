import { describe, it, expect } from 'vitest';
import { processRacerChoice, allRacersChosen, hasPlayerChosen } from '../../src/phases/race-setup.js';
import { createInitialState } from '../../src/state.js';
import type { GameState, Player } from '../../src/types.js';

function makeRaceSetupState(): GameState {
  const players: Player[] = [
    { id: 'p1', name: 'P1', isAI: false, hand: ['alchemist', 'banana', 'centaur'], usedRacers: [] },
    { id: 'p2', name: 'P2', isAI: false, hand: ['blimp', 'coach', 'duelist'], usedRacers: [] },
  ];
  const state = createInitialState(players);
  state.players = players;
  state.phase = 'RACE_SETUP';
  return state;
}

describe('Race Setup Phase (simultaneous selection)', () => {
  it('should record a player choice without revealing', () => {
    const state = makeRaceSetupState();
    const result = processRacerChoice(state, 'p1', 'alchemist');

    expect(result.error).toBeUndefined();
    // Still in RACE_SETUP (waiting for p2)
    expect(result.state!.phase).toBe('RACE_SETUP');
    // Choice recorded
    expect(result.state!.raceSetupChoices['p1']).toBe('alchemist');
    // No activeRacers yet
    expect(result.state!.activeRacers).toHaveLength(0);
  });

  it('should reject choosing a racer not in hand', () => {
    const state = makeRaceSetupState();
    const result = processRacerChoice(state, 'p1', 'blimp');
    expect(result.error).toBeDefined();
  });

  it('should reject choosing an already used racer', () => {
    const state = makeRaceSetupState();
    state.players[0].usedRacers = ['alchemist'];
    const result = processRacerChoice(state, 'p1', 'alchemist');
    expect(result.error).toBeDefined();
  });

  it('should transition to RACING when all players have chosen (simultaneous reveal)', () => {
    let state = makeRaceSetupState();
    state = processRacerChoice(state, 'p1', 'alchemist').state!;
    expect(state.phase).toBe('RACE_SETUP'); // p2 hasn't chosen yet

    state = processRacerChoice(state, 'p2', 'blimp').state!;
    expect(state.phase).toBe('RACING'); // both chose → revealed
    expect(state.activeRacers).toHaveLength(2);
    expect(state.activeRacers[0].racerName).toBe('alchemist');
    expect(state.activeRacers[0].playerId).toBe('p1');
    expect(state.activeRacers[0].position).toBe(0);
    expect(state.activeRacers[1].racerName).toBe('blimp');
    // raceSetupChoices should be cleared
    expect(state.raceSetupChoices).toEqual({});
    // usedRacers updated
    expect(state.players[0].usedRacers).toContain('alchemist');
    expect(state.players[1].usedRacers).toContain('blimp');
  });

  it('should reject duplicate choice from same player', () => {
    let state = makeRaceSetupState();
    state = processRacerChoice(state, 'p1', 'alchemist').state!;
    const result = processRacerChoice(state, 'p1', 'banana');
    expect(result.error).toBeDefined();
  });

  it('sisyphus should get 4 point chips when entering race', () => {
    const players: Player[] = [
      { id: 'p1', name: 'P1', isAI: false, hand: ['sisyphus', 'banana'], usedRacers: [] },
      { id: 'p2', name: 'P2', isAI: false, hand: ['blimp', 'coach'], usedRacers: [] },
    ];
    let state = createInitialState(players);
    state.players = players;
    state.phase = 'RACE_SETUP';

    state = processRacerChoice(state, 'p1', 'sisyphus').state!;
    state = processRacerChoice(state, 'p2', 'blimp').state!;

    const sisyphus = state.activeRacers.find(r => r.racerName === 'sisyphus')!;
    expect(sisyphus.sisyphusChips).toBe(4);
  });

  it('hasPlayerChosen should work correctly', () => {
    let state = makeRaceSetupState();
    expect(hasPlayerChosen(state, 'p1')).toBe(false);
    state = processRacerChoice(state, 'p1', 'alchemist').state!;
    expect(hasPlayerChosen(state, 'p1')).toBe(true);
    expect(hasPlayerChosen(state, 'p2')).toBe(false);
  });

  it('should set turn order based on last race positions (farthest behind first)', () => {
    let state = makeRaceSetupState();
    // Simulate last race: p2 was farther behind than p1
    state.lastRacePositions = { p1: 15, p2: 5 };

    state = processRacerChoice(state, 'p1', 'alchemist').state!;
    state = processRacerChoice(state, 'p2', 'blimp').state!;

    // p2 should go first (was farther behind)
    expect(state.turnOrder[0]).toBe('p2');
    expect(state.turnOrder[1]).toBe('p1');
  });

  it('should randomize turn order for first race (no lastRacePositions)', () => {
    // Run multiple times — should contain both players in some order
    let state = makeRaceSetupState();
    state = processRacerChoice(state, 'p1', 'alchemist').state!;
    state = processRacerChoice(state, 'p2', 'blimp').state!;

    expect(state.turnOrder).toHaveLength(2);
    expect(state.turnOrder).toContain('p1');
    expect(state.turnOrder).toContain('p2');
  });
});
