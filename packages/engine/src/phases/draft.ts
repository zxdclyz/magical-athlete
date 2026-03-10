import type { GameState, GameEvent, RacerName } from '../types.js';
import { generateDraftOrder, getDraftsPerPlayer } from '../state.js';

export function startDraft(state: GameState): { state: GameState; events: GameEvent[] } {
  const playerIds = state.players.map(p => p.id);
  const draftsPerPlayer = getDraftsPerPlayer(state.players.length);
  const draftOrder = generateDraftOrder(playerIds, draftsPerPlayer);

  const newState: GameState = {
    ...state,
    phase: 'DRAFTING',
    draftOrder,
    draftCurrentIndex: 0,
  };

  return {
    state: newState,
    events: [{ type: 'PHASE_CHANGED', phase: 'DRAFTING' }],
  };
}

export function processDraftPick(
  state: GameState,
  playerId: string,
  racerName: RacerName,
): { state?: GameState; events?: GameEvent[]; error?: string } {
  if (state.phase !== 'DRAFTING') {
    return { error: 'Not in drafting phase' };
  }

  const expectedPlayerId = state.draftOrder[state.draftCurrentIndex];
  if (playerId !== expectedPlayerId) {
    return { error: `Not your turn to draft. Expected ${expectedPlayerId}` };
  }

  if (!state.availableRacers.includes(racerName)) {
    return { error: `Racer ${racerName} is not available` };
  }

  // Update player hand
  const players = state.players.map(p => {
    if (p.id === playerId) {
      return { ...p, hand: [...p.hand, racerName] };
    }
    return p;
  });

  const availableRacers = state.availableRacers.filter(r => r !== racerName);
  const nextIndex = state.draftCurrentIndex + 1;
  const draftComplete = nextIndex >= state.draftOrder.length;

  const newState: GameState = {
    ...state,
    players,
    availableRacers,
    draftCurrentIndex: nextIndex,
    phase: draftComplete ? 'RACE_SETUP' : 'DRAFTING',
  };

  const events: GameEvent[] = [];
  if (draftComplete) {
    events.push({ type: 'PHASE_CHANGED', phase: 'RACE_SETUP' });
  }

  return { state: newState, events };
}
