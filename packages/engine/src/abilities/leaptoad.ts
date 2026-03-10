import type { AbilityHandler } from '../events.js';

// Leaptoad: While moving, I skip spaces with other racers on them.
// This effectively means Leaptoad moves further when racers are in the path.
export const leaptoadHandler: AbilityHandler = {
  racerName: 'leaptoad',
  eventTypes: ['RACER_MOVING'],
  priority: 3,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_MOVING') return false;
    return event.racerName === 'leaptoad' && event.isMainMove;
  },
  execute(event, state) {
    if (event.type !== 'RACER_MOVING') return { state, events: [] };
    const finishIndex = state.track.length - 1;
    let pos = event.from;
    let stepsLeft = event.to - event.from;
    if (stepsLeft <= 0) return { state, events: [] };

    // Walk step by step, skipping occupied spaces
    while (stepsLeft > 0 && pos < finishIndex) {
      pos++;
      const occupied = state.activeRacers.some(
        r => r.racerName !== 'leaptoad' && r.position === pos && !r.finished && !r.eliminated
      );
      if (occupied) {
        // Skip this space — don't count it
        continue;
      }
      stepsLeft--;
    }

    // Cap at finish
    pos = Math.min(pos, finishIndex);

    if (pos === event.to) return { state, events: [] }; // No change

    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'leaptoad') return { ...r, position: pos };
      return r;
    });

    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'leaptoad', abilityName: 'Leaptoad', description: `Leaped to space ${pos} (skipped occupied spaces)` },
      ],
    };
  },
};
