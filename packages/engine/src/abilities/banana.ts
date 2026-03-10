import type { AbilityHandler } from '../events.js';

// Banana: When a racer passes me, they trip.
export const bananaHandler: AbilityHandler = {
  racerName: 'banana',
  eventTypes: ['RACER_PASSED'],
  priority: 30,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_PASSED') return false;
    return event.passedRacer === 'banana';
  },
  execute(event, state) {
    if (event.type !== 'RACER_PASSED') return { state, events: [] };
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === event.movingRacer) {
        return { ...r, tripped: true };
      }
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'banana', abilityName: 'Banana', description: `${event.movingRacer} slipped on Banana` },
        { type: 'RACER_TRIPPED', racerName: event.movingRacer },
      ],
    };
  },
};
