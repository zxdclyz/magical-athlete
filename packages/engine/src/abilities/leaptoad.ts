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
    let stepsLeft = Math.abs(event.to - event.from);
    const direction = event.to >= event.from ? 1 : -1;

    if (stepsLeft === 0) return { state, events: [] };

    while (stepsLeft > 0) {
      const nextPos = pos + direction;
      if (nextPos < 0 || nextPos > finishIndex) break;
      pos = nextPos;
      const occupied = state.activeRacers.some(
        r => r.racerName !== 'leaptoad' && r.position === pos && !r.finished && !r.eliminated
      );
      if (occupied) continue;
      stepsLeft--;
    }
    pos = Math.max(0, Math.min(pos, finishIndex));

    if (pos === event.to) return { state, events: [] }; // No change

    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'leaptoad') return { ...r, position: pos };
      return r;
    });

    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'leaptoad', abilityName: '跳蛙', description: `跳到了第${pos}格（跳过了有角色的格子）` },
      ],
    };
  },
};
