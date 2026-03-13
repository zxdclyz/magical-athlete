import type { AbilityHandler } from '../events.js';

// Twin: At the start of my race, pick a racer who won a previous race. I have their abilities.
export const twinHandler: AbilityHandler = {
  racerName: 'twin',
  eventTypes: ['PHASE_CHANGED'],
  priority: 1,
  shouldTrigger(event, state) {
    if (event.type !== 'PHASE_CHANGED') return false;
    if (event.phase !== 'RACING') return false;
    const twin = state.activeRacers.find(r => r.racerName === 'twin' && !r.copiedAbility);
    if (!twin) return false;
    // Need at least one previous winner
    return state.raceWinners.length > 0;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'PHASE_CHANGED') return null;
    return {
      type: 'CHOOSE_COPIED_ABILITY',
      racerName: 'twin',
      candidates: [...state.raceWinners],
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'PHASE_CHANGED') return { state, events: [] };
    if (decision && decision.type === 'CHOOSE_COPIED_ABILITY') {
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'twin') return { ...r, copiedAbility: decision.racerName };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'twin', abilityName: '双胞胎', description: `复制了之前获胜者${decision.racerName}的能力` },
        ],
      };
    }
    return { state, events: [] };
  },
};
