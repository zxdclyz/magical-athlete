import type { AbilityHandler } from '../events.js';

// Party Animal: At the start of my turn, all racers move 1 space towards me.
// Each other racer on my space gives me +1 to my main move.
export const partyAnimalMoveHandler: AbilityHandler = {
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
      { type: 'ABILITY_TRIGGERED', racerName: 'party_animal', abilityName: '派对动物', description: '所有角色向派对动物靠近1格' },
    ];
    let finishCount = state.activeRacers.filter(r => r.finished).length;
    const finishIndex = state.track.length - 1;

    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'party_animal' || r.finished || r.eliminated) return r;
      let newPos = r.position;
      if (r.position < paPos) {
        newPos = r.position + 1;
      } else if (r.position > paPos) {
        newPos = r.position - 1;
      }
      if (newPos !== r.position) {
        events.push({ type: 'RACER_MOVING', racerName: r.racerName, from: r.position, to: newPos, isMainMove: false });
        const updated = { ...r, position: newPos };
        if (newPos >= finishIndex && !r.finished) {
          finishCount++;
          updated.finished = true;
          updated.finishOrder = finishCount;
          events.push({ type: 'RACER_FINISHED', racerName: r.racerName, place: finishCount });
        }
        return updated;
      }
      return r;
    });

    return { state: { ...state, activeRacers }, events };
  },
};

// Party Animal dice bonus: +1 per racer sharing space at dice roll time
export const partyAnimalBonusHandler: AbilityHandler = {
  racerName: 'party_animal',
  eventTypes: ['DICE_ROLLED'],
  priority: 13,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const racer = state.activeRacers.find(r => r.racerName === 'party_animal' && !r.finished && !r.eliminated);
    if (!racer || racer.playerId !== event.playerId) return false;
    // Check if any other racer is on party animal's space
    return state.activeRacers.some(
      r => r.racerName !== 'party_animal' && r.position === racer.position && !r.finished && !r.eliminated
    );
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const partyAnimal = state.activeRacers.find(r => r.racerName === 'party_animal')!;
    const onSpace = state.activeRacers.filter(
      r => r.racerName !== 'party_animal' && r.position === partyAnimal.position && !r.finished && !r.eliminated
    ).length;
    if (onSpace === 0) return { state, events: [] };
    return {
      state,
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'party_animal', abilityName: '派对动物', description: `${onSpace}个角色同格——移动 +${onSpace}` },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue: event.value + onSpace, reason: 'Party Animal' },
      ],
    };
  },
};
