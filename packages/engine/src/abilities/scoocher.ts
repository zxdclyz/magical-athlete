import type { AbilityHandler } from '../events.js';

// Scoocher: When another racer's power happens, I move 1.
export const scoocherHandler: AbilityHandler = {
  racerName: 'scoocher',
  eventTypes: ['ABILITY_TRIGGERED'],
  priority: 99, // Very low priority — reacts after all other abilities
  shouldTrigger(event, state) {
    if (event.type !== 'ABILITY_TRIGGERED') return false;
    const scoocher = state.activeRacers.find(r => r.racerName === 'scoocher' && !r.finished && !r.eliminated);
    if (!scoocher) return false;
    // Only trigger on OTHER racers' abilities
    return event.racerName !== 'scoocher';
  },
  execute(event, state) {
    if (event.type !== 'ABILITY_TRIGGERED') return { state, events: [] };
    const scoocher = state.activeRacers.find(r => r.racerName === 'scoocher')!;
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, scoocher.position + 1);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'scoocher') return { ...r, position: newPos };
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'scoocher', abilityName: 'Scoocher', description: 'Scooch! Another ability triggered' },
        { type: 'RACER_MOVING', racerName: 'scoocher', from: scoocher.position, to: newPos, isMainMove: false },
      ],
    };
  },
};
