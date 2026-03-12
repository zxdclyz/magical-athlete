import type { AbilityHandler } from '../events.js';

// Stickler: Other racers can only cross the finish line by exact amount.
// If they overshoot, they don't move.
// Two handlers:
// 1. sticklerHandler — listens to DICE_ROLLED, cancels main-move overshoots via DICE_MODIFIED.
// 2. sticklerMovementHandler — listens to RACER_MOVING for ability-caused moves that overshoot.
export const sticklerHandler: AbilityHandler = {
  racerName: 'stickler',
  eventTypes: ['DICE_ROLLED'],
  priority: 1, // Very high priority — must check before other dice modifiers
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const stickler = state.activeRacers.find(r => r.racerName === 'stickler' && !r.finished && !r.eliminated);
    if (!stickler) return false;
    // Only affects other racers, not stickler itself
    if (stickler.playerId === event.playerId) return false;
    const roller = state.activeRacers.find(r => r.playerId === event.playerId && !r.finished && !r.eliminated);
    if (!roller) return false;
    const finishIndex = state.track.length - 1;
    const remaining = finishIndex - roller.position;
    // Trigger if dice would overshoot
    return event.value > remaining;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const roller = state.activeRacers.find(r => r.playerId === event.playerId)!;
    return {
      state,
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'stickler', abilityName: '较真者', description: `${roller.racerName}超过了终点线——不移动` },
        { type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: event.value, newValue: 0, reason: 'Stickler' },
      ],
    };
  },
};

export const sticklerMovementHandler: AbilityHandler = {
  racerName: 'stickler',
  eventTypes: ['RACER_MOVING'],
  priority: 1,
  shouldTrigger(event, state) {
    if (event.type !== 'RACER_MOVING') return false;
    if (event.isMainMove) return false; // main move already handled by DICE_ROLLED handler
    const stickler = state.activeRacers.find(r => r.racerName === 'stickler' && !r.finished && !r.eliminated);
    if (!stickler) return false;
    if (event.racerName === 'stickler') return false; // doesn't affect self
    const finishIndex = state.track.length - 1;
    const distance = event.to - event.from;
    const remaining = finishIndex - event.from;
    return distance > remaining && distance > 0;
  },
  execute(event, state) {
    if (event.type !== 'RACER_MOVING') return { state, events: [] };
    // Reset the racer's position back to where they were
    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === event.racerName) return { ...r, position: event.from };
      return r;
    });
    return {
      state: { ...state, activeRacers },
      events: [
        { type: 'ABILITY_TRIGGERED', racerName: 'stickler', abilityName: '较真者', description: `${event.racerName}的移动超过了终点线——不移动` },
      ],
    };
  },
};