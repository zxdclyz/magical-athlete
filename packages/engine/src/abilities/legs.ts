import type { AbilityHandler } from '../events.js';
import { executeMovement } from '../phases/racing.js';

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
      abilityDescription: '跳过掷骰，直接前进5格？',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      // Do the movement directly, then skip main move
      const moveResult = executeMovement(state, event.playerId, 5);
      return {
        state: { ...moveResult.state, skipMainMove: true },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'legs', abilityName: '长腿', description: '跳过掷骰——前进5格' },
          ...moveResult.events,
        ],
      };
    }
    return { state, events: [] };
  },
};
