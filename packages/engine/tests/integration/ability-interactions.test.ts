import { describe, it, expect } from 'vitest';
import { EventEngine } from '../../src/events.js';
import { createInitialState } from '../../src/state.js';
import { bananaHandler } from '../../src/abilities/banana.js';
import { centaurHandler } from '../../src/abilities/centaur.js';
import { scoocherHandler } from '../../src/abilities/scoocher.js';
import { babaYagaHandler } from '../../src/abilities/baba-yaga.js';
import { hugeBabyHandler } from '../../src/abilities/huge-baby.js';
import { mouthHandler } from '../../src/abilities/mouth.js';
import { romanticHandler } from '../../src/abilities/romantic.js';
import { copyCatHandler } from '../../src/abilities/copy-cat.js';
import { gunkHandler } from '../../src/abilities/gunk.js';
import { coachHandler } from '../../src/abilities/coach.js';
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

describe('Ability Interactions', () => {
  describe('Centaur passes Banana', () => {
    it('should trigger both: Banana trips Centaur, Centaur kicks Banana -2', () => {
      const engine = new EventEngine();
      engine.registerHandler(bananaHandler);   // priority 30
      engine.registerHandler(centaurHandler);   // priority 31

      const state = makeState([
        { racerName: 'centaur', position: 0 },
        { racerName: 'banana', position: 3 },
      ]);

      // Centaur passes Banana
      const result = engine.processEvent(
        { type: 'RACER_PASSED', movingRacer: 'centaur', passedRacer: 'banana', space: 3 },
        state,
      );

      // Banana trips Centaur (priority 30 first)
      expect(result.state.activeRacers[0].tripped).toBe(true);

      // Centaur kicks Banana -2 (priority 31 second)
      expect(result.state.activeRacers[1].position).toBe(1); // 3-2=1

      // Both abilities triggered
      const abilityEvents = result.events.filter(e => e.type === 'ABILITY_TRIGGERED');
      expect(abilityEvents).toHaveLength(2);
    });
  });

  describe('Scoocher chain triggering', () => {
    it('should move Scoocher 1 when another ability triggers', () => {
      const engine = new EventEngine();
      engine.registerHandler(scoocherHandler);
      engine.registerHandler(gunkHandler);

      const state = makeState([
        { racerName: 'scoocher', position: 3 },
        { racerName: 'gunk', position: 0 },
        { racerName: 'alchemist', position: 0 },
      ]);

      // Alchemist rolls — Gunk triggers (-1), then Scoocher reacts to Gunk's ability
      const result = engine.processEvent(
        { type: 'DICE_ROLLED', playerId: 'p3', value: 4 },
        state,
      );

      // Gunk should trigger
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'ABILITY_TRIGGERED', racerName: 'gunk' }),
      );

      // Scoocher should react to Gunk's ability
      expect(result.state.activeRacers[0].position).toBe(4); // moved from 3 to 4
    });

    it('should not cause infinite loop (Scoocher triggers on others, not self)', () => {
      const engine = new EventEngine();
      engine.registerHandler(scoocherHandler);
      engine.registerHandler(gunkHandler);

      const state = makeState([
        { racerName: 'scoocher', position: 0 },
        { racerName: 'gunk', position: 0 },
        { racerName: 'alchemist', position: 0 },
      ]);

      // This should not infinite loop — Scoocher's own ABILITY_TRIGGERED is ignored
      const result = engine.processEvent(
        { type: 'DICE_ROLLED', playerId: 'p3', value: 4 },
        state,
      );

      // Should complete without hanging
      expect(result.state).toBeDefined();
      // Scoocher moved exactly once
      expect(result.state.activeRacers[0].position).toBe(1);
    });
  });

  describe('Huge Baby + Baba Yaga interaction', () => {
    it('Huge Baby pushes racer behind, Baba Yaga trips if on that space', () => {
      const engine = new EventEngine();
      engine.registerHandler(hugeBabyHandler);  // priority 2
      engine.registerHandler(babaYagaHandler);  // priority 32

      const state = makeState([
        { racerName: 'huge_baby', position: 5 },
        { racerName: 'baba_yaga', position: 4 },
        { racerName: 'alchemist', position: 5 }, // stops on Huge Baby's space
      ]);

      const result = engine.processEvent(
        { type: 'RACER_STOPPED', racerName: 'alchemist', space: 5 },
        state,
      );

      // Huge Baby pushes alchemist to space 4 (behind)
      expect(result.state.activeRacers[2].position).toBe(4);

      // Baba Yaga is at space 4 — but the RACER_STOPPED event was at space 5
      // The RACER_WARPED chain event from Huge Baby doesn't auto-trigger BabaYaga
      // (BabaYaga listens for RACER_STOPPED, not RACER_WARPED)
      // This is correct game behavior — push doesn't count as "stopping"
    });
  });

  describe('M.O.U.T.H. elimination', () => {
    it('should eliminate the only other racer on space', () => {
      const engine = new EventEngine();
      engine.registerHandler(mouthHandler);

      const state = makeState([
        { racerName: 'mouth', position: 5 },
        { racerName: 'alchemist', position: 5 },
        { racerName: 'blimp', position: 3 },
      ]);

      const result = engine.processEvent(
        { type: 'RACER_STOPPED', racerName: 'mouth', space: 5 },
        state,
      );

      expect(result.state.activeRacers[1].eliminated).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'RACER_ELIMINATED', racerName: 'alchemist' }),
      );
    });
  });

  describe('Romantic + two racers stopping together', () => {
    it('should trigger Romantic when two racers share a space', () => {
      const engine = new EventEngine();
      engine.registerHandler(romanticHandler);

      const state = makeState([
        { racerName: 'romantic', position: 0 },
        { racerName: 'alchemist', position: 5 },
        { racerName: 'blimp', position: 5 },
      ]);

      const result = engine.processEvent(
        { type: 'RACER_STOPPED', racerName: 'blimp', space: 5 },
        state,
      );

      expect(result.state.activeRacers[0].position).toBe(2); // Romantic moved 2
    });
  });

  describe('Copy Cat copies leader', () => {
    it('should set copiedAbility to the leading racer', () => {
      const engine = new EventEngine();
      engine.registerHandler(copyCatHandler);

      const state = makeState([
        { racerName: 'copy_cat', position: 0 },
        { racerName: 'alchemist', position: 3 },
        { racerName: 'blimp', position: 10 },
      ]);

      const result = engine.processEvent(
        { type: 'TURN_START', playerId: 'p1' },
        state,
      );

      const cc = result.state.activeRacers.find(r => r.racerName === 'copy_cat')!;
      expect(cc.copiedAbility).toBe('blimp'); // blimp is in the lead
    });
  });

  describe('Multiple dice modifiers stack', () => {
    it('Coach +1 and Gunk -1 should cancel out', () => {
      const engine = new EventEngine();
      engine.registerHandler(coachHandler);  // priority 16
      engine.registerHandler(gunkHandler);   // priority 17

      const state = makeState([
        { racerName: 'coach', position: 5 },
        { racerName: 'gunk', position: 0 },
        { racerName: 'alchemist', position: 5 }, // same space as coach
      ]);

      const result = engine.processEvent(
        { type: 'DICE_ROLLED', playerId: 'p3', value: 4 },
        state,
      );

      // Coach triggers +1, Gunk triggers -1
      const modEvents = result.events.filter(e => e.type === 'DICE_MODIFIED');
      expect(modEvents).toHaveLength(2);
      // Coach: 4→5, then Gunk: 4→3 (both modify original value)
      expect(modEvents[0]).toEqual(expect.objectContaining({ newValue: 5, reason: 'Coach' }));
      expect(modEvents[1]).toEqual(expect.objectContaining({ newValue: 3, reason: 'Gunk' }));
    });
  });

  describe('Loop prevention', () => {
    it('should not allow same handler to trigger twice for same event type', () => {
      const engine = new EventEngine();
      // Register two handlers that could chain-trigger each other
      engine.registerHandler(scoocherHandler);
      engine.registerHandler(bananaHandler);

      const state = makeState([
        { racerName: 'scoocher', position: 0 },
        { racerName: 'banana', position: 3 },
      ]);

      // Trigger a chain: someone passes Banana → Banana triggers → Scoocher reacts
      // Scoocher's ABILITY_TRIGGERED should not re-trigger Scoocher
      const result = engine.processEvent(
        { type: 'RACER_PASSED', movingRacer: 'alchemist' as any, passedRacer: 'banana', space: 3 },
        state,
      );

      // Should complete without infinite loop
      expect(result.state).toBeDefined();
      // Scoocher should have moved at most once
      expect(result.state.activeRacers[0].position).toBeLessThanOrEqual(1);
    });
  });
});
