import { describe, it, expect } from 'vitest';
import { EventEngine } from '../../src/events.js';
import { createInitialState } from '../../src/state.js';
import { inchwormHandler } from '../../src/abilities/inchworm.js';
import { lackeyHandler } from '../../src/abilities/lackey.js';
import { skipperHandler } from '../../src/abilities/skipper.js';
import { sisyphusHandler } from '../../src/abilities/sisyphus.js';
import { dicemongerHandler } from '../../src/abilities/dicemonger.js';
import type { GameState, Player, ActiveRacer } from '../../src/types.js';

function makeState(racers: Partial<ActiveRacer>[]): GameState {
  const players: Player[] = racers.map((r, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    isAI: false,
    hand: [r.racerName!],
    usedRacers: [r.racerName!],
  }));
  const state = createInitialState(players);
  state.players = players;
  state.phase = 'RACING';
  state.turnOrder = players.map(p => p.id);
  state.currentTurnIndex = 0;
  state.activeRacers = racers.map((r, i) => ({
    racerName: r.racerName!,
    playerId: `p${i + 1}`,
    position: r.position ?? 0,
    tripped: r.tripped ?? false,
    finished: r.finished ?? false,
    finishOrder: r.finishOrder ?? null,
    eliminated: r.eliminated ?? false,
    ...('sisyphusChips' in r ? { sisyphusChips: r.sisyphusChips } : {}),
  }));
  return state;
}

describe('Inchworm', () => {
  it('should move 1 when another racer rolls a 1', () => {
    const engine = new EventEngine();
    engine.registerHandler(inchwormHandler);
    const state = makeState([
      { racerName: 'inchworm', position: 3 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 1 },
      state,
    );
    expect(result.state.activeRacers[0].position).toBe(4);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'ABILITY_TRIGGERED', racerName: 'inchworm' }),
    );
  });

  it('should not trigger on own roll of 1', () => {
    const engine = new EventEngine();
    engine.registerHandler(inchwormHandler);
    const state = makeState([
      { racerName: 'inchworm', position: 3 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 1 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });

  it('should not trigger on rolls other than 1', () => {
    const engine = new EventEngine();
    engine.registerHandler(inchwormHandler);
    const state = makeState([
      { racerName: 'inchworm', position: 3 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 3 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Lackey', () => {
  it('should move 2 when another racer rolls a 6', () => {
    const engine = new EventEngine();
    engine.registerHandler(lackeyHandler);
    const state = makeState([
      { racerName: 'lackey', position: 5 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 6 },
      state,
    );
    expect(result.state.activeRacers[0].position).toBe(7);
  });

  it('should not trigger on own roll', () => {
    const engine = new EventEngine();
    engine.registerHandler(lackeyHandler);
    const state = makeState([
      { racerName: 'lackey', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 6 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Skipper', () => {
  it('should set skipperNextPlayerId when anyone rolls 1', () => {
    const engine = new EventEngine();
    engine.registerHandler(skipperHandler);
    const state = makeState([
      { racerName: 'skipper', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 1 },
      state,
    );
    expect(result.state.skipperNextPlayerId).toBe('p1');
  });

  it('should not trigger on non-1 rolls', () => {
    const engine = new EventEngine();
    engine.registerHandler(skipperHandler);
    const state = makeState([
      { racerName: 'skipper', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 4 },
      state,
    );
    expect(result.state.skipperNextPlayerId).toBeNull();
  });
});

describe('Sisyphus', () => {
  it('should warp to start and lose a chip on roll of 6', () => {
    const engine = new EventEngine();
    engine.registerHandler(sisyphusHandler);
    const state = makeState([
      { racerName: 'sisyphus', position: 10, sisyphusChips: 4 },
    ]);
    state.scores['p1'] = 4;

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 6 },
      state,
    );
    expect(result.state.activeRacers[0].position).toBe(0);
    expect(result.state.activeRacers[0].sisyphusChips).toBe(3);
    expect(result.state.scores['p1']).toBe(3);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_WARPED', racerName: 'sisyphus', from: 10, to: 0 }),
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 0, reason: 'Sisyphus' }),
    );
  });

  it('should not trigger on non-6 rolls', () => {
    const engine = new EventEngine();
    engine.registerHandler(sisyphusHandler);
    const state = makeState([
      { racerName: 'sisyphus', position: 10, sisyphusChips: 4 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 3 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });

  it('should not lose chip when at 0 chips', () => {
    const engine = new EventEngine();
    engine.registerHandler(sisyphusHandler);
    const state = makeState([
      { racerName: 'sisyphus', position: 10, sisyphusChips: 0 },
    ]);
    state.scores['p1'] = 0;

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 6 },
      state,
    );
    expect(result.state.activeRacers[0].sisyphusChips).toBe(0);
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: 'POINT_CHIP_LOST' }),
    );
  });
});

describe('Dicemonger', () => {
  it('should offer reroll to any roller', () => {
    const engine = new EventEngine();
    engine.registerHandler(dicemongerHandler);
    const state = makeState([
      { racerName: 'dicemonger', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 3 },
      state,
    );
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('REROLL_DICE');
  });

  it('should move 1 when another racer rerolls', () => {
    const engine = new EventEngine();
    engine.registerHandler(dicemongerHandler);
    const state = makeState([
      { racerName: 'dicemonger', position: 5 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.resumeAfterDecision(
      state,
      { type: 'REROLL_DICE', reroll: true },
      0,
      { type: 'DICE_ROLLED', playerId: 'p2', value: 3 },
    );
    expect(result.state.activeRacers[0].position).toBe(6);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', reason: 'Dicemonger reroll' }),
    );
  });
});
