import { describe, it, expect } from 'vitest';
import { processRacerChoice, allRacersChosen } from '../../src/phases/race-setup.js';
import { createInitialState } from '../../src/state.js';
import type { GameState, Player } from '../../src/types.js';

function makeRaceSetupState(): GameState {
  const players: Player[] = [
    { id: 'p1', name: 'P1', isAI: false, hand: ['alchemist', 'banana', 'centaur'], usedRacers: [] },
    { id: 'p2', name: 'P2', isAI: false, hand: ['blimp', 'coach', 'dragon' as any], usedRacers: [] },
  ];
  const state = createInitialState(players);
  // Manually fix hand since createInitialState doesn't set hands
  state.players = players;
  state.phase = 'RACE_SETUP';
  return state;
}

describe('Race Setup Phase', () => {
  it('should allow a player to choose a racer from their hand', () => {
    const state = makeRaceSetupState();
    const result = processRacerChoice(state, 'p1', 'alchemist');

    expect(result.error).toBeUndefined();
    const p1 = result.state!.players.find(p => p.id === 'p1')!;
    expect(p1.usedRacers).toContain('alchemist');
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

  it('should transition to RACING when all players have chosen', () => {
    let state = makeRaceSetupState();
    const r1 = processRacerChoice(state, 'p1', 'alchemist');
    state = r1.state!;
    const r2 = processRacerChoice(state, 'p2', 'blimp');
    state = r2.state!;

    expect(state.phase).toBe('RACING');
    expect(state.activeRacers).toHaveLength(2);
    expect(state.activeRacers[0].racerName).toBe('alchemist');
    expect(state.activeRacers[0].playerId).toBe('p1');
    expect(state.activeRacers[0].position).toBe(0); // start
    expect(state.activeRacers[0].tripped).toBe(false);
    expect(state.activeRacers[0].finished).toBe(false);
  });

  it('should not transition until all players choose', () => {
    let state = makeRaceSetupState();
    const r1 = processRacerChoice(state, 'p1', 'banana');
    expect(r1.state!.phase).toBe('RACE_SETUP');
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
});
