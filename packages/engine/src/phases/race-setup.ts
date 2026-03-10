import type { GameState, GameEvent, RacerName, ActiveRacer } from '../types.js';

// Track which players have chosen for the current race
const raceChoices = new Map<string, RacerName>();

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

  // Check if player already chose this race (from activeRacers being built)
  const existingChoice = state.activeRacers.find(r => r.playerId === playerId);
  if (existingChoice) {
    return { error: 'You already chose a racer for this race' };
  }

  // Mark racer as used
  const players = state.players.map(p => {
    if (p.id === playerId) {
      return { ...p, usedRacers: [...p.usedRacers, racerName] };
    }
    return p;
  });

  // Create ActiveRacer
  const newRacer: ActiveRacer = {
    racerName,
    playerId,
    position: 0,
    tripped: false,
    finished: false,
    finishOrder: null,
    eliminated: false,
    ...(racerName === 'sisyphus' ? { sisyphusChips: 4 } : {}),
  };

  const activeRacers = [...state.activeRacers, newRacer];
  const allChosen = activeRacers.length === state.players.length;

  const newState: GameState = {
    ...state,
    players,
    activeRacers,
    phase: allChosen ? 'RACING' : 'RACE_SETUP',
    turnOrder: allChosen ? players.map(p => p.id) : state.turnOrder,
    currentTurnIndex: allChosen ? 0 : state.currentTurnIndex,
  };

  const events: GameEvent[] = [];
  if (allChosen) {
    events.push({ type: 'PHASE_CHANGED', phase: 'RACING' });
  }

  return { state: newState, events };
}

export function allRacersChosen(state: GameState): boolean {
  return state.activeRacers.length === state.players.length;
}
