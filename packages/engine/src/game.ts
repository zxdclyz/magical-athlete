import type { GameState, GameEvent, PlayerAction, DecisionResponse, Player } from './types.js';
import { createInitialState } from './state.js';
import { startDraft, processDraftPick } from './phases/draft.js';
import { processRacerChoice } from './phases/race-setup.js';
import { executeTurn, advanceTurn, checkRaceEnd } from './phases/racing.js';
import { assignRaceChips, getFinalWinner } from './phases/scoring.js';
import { createTrack, RACE_TRACK_SEQUENCE } from './track.js';
import { EventEngine } from './events.js';
import { getHandlersForRace } from './abilities/index.js';

export interface ActionResult {
  state: GameState;
  events: GameEvent[];
  error?: string;
}

export class GameController {
  private eventEngine: EventEngine;

  constructor() {
    this.eventEngine = new EventEngine();
  }

  /**
   * Process a player action and return the new state + events.
   */
  processAction(state: GameState, playerId: string, action: PlayerAction): ActionResult {
    switch (action.type) {
      case 'START_GAME':
        return this.handleStartGame(state);

      case 'MAKE_DECISION':
        return this.handleDecision(state, playerId, action.decision);

      default:
        return { state, events: [], error: `Unknown action: ${action.type}` };
    }
  }

  /**
   * Handle START_GAME: transition from LOBBY to DRAFTING.
   */
  private handleStartGame(state: GameState): ActionResult {
    if (state.phase !== 'LOBBY') {
      return { state, events: [], error: 'Can only start game from LOBBY' };
    }
    if (state.players.length < 2) {
      return { state, events: [], error: 'Need at least 2 players' };
    }

    const result = startDraft(state);
    return { state: result.state, events: result.events };
  }

  /**
   * Handle MAKE_DECISION: route to the correct phase handler.
   */
  private handleDecision(state: GameState, playerId: string, decision: DecisionResponse): ActionResult {
    switch (state.phase) {
      case 'DRAFTING':
        return this.handleDraftDecision(state, playerId, decision);

      case 'RACE_SETUP':
        return this.handleRaceSetupDecision(state, playerId, decision);

      case 'RACING':
        return this.handleRacingDecision(state, playerId, decision);

      default:
        return { state, events: [], error: `No decisions expected in phase ${state.phase}` };
    }
  }

  private handleDraftDecision(state: GameState, playerId: string, decision: DecisionResponse): ActionResult {
    if (decision.type !== 'DRAFT_PICK') {
      return { state, events: [], error: 'Expected DRAFT_PICK decision' };
    }
    const result = processDraftPick(state, playerId, decision.racerName);
    if (result.error) return { state, events: [], error: result.error };
    return { state: result.state!, events: result.events ?? [] };
  }

  private handleRaceSetupDecision(state: GameState, playerId: string, decision: DecisionResponse): ActionResult {
    if (decision.type !== 'CHOOSE_RACE_RACER') {
      return { state, events: [], error: 'Expected CHOOSE_RACE_RACER decision' };
    }
    const result = processRacerChoice(state, playerId, decision.racerName);
    if (result.error) return { state, events: [], error: result.error };

    let newState = result.state!;
    const events = [...(result.events ?? [])];

    // If transitioning to RACING, set up event engine for this race
    if (newState.phase === 'RACING') {
      this.setupRaceEventEngine(newState);
    }

    return { state: newState, events };
  }

  private handleRacingDecision(state: GameState, playerId: string, decision: DecisionResponse): ActionResult {
    // If there's a pending decision from ability, resolve it
    if (state.pendingDecision) {
      // TODO: resume ability decision
      return { state: { ...state, pendingDecision: null }, events: [] };
    }

    // Otherwise this is a ROLL_DICE action — execute the turn
    if (decision.type !== 'ROLL_DICE') {
      return { state, events: [], error: 'Expected ROLL_DICE decision' };
    }

    const currentPlayerId = state.turnOrder[state.currentTurnIndex];
    if (playerId !== currentPlayerId) {
      return { state, events: [], error: `Not your turn. Expected ${currentPlayerId}` };
    }

    // Execute turn
    const turnResult = executeTurn(state, playerId, decision.value || undefined);
    let newState = turnResult.state;
    const events = [...turnResult.events];

    // Check race end
    if (checkRaceEnd(newState)) {
      const endResult = this.endRace(newState);
      newState = endResult.state;
      events.push(...endResult.events);
    } else {
      // Advance turn
      newState = advanceTurn(newState);
      // Reset triggeredThisMove for next turn
      newState = { ...newState, triggeredThisMove: new Set() };
    }

    return { state: newState, events };
  }

  /**
   * End current race: score, check if game over, or set up next race.
   */
  private endRace(state: GameState): { state: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];

    // Assign chips
    const scoringResult = assignRaceChips(state);
    let newState = scoringResult.state;
    events.push(...scoringResult.events);

    // Check if this was the last race
    if (newState.currentRace >= 4) {
      // Game over
      const winnerId = getFinalWinner(newState);
      const scores: Record<string, number> = {};
      for (const p of newState.players) {
        scores[p.id] = newState.scores[p.id] || 0;
      }
      newState = { ...newState, phase: 'GAME_OVER' };
      events.push({ type: 'GAME_ENDED', winnerId, scores });
      events.push({ type: 'PHASE_CHANGED', phase: 'GAME_OVER' });
    } else {
      // Next race
      const nextRace = newState.currentRace + 1;
      const trackId = RACE_TRACK_SEQUENCE[nextRace - 1];
      const trackConfig = createTrack(trackId);
      newState = {
        ...newState,
        phase: 'RACE_SETUP',
        currentRace: nextRace,
        track: trackConfig.spaces,
        trackConfig,
        activeRacers: [],
        turnOrder: [],
        currentTurnIndex: 0,
        triggeredThisMove: new Set(),
        pendingDecision: null,
        extraTurnPlayerId: null,
        skipperNextPlayerId: null,
        turnStartPositions: {},
      };
      events.push({ type: 'PHASE_CHANGED', phase: 'RACE_SETUP' });
    }

    return { state: newState, events };
  }

  /**
   * Set up event engine with ability handlers for the current race's active racers.
   */
  private setupRaceEventEngine(state: GameState): void {
    this.eventEngine.clearHandlers();
    const racerNames = state.activeRacers.map(r => r.racerName);
    const handlers = getHandlersForRace(racerNames);
    for (const handler of handlers) {
      this.eventEngine.registerHandler(handler);
    }
  }
}
