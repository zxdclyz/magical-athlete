import { describe, it, expect } from 'vitest';
import { EventEngine } from '../../src/events.js';
import { createInitialState } from '../../src/state.js';
import { magicianHandler } from '../../src/abilities/magician.js';
import { rocketScientistHandler } from '../../src/abilities/rocket-scientist.js';
import { geniusHandler } from '../../src/abilities/genius.js';
import { mastermindHandler, mastermindCheckHandler } from '../../src/abilities/mastermind.js';
import { copyCatHandler } from '../../src/abilities/copy-cat.js';
import { leaptoadHandler } from '../../src/abilities/leaptoad.js';
import { suckerfishHandler } from '../../src/abilities/suckerfish.js';
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
    ...(r.copiedAbility ? { copiedAbility: r.copiedAbility } : {}),
    ...(r.mastermindPrediction ? { mastermindPrediction: r.mastermindPrediction } : {}),
  }));
  return state;
}

describe('Magician', () => {
  it('should offer reroll on own dice roll', () => {
    const engine = new EventEngine();
    engine.registerHandler(magicianHandler);
    const state = makeState([{ racerName: 'magician', position: 0 }]);
    const result = engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 2 }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('REROLL_DICE');
  });

  it('should emit DICE_MODIFIED on reroll', () => {
    const engine = new EventEngine();
    engine.registerHandler(magicianHandler);
    const state = makeState([{ racerName: 'magician', position: 0 }]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'REROLL_DICE', reroll: true },
      0,
      { type: 'DICE_ROLLED', playerId: 'p1', value: 2 },
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', reason: 'Magician reroll 1' }),
    );
  });

  it('should not trigger on other players dice', () => {
    const engine = new EventEngine();
    engine.registerHandler(magicianHandler);
    const state = makeState([
      { racerName: 'magician', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p2', value: 2 }, state);
    expect(result.pendingDecision).toBeNull();
  });
});

describe('Rocket Scientist', () => {
  it('should offer double option', () => {
    const engine = new EventEngine();
    engine.registerHandler(rocketScientistHandler);
    const state = makeState([{ racerName: 'rocket_scientist', position: 0 }]);
    const result = engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 4 }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('USE_ABILITY');
  });

  it('should double dice and trip on accept', () => {
    const engine = new EventEngine();
    engine.registerHandler(rocketScientistHandler);
    const state = makeState([{ racerName: 'rocket_scientist', position: 0 }]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'USE_ABILITY', use: true },
      0,
      { type: 'DICE_ROLLED', playerId: 'p1', value: 4 },
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'DICE_MODIFIED', newValue: 8 }),
    );
    expect(result.state.activeRacers[0].tripped).toBe(true);
  });
});

describe('Genius', () => {
  it('should ask for prediction at turn start', () => {
    const engine = new EventEngine();
    engine.registerHandler(geniusHandler);
    const state = makeState([{ racerName: 'genius', position: 0 }]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('PREDICT_DICE');
  });
});

describe('Mastermind', () => {
  it('should ask for winner prediction on first turn', () => {
    const engine = new EventEngine();
    engine.registerHandler(mastermindHandler);
    const state = makeState([
      { racerName: 'mastermind', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('PREDICT_WINNER');
  });

  it('should store prediction after decision', () => {
    const engine = new EventEngine();
    engine.registerHandler(mastermindHandler);
    const state = makeState([
      { racerName: 'mastermind', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'PREDICT_WINNER', targetRacer: 'alchemist' },
      0,
      { type: 'TURN_START', playerId: 'p1' },
    );
    const mm = result.state.activeRacers.find(r => r.racerName === 'mastermind')!;
    expect(mm.mastermindPrediction).toBe('alchemist');
  });

  it('should include mastermind in prediction candidates', () => {
    const engine = new EventEngine();
    engine.registerHandler(mastermindHandler);
    const state = makeState([
      { racerName: 'mastermind', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.candidates).toContain('mastermind');
  });

  it('should give mastermind 2nd place when self-prediction correct', () => {
    const engine = new EventEngine();
    engine.registerHandler(mastermindCheckHandler);
    const state = makeState([
      { racerName: 'mastermind', position: 0, mastermindPrediction: 'mastermind' as any },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent(
      { type: 'RACER_FINISHED', racerName: 'mastermind', place: 1 },
      state,
    );
    const mm = result.state.activeRacers.find(r => r.racerName === 'mastermind')!;
    expect(mm.finished).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_FINISHED', racerName: 'mastermind', place: 2 }),
    );
  });

  it('should not trigger after first turn (prediction already stored)', () => {
    const engine = new EventEngine();
    engine.registerHandler(mastermindHandler);
    const state = makeState([
      { racerName: 'mastermind', position: 0, mastermindPrediction: 'alchemist' as any },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    expect(result.pendingDecision).toBeNull();
  });
});

describe('Copy Cat', () => {
  it('should copy the leading racer ability', () => {
    const engine = new EventEngine();
    engine.registerHandler(copyCatHandler);
    const state = makeState([
      { racerName: 'copy_cat', position: 0 },
      { racerName: 'alchemist', position: 10 },
      { racerName: 'blimp', position: 5 },
    ]);
    const result = engine.processEvent({ type: 'TURN_START', playerId: 'p1' }, state);
    const cc = result.state.activeRacers.find(r => r.racerName === 'copy_cat')!;
    expect(cc.copiedAbility).toBe('alchemist');
  });
});

describe('Leaptoad', () => {
  it('should skip occupied spaces during movement', () => {
    const engine = new EventEngine();
    engine.registerHandler(leaptoadHandler);
    const state = makeState([
      { racerName: 'leaptoad', position: 0 },
      { racerName: 'alchemist', position: 1 },
      { racerName: 'blimp', position: 2 },
    ]);
    // Moving from 0, dice=3, normally lands on 3.
    // But spaces 1 and 2 are occupied, so leaptoad skips them.
    // Step 1: pos=1 (occupied, skip, don't decrement). Step 2: pos=2 (occupied, skip).
    // Step 3: pos=3 (empty, decrement→2). Step 4: pos=4 (empty, decrement→1). Step 5: pos=5 (empty, decrement→0).
    // Result: position 5
    const result = engine.processEvent(
      { type: 'RACER_MOVING', racerName: 'leaptoad', from: 0, to: 3, isMainMove: true },
      state,
    );
    expect(result.state.activeRacers[0].position).toBe(5);
  });

  it('should skip occupied spaces when moving backwards', () => {
    const engine = new EventEngine();
    engine.registerHandler(leaptoadHandler);

    // Leaptoad at 10, moving back 3 steps. Position 9 is occupied.
    const state = makeState([
      { racerName: 'leaptoad', position: 10 },
      { racerName: 'alchemist', position: 9 },
      { racerName: 'blimp', position: 5 },
    ]);

    // Move from 10 to 7 (back 3 steps)
    const result = engine.processEvent(
      { type: 'RACER_MOVING', racerName: 'leaptoad', from: 10, to: 7, isMainMove: true },
      state,
    );

    // Position 9 occupied → skip. Steps: 10→9(skip)→8(1)→7(2)→6(3)
    const leaptoad = result.state.activeRacers.find(r => r.racerName === 'leaptoad')!;
    expect(leaptoad.position).toBe(6);
  });

  it('should still skip forward normally', () => {
    const engine = new EventEngine();
    engine.registerHandler(leaptoadHandler);

    const state = makeState([
      { racerName: 'leaptoad', position: 5 },
      { racerName: 'alchemist', position: 7 },
      { racerName: 'blimp', position: 3 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_MOVING', racerName: 'leaptoad', from: 5, to: 9, isMainMove: true },
      state,
    );

    // Position 7 occupied → skip. Steps: 5→6(1)→7(skip)→8(2)→9(3)→10(4)
    const leaptoad = result.state.activeRacers.find(r => r.racerName === 'leaptoad')!;
    expect(leaptoad.position).toBe(10);
  });

  it('should not change position when no occupied spaces in path', () => {
    const engine = new EventEngine();
    engine.registerHandler(leaptoadHandler);
    const state = makeState([
      { racerName: 'leaptoad', position: 0 },
      { racerName: 'alchemist', position: 10 },
    ]);
    const result = engine.processEvent(
      { type: 'RACER_MOVING', racerName: 'leaptoad', from: 0, to: 3, isMainMove: true },
      state,
    );
    expect(result.events).toHaveLength(0); // No change needed
  });
});

describe('Suckerfish', () => {
  it('should offer to follow racer leaving shared space', () => {
    const engine = new EventEngine();
    engine.registerHandler(suckerfishHandler);
    const state = makeState([
      { racerName: 'suckerfish', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);
    const result = engine.processEvent(
      { type: 'RACER_MOVING', racerName: 'alchemist', from: 5, to: 8, isMainMove: true },
      state,
    );
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('USE_ABILITY');
  });

  it('should follow to new space on accept', () => {
    const engine = new EventEngine();
    engine.registerHandler(suckerfishHandler);
    const state = makeState([
      { racerName: 'suckerfish', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'USE_ABILITY', use: true },
      0,
      { type: 'RACER_MOVING', racerName: 'alchemist', from: 5, to: 8, isMainMove: true },
    );
    expect(result.state.activeRacers[0].position).toBe(8);
  });

  it('should not trigger when racer was not on same space', () => {
    const engine = new EventEngine();
    engine.registerHandler(suckerfishHandler);
    const state = makeState([
      { racerName: 'suckerfish', position: 3 },
      { racerName: 'alchemist', position: 5 },
    ]);
    const result = engine.processEvent(
      { type: 'RACER_MOVING', racerName: 'alchemist', from: 5, to: 8, isMainMove: true },
      state,
    );
    expect(result.pendingDecision).toBeNull();
  });
});
