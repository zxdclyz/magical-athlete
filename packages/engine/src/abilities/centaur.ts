import type { AbilityHandler } from '../events.js';

// Centaur: When I pass a racer, they move -2.
export const centaurHandler: AbilityHandler = {
  racerName: 'centaur',
  eventTypes: ['RACER_PASSED'],
  priority: 31,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_PASSED') return false;
    return event.movingRacer === 'centaur';
  },
  execute(event, state) {
    if (event.type !== 'RACER_PASSED') return { state, events: [] };
    const target = state.activeRacers.find(r => r.racerName === event.passedRacer);
    if (!target || target.finished || target.eliminated) return { state, events: [] };

    const newPos = Math.max(0, target.position - 2);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === event.passedRacer) {
        return { ...r, position: newPos };
      }
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'centaur', abilityName: '半人马', description: `将${event.passedRacer}踢退2格` },
        { type: 'RACER_MOVING', racerName: event.passedRacer, from: target.position, to: newPos, isMainMove: false },
      ],
    };
  },
};
