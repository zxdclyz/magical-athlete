import type { GameState, GameEvent, RacerName, ActiveRacer } from '../types.js';

/**
 * Roll a six-sided die.
 */
export function rollDice(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/**
 * Get the current finish count (how many racers have finished).
 */
function getFinishCount(state: GameState): number {
  return state.activeRacers.filter(r => r.finished).length;
}

/**
 * Move a racer forward by `distance` spaces. Emits RACER_MOVING,
 * RACER_PASSED (for each racer along the path), RACER_STOPPED,
 * and RACER_FINISHED if applicable.
 */
export function executeMovement(
  state: GameState,
  playerId: string,
  distance: number,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const racerIndex = state.activeRacers.findIndex(r => r.playerId === playerId && !r.finished && !r.eliminated);
  if (racerIndex === -1) return { state, events };

  const racer = state.activeRacers[racerIndex];
  const from = racer.position;
  const finishIndex = state.track.length - 1;
  const to = Math.min(finishIndex, Math.max(0, from + distance));

  events.push({ type: 'RACER_MOVING', racerName: racer.racerName, from, to, isMainMove: true });

  // Check for racers along the path (passed but not landed on)
  for (let pos = from + 1; pos < to; pos++) {
    for (const other of state.activeRacers) {
      if (other.racerName !== racer.racerName && other.position === pos && !other.finished && !other.eliminated) {
        events.push({ type: 'RACER_PASSED', movingRacer: racer.racerName, passedRacer: other.racerName, space: pos });
      }
    }
  }

  // Update racer position
  const activeRacers = state.activeRacers.map((r, i) => {
    if (i !== racerIndex) return r;
    const updated = { ...r, position: to };

    // Check finish
    if (to >= finishIndex) {
      const currentFinishCount = getFinishCount(state);
      updated.finished = true;
      updated.finishOrder = currentFinishCount + 1;
      events.push({ type: 'RACER_FINISHED', racerName: r.racerName, place: currentFinishCount + 1 });
    }
    return updated;
  });

  // Emit RACER_STOPPED (only if not finished)
  const updatedRacer = activeRacers[racerIndex];
  if (!updatedRacer.finished) {
    events.push({ type: 'RACER_STOPPED', racerName: racer.racerName, space: to });
  }

  return {
    state: { ...state, activeRacers },
    events,
  };
}

/**
 * Apply track space effects (arrow, trip, star) at the racer's current position.
 */
export function applyTrackSpaceEffect(
  state: GameState,
  racerName: RacerName,
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const racerIndex = state.activeRacers.findIndex(r => r.racerName === racerName);
  if (racerIndex === -1) return { state, events };

  const racer = state.activeRacers[racerIndex];
  const space = state.track[racer.position];
  if (!space) return { state, events };

  if (space.type === 'arrow' && space.arrowDistance !== undefined) {
    const finishIndex = state.track.length - 1;
    const newPos = Math.min(finishIndex, Math.max(0, racer.position + space.arrowDistance));
    const activeRacers = state.activeRacers.map((r, i) => {
      if (i !== racerIndex) return r;
      return { ...r, position: newPos };
    });
    events.push({ type: 'RACER_WARPED', racerName, from: racer.position, to: newPos });
    return { state: { ...state, activeRacers }, events };
  }

  if (space.type === 'trip') {
    const activeRacers = state.activeRacers.map((r, i) => {
      if (i !== racerIndex) return r;
      return { ...r, tripped: true };
    });
    events.push({ type: 'RACER_TRIPPED', racerName });
    return { state: { ...state, activeRacers }, events };
  }

  // star: gain a bronze chip (1 point)
  if (space.type === 'star') {
    const scores = { ...state.scores };
    const playerId = racer.playerId;
    scores[playerId] = (scores[playerId] || 0) + 1;
    events.push({ type: 'POINT_CHIP_GAINED', playerId, chipType: 'bronze', value: 1 });
    return { state: { ...state, scores }, events };
  }

  return { state, events };
}

/**
 * Check if the race should end: 2+ finishers, or all racers finished/eliminated.
 */
export function checkRaceEnd(state: GameState): boolean {
  const finishers = state.activeRacers.filter(r => r.finished).length;
  if (finishers >= 2) return true;

  const active = state.activeRacers.filter(r => !r.finished && !r.eliminated).length;
  return active === 0;
}

/**
 * Advance to the next player's turn. Skips finished and eliminated racers.
 */
export function advanceTurn(state: GameState): GameState {
  const playerCount = state.turnOrder.length;
  let nextIndex = (state.currentTurnIndex + 1) % playerCount;

  // Find next active (not finished, not eliminated) player
  for (let attempts = 0; attempts < playerCount; attempts++) {
    const playerId = state.turnOrder[nextIndex];
    const racer = state.activeRacers.find(r => r.playerId === playerId);
    if (racer && !racer.finished && !racer.eliminated) {
      return { ...state, currentTurnIndex: nextIndex };
    }
    nextIndex = (nextIndex + 1) % playerCount;
  }

  // All racers done — return as-is
  return { ...state, currentTurnIndex: nextIndex };
}

/**
 * Execute a complete basic turn for a player.
 * If diceValue is provided, use it (for testing); otherwise roll.
 */
export function executeTurn(
  state: GameState,
  playerId: string,
  diceValue?: number,
): { state: GameState; events: GameEvent[] } {
  const allEvents: GameEvent[] = [];
  let currentState = state;

  // 1. TURN_START
  allEvents.push({ type: 'TURN_START', playerId });

  // Check if racer is tripped — skip movement, untrip
  const racer = currentState.activeRacers.find(r => r.playerId === playerId && !r.finished && !r.eliminated);
  if (!racer) {
    allEvents.push({ type: 'TURN_END', playerId });
    return { state: currentState, events: allEvents };
  }

  // Record turn start position for Heckler
  const turnStartPositions = { ...currentState.turnStartPositions, [playerId]: racer.position };
  currentState = { ...currentState, turnStartPositions };

  if (racer.tripped) {
    // Untrip and skip
    const activeRacers = currentState.activeRacers.map(r => {
      if (r.racerName === racer.racerName) {
        return { ...r, tripped: false };
      }
      return r;
    });
    currentState = { ...currentState, activeRacers };
    allEvents.push({ type: 'TURN_END', playerId });
    return { state: currentState, events: allEvents };
  }

  // 2. DICE_ROLL
  const dice = diceValue ?? rollDice();
  allEvents.push({ type: 'DICE_ROLLED', playerId, value: dice });

  // 3. MOVEMENT
  const moveResult = executeMovement(currentState, playerId, dice);
  currentState = moveResult.state;
  allEvents.push(...moveResult.events);

  // 4. Track space effect (only if not finished)
  const updatedRacer = currentState.activeRacers.find(r => r.playerId === playerId)!;
  if (!updatedRacer.finished) {
    const effectResult = applyTrackSpaceEffect(currentState, updatedRacer.racerName);
    currentState = effectResult.state;
    allEvents.push(...effectResult.events);
  }

  // 5. TURN_END
  allEvents.push({ type: 'TURN_END', playerId });

  return { state: currentState, events: allEvents };
}
