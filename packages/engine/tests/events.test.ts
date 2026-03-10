import { describe, it, expect } from 'vitest';
import { EventEngine } from '../src/events.js';
import type { AbilityHandler } from '../src/events.js';
import { createInitialState } from '../src/state.js';
import type { GameState, GameEvent, Player } from '../src/types.js';

function makeRacingState(): GameState {
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
  return state;
}

describe('EventEngine', () => {
  it('should trigger handler for matching event type', () => {
    const engine = new EventEngine();
    let triggered = false;

    const handler: AbilityHandler = {
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        triggered = true;
        return { state, events: [] };
      },
    };
    engine.registerHandler(handler);

    const state = makeRacingState();
    const event: GameEvent = { type: 'DICE_ROLLED', playerId: 'p1', value: 2 };
    engine.processEvent(event, state);
    expect(triggered).toBe(true);
  });

  it('should not trigger handler for non-matching event type', () => {
    const engine = new EventEngine();
    let triggered = false;

    const handler: AbilityHandler = {
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        triggered = true;
        return { state, events: [] };
      },
    };
    engine.registerHandler(handler);

    const state = makeRacingState();
    const event: GameEvent = { type: 'TURN_START', playerId: 'p1' };
    engine.processEvent(event, state);
    expect(triggered).toBe(false);
  });

  it('should respect shouldTrigger returning false', () => {
    const engine = new EventEngine();
    let triggered = false;

    const handler: AbilityHandler = {
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => false,
      execute: (_event, state) => {
        triggered = true;
        return { state, events: [] };
      },
    };
    engine.registerHandler(handler);

    const state = makeRacingState();
    const event: GameEvent = { type: 'DICE_ROLLED', playerId: 'p1', value: 2 };
    engine.processEvent(event, state);
    expect(triggered).toBe(false);
  });

  it('should execute handlers in priority order (lower number first)', () => {
    const engine = new EventEngine();
    const order: string[] = [];

    engine.registerHandler({
      racerName: 'blimp',
      eventTypes: ['DICE_ROLLED'],
      priority: 20,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        order.push('blimp');
        return { state, events: [] };
      },
    });

    engine.registerHandler({
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        order.push('alchemist');
        return { state, events: [] };
      },
    });

    const state = makeRacingState();
    engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 2 }, state);
    expect(order).toEqual(['alchemist', 'blimp']);
  });

  it('should handle chain triggering (events from handlers trigger more handlers)', () => {
    const engine = new EventEngine();
    const triggered: string[] = [];

    engine.registerHandler({
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        triggered.push('alchemist');
        return {
          state,
          events: [{ type: 'RACER_TRIPPED', racerName: 'blimp' }],
        };
      },
    });

    engine.registerHandler({
      racerName: 'blimp',
      eventTypes: ['RACER_TRIPPED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        triggered.push('blimp-on-trip');
        return { state, events: [] };
      },
    });

    const state = makeRacingState();
    engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 2 }, state);
    expect(triggered).toEqual(['alchemist', 'blimp-on-trip']);
  });

  it('should prevent infinite loops (same ability + same event type blocked per move)', () => {
    const engine = new EventEngine();
    let triggerCount = 0;

    engine.registerHandler({
      racerName: 'alchemist',
      eventTypes: ['RACER_TRIPPED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        triggerCount++;
        // This would cause infinite loop without protection
        return {
          state,
          events: [{ type: 'RACER_TRIPPED', racerName: 'alchemist' }],
        };
      },
    });

    const state = makeRacingState();
    engine.processEvent({ type: 'RACER_TRIPPED', racerName: 'alchemist' }, state);
    expect(triggerCount).toBe(1); // Only triggers once
  });

  it('should return accumulated events and final state', () => {
    const engine = new EventEngine();

    engine.registerHandler({
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        return {
          state,
          events: [{ type: 'ABILITY_TRIGGERED', racerName: 'alchemist', abilityName: 'alchemist', description: 'test' }],
        };
      },
    });

    const state = makeRacingState();
    const result = engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 2 }, state);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'ABILITY_TRIGGERED', racerName: 'alchemist' })
    );
  });

  it('should detect decision requests and pause', () => {
    const engine = new EventEngine();

    engine.registerHandler({
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      getDecisionRequest: () => ({
        type: 'USE_ABILITY',
        racerName: 'alchemist',
        abilityDescription: 'Change to 4?',
      }),
      execute: (_event, state, decision) => {
        return { state, events: [] };
      },
    });

    const state = makeRacingState();
    const result = engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 2 }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('USE_ABILITY');
  });

  it('should only trigger handlers for racers in the active race', () => {
    const engine = new EventEngine();
    let triggered = false;

    engine.registerHandler({
      racerName: 'coach', // not in active racers
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        triggered = true;
        return { state, events: [] };
      },
    });

    const state = makeRacingState();
    engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 2 }, state);
    expect(triggered).toBe(false);
  });

  it('should skip handlers for eliminated racers', () => {
    const engine = new EventEngine();
    let triggered = false;

    engine.registerHandler({
      racerName: 'alchemist',
      eventTypes: ['DICE_ROLLED'],
      priority: 10,
      shouldTrigger: () => true,
      execute: (_event, state) => {
        triggered = true;
        return { state, events: [] };
      },
    });

    const state = makeRacingState();
    state.activeRacers[0].eliminated = true;
    engine.processEvent({ type: 'DICE_ROLLED', playerId: 'p1', value: 2 }, state);
    expect(triggered).toBe(false);
  });
});
