import type { AbilityHandler } from '../events.js';

// Mastermind: At start of first turn, predict race winner.
// If correct, race ends immediately and Mastermind finishes 2nd.
export const mastermindHandler: AbilityHandler = {
  racerName: 'mastermind',
  eventTypes: ['TURN_START'],
  priority: 2,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'mastermind' && !r.finished && !r.eliminated);
    if (!racer || racer.playerId !== event.playerId) return false;
    // Only on first turn (no prediction stored yet)
    return !racer.mastermindPrediction;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'TURN_START') return null;
    const candidates = state.activeRacers
      .filter(r => r.racerName !== 'mastermind' && !r.finished && !r.eliminated)
      .map(r => r.racerName);
    return {
      type: 'PREDICT_WINNER',
      racerName: 'mastermind',
      candidates,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'PREDICT_WINNER') {
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'mastermind') {
          return { ...r, mastermindPrediction: decision.targetRacer };
        }
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'mastermind', abilityName: 'Mastermind', description: `Predicted ${decision.targetRacer} will win` },
        ],
      };
    }
    return { state, events: [] };
  },
};
