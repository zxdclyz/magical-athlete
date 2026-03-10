import type { AbilityHandler } from '../events.js';

// Inchworm: When another racer rolls a 1, they skip that move and I move 1.
export const inchwormHandler: AbilityHandler = {
  racerName: 'inchworm',
  eventTypes: ['DICE_ROLLED'],
  priority: 8,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const inchworm = state.activeRacers.find(r => r.racerName === 'inchworm' && !r.finished && !r.eliminated);
    if (!inchworm) return false;
    if (inchworm.playerId === event.playerId) return false; // Only other racers
    return event.value === 1;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const inchworm = state.activeRacers.find(r => r.racerName === 'inchworm')!;
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, inchworm.position + 1);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'inchworm') return { ...r, position: newPos };
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'inchworm', abilityName: 'Inchworm', description: `Another racer rolled 1 — Inchworm moves 1, their move is skipped` },
        { type: 'RACER_MOVING', racerName: 'inchworm', from: inchworm.position, to: newPos, isMainMove: false },
        // The roller's move skip is handled by the turn engine checking for this event
      ],
    };
  },
};
