import type { AbilityHandler } from '../events.js';

// Skipper: When anyone rolls a 1, I go next in turn order.
// If Skipper herself rolls a 1, she gets an extra turn immediately.
export const skipperHandler: AbilityHandler = {
  racerName: 'skipper',
  eventTypes: ['DICE_ROLLED'],
  priority: 9,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const skipper = state.activeRacers.find(r => r.racerName === 'skipper' && !r.finished && !r.eliminated);
    if (!skipper) return false;
    return event.value === 1;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const skipper = state.activeRacers.find(r => r.racerName === 'skipper')!;
    const isSelfRoll = event.playerId === skipper.playerId;
    if (isSelfRoll) {
      // Skipper rolled 1 herself — she gets an extra turn immediately
      return {
        state: { ...state, extraTurnPlayerId: skipper.playerId },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'skipper', abilityName: '船长', description: '船长掷出了1——再行动一次！' },
        ],
      };
    }
    // Someone else rolled 1 — Skipper goes next
    return {
      state: { ...state, skipperNextPlayerId: skipper.playerId },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'skipper', abilityName: '船长', description: '有人掷出了1——船长下一个行动' },
      ],
    };
  },
};
