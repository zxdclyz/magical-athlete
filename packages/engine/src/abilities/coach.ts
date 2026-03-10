import type { AbilityHandler } from '../events.js';

// Coach: Everyone on my space gets +1 to their main move, including me.
export const coachHandler: AbilityHandler = {
  racerName: 'coach',
  eventTypes: ['DICE_ROLLED'],
  priority: 16,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const coach = state.activeRacers.find(r => r.racerName === 'coach' && !r.finished && !r.eliminated);
    if (!coach) return false;
    const roller = state.activeRacers.find(r => r.playerId === event.playerId && !r.finished && !r.eliminated);
    if (!roller) return false;
    return roller.position === coach.position;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    return {
      state,
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'coach', abilityName: 'Coach', description: '+1 from Coach on same space' },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue: event.value + 1, reason: 'Coach' },
      ],
    };
  },
};
