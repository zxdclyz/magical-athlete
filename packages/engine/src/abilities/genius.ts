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
    // Store prediction in ActiveRacer
    if (decision && decision.type === 'PREDICT_DICE') {
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'genius') return { ...r, geniusPrediction: decision.prediction };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'genius', abilityName: '天才', description: `预测点数：${decision.prediction}` },
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
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const racer = state.activeRacers.find(r => r.racerName === 'genius');
    if (!racer || racer.geniusPrediction === undefined) return { state, events: [] };
    if (event.value === racer.geniusPrediction) {
      // Correct prediction — grant extra turn
      return {
        state: { ...state, extraTurnPlayerId: racer.playerId },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'genius', abilityName: '天才', description: '猜对了！获得额外回合' },
        ],
      };
    }
    return { state, events: [] };
  },
};
