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
      reason: '与一个角色交换位置（或放弃，正常掷骰）',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'CHOOSE_TARGET_RACER') {
      // targetRacer === 'flip_flop' means player declined
      if (decision.targetRacer === 'flip_flop') return { state, events: [] };

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
        state: { ...state, activeRacers, skipMainMove: true },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'flip_flop', abilityName: '翻转拖鞋', description: `与${decision.targetRacer}交换了位置` },
          { type: 'RACER_SWAPPED', racer1: 'flip_flop', racer2: decision.targetRacer },
        ],
      };
    }
    return { state, events: [] };
  },
};
