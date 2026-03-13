import { describe, it, expect } from 'vitest';
import { EventEngine } from '../../src/events.js';
import { createInitialState } from '../../src/state.js';
import { flipFlopHandler } from '../../src/abilities/flip-flop.js';
import { legsHandler } from '../../src/abilities/legs.js';
import { hypnotistHandler } from '../../src/abilities/hypnotist.js';
import { cheerleaderHandler } from '../../src/abilities/cheerleader.js';
import { thirdWheelHandler } from '../../src/abilities/third-wheel.js';
import { partyAnimalMoveHandler } from '../../src/abilities/party-animal.js';
import type { GameState, Player, ActiveRacer } from '../../src/types.js';

function makeState(racers: Partial<ActiveRacer>[]): GameState {
  const players: Player[] = racers.map((r, i) => ({
    id: `p${i + 1}`, name: `P${i + 1}`, isAI: false,
    hand: [r.racerName!], usedRacers: [r.racerName!],
  }));
  const state = createInitialState(players);
  state.players = players;
  state.phase = 'RACING';
  state.turnOrder = players.map(p => p.id);
  state.currentTurnIndex = 0;
  state.activeRacers = racers.map((r, i) => ({
    racerName: r.racerName!, playerId: `p${i + 1}`,
    position: r.position ?? 0, tripped: false,
    finished: r.finished ?? false, finishOrder: r.finishOrder ?? null,
    eliminated: r.eliminated ?? false,
  }));
  return state;
}

describe('Flip Flop', () => {
  it('should offer swap decision at turn start', () => {
    const engine = new EventEngine();
    engine.registerHandler(flipFlopHandler);
    const state = makeState([
      { racerName: 'flip_flop', position: 2 },
      { racerName: 'alchemist', position: 8 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('CHOOSE_TARGET_RACER');
  });

  it('should swap positions when decision made', () => {
    const engine = new EventEngine();
    engine.registerHandler(flipFlopHandler);
    const state = makeState([
      { racerName: 'flip_flop', position: 2 },
      { racerName: 'alchemist', position: 8 },
    ]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'CHOOSE_TARGET_RACER', targetRacer: 'alchemist' },
      0,
      { type: 'TURN_START', playerId: 'p1' },
    );
    expect(result.state.activeRacers[0].position).toBe(8);
    expect(result.state.activeRacers[1].position).toBe(2);
    expect(result.events).toContainEqual(expect.objectContaining({ type: 'RACER_SWAPPED' }));
  });
});

describe('Legs', () => {
  it('should offer move-5 decision', () => {
    const engine = new EventEngine();
    engine.registerHandler(legsHandler);
    const state = makeState([{ racerName: 'legs', position: 0 }]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('USE_ABILITY');
  });

  it('should move racer 5 spaces and set skipMainMove when accepted', () => {
    const engine = new EventEngine();
    engine.registerHandler(legsHandler);
    const state = makeState([{ racerName: 'legs', position: 0 }]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'USE_ABILITY', use: true },
      0,
      { type: 'TURN_START', playerId: 'p1' },
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_MOVING', racerName: 'legs', from: 0, to: 5 }),
    );
    expect(result.state.skipMainMove).toBe(true);
  });
});

describe('Hypnotist', () => {
  it('should offer warp decision', () => {
    const engine = new EventEngine();
    engine.registerHandler(hypnotistHandler);
    const state = makeState([
      { racerName: 'hypnotist', position: 3 },
      { racerName: 'alchemist', position: 10 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeDefined();
  });

  it('should warp target to hypnotist space', () => {
    const engine = new EventEngine();
    engine.registerHandler(hypnotistHandler);
    const state = makeState([
      { racerName: 'hypnotist', position: 3 },
      { racerName: 'alchemist', position: 10 },
    ]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'CHOOSE_TARGET_RACER', targetRacer: 'alchemist' },
      0,
      { type: 'TURN_START', playerId: 'p1' },
    );
    expect(result.state.activeRacers[1].position).toBe(3);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_WARPED', racerName: 'alchemist', to: 3 }),
    );
  });
});

describe('Cheerleader', () => {
  it('should move last-place racers 2 and self 1', () => {
    const engine = new EventEngine();
    engine.registerHandler(cheerleaderHandler);
    const state = makeState([
      { racerName: 'cheerleader', position: 5 },
      { racerName: 'alchemist', position: 0 },
      { racerName: 'blimp', position: 3 },
    ]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'USE_ABILITY', use: true },
      0,
      { type: 'TURN_START', playerId: 'p1' },
    );
    expect(result.state.activeRacers[1].position).toBe(2); // last place moved 2
    expect(result.state.activeRacers[0].position).toBe(6); // cheerleader moved 1
    expect(result.state.activeRacers[2].position).toBe(3); // blimp unchanged
  });
});

describe('Third Wheel', () => {
  it('should detect spaces with exactly 2 racers', () => {
    const engine = new EventEngine();
    engine.registerHandler(thirdWheelHandler);
    const state = makeState([
      { racerName: 'third_wheel', position: 0 },
      { racerName: 'alchemist', position: 5 },
      { racerName: 'blimp', position: 5 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('CHOOSE_TARGET_SPACE');
  });

  it('should warp to chosen space', () => {
    const engine = new EventEngine();
    engine.registerHandler(thirdWheelHandler);
    const state = makeState([
      { racerName: 'third_wheel', position: 0 },
      { racerName: 'alchemist', position: 5 },
      { racerName: 'blimp', position: 5 },
    ]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'CHOOSE_TARGET_SPACE', targetSpace: 5 },
      0,
      { type: 'TURN_START', playerId: 'p1' },
    );
    expect(result.state.activeRacers[0].position).toBe(5);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_WARPED', racerName: 'third_wheel', to: 5 }),
    );
  });

  it('should not trigger when no space has exactly 2 racers', () => {
    const engine = new EventEngine();
    engine.registerHandler(thirdWheelHandler);
    const state = makeState([
      { racerName: 'third_wheel', position: 0 },
      { racerName: 'alchemist', position: 5 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeNull();
  });
});

describe('Party Animal', () => {
  it('should move all racers 1 towards party animal', () => {
    const engine = new EventEngine();
    engine.registerHandler(partyAnimalMoveHandler);
    const state = makeState([
      { racerName: 'party_animal', position: 5 },
      { racerName: 'alchemist', position: 3 },
      { racerName: 'blimp', position: 8 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.state.activeRacers[1].position).toBe(4); // 3→4 towards 5
    expect(result.state.activeRacers[2].position).toBe(7); // 8→7 towards 5
  });

  it('should not move racers already on same space', () => {
    const engine = new EventEngine();
    engine.registerHandler(partyAnimalMoveHandler);
    const state = makeState([
      { racerName: 'party_animal', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.state.activeRacers[1].position).toBe(5);
  });
});
