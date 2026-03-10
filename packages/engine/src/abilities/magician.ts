import type { AbilityHandler } from '../events.js';

// Magician: I can reroll my main move twice.
export const magicianHandler: AbilityHandler = {
  racerName: 'magician',
  eventTypes: ['DICE_ROLLED'],
  priority: 22,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'magician');
    return !!racer && racer.playerId === event.playerId && !racer.finished;
  },
  getDecisionRequest(event) {
    if (event.type !== 'DICE_ROLLED') return null;
    return {
      type: 'REROLL_DICE',
      currentValue: event.value,
      rerollsLeft: 2,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    if (decision && decision.type === 'REROLL_DICE' && decision.reroll) {
      const newValue = Math.floor(Math.random() * 6) + 1;
      return {
        state,
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'magician', abilityName: 'Magician', description: `Rerolled: ${event.value} → ${newValue}` },
          { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue, reason: 'Magician reroll' },
        ],
      };
    }
    return { state, events: [] };
  },
};
