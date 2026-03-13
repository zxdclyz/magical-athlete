import type { AbilityHandler } from '../events.js';

// Suckerfish: When a racer on my space moves, I can also move to their new space.
export const suckerfishHandler: AbilityHandler = {
  racerName: 'suckerfish',
  eventTypes: ['RACER_MOVING'],
  priority: 45,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_MOVING') return false;
    const suckerfish = state.activeRacers.find(r => r.racerName === 'suckerfish' && !r.finished && !r.eliminated);
    if (!suckerfish) return false;
    if (event.racerName === 'suckerfish') return false;
    // Check if the moving racer was on suckerfish's space before moving
    return event.from === suckerfish.position;
  },
  getDecisionRequest(event) {
    if (event.type !== 'RACER_MOVING') return null;
    return {
      type: 'USE_ABILITY',
      racerName: 'suckerfish',
      abilityDescription: `跟随${event.racerName}到第${event.to}格？`,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'RACER_MOVING') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      const suckerfish = state.activeRacers.find(r => r.racerName === 'suckerfish')!;
      const fromPos = suckerfish.position;
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'suckerfish') return { ...r, position: event.to };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'suckerfish', abilityName: '吸盘鱼', description: `跟随${event.racerName}到了第${event.to}格` },
          { type: 'RACER_WARPED', racerName: 'suckerfish', from: fromPos, to: event.to },
        ],
      };
    }
    return { state, events: [] };
  },
};
