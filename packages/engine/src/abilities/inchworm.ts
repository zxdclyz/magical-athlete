import type { AbilityHandler } from '../events.js';

// Inchworm: When another racer rolls a 1, they skip that move and I move 1.
export const inchwormHandler: AbilityHandler = {
  racerName: 'inchworm',
  eventTypes: ['DICE_ROLLED'],
  priority: 8,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const inchworm = state.activeRacers.find(r => r.racerName === 'inchworm' && !r.finished && !r.eliminated);
    if (!inchworm) return false;
    if (inchworm.playerId === event.playerId) return false; // Only other racers
    return event.value === 1;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const inchworm = state.activeRacers.find(r => r.racerName === 'inchworm')!;
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, inchworm.position + 1);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'inchworm') return { ...r, position: newPos };
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'inchworm', abilityName: '尺蠖虫', description: '其他角色掷出1——尺蠖虫前进1格，该角色跳过移动' },
        { type: 'RACER_MOVING', racerName: 'inchworm', from: inchworm.position, to: newPos, isMainMove: false },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: 1, newValue: 0, reason: 'Inchworm' },
      ],
    };
  },
};
