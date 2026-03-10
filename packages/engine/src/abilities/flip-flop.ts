import type { AbilityHandler } from '../events.js';

// Flip Flop: Skip rolling and swap spaces with another racer instead.
export const flipFlopHandler: AbilityHandler = {
  racerName: 'flip_flop',
  eventTypes: ['TURN_START'],
  priority: 3,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'flip_flop' && !r.finished && !r.eliminated);
    if (!racer || racer.playerId !== event.playerId) return false;
    // Need at least one other active racer to swap with
    return state.activeRacers.some(r => r.racerName !== 'flip_flop' && !r.finished && !r.eliminated);
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'TURN_START') return null;
    const targets = state.activeRacers
      .filter(r => r.racerName !== 'flip_flop' && !r.finished && !r.eliminated)
      .map(r => r.racerName);
    return {
      type: 'CHOOSE_TARGET_RACER',
      racerName: 'flip_flop',
      targets,
      reason: 'Swap spaces with a racer (or decline to roll normally)',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'CHOOSE_TARGET_RACER') {
      const flipFlop = state.activeRacers.find(r => r.racerName === 'flip_flop')!;
      const target = state.activeRacers.find(r => r.racerName === decision.targetRacer)!;
      if (!target) return { state, events: [] };

      const ffPos = flipFlop.position;
      const tPos = target.position;
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'flip_flop') return { ...r, position: tPos };
        if (r.racerName === decision.targetRacer) return { ...r, position: ffPos };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'flip_flop', abilityName: 'Flip Flop', description: `Swapped with ${decision.targetRacer}` },
          { type: 'RACER_SWAPPED', racer1: 'flip_flop', racer2: decision.targetRacer },
        ],
      };
    }
    return { state, events: [] };
  },
};
