import { describe, it, expect } from 'vitest';
import { GameController } from '../../src/game.js';
import { createInitialState } from '../../src/state.js';
import type { Player, GameState, RacerName } from '../../src/types.js';

function makePlayers(count: number, hands: RacerName[][]): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    isAI: false,
    hand: hands[i] || [],
    usedRacers: hands[i] ? [hands[i][0]] : [],
  }));
}

/** Create a RACING state with specific racers, bypassing draft. */
function makeRacingState(racers: { name: RacerName; playerId: string; position?: number }[]): GameState {
  const playerIds = [...new Set(racers.map(r => r.playerId))];
  const players = playerIds.map(id => ({
    id,
    name: id,
    isAI: false,
    hand: racers.filter(r => r.playerId === id).map(r => r.name),
    usedRacers: racers.filter(r => r.playerId === id).map(r => r.name),
  }));
  const state = createInitialState(players);
  return {
    ...state,
    phase: 'RACING' as const,
    activeRacers: racers.map(r => ({
      racerName: r.name,
      playerId: r.playerId,
      position: r.position ?? 0,
      tripped: false,
      finished: false,
      finishOrder: null,
      eliminated: false,
    })),
    turnOrder: playerIds,
    currentTurnIndex: 0,
  };
}

/**
 * Set up event engine and begin the first turn (TURN_START processing).
 * Returns the state after TURN_START has been processed.
 */
function setupAndBeginTurn(controller: GameController, state: GameState): { state: GameState; events: import('../../src/types.js').GameEvent[] } {
  (controller as any).setupRaceEventEngine(state);
  const result = (controller as any).beginNextTurn(state, []);
  return { state: result.state, events: result.events };
}

describe('Ability Integration through GameController', () => {
  it('Gunk should reduce other racers dice by 1', () => {
    const controller = new GameController();
    let state = makeRacingState([
      { name: 'gunk', playerId: 'p1', position: 0 },
      { name: 'alchemist', playerId: 'p2', position: 0 },
    ]);

    // Begin turn for p1 (TURN_START auto-processed), then roll dice
    const setup = setupAndBeginTurn(controller, state);
    state = setup.state;
    expect(state.pendingDecision).toBeNull(); // No TURN_START decision for gunk

    // p1 (gunk) rolls dice
    const r1 = controller.processAction(state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'ROLL_DICE', value: 4 },
    });
    expect(r1.error).toBeUndefined();
    state = r1.state;

    // p2 (alchemist) rolls 4, but gunk reduces it to 3
    const r2 = controller.processAction(state, 'p2', {
      type: 'MAKE_DECISION',
      decision: { type: 'ROLL_DICE', value: 4 },
    });
    expect(r2.error).toBeUndefined();

    // Check that DICE_MODIFIED was emitted
    const diceModified = r2.events.find(
      e => e.type === 'DICE_MODIFIED' && e.playerId === 'p2'
    );
    expect(diceModified).toBeDefined();
    if (diceModified && diceModified.type === 'DICE_MODIFIED') {
      expect(diceModified.newValue).toBe(3);
    }

    // Alchemist should be at position 3 (4 - 1 from gunk)
    const alchemist = r2.state.activeRacers.find(r => r.racerName === 'alchemist')!;
    expect(alchemist.position).toBe(3);
  });

  it('Hare lead should skip movement and gain chip when alone in front', () => {
    const controller = new GameController();
    let state = makeRacingState([
      { name: 'hare', playerId: 'p1', position: 10 },
      { name: 'alchemist', playerId: 'p2', position: 2 },
    ]);

    // Begin turn — Hare lead triggers at TURN_START (skipMainMove)
    const setup = setupAndBeginTurn(controller, state);

    // Hare should NOT have moved (skipMainMove skips dice entirely)
    const hare = setup.state.activeRacers.find(r => r.racerName === 'hare')!;
    expect(hare.position).toBe(10);

    // Should have gained a bronze chip
    const chipEvent = setup.events.find(e => e.type === 'POINT_CHIP_GAINED');
    expect(chipEvent).toBeDefined();

    // Ability triggered event should be present
    const abilityEvent = setup.events.find(
      e => e.type === 'ABILITY_TRIGGERED' && e.racerName === 'hare'
    );
    expect(abilityEvent).toBeDefined();
  });

  it('Flip Flop should pause for decision and resume with swap', () => {
    const controller = new GameController();
    let state = makeRacingState([
      { name: 'flip_flop', playerId: 'p1', position: 3 },
      { name: 'alchemist', playerId: 'p2', position: 10 },
    ]);

    // Begin turn — Flip Flop triggers TURN_START decision
    const setup = setupAndBeginTurn(controller, state);
    // Should be paused for decision (from beginNextTurn)
    expect(setup.state.pendingDecision).not.toBeNull();
    expect(setup.state.pendingDecision!.request.type).toBe('CHOOSE_TARGET_RACER');

    // Make the decision — swap with alchemist
    const r2 = controller.processAction(setup.state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'CHOOSE_TARGET_RACER', targetRacer: 'alchemist' },
    });
    expect(r2.error).toBeUndefined();

    // Flip Flop should now be at position 10 (alchemist's old position)
    const flipFlop = r2.state.activeRacers.find(r => r.racerName === 'flip_flop')!;
    expect(flipFlop.position).toBe(10);

    // Alchemist should be at position 3 (flip flop's old position)
    const alchemist = r2.state.activeRacers.find(r => r.racerName === 'alchemist')!;
    expect(alchemist.position).toBe(3);

    // pendingDecision should be cleared (turn was skipped due to skipMainMove)
    expect(r2.state.pendingDecision).toBeNull();
  });

  it('Banana should trip racers that pass it', () => {
    const controller = new GameController();
    let state = makeRacingState([
      { name: 'alchemist', playerId: 'p1', position: 0 },
      { name: 'banana', playerId: 'p2', position: 3 },
    ]);

    const setup = setupAndBeginTurn(controller, state);
    state = setup.state;

    // p1 moves past banana at position 3
    const result = controller.processAction(state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'ROLL_DICE', value: 5 },
    });
    expect(result.error).toBeUndefined();

    // Banana ability should have triggered — p1 should be tripped
    const alchemist = result.state.activeRacers.find(r => r.racerName === 'alchemist')!;
    expect(alchemist.tripped).toBe(true);
  });

  it('Coach should give +1 to racers on same space', () => {
    const controller = new GameController();
    let state = makeRacingState([
      { name: 'alchemist', playerId: 'p1', position: 5 },
      { name: 'coach', playerId: 'p2', position: 5 },
    ]);

    const setup = setupAndBeginTurn(controller, state);
    state = setup.state;

    // p1 (alchemist) rolls 3 from position 5, coach is also at 5 → +1 = moves 4
    const result = controller.processAction(state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'ROLL_DICE', value: 3 },
    });
    expect(result.error).toBeUndefined();

    const alchemist = result.state.activeRacers.find(r => r.racerName === 'alchemist')!;
    // Coach gives +1, so 3+1=4 from position 5 = position 9
    expect(alchemist.position).toBe(9);
  });

  it('Genius should pause for prediction before dice roll', () => {
    const controller = new GameController();
    let state = makeRacingState([
      { name: 'genius', playerId: 'p1', position: 0 },
      { name: 'alchemist', playerId: 'p2', position: 0 },
    ]);

    // Begin turn — Genius triggers TURN_START decision (predict dice) BEFORE rolling
    const setup = setupAndBeginTurn(controller, state);
    expect(setup.state.pendingDecision).not.toBeNull();
    expect(setup.state.pendingDecision!.request.type).toBe('PREDICT_DICE');

    // Predict 4
    const r2 = controller.processAction(setup.state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'PREDICT_DICE', prediction: 4 },
    });
    expect(r2.error).toBeUndefined();
    // After prediction, TURN_START resolved — now waiting for ROLL_DICE
    expect(r2.state.pendingDecision).toBeNull();

    // Now roll 4 (matches prediction)
    const r3 = controller.processAction(r2.state, 'p1', {
      type: 'MAKE_DECISION',
      decision: { type: 'ROLL_DICE', value: 4 },
    });
    expect(r3.error).toBeUndefined();

    // Should have granted extra turn since prediction matched dice value
    const geniusTriggered = r3.events.some(
      e => e.type === 'ABILITY_TRIGGERED' && e.racerName === 'genius' && e.description.includes('猜对')
    );
    expect(geniusTriggered).toBe(true);
  });
});
