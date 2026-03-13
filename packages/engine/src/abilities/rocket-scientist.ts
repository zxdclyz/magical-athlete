import type { AbilityHandler } from '../events.js';

// Rocket Scientist: When I roll for my main move, I can move double. If I do, I trip.
export const rocketScientistHandler: AbilityHandler = {
  racerName: 'rocket_scientist',
  eventTypes: ['DICE_ROLLED'],
  priority: 21,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'rocket_scientist');
    return !!racer && racer.playerId === event.playerId && !racer.finished;
  },
  getDecisionRequest(event) {
    if (event.type !== 'DICE_ROLLED') return null;
    return {
      type: 'USE_ABILITY',
      racerName: 'rocket_scientist',
      abilityDescription: `移动${event.value * 2}格而不是${event.value}格？（你会被绊倒）`,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      const doubled = event.value * 2;
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'rocket_scientist') return { ...r, tripped: true };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'rocket_scientist', abilityName: '火箭科学家', description: `加倍到${doubled}格，将被绊倒` },
          { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue: doubled, reason: 'Rocket Scientist' },
          { type: 'RACER_TRIPPED', racerName: 'rocket_scientist' },
        ],
      };
    }
    return { state, events: [] };
  },
};
