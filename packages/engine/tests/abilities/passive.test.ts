import { describe, it, expect } from 'vitest';
import { EventEngine } from '../../src/events.js';
import { createInitialState } from '../../src/state.js';
import { alchemistHandler } from '../../src/abilities/alchemist.js';
import { blimpHandler } from '../../src/abilities/blimp.js';
import { coachHandler } from '../../src/abilities/coach.js';
import { gunkHandler } from '../../src/abilities/gunk.js';
import { hareMovementHandler, hareLeadHandler } from '../../src/abilities/hare.js';
import { lovableLoserHandler } from '../../src/abilities/lovable-loser.js';
import { sticklerHandler } from '../../src/abilities/stickler.js';
import { hecklerHandler } from '../../src/abilities/heckler.js';
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

describe('Alchemist', () => {
  it('should offer to change 1 or 2 to 4', () => {
    const engine = new EventEngine();
    engine.registerHandler(alchemistHandler);
    const state = makeState([{ racerName: 'alchemist', position: 0 }]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 2 },
      state,
    );
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('USE_ABILITY');
  });

  it('should not trigger on dice values 3-6', () => {
    const engine = new EventEngine();
    engine.registerHandler(alchemistHandler);
    const state = makeState([{ racerName: 'alchemist', position: 0 }]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 4 },
      state,
    );
    expect(result.pendingDecision).toBeNull();
  });

  it('should emit DICE_MODIFIED when decision is yes', () => {
    const engine = new EventEngine();
    engine.registerHandler(alchemistHandler);
    const state = makeState([{ racerName: 'alchemist', position: 0 }]);

    const result = engine.resumeAfterDecision(
      state,
      { type: 'USE_ABILITY', use: true },
      0,
      { type: 'DICE_ROLLED', playerId: 'p1', value: 1 },
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 4 }),
    );
  });
});

describe('Blimp', () => {
  it('should add +3 before second corner', () => {
    const engine = new EventEngine();
    engine.registerHandler(blimpHandler);
    const state = makeState([{ racerName: 'blimp', position: 5 }]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 3 },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 6 }),
    );
  });

  it('should subtract 1 after second corner', () => {
    const engine = new EventEngine();
    engine.registerHandler(blimpHandler);
    const state = makeState([{ racerName: 'blimp', position: 14 }]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 3 },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 2 }),
    );
  });
});

describe('Coach', () => {
  it('should add +1 when roller is on same space', () => {
    const engine = new EventEngine();
    engine.registerHandler(coachHandler);
    const state = makeState([
      { racerName: 'coach', position: 3 },
      { racerName: 'alchemist', position: 3 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 4 },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 5, reason: 'Coach' }),
    );
  });

  it('should add +1 to coach themselves', () => {
    const engine = new EventEngine();
    engine.registerHandler(coachHandler);
    const state = makeState([{ racerName: 'coach', position: 3 }]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 2 },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 3 }),
    );
  });

  it('should not trigger when roller is on different space', () => {
    const engine = new EventEngine();
    engine.registerHandler(coachHandler);
    const state = makeState([
      { racerName: 'coach', position: 3 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 4 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Gunk', () => {
  it('should subtract 1 from other racers', () => {
    const engine = new EventEngine();
    engine.registerHandler(gunkHandler);
    const state = makeState([
      { racerName: 'gunk', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 4 },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 3, reason: 'Gunk' }),
    );
  });

  it('should not affect gunk itself', () => {
    const engine = new EventEngine();
    engine.registerHandler(gunkHandler);
    const state = makeState([
      { racerName: 'gunk', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 4 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Hare', () => {
  it('should add +2 to movement', () => {
    const engine = new EventEngine();
    engine.registerHandler(hareMovementHandler);
    const state = makeState([{ racerName: 'hare', position: 0 }]);

    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 3 },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 5, reason: 'Hare' }),
    );
  });

  it('should gain bronze chip when alone in lead', () => {
    const engine = new EventEngine();
    engine.registerHandler(hareLeadHandler);
    const state = makeState([
      { racerName: 'hare', position: 10 },
      { racerName: 'alchemist', position: 3 },
    ]);

    const result = engine.processEvent(
      { type: 'TURN_START', playerId: 'p1' },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'POINT_CHIP_GAINED', chipType: 'bronze' }),
    );
    expect(result.state.scores['p1']).toBe(1);
  });

  it('should not skip when tied for lead', () => {
    const engine = new EventEngine();
    engine.registerHandler(hareLeadHandler);
    const state = makeState([
      { racerName: 'hare', position: 10 },
      { racerName: 'alchemist', position: 10 },
    ]);

    const result = engine.processEvent(
      { type: 'TURN_START', playerId: 'p1' },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Lovable Loser', () => {
  it('should gain bronze chip when alone in last', () => {
    const engine = new EventEngine();
    engine.registerHandler(lovableLoserHandler);
    const state = makeState([
      { racerName: 'lovable_loser', position: 0 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'TURN_START', playerId: 'p1' },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'POINT_CHIP_GAINED', chipType: 'bronze' }),
    );
    expect(result.state.scores['p1']).toBe(1);
  });

  it('should not trigger when tied for last', () => {
    const engine = new EventEngine();
    engine.registerHandler(lovableLoserHandler);
    const state = makeState([
      { racerName: 'lovable_loser', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'TURN_START', playerId: 'p1' },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Stickler', () => {
  it('should block overshooting finish for other racers via DICE_MODIFIED', () => {
    const engine = new EventEngine();
    engine.registerHandler(sticklerHandler);
    const state = makeState([
      { racerName: 'stickler', position: 5 },
      { racerName: 'alchemist', position: 25 },
    ]);
    // Track length 29 → finishIndex 28, remaining = 28-25 = 3, dice = 5 → overshoot
    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 5 },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 0, reason: 'Stickler' }),
    );
  });

  it('should allow exact finish', () => {
    const engine = new EventEngine();
    engine.registerHandler(sticklerHandler);
    const state = makeState([
      { racerName: 'stickler', position: 5 },
      { racerName: 'alchemist', position: 25 },
    ]);
    // Remaining = 28-25 = 3, dice = 3 → exact, no block
    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p2', value: 3 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });

  it('should not block stickler themselves', () => {
    const engine = new EventEngine();
    engine.registerHandler(sticklerHandler);
    const state = makeState([
      { racerName: 'stickler', position: 17 },
    ]);
    // Stickler's own dice roll — should not trigger
    const result = engine.processEvent(
      { type: 'DICE_ROLLED', playerId: 'p1', value: 5 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Heckler', () => {
  it('should move 2 when another racer barely moves', () => {
    const engine = new EventEngine();
    engine.registerHandler(hecklerHandler);
    const state = makeState([
      { racerName: 'heckler', position: 3 },
      { racerName: 'alchemist', position: 5 },
    ]);
    state.turnStartPositions = { p2: 5 }; // alchemist started at 5, still at 5

    const result = engine.processEvent(
      { type: 'TURN_END', playerId: 'p2' },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'ABILITY_TRIGGERED', racerName: 'heckler' }),
    );
    expect(result.state.activeRacers.find(r => r.racerName === 'heckler')!.position).toBe(5);
  });

  it('should trigger when racer moved only 1 space', () => {
    const engine = new EventEngine();
    engine.registerHandler(hecklerHandler);
    const state = makeState([
      { racerName: 'heckler', position: 0 },
      { racerName: 'alchemist', position: 6 },
    ]);
    state.turnStartPositions = { p2: 5 }; // moved from 5 to 6 = 1 space

    const result = engine.processEvent(
      { type: 'TURN_END', playerId: 'p2' },
      state,
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'ABILITY_TRIGGERED', racerName: 'heckler' }),
    );
  });

  it('should not trigger when racer moved more than 1 space', () => {
    const engine = new EventEngine();
    engine.registerHandler(hecklerHandler);
    const state = makeState([
      { racerName: 'heckler', position: 0 },
      { racerName: 'alchemist', position: 8 },
    ]);
    state.turnStartPositions = { p2: 5 }; // moved from 5 to 8 = 3 spaces

    const result = engine.processEvent(
      { type: 'TURN_END', playerId: 'p2' },
      state,
    );
    expect(result.events).toHaveLength(0);
  });

  it('should not trigger on own turn', () => {
    const engine = new EventEngine();
    engine.registerHandler(hecklerHandler);
    const state = makeState([
      { racerName: 'heckler', position: 0 },
    ]);
    state.turnStartPositions = { p1: 0 };

    const result = engine.processEvent(
      { type: 'TURN_END', playerId: 'p1' },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});
