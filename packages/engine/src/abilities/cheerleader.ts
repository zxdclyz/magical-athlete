import type { AbilityHandler } from '../events.js';

// Cheerleader: At the start of my turn, I can make the racer(s) in last place move 2. If I do, I move 1.
export const cheerleaderHandler: AbilityHandler = {
  racerName: 'cheerleader',
  eventTypes: ['TURN_START'],
  priority: 4,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'cheerleader' && !r.finished && !r.eliminated);
    return !!racer && racer.playerId === event.playerId;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'TURN_START') return null;
    return {
      type: 'USE_ABILITY',
      racerName: 'cheerleader',
      abilityDescription: 'Make last-place racer(s) move 2, and you move 1?',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      const cheerleader = state.activeRacers.find(r => r.racerName === 'cheerleader')!;
      const activeRacers = state.activeRacers.filter(r => !r.finished && !r.eliminated);
      const minPos = Math.min(...activeRacers.map(r => r.position));
      const lastPlacers = activeRacers.filter(r => r.position === minPos);
      const finishIndex = state.track.length - 1;

      const events: import('../types.js').GameEvent[] = [
        { type: 'ABILITY_TRIGGERED', racerName: 'cheerleader', abilityName: 'Cheerleader', description: 'Cheers for last place!' },
      ];

      const newRacers = state.activeRacers.map(r => {
        // Move last placers 2
        if (lastPlacers.some(lp => lp.racerName === r.racerName)) {
          const newPos = Math.min(finishIndex, r.position + 2);
          events.push({ type: 'RACER_MOVING', racerName: r.racerName, from: r.position, to: newPos, isMainMove: false });
          return { ...r, position: newPos };
        }
        // Move cheerleader 1
        if (r.racerName === 'cheerleader') {
          const newPos = Math.min(finishIndex, r.position + 1);
          events.push({ type: 'RACER_MOVING', racerName: 'cheerleader', from: r.position, to: newPos, isMainMove: false });
          return { ...r, position: newPos };
        }
        return r;
      });

      return { state: { ...state, activeRacers: newRacers }, events };
    }
    return { state, events: [] };
  },
};
