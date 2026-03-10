import type { AbilityHandler } from '../events.js';

// Legs: Skip rolling and move 5 instead.
export const legsHandler: AbilityHandler = {
  racerName: 'legs',
  eventTypes: ['TURN_START'],
  priority: 3,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'legs' && !r.finished && !r.eliminated);
    return !!racer && racer.playerId === event.playerId;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'TURN_START') return null;
    return {
      type: 'USE_ABILITY',
      racerName: 'legs',
      abilityDescription: 'Skip rolling and move 5 instead?',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      return {
        state,
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'legs', abilityName: 'Legs', description: 'Skips rolling — moves 5' },
          { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: 0, newValue: 5, reason: 'Legs' },
        ],
      };
    }
    return { state, events: [] };
  },
};
