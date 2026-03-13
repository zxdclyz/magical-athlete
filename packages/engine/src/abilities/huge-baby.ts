import type { AbilityHandler } from '../events.js';

// Huge Baby: No one can be on my space (besides Start). Put them on the space behind me.
export const hugeBabyHandler: AbilityHandler = {
  racerName: 'huge_baby',
  eventTypes: ['RACER_STOPPED'],
  priority: 2, // Very high priority — must redirect before other effects
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_STOPPED') return false;
    const hugeBaby = state.activeRacers.find(r => r.racerName === 'huge_baby' && !r.finished && !r.eliminated);
    if (!hugeBaby) return false;
    if (event.racerName === 'huge_baby') return false;
    // Start space (0) is exempt
    if (event.space === 0) return false;
    return hugeBaby.position === event.space;
  },
  execute(event, state) {
    if (event.type !== 'RACER_STOPPED') return { state, events: [] };
    // Move the racer to the space behind Huge Baby
    const behindPos = Math.max(0, event.space - 1);
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === event.racerName) {
        return { ...r, position: behindPos };
      }
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'huge_baby', abilityName: '巨婴', description: `${event.racerName}不能同格——被移到身后` },
        { type: 'RACER_WARPED', racerName: event.racerName, from: event.space, to: behindPos },
      ],
    };
  },
};
