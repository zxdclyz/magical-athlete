import type { AbilityHandler } from '../events.js';

// Third Wheel: Before my main move, I can warp to any space with exactly 2 racers.
export const thirdWheelHandler: AbilityHandler = {
  racerName: 'third_wheel',
  eventTypes: ['TURN_START'],
  priority: 3,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'third_wheel' && !r.finished && !r.eliminated);
    if (!racer || racer.playerId !== event.playerId) return false;
    // Check if any space has exactly 2 racers (excluding third_wheel)
    const positionCounts = new Map<number, number>();
    for (const r of state.activeRacers) {
      if (r.racerName === 'third_wheel' || r.finished || r.eliminated) continue;
      positionCounts.set(r.position, (positionCounts.get(r.position) || 0) + 1);
    }
    return [...positionCounts.values()].some(count => count === 2);
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'TURN_START') return null;
    const positionCounts = new Map<number, number>();
    for (const r of state.activeRacers) {
      if (r.racerName === 'third_wheel' || r.finished || r.eliminated) continue;
      positionCounts.set(r.position, (positionCounts.get(r.position) || 0) + 1);
    }
    const spaces = [...positionCounts.entries()]
      .filter(([, count]) => count === 2)
      .map(([pos]) => pos);
    return {
      type: 'CHOOSE_TARGET_SPACE',
      racerName: 'third_wheel',
      spaces,
      reason: 'Warp to a space with exactly 2 racers (or decline)',
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    if (decision && decision.type === 'CHOOSE_TARGET_SPACE') {
      const thirdWheel = state.activeRacers.find(r => r.racerName === 'third_wheel')!;
      const fromPos = thirdWheel.position;
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'third_wheel') return { ...r, position: decision.targetSpace };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'third_wheel', abilityName: 'Third Wheel', description: `Warped to space ${decision.targetSpace}` },
          { type: 'RACER_WARPED', racerName: 'third_wheel', from: fromPos, to: decision.targetSpace },
        ],
      };
    }
    return { state, events: [] };
  },
};
