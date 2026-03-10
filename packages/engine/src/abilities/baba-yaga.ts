import type { AbilityHandler } from '../events.js';

// Baba Yaga: Trip any racer that stops on my space, or when I stop on theirs.
export const babaYagaHandler: AbilityHandler = {
  racerName: 'baba_yaga',
  eventTypes: ['RACER_STOPPED'],
  priority: 32,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_STOPPED') return false;
    const babaYaga = state.activeRacers.find(r => r.racerName === 'baba_yaga' && !r.finished && !r.eliminated);
    if (!babaYaga) return false;

    if (event.racerName === 'baba_yaga') {
      // Baba Yaga stopped — trip anyone on her space
      return state.activeRacers.some(
        r => r.racerName !== 'baba_yaga' && r.position === event.space && !r.finished && !r.eliminated
      );
    } else {
      // Someone else stopped on Baba Yaga's space
      return babaYaga.position === event.space;
    }
  },
  execute(event, state) {
    if (event.type !== 'RACER_STOPPED') return { state, events: [] };
    const babaYaga = state.activeRacers.find(r => r.racerName === 'baba_yaga')!;
    const events: import('../types.js').GameEvent[] = [];

    if (event.racerName === 'baba_yaga') {
      // Trip everyone on Baba Yaga's space
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName !== 'baba_yaga' && r.position === event.space && !r.finished && !r.eliminated) {
          events.push(
            { type: 'ABILITY_TRIGGERED', racerName: 'baba_yaga', abilityName: 'Baba Yaga', description: `Tripped ${r.racerName}` },
            { type: 'RACER_TRIPPED', racerName: r.racerName },
          );
          return { ...r, tripped: true };
        }
        return r;
      });
      return { state: { ...state, activeRacers }, events };
    } else {
      // Someone stopped on Baba Yaga — trip them
      const activeRacers = state.activeRacers.map(r => {
        if (r.racerName === event.racerName) {
          return { ...r, tripped: true };
        }
        return r;
      });
      return {
        state: { ...state, activeRacers },
        events: [
          { type: 'ABILITY_TRIGGERED', racerName: 'baba_yaga', abilityName: 'Baba Yaga', description: `Tripped ${event.racerName}` },
          { type: 'RACER_TRIPPED', racerName: event.racerName },
        ],
      };
    }
  },
};
