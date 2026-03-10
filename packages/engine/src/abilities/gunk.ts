import type { AbilityHandler } from '../events.js';

// Gunk: Other racers get -1 to their main move.
export const gunkHandler: AbilityHandler = {
  racerName: 'gunk',
  eventTypes: ['DICE_ROLLED'],
  priority: 17,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const gunk = state.activeRacers.find(r => r.racerName === 'gunk' && !r.finished && !r.eliminated);
    if (!gunk) return false;
    // Only applies to OTHER racers, not gunk itself
    const roller = state.activeRacers.find(r => r.playerId === event.playerId);
    return !!roller && roller.racerName !== 'gunk';
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const newValue = Math.max(0, event.value - 1);
    return {
      state,
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'gunk', abilityName: 'Gunk', description: '-1 from Gunk' },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue, reason: 'Gunk' },
      ],
    };
  },
};
