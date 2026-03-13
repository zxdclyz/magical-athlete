import type { AbilityHandler } from '../events.js';

// Scoocher: When another racer's power happens, I move 1.
export const scoocherHandler: AbilityHandler = {
  racerName: 'scoocher',
  eventTypes: ['ABILITY_TRIGGERED'],
  priority: 99, // Very low priority — reacts after all other abilities
  shouldTrigger(event, state) {
    if (event.type !== 'ABILITY_TRIGGERED') return false;
    const scoocher = state.activeRacers.find(r => r.racerName === 'scoocher' && !r.finished && !r.eliminated);
    if (!scoocher) return false;
    // Only trigger on OTHER racers' abilities
    return event.racerName !== 'scoocher';
  },
  execute(event, state) {
    if (event.type !== 'ABILITY_TRIGGERED') return { state, events: [] };
    const scoocher = state.activeRacers.find(r => r.racerName === 'scoocher')!;
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, scoocher.position + 1);
    const events: import('../types.js').GameEvent[] = [
      { type: 'ABILITY_TRIGGERED', racerName: 'scoocher', abilityName: '蹭蹭狗', description: '蹭蹭！其他角色触发了技能' },
      { type: 'RACER_MOVING', racerName: 'scoocher', from: scoocher.position, to: newPos, isMainMove: false },
    ];
    let activeRacers: import('../types.js').ActiveRacer[];
    if (newPos >= finishIndex && !scoocher.finished) {
      const finishCount = state.activeRacers.filter(r => r.finished).length + 1;
      activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'scoocher') return { ...r, position: newPos, finished: true, finishOrder: finishCount };
        return r;
      });
      events.push({ type: 'RACER_FINISHED', racerName: 'scoocher', place: finishCount });
    } else {
      activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'scoocher') return { ...r, position: newPos };
        return r;
      });
    }
    return { state: { ...state, activeRacers }, events };
  },
};
