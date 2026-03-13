import type { AbilityHandler } from '../events.js';

// Romantic: When anyone stops on a space with exactly one other racer, I move 2.
export const romanticHandler: AbilityHandler = {
  racerName: 'romantic',
  eventTypes: ['RACER_STOPPED'],
  priority: 40,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_STOPPED') return false;
    const romantic = state.activeRacers.find(r => r.racerName === 'romantic' && !r.finished && !r.eliminated);
    if (!romantic) return false;
    // Check if the space now has exactly 2 racers (the one who stopped + exactly one other)
    const racersOnSpace = state.activeRacers.filter(
      r => r.position === event.space && !r.finished && !r.eliminated
    );
    return racersOnSpace.length === 2;
  },
  execute(event, state) {
    if (event.type !== 'RACER_STOPPED') return { state, events: [] };
    const romantic = state.activeRacers.find(r => r.racerName === 'romantic')!;
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, romantic.position + 2);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'romantic') return { ...r, position: newPos };
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'romantic', abilityName: '浪漫者', description: '爱情万岁！两个角色同格了' },
        { type: 'RACER_MOVING', racerName: 'romantic', from: romantic.position, to: newPos, isMainMove: false },
      ],
    };
  },
};
