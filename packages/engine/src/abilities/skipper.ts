import type { AbilityHandler } from '../events.js';

// Skipper: When anyone rolls a 1, I go next in turn order.
export const skipperHandler: AbilityHandler = {
  racerName: 'skipper',
  eventTypes: ['DICE_ROLLED'],
  priority: 9,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const skipper = state.activeRacers.find(r => r.racerName === 'skipper' && !r.finished && !r.eliminated);
    if (!skipper) return false;
    // Triggers on anyone's roll of 1 (including own)
    return event.value === 1;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const skipper = state.activeRacers.find(r => r.racerName === 'skipper')!;
    return {
      state: { ...state, skipperNextPlayerId: skipper.playerId },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'skipper', abilityName: 'Skipper', description: 'A 1 was rolled — Skipper goes next' },
      ],
    };
  },
};
