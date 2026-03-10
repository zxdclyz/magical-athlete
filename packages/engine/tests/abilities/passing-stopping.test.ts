import { describe, it, expect } from 'vitest';
import { EventEngine } from '../../src/events.js';
import { createInitialState } from '../../src/state.js';
import { bananaHandler } from '../../src/abilities/banana.js';
import { centaurHandler } from '../../src/abilities/centaur.js';
import { babaYagaHandler } from '../../src/abilities/baba-yaga.js';
import { duelistHandler } from '../../src/abilities/duelist.js';
import { mouthHandler } from '../../src/abilities/mouth.js';
import { romanticHandler } from '../../src/abilities/romantic.js';
import { hugeBabyHandler } from '../../src/abilities/huge-baby.js';
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
  }));
  return state;
}

describe('Banana', () => {
  it('should trip a racer that passes Banana', () => {
    const engine = new EventEngine();
    engine.registerHandler(bananaHandler);
    const state = makeState([
      { racerName: 'alchemist', position: 0 },
      { racerName: 'banana', position: 3 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_PASSED', movingRacer: 'alchemist', passedRacer: 'banana', space: 3 },
      state,
    );
    expect(result.state.activeRacers[0].tripped).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_TRIPPED', racerName: 'alchemist' }),
    );
  });

  it('should not trip when another racer passes (not banana)', () => {
    const engine = new EventEngine();
    engine.registerHandler(bananaHandler);
    const state = makeState([
      { racerName: 'alchemist', position: 0 },
      { racerName: 'banana', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_PASSED', movingRacer: 'alchemist', passedRacer: 'coach', space: 3 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Centaur', () => {
  it('should kick passed racer back 2 spaces', () => {
    const engine = new EventEngine();
    engine.registerHandler(centaurHandler);
    const state = makeState([
      { racerName: 'centaur', position: 0 },
      { racerName: 'alchemist', position: 3 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_PASSED', movingRacer: 'centaur', passedRacer: 'alchemist', space: 3 },
      state,
    );
    expect(result.state.activeRacers[1].position).toBe(1); // 3-2=1
  });

  it('should not go below 0', () => {
    const engine = new EventEngine();
    engine.registerHandler(centaurHandler);
    const state = makeState([
      { racerName: 'centaur', position: 0 },
      { racerName: 'alchemist', position: 1 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_PASSED', movingRacer: 'centaur', passedRacer: 'alchemist', space: 1 },
      state,
    );
    expect(result.state.activeRacers[1].position).toBe(0);
  });
});

describe('Baba Yaga', () => {
  it('should trip racer that stops on her space', () => {
    const engine = new EventEngine();
    engine.registerHandler(babaYagaHandler);
    const state = makeState([
      { racerName: 'baba_yaga', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'alchemist', space: 5 },
      state,
    );
    expect(result.state.activeRacers[1].tripped).toBe(true);
  });

  it('should trip racers when Baba Yaga stops on their space', () => {
    const engine = new EventEngine();
    engine.registerHandler(babaYagaHandler);
    const state = makeState([
      { racerName: 'baba_yaga', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'baba_yaga', space: 5 },
      state,
    );
    expect(result.state.activeRacers[1].tripped).toBe(true);
  });
});

describe('Duelist', () => {
  it('should offer duel when someone stops on duelist space', () => {
    const engine = new EventEngine();
    engine.registerHandler(duelistHandler);
    const state = makeState([
      { racerName: 'duelist', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'alchemist', space: 5 },
      state,
    );
    expect(result.pendingDecision).toBeDefined();
    expect(result.pendingDecision!.request.type).toBe('USE_ABILITY');
  });

  it('should not duel when duelist stops (triggers on others only)', () => {
    const engine = new EventEngine();
    engine.registerHandler(duelistHandler);
    const state = makeState([
      { racerName: 'duelist', position: 5 },
      { racerName: 'alchemist', position: 3 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'duelist', space: 5 },
      state,
    );
    expect(result.pendingDecision).toBeNull();
  });
});

describe('M.O.U.T.H.', () => {
  it('should eliminate the only racer on the same space', () => {
    const engine = new EventEngine();
    engine.registerHandler(mouthHandler);
    const state = makeState([
      { racerName: 'mouth', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'mouth', space: 5 },
      state,
    );
    expect(result.state.activeRacers[1].eliminated).toBe(true);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_ELIMINATED', racerName: 'alchemist', byRacer: 'mouth' }),
    );
  });

  it('should not trigger when more than one other racer on space', () => {
    const engine = new EventEngine();
    engine.registerHandler(mouthHandler);
    const state = makeState([
      { racerName: 'mouth', position: 5 },
      { racerName: 'alchemist', position: 5 },
      { racerName: 'blimp', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'mouth', space: 5 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });

  it('should not trigger when others stop on MOUTH space (only when MOUTH stops)', () => {
    const engine = new EventEngine();
    engine.registerHandler(mouthHandler);
    const state = makeState([
      { racerName: 'mouth', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'alchemist', space: 5 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Romantic', () => {
  it('should move 2 when two racers share a space', () => {
    const engine = new EventEngine();
    engine.registerHandler(romanticHandler);
    const state = makeState([
      { racerName: 'romantic', position: 0 },
      { racerName: 'alchemist', position: 5 },
      { racerName: 'blimp', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'alchemist', space: 5 },
      state,
    );
    expect(result.state.activeRacers[0].position).toBe(2);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'ABILITY_TRIGGERED', racerName: 'romantic' }),
    );
  });

  it('should not trigger when 3 racers share a space', () => {
    const engine = new EventEngine();
    engine.registerHandler(romanticHandler);
    const state = makeState([
      { racerName: 'romantic', position: 0 },
      { racerName: 'alchemist', position: 5 },
      { racerName: 'blimp', position: 5 },
      { racerName: 'coach', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'alchemist', space: 5 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});

describe('Huge Baby', () => {
  it('should push racer to space behind', () => {
    const engine = new EventEngine();
    engine.registerHandler(hugeBabyHandler);
    const state = makeState([
      { racerName: 'huge_baby', position: 5 },
      { racerName: 'alchemist', position: 5 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'alchemist', space: 5 },
      state,
    );
    expect(result.state.activeRacers[1].position).toBe(4);
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: 'RACER_WARPED', racerName: 'alchemist', from: 5, to: 4 }),
    );
  });

  it('should allow sharing start space', () => {
    const engine = new EventEngine();
    engine.registerHandler(hugeBabyHandler);
    const state = makeState([
      { racerName: 'huge_baby', position: 0 },
      { racerName: 'alchemist', position: 0 },
    ]);

    const result = engine.processEvent(
      { type: 'RACER_STOPPED', racerName: 'alchemist', space: 0 },
      state,
    );
    expect(result.events).toHaveLength(0);
  });
});
