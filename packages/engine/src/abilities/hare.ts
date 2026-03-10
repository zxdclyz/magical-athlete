import type { AbilityHandler } from '../events.js';

// Hare: +2 to main move. When alone in the lead at turn start, skip move and get bronze chip.
export const hareMovementHandler: AbilityHandler = {
  racerName: 'hare',
  eventTypes: ['DICE_ROLLED'],
  priority: 14,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'hare');
    return !!racer && racer.playerId === event.playerId && !racer.finished;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    return {
      state,
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'hare', abilityName: 'Hare', description: '+2 to move' },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue: event.value + 2, reason: 'Hare' },
      ],
    };
  },
};

export const hareLeadHandler: AbilityHandler = {
  racerName: 'hare',
  eventTypes: ['TURN_START'],
  priority: 5,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const hare = state.activeRacers.find(r => r.racerName === 'hare');
    if (!hare || hare.playerId !== event.playerId || hare.finished) return false;
    // Check if alone in the lead
    const activeRacers = state.activeRacers.filter(r => !r.finished && !r.eliminated);
    const maxPos = Math.max(...activeRacers.map(r => r.position));
    const leaders = activeRacers.filter(r => r.position === maxPos);
    return leaders.length === 1 && leaders[0].racerName === 'hare';
  },
  execute(event, state) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    const hare = state.activeRacers.find(r => r.racerName === 'hare')!;
    const scores = { ...state.scores };
    scores[hare.playerId] = (scores[hare.playerId] || 0) + 1;
    return {
      state: { ...state, scores },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'hare', abilityName: 'Hare', description: 'Alone in lead — skips move, gains bronze chip' },
        { type: 'POINT_CHIP_GAINED', playerId: hare.playerId, chipType: 'bronze', value: 1 },
      ],
    };
  },
};
