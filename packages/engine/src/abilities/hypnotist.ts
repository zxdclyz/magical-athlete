import type { AbilityHandler } from '../events.js';

// Hypnotist: At the start of my turn, I can warp a racer to my space.
export const hypnotistHandler: AbilityHandler = {
  racerName: 'hypnotist',
  eventTypes: ['TURN_START'],
  priority: 4,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'hypnotist' && !r.finished && !r.eliminated);
    if (!racer || racer.playerId !== event.playerId) return false;
    return state.activeRacers.some(r => r.racerName !== 'hypnotist' && !r.finished && !r.eliminated);
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'TURN_START') return null;
    const targets = state.activeRacers
      .filter(r => r.racerName !== 'hypnotist' && !r.finished && !r.eliminated)
      .map(r => r.racerName);
    return {
      type: 'CHOOSE_TARGET_RACER',
      racerName: 'hypnotist',
      targets,
      reason: '将一个角色传送到你的格子（或放弃）',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'CHOOSE_TARGET_RACER') {
      // targetRacer === 'hypnotist' means player declined
      if (decision.targetRacer === 'hypnotist') return { state, events: [] };

      const hypnotist = state.activeRacers.find(r => r.racerName === 'hypnotist')!;
      const target = state.activeRacers.find(r => r.racerName === decision.targetRacer);
      if (!target) return { state, events: [] };

      const fromPos = target.position;
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === decision.targetRacer) return { ...r, position: hypnotist.position };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'hypnotist', abilityName: '催眠师', description: `将${decision.targetRacer}传送到第${hypnotist.position}格` },
          { type: 'RACER_WARPED', racerName: decision.targetRacer, from: fromPos, to: hypnotist.position },
        ],
      };
    }
    return { state, events: [] };
  },
};
