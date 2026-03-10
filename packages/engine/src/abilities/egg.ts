import type { AbilityHandler } from '../events.js';

// Egg: At the start of my race, draw 3 new racers from the deck and pick one. I have its powers.
// This is a pre-race ability that runs during RACE_SETUP → RACING transition.
export const eggHandler: AbilityHandler = {
  racerName: 'egg',
  eventTypes: ['PHASE_CHANGED'],
  priority: 1,
  shouldTrigger(event, state) {
    if (event.type !== 'PHASE_CHANGED') return false;
    if (event.phase !== 'RACING') return false;
    const egg = state.activeRacers.find(r => r.racerName === 'egg' && !r.copiedAbility);
    return !!egg;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'PHASE_CHANGED') return null;
    // Draw 3 random from available (not in anyone's hand or active)
    const usedNames = new Set(state.activeRacers.map(r => r.racerName));
    const handNames = new Set(state.players.flatMap(p => p.hand));
    const available = state.availableRacers.filter(r => !usedNames.has(r) && !handNames.has(r));
    const drawn = available.sort(() => Math.random() - 0.5).slice(0, 3);
    return {
      type: 'CHOOSE_COPIED_ABILITY',
      racerName: 'egg',
      candidates: drawn,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'PHASE_CHANGED') return { state, events: [] };
    if (decision && decision.type === 'CHOOSE_COPIED_ABILITY') {
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === 'egg') return { ...r, copiedAbility: decision.racerName };
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'egg', abilityName: 'Egg', description: `Hatched into ${decision.racerName}` },
        ],
      };
    }
    return { state, events: [] };
  },
};
