import type { AbilityHandler } from '../events.js';

// Lackey: When another racer rolls a 6, I move 2 before they move.
export const lackeyHandler: AbilityHandler = {
  racerName: 'lackey',
  eventTypes: ['DICE_ROLLED'],
  priority: 7,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const lackey = state.activeRacers.find(r => r.racerName === 'lackey' && !r.finished && !r.eliminated);
    if (!lackey) return false;
    if (lackey.playerId === event.playerId) return false;
    return event.value === 6;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const lackey = state.activeRacers.find(r => r.racerName === 'lackey')!;
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, lackey.position + 2);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'lackey') return { ...r, position: newPos };
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'lackey', abilityName: '跟班', description: '其他角色掷出6——跟班前进2格' },
        { type: 'RACER_MOVING', racerName: 'lackey', from: lackey.position, to: newPos, isMainMove: false },
      ],
    };
  },
};
