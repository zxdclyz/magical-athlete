import type { AbilityHandler } from '../events.js';

// Duelist: When a racer shares my space, I can shout DUEL!
// We roll dice and whoever rolls highest moves 2. I win ties.
export const duelistHandler: AbilityHandler = {
  racerName: 'duelist',
  eventTypes: ['RACER_STOPPED'],
  priority: 33,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_STOPPED') return false;
    const duelist = state.activeRacers.find(r => r.racerName === 'duelist' && !r.finished && !r.eliminated);
    if (!duelist) return false;
    if (event.racerName === 'duelist') return false; // Don't duel yourself
    return duelist.position === event.space;
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'RACER_STOPPED') return null;
    return {
      type: 'USE_ABILITY',
      racerName: 'duelist',
      abilityDescription: `Duel ${event.racerName}?`,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'RACER_STOPPED') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      // Both roll dice — simulated here. Winner moves 2.
      const duelistRoll = Math.floor(Math.random() * 6) + 1;
      const opponentRoll = Math.floor(Math.random() * 6) + 1;
      const duelistWins = duelistRoll >= opponentRoll; // Duelist wins ties
      const winner = duelistWins ? 'duelist' : event.racerName;
      const winnerRacer = state.activeRacers.find(r => r.racerName === winner)!;
      const finishIndex = state.track.length - 1;
      const newPos = Math.min(finishIndex, winnerRacer.position + 2);

      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === winner) return { ...r, position: newPos };
        return r;
      });

      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'duelist', abilityName: 'Duelist', description: `Duel! Duelist rolled ${duelistRoll}, ${event.racerName} rolled ${opponentRoll}. ${winner} wins and moves 2` },
          { type: 'RACER_MOVING', racerName: winner, from: winnerRacer.position, to: newPos, isMainMove: false },
        ],
      };
    }
    return { state, events: [] };
  },
};
