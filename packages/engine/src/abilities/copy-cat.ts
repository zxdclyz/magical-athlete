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
  execute(event, state) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    // Find the leader(s)
    const activeRacers = state.activeRacers.filter(r => !r.finished && !r.eliminated && r.racerName !== 'copy_cat');
    if (activeRacers.length === 0) return { state, events: [] };

    const maxPos = Math.max(...activeRacers.map(r => r.position));
    const leaders = activeRacers.filter(r => r.position === maxPos);
    const leaderName = leaders[0].racerName; // Pick first if tied (decision can be added later)

    const newRacers = state.activeRacers.map(r => {
      if (r.racerName === 'copy_cat') return { ...r, copiedAbility: leaderName };
      return r;
    });

    return {
      state: { ...state, activeRacers: newRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'copy_cat', abilityName: 'Copy Cat', description: `Copying ${leaderName}'s ability` },
      ],
    };
  },
};
