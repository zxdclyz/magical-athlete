import { describe, it, expect } from 'vitest';
import { EventEngine } from '../../src/events.js';
import { createInitialState } from '../../src/state.js';
import { eggHandler } from '../../src/abilities/egg.js';
import { twinHandler } from '../../src/abilities/twin.js';
import { scoocherHandler } from '../../src/abilities/scoocher.js';
import type { GameState, Player, ActiveRacer } from '../../src/types.js';

function makeState(racers: Partial<ActiveRacer>[], overrides?: Partial<GameState>): GameState {
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
  return { ...state, ...overrides };
}

describe('Egg', () => {
  it('should offer ability choice when race starts', () => {
    const engine = new EventEngine();
    engine.registerHandler(eggHandler);
    const state = makeState([
      { racerName: 'egg', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent({ type: 'PHASE_CHANGED', phase: 'RACING' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('CHOOSE_COPIED_ABILITY');
  });

  it('should copy chosen ability', () => {
    const engine = new EventEngine();
    engine.registerHandler(eggHandler);
    const state = makeState([
      { racerName: 'egg', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.resumeAfterDecision(
      state,
      { type: 'CHOOSE_COPIED_ABILITY', racerName: 'blimp' },
      0,
      { type: 'PHASE_CHANGED', phase: 'RACING' },
    );
    const egg = result.state.activeRacers.find(r => r.racerName === 'egg')!;
    expect(egg.copiedAbility).toBe('blimp');
  });
});

describe('Twin', () => {
  it('should offer previous winners to copy', () => {
    const engine = new EventEngine();
    engine.registerHandler(twinHandler);
    const state = makeState(
      [{ racerName: 'twin', position: 0 }, { racerName: 'alchemist', position: 0 }],
      { raceWinners: ['blimp', 'coach'] },
    );
    const result = engine.processEvent({ type: 'PHASE_CHANGED', phase: 'RACING' }, state);
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('CHOOSE_COPIED_ABILITY');
  });

  it('should not trigger when no previous winners', () => {
    const engine = new EventEngine();
    engine.registerHandler(twinHandler);
    const state = makeState([
      { racerName: 'twin', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent({ type: 'PHASE_CHANGED', phase: 'RACING' }, state);
    expect(result.pendingDecision).toBeNull();
  });

  it('should copy chosen winner ability', () => {
    const engine = new EventEngine();
    engine.registerHandler(twinHandler);
    const state = makeState(
      [{ racerName: 'twin', position: 0 }, { racerName: 'alchemist', position: 0 }],
      { raceWinners: ['blimp'] },
    );
    const result = engine.resumeAfterDecision(
      state,
      { type: 'CHOOSE_COPIED_ABILITY', racerName: 'blimp' },
      0,
      { type: 'PHASE_CHANGED', phase: 'RACING' },
    );
    const twin = result.state.activeRacers.find(r => r.racerName === 'twin')!;
    expect(twin.copiedAbility).toBe('blimp');
  });
});

describe('Scoocher', () => {
  it('should move 1 when another racer ability triggers', () => {
    const engine = new EventEngine();
    engine.registerHandler(scoocherHandler);
    const state = makeState([
      { racerName: 'scoocher', position: 3 },
      { racerName: 'alchemist', position: 0 },
    ]);
    const result = engine.processEvent(
      { type: 'ABILITY_TRIGGERED', racerName: 'alchemist', abilityName: 'Alchemist', description: 'test' },
      state,
    );
    expect(result.state.activeRacers[0].position).toBe(4);
  });

  it('should not trigger on own ability', () => {
    const engine = new EventEngine();
    engine.registerHandler(scoocherHandler);
    const state = makeState([
      { racerName: 'scoocher', position: 3 },
    ]);
    const result = engine.processEvent(
      { type: 'ABILITY_TRIGGERED', racerName: 'scoocher', abilityName: 'Scoocher', description: 'test' },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});
