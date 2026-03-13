import type { AbilityHandler } from '../events.js';

// Dicemonger: Anyone can reroll their main move once per turn.
// When another racer does it, I move 1.
export const dicemongerHandler: AbilityHandler = {
  racerName: 'dicemonger',
  eventTypes: ['DICE_ROLLED'],
  priority: 25,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const dicemonger = state.activeRacers.find(r => r.racerName === 'dicemonger' && !r.finished && !r.eliminated);
    return !!dicemonger;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'DICE_ROLLED') return null;
    return {
      type: 'REROLL_DICE',
      currentValue: event.value,
      rerollsLeft: 1,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    if (decision && decision.type === 'REROLL_DICE' && decision.reroll) {
      const newValue = Math.floor(Math.random() * 6) + 1;
      const dicemonger = state.activeRacers.find(r => r.racerName === 'dicemonger')!;
      const events: import('../types.js').GameEvent[] = [
        { type: 'ABILITY_TRIGGERED', racerName: 'dicemonger', abilityName: '骰子商人', description: `重掷：${event.value} → ${newValue}` },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue, reason: 'Dicemonger reroll' },
      ];

      // If another racer rerolled, dicemonger moves 1
      const roller = state.activeRacers.find(r => r.playerId === event.playerId);
      if (roller && roller.racerName !== 'dicemonger') {
        const finishIndex = state.track.length - 1;
        const newPos = Math.min(finishIndex, dicemonger.position + 1);
        const activeRacers = state.activeRacers.map(r => {
          if (r.racerName === 'dicemonger') return { ...r, position: newPos };
          return r;
        });
        events.push({ type: 'RACER_MOVING', racerName: 'dicemonger', from: dicemonger.position, to: newPos, isMainMove: false });
        return { state: { ...state, activeRacers }, events };
      }

      return { state, events };
    }
    return { state, events: [] };
  },
};
