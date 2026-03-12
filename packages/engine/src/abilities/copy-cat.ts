import type { AbilityHandler } from '../events.js';

// Copy Cat: I have the power of the racer currently in the lead. If tie, I pick.
// This is implemented by dynamically copying the leading racer's ability.
export const copyCatHandler: AbilityHandler = {
  racerName: 'copy_cat',
  eventTypes: ['TURN_START'],
  priority: 1,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'copy_cat' && !r.finished && !r.eliminated);
    return !!racer && racer.playerId === event.playerId;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'TURN_START') return null;
    const activeRacers = state.activeRacers.filter(r => !r.finished && !r.eliminated && r.racerName !== 'copy_cat');
    if (activeRacers.length === 0) return null;
    const maxPos = Math.max(...activeRacers.map(r => r.position));
    const leaders = activeRacers.filter(r => r.position === maxPos);
    if (leaders.length > 1) {
      return {
        type: 'CHOOSE_COPIED_ABILITY' as const,
        racerName: 'copy_cat' as const,
        candidates: leaders.map(r => r.racerName),
      };
    }
    return null;
  },
  execute(event, state, decision) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    const activeRacers = state.activeRacers.filter(r => !r.finished && !r.eliminated && r.racerName !== 'copy_cat');
    if (activeRacers.length === 0) return { state, events: [] };

    let leaderName: string;
    if (decision && decision.type === 'CHOOSE_COPIED_ABILITY') {
      leaderName = decision.racerName;
    } else {
      const maxPos = Math.max(...activeRacers.map(r => r.position));
      const leaders = activeRacers.filter(r => r.position === maxPos);
      leaderName = leaders[0].racerName;
    }

    const newRacers = state.activeRacers.map(r => {
      if (r.racerName === 'copy_cat') return { ...r, copiedAbility: leaderName as any };
      return r;
    });

    return {
      state: { ...state, activeRacers: newRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'copy_cat', abilityName: '模仿猫', description: `模仿了${leaderName}的能力` },
      ],
    };
  },
};
