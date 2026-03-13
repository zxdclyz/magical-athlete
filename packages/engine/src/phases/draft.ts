import type { GameState, GameEvent, RacerName } from '../types.js';
import { ALL_RACER_NAMES } from '../racers.js';
import { generateFullDraftOrder, getFlipCount, flipDraftCards } from '../state.js';

/**
 * Start draft: flip first round of cards, set up snake draft order.
 */
export function startDraft(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // Roll off to determine draft order (rulebook page 12)
  const rolls = state.players.map(p => ({
    playerId: p.id,
    roll: Math.floor(Math.random() * 6) + 1,
  }));
  // Sort by roll descending (highest goes first), break ties randomly
  rolls.sort((a, b) => b.roll - a.roll || (Math.random() - 0.5));

  const sortedPlayerIds = rolls.map(r => r.playerId);

  // Emit a single draft-order event (not DICE_ROLLED, to avoid triggering race dice animations)
  events.push({
    type: 'DRAFT_ORDER_ROLLED',
    rolls: rolls.map(r => ({ playerId: r.playerId, value: r.roll })),
    order: sortedPlayerIds,
  });

  const playerCount = sortedPlayerIds.length;
  const draftOrder = generateFullDraftOrder(sortedPlayerIds, playerCount);

  // Flip first round of cards
  const flipCount = getFlipCount(playerCount);
  const flipped = flipDraftCards(ALL_RACER_NAMES, [], flipCount);

  const newState: GameState = {
    ...state,
    phase: 'DRAFTING',
    draftOrder,
    draftCurrentIndex: 0,
    availableRacers: flipped,
  };

  events.push({ type: 'PHASE_CHANGED', phase: 'DRAFTING' });

  return {
    state: newState,
    events,
  };
}

/**
 * Process a draft pick. When a round's available racers are exhausted,
 * flip the next round's cards.
 */
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

  let availableRacers = state.availableRacers.filter(r => r !== racerName);
  const nextIndex = state.draftCurrentIndex + 1;
  const draftComplete = nextIndex >= state.draftOrder.length;

  // Check if current round is finished (all flipped cards taken)
  // and we need to flip new cards for the next round
  if (!draftComplete && availableRacers.length === 0) {
    // Collect all already-drafted racer names
    const allDrafted = players.flatMap(p => p.hand);
    const flipCount = getFlipCount(players.length);
    availableRacers = flipDraftCards(ALL_RACER_NAMES, allDrafted, flipCount);
  }

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
