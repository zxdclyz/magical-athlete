import type { AbilityHandler } from '../events.js';

// Party Animal: At the start of my turn, all racers move 1 space towards me.
// Each other racer on my space gives me +1 to my main move.
export const partyAnimalHandler: AbilityHandler = {
  racerName: 'party_animal',
  eventTypes: ['TURN_START'],
  priority: 4,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_START') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'party_animal' && !r.finished && !r.eliminated);
    return !!racer && racer.playerId === event.playerId;
  },
  execute(event, state) {
    if (event.type !== 'TURN_START') return { state, events: [] };
    const partyAnimal = state.activeRacers.find(r => r.racerName === 'party_animal')!;
    const paPos = partyAnimal.position;
    const events: import('../types.js').GameEvent[] = [
      { type: 'ABILITY_TRIGGERED', racerName: 'party_animal', abilityName: 'Party Animal', description: 'All racers move 1 towards Party Animal' },
    ];

    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'party_animal' || r.finished || r.eliminated) return r;
      let newPos = r.position;
      if (r.position < paPos) {
        newPos = r.position + 1;
      } else if (r.position > paPos) {
        newPos = r.position - 1;
      }
      // Don't move if already on same space
      if (newPos !== r.position) {
        events.push({ type: 'RACER_MOVING', racerName: r.racerName, from: r.position, to: newPos, isMainMove: false });
      }
      return { ...r, position: newPos };
    });

    // Count racers on PA's space (after movement) for dice bonus
    const onSpace = activeRacers.filter(
      r => r.racerName !== 'party_animal' && r.position === paPos && !r.finished && !r.eliminated
    ).length;

    if (onSpace > 0) {
      events.push({ type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: 0, newValue: onSpace, reason: 'Party Animal bonus' });
    }

    return { state: { ...state, activeRacers }, events };
  },
};
