import type { GameState, GameEvent, RacerName, ActiveRacer } from '../types.js';

/**
 * A player submits their secret racer choice for the upcoming race.
 * Choices are stored in raceSetupChoices until everyone has chosen,
 * then all are revealed simultaneously.
 */
export function processRacerChoice(
  state: GameState,
  playerId: string,
  racerName: RacerName,
): { state?: GameState; events?: GameEvent[]; error?: string } {
  if (state.phase !== 'RACE_SETUP') {
    return { error: 'Not in race setup phase' };
  }

  const player = state.players.find(p => p.id === playerId);
  if (!player) {
    return { error: `Unknown player: ${playerId}` };
  }

  if (!player.hand.includes(racerName)) {
    return { error: `Racer ${racerName} is not in your hand` };
  }

  if (player.usedRacers.includes(racerName)) {
    return { error: `Racer ${racerName} has already been used` };
  }

  // Check if player already chose this race
  if (state.raceSetupChoices[playerId]) {
    return { error: 'You already chose a racer for this race' };
  }

  // Record the secret choice
  const raceSetupChoices = { ...state.raceSetupChoices, [playerId]: racerName };

  // Check if all players have chosen
  const allChosen = state.players.every(p => raceSetupChoices[p.id]);

  if (!allChosen) {
    // Just record the choice, stay in RACE_SETUP
    return {
      state: { ...state, raceSetupChoices },
      events: [],
    };
  }

  // All chosen — reveal simultaneously!
  // Mark racers as used and create ActiveRacers
  const players = state.players.map(p => {
    const chosen = raceSetupChoices[p.id];
    return { ...p, usedRacers: [...p.usedRacers, chosen] };
  });

  const activeRacers: ActiveRacer[] = state.players.map(p => {
    const chosen = raceSetupChoices[p.id];
    return {
      racerName: chosen,
      playerId: p.id,
      position: 0,
      tripped: false,
      finished: false,
      finishOrder: null,
      eliminated: false,
      ...(chosen === 'sisyphus' ? { sisyphusChips: 4 } : {}),
    };
  });

  // Determine turn order based on last race results
  let turnOrder: string[];
  if (Object.keys(state.lastRacePositions).length > 0) {
    // Sort players: farthest behind (lowest position) goes first
    turnOrder = [...state.players]
      .sort((a, b) => (state.lastRacePositions[a.id] ?? 0) - (state.lastRacePositions[b.id] ?? 0))
      .map(p => p.id);
  } else {
    // First race: randomize order
    turnOrder = [...state.players].sort(() => Math.random() - 0.5).map(p => p.id);
  }

  const newState: GameState = {
    ...state,
    players,
    activeRacers,
    phase: 'RACING',
    turnOrder,
    currentTurnIndex: 0,
    raceSetupChoices: {},
  };

  return {
    state: newState,
    events: [
      { type: 'TURN_ORDER_DECIDED', turnOrder },
      { type: 'PHASE_CHANGED', phase: 'RACING' },
    ],
  };
}

export function allRacersChosen(state: GameState): boolean {
  return state.players.every(p => state.raceSetupChoices[p.id]);
}

/**
 * Check if a specific player has already chosen for this race.
 */
export function hasPlayerChosen(state: GameState, playerId: string): boolean {
  return !!state.raceSetupChoices[playerId];
}
