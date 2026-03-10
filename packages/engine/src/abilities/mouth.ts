import type { AbilityHandler } from '../events.js';

// M.O.U.T.H.: When I stop on a space with exactly one other racer, they're eliminated.
export const mouthHandler: AbilityHandler = {
  racerName: 'mouth',
  eventTypes: ['RACER_STOPPED'],
  priority: 34,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_STOPPED') return false;
    if (event.racerName !== 'mouth') return false;
    // Check exactly one other racer on this space
    const others = state.activeRacers.filter(
      r => r.racerName !== 'mouth' && r.position === event.space && !r.finished && !r.eliminated
    );
    return others.length === 1;
  },
  execute(event, state) {
    if (event.type !== 'RACER_STOPPED') return { state, events: [] };
    const target = state.activeRacers.find(
      r => r.racerName !== 'mouth' && r.position === event.space && !r.finished && !r.eliminated
    );
    if (!target) return { state, events: [] };

    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === target.racerName) {
        return { ...r, eliminated: true };
      }
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'mouth', abilityName: 'M.O.U.T.H.', description: `Chomped ${target.racerName}` },
        { type: 'RACER_ELIMINATED', racerName: target.racerName, byRacer: 'mouth' },
      ],
    };
  },
};
