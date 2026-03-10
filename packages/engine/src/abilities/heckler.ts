import type { AbilityHandler } from '../events.js';

// Heckler: When a racer ends their turn within 1 space of where they started, I move 2.
export const hecklerHandler: AbilityHandler = {
  racerName: 'heckler',
  eventTypes: ['TURN_END'],
  priority: 50,
  shouldTrigger(event, state) {
    if (event.type !== 'TURN_END') return false;
    const heckler = state.activeRacers.find(r => r.racerName === 'heckler' && !r.finished && !r.eliminated);
    if (!heckler) return false;
    // Don't trigger on heckler's own turn
    if (heckler.playerId === event.playerId) return false;
    // Check if the racer barely moved (within 1 space of start)
    const racer = state.activeRacers.find(r => r.playerId === event.playerId && !r.eliminated);
    if (!racer) return false;
    const startPos = state.turnStartPositions[event.playerId];
    if (startPos === undefined) return false;
    return Math.abs(racer.position - startPos) <= 1;
  },
  execute(event, state) {
    if (event.type !== 'TURN_END') return { state, events: [] };
    const heckler = state.activeRacers.find(r => r.racerName === 'heckler')!;
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, heckler.position + 2);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'heckler') {
        return { ...r, position: newPos };
      }
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'heckler', abilityName: 'Heckler', description: 'Racer barely moved — Heckler moves 2' },
        { type: 'RACER_MOVING', racerName: 'heckler', from: heckler.position, to: newPos, isMainMove: false },
      ],
    };
  },
};
