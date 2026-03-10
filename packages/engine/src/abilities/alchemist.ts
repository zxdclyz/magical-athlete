import type { AbilityHandler } from '../events.js';

// Alchemist: When I roll a 1 or 2 for my main move, I can move 4 instead.
export const alchemistHandler: AbilityHandler = {
  racerName: 'alchemist',
  eventTypes: ['DICE_ROLLED'],
  priority: 20,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'alchemist');
    if (!racer || racer.playerId !== event.playerId) return false;
    return event.value === 1 || event.value === 2;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'DICE_ROLLED') return null;
    return {
      type: 'USE_ABILITY',
      racerName: 'alchemist',
      abilityDescription: `Rolled ${event.value}. Move 4 instead?`,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      return {
        state,
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'alchemist', abilityName: 'Alchemist', description: 'Changed move to 4' },
          { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue: 4, reason: 'Alchemist' },
        ],
      };
    }
    return { state, events: [] };
  },
};
