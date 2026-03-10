import type { AbilityHandler } from '../events.js';

// Stickler: Other racers can only cross the finish line by exact amount.
// If they overshoot, they don't move.
export const sticklerHandler: AbilityHandler = {
  racerName: 'stickler',
  eventTypes: ['RACER_MOVING'],
  priority: 1, // Very high priority — must check before movement resolves
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_MOVING') return false;
    const stickler = state.activeRacers.find(r => r.racerName === 'stickler' && !r.finished && !r.eliminated);
    if (!stickler) return false;
    // Only affects other racers, not stickler itself
    if (event.racerName === 'stickler') return false;
    const finishIndex = state.track.length - 1;
    // Trigger if the move would go past or reach finish
    return event.to >= finishIndex && event.to > event.from;
  },
  execute(event, state) {
    if (event.type !== 'RACER_MOVING') return { state, events: [] };
    const finishIndex = state.track.length - 1;
    const distance = event.to - event.from;
    const exactDistance = finishIndex - event.from;
    // If overshoot (moved more than exact), cancel the movement
    if (distance > exactDistance) {
      // Revert position to original
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === event.racerName) {
          return { ...r, position: event.from, finished: false, finishOrder: null };
        }
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'stickler', abilityName: 'Stickler', description: `${event.racerName} overshoots finish — doesn't move` },
        ],
      };
    }
    return { state, events: [] };
  },
};
