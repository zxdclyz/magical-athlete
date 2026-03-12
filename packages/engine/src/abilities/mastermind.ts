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
      .filter(r => !r.finished && !r.eliminated)
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
          { type: 'ABILITY_TRIGGERED', racerName: 'mastermind', abilityName: '策划大师', description: `预测${decision.targetRacer}会获胜` },
        ],
      };
    }
    return { state, events: [] };
  },
};

// Mastermind check — triggers when any racer finishes to see if prediction was correct
export const mastermindCheckHandler: AbilityHandler = {
  racerName: 'mastermind',
  eventTypes: ['RACER_FINISHED'],
  priority: 50,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_FINISHED') return false;
    const mastermind = state.activeRacers.find(r => r.racerName === 'mastermind' && !r.eliminated);
    if (!mastermind || !mastermind.mastermindPrediction) return false;
    // Only trigger if the finished racer is the predicted winner and it's 1st place
    return event.place === 1 && event.racerName === mastermind.mastermindPrediction;
  },
  execute(event, state) {
    if (event.type !== 'RACER_FINISHED') return { state, events: [] };
    const mastermind = state.activeRacers.find(r => r.racerName === 'mastermind')!;
    // Mastermind auto-finishes in next place after the winner (always 2nd)
    const place = event.place + 1;
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'mastermind') {
        return { ...r, finished: true, finishOrder: place };
      }
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'mastermind', abilityName: '策划大师', description: `预测正确！${event.racerName}获胜，策划大师获得第${place}名` },
        { type: 'RACER_FINISHED', racerName: 'mastermind', place },
      ],
    };
  },
};
