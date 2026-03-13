import type { AbilityHandler } from '../events.js';

// Blimp: Before the second corner +3 to main move. On or after that corner, -1.
export const blimpHandler: AbilityHandler = {
  racerName: 'blimp',
  eventTypes: ['DICE_ROLLED'],
  priority: 15,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'blimp');
    return !!racer && racer.playerId === event.playerId && !racer.finished;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const racer = state.activeRacers.find(r => r.racerName === 'blimp')!;
    const secondCorner = state.trackConfig.secondCornerIndex;
    const modifier = racer.position < secondCorner ? 3 : -1;
    const newValue = Math.max(0, event.value + modifier);
    return {
      state,
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'blimp', abilityName: '飞艇', description: modifier > 0 ? `第二弯道前 +${modifier}` : `第二弯道后 ${modifier}` },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue, reason: 'Blimp' },
      ],
    };
  },
};
