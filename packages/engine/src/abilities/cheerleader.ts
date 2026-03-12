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
      abilityDescription: '让最后一名的角色前进2格，你前进1格？',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      const activeRacers = state.activeRacers.filter(r => !r.finished && !r.eliminated);
      const minPos = Math.min(...activeRacers.map(r => r.position));
      const lastPlacers = activeRacers.filter(r => r.position === minPos);
      const finishIndex = state.track.length - 1;

      const events: import('../types.js').GameEvent[] = [
        { type: 'ABILITY_TRIGGERED', racerName: 'cheerleader', abilityName: '啦啦队长', description: '为最后一名加油！' },
      ];
      let finishCount = state.activeRacers.filter(r => r.finished).length;

      // Step 1: Move last-placers +2
      let newRacers = state.activeRacers.map(r => {
        if (lastPlacers.some(lp => lp.racerName === r.racerName)) {
          const newPos = Math.min(finishIndex, r.position + 2);
          events.push({ type: 'RACER_MOVING', racerName: r.racerName, from: r.position, to: newPos, isMainMove: false });
          const updated = { ...r, position: newPos };
          if (newPos >= finishIndex && !r.finished) {
            finishCount++;
            updated.finished = true;
            updated.finishOrder = finishCount;
            events.push({ type: 'RACER_FINISHED', racerName: r.racerName, place: finishCount });
          }
          return updated;
        }
        return r;
      });

      // Step 2: Move cheerleader +1 (always, even if already moved as last-placer)
      newRacers = newRacers.map(r => {
        if (r.racerName === 'cheerleader' && !r.finished) {
          const newPos = Math.min(finishIndex, r.position + 1);
          events.push({ type: 'RACER_MOVING', racerName: 'cheerleader', from: r.position, to: newPos, isMainMove: false });
          const updated = { ...r, position: newPos };
          if (newPos >= finishIndex && !r.finished) {
            finishCount++;
            updated.finished = true;
            updated.finishOrder = finishCount;
            events.push({ type: 'RACER_FINISHED', racerName: 'cheerleader', place: finishCount });
          }
          return updated;
        }
        return r;
      });

      return { state: { ...state, activeRacers: newRacers }, events };
    }
    return { state, events: [] };
  },
};
