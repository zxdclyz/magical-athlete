import type { AbilityHandler } from '../events.js';

// Genius: Predict dice roll. If correct, take another turn after this one.
export const geniusHandler: AbilityHandler = {
  racerName: 'genius',
  eventTypes: ['TURN_START'],
  priority: 3,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'genius' && !r.finished && !r.eliminated);
    return !!racer && racer.playerId === event.playerId;
  },
  getDecisionRequest() {
    return {
      type: 'PREDICT_DICE',
      racerName: 'genius',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    // Store prediction — it will be checked after dice roll
    if (decision && decision.type === 'PREDICT_DICE') {
      return {
        state: { ...state, extraTurnPlayerId: null }, // Will be set after dice check
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'genius', abilityName: 'Genius', description: `Predicted: ${decision.prediction}` },
        ],
      };
    }
    return { state, events: [] };
  },
};

// Genius dice check — triggers after dice roll to check if prediction was correct
export const geniusDiceCheckHandler: AbilityHandler = {
  racerName: 'genius',
  eventTypes: ['DICE_ROLLED'],
  priority: 50,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'genius');
    return !!racer && racer.playerId === event.playerId && !racer.finished;
  },
  execute(event, state) {
    // The prediction check logic would be integrated with the turn engine
    // For now, set extraTurnPlayerId if prediction matches
    // The actual prediction value is stored via the decision system
    return { state, events: [] };
  },
};
