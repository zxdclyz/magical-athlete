import type { AbilityHandler } from '../events.js';

// Magician: I can reroll my main move twice.
// Implemented as two handlers: first on DICE_ROLLED, second on DICE_MODIFIED (from first reroll).
export const magicianHandler: AbilityHandler = {
  racerName: 'magician',
  eventTypes: ['DICE_ROLLED'],
  priority: 22,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'magician');
    return !!racer && racer.playerId === event.playerId && !racer.finished;
  },
  getDecisionRequest(event) {
    if (event.type !== 'DICE_ROLLED') return null;
    return {
      type: 'REROLL_DICE',
      currentValue: event.value,
      rerollsLeft: 2,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    if (decision && decision.type === 'REROLL_DICE' && decision.reroll) {
      const newValue = Math.floor(Math.random() * 6) + 1;
      return {
        state,
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'magician', abilityName: '魔术师', description: `第一次重掷：${event.value} → ${newValue}` },
          { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue, reason: 'Magician reroll 1' },
        ],
      };
    }
    return { state, events: [] };
  },
};

// Second reroll handler: listens to DICE_MODIFIED from first reroll
export const magicianSecondRerollHandler: AbilityHandler = {
  racerName: 'magician',
  eventTypes: ['DICE_MODIFIED'],
  priority: 22,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_MODIFIED') return false;
    // Only trigger on magician's own first reroll
    if (!event.reason.includes('Magician reroll 1')) return false;
    const racer = state.activeRacers.find(r => r.racerName === 'magician');
    return !!racer && racer.playerId === event.playerId && !racer.finished;
  },
  getDecisionRequest(event) {
    if (event.type !== 'DICE_MODIFIED') return null;
    return {
      type: 'REROLL_DICE',
      currentValue: event.newValue,
      rerollsLeft: 1,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'DICE_MODIFIED') return { state, events: [] };
    if (decision && decision.type === 'REROLL_DICE' && decision.reroll) {
      const newValue = Math.floor(Math.random() * 6) + 1;
      return {
        state,
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'magician', abilityName: '魔术师', description: `第二次重掷：${event.newValue} → ${newValue}` },
          { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.newValue, newValue, reason: 'Magician reroll 2' },
        ],
      };
    }
    return { state, events: [] };
  },
};
