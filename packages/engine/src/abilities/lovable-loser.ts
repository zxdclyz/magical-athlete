import type { AbilityHandler } from '../events.js';

// Lovable Loser: At the start of my turn, I get a bronze chip if I'm alone in last place.
export const lovableLoserHandler: AbilityHandler = {
  racerName: 'lovable_loser',
  eventTypes: ['TURN_START'],
  priority: 6,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'lovable_loser');
    if (!racer || racer.playerId !== event.playerId || racer.finished) return false;
    // Check if alone in last place
    const activeRacers = state.activeRacers.filter(r => !r.finished && !r.eliminated);
    const minPos = Math.min(...activeRacers.map(r => r.position));
    const lastPlacers = activeRacers.filter(r => r.position === minPos);
    return lastPlacers.length === 1 && lastPlacers[0].racerName === 'lovable_loser';
  },
  execute(event, state) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    const racer = state.activeRacers.find(r => r.racerName === 'lovable_loser')!;
    const scores = { ...state.scores };
    scores[racer.playerId] = (scores[racer.playerId] || 0) + 1;
    return {
      state: { ...state, scores },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'lovable_loser', abilityName: '可爱的失败者', description: '独自垫底——获得铜色筹码' },
        { type: 'POINT_CHIP_GAINED', playerId: racer.playerId, chipType: 'bronze', value: 1 },
      ],
    };
  },
};
