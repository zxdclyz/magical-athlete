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

    if (event.racerName === 'duelist') {
      // Duelist stopped — check if someone else is on that space
      return state.activeRacers.some(
        r => r.racerName !== 'duelist' && r.position === event.space && !r.finished && !r.eliminated
      );
    } else {
      // Someone else stopped on duelist's space
      return duelist.position === event.space;
    }
  },
  getDecisionRequest(event, state) {
    if (event.type !== 'RACER_STOPPED') return null;
    const duelist = state.activeRacers.find(r => r.racerName === 'duelist')!;
    // Find the opponent name for the decision description
    let opponentName: string;
    if (event.racerName === 'duelist') {
      const opponent = state.activeRacers.find(
        r => r.racerName !== 'duelist' && r.position === event.space && !r.finished && !r.eliminated
      );
      opponentName = opponent?.racerName ?? '?';
    } else {
      opponentName = event.racerName;
    }
    return {
      type: 'USE_ABILITY',
      racerName: 'duelist',
      abilityDescription: `与${opponentName}决斗？`,
    };
  },
  execute(event, state, decision) {
    if (event.type !== 'RACER_STOPPED') return { state, events: [] };
    if (decision && decision.type === 'USE_ABILITY' && decision.use) {
      const duelist = state.activeRacers.find(r => r.racerName === 'duelist')!;
      // Determine opponent
      let opponent;
      if (event.racerName === 'duelist') {
        opponent = state.activeRacers.find(
          r => r.racerName !== 'duelist' && r.position === event.space && !r.finished && !r.eliminated
        );
      } else {
        opponent = state.activeRacers.find(r => r.racerName === event.racerName);
      }
      if (!opponent) return { state, events: [] };

      // Both roll dice — simulated here. Winner moves 2.
      const duelistRoll = Math.floor(Math.random() * 6) + 1;
      const opponentRoll = Math.floor(Math.random() * 6) + 1;
      const duelistWins = duelistRoll >= opponentRoll; // Duelist wins ties
      const winner = duelistWins ? 'duelist' : opponent.racerName;
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
          { type: 'ABILITY_TRIGGERED', racerName: 'duelist', abilityName: '决斗者', description: `决斗！决斗者掷出${duelistRoll}，${opponent.racerName}掷出${opponentRoll}。${winner}获胜并前进2格` },
          { type: 'RACER_MOVING', racerName: winner, from: winnerRacer.position, to: newPos, isMainMove: false },
        ],
      };
    }
    return { state, events: [] };
  },
};
