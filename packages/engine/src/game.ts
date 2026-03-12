import type { GameState, GameEvent, PlayerAction, DecisionResponse, Player } from './types.js';
import { createInitialState } from './state.js';
import { startDraft, processDraftPick } from './phases/draft.js';
import { processRacerChoice } from './phases/race-setup.js';
import { rollDice, executeMovement, applyTrackSpaceEffect, advanceTurn, checkRaceEnd } from './phases/racing.js';
import { assignRaceChips, getFinalWinners } from './phases/scoring.js';
import { createTrack, RACE_TRACK_SEQUENCE } from './track.js';
import { EventEngine } from './events.js';
import { getHandlersForRace, createCopiedHandlers } from './abilities/index.js';

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

      case 'CONTINUE_FROM_RACE_END':
        return this.handleContinueFromRaceEnd(state);

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

    // If transitioning to RACING, set up event engine and process PHASE_CHANGED
    if (newState.phase === 'RACING') {
      this.setupRaceEventEngine(newState);

      // Process PHASE_CHANGED through EventEngine (triggers Egg, Twin, etc.)
      const phaseEvent: GameEvent = { type: 'PHASE_CHANGED', phase: 'RACING' };
      const phResult = this.processEventThroughEngine(newState, phaseEvent);
      if (phResult.pendingDecision) {
        const pd = phResult.pendingDecision;
        newState = {
          ...phResult.state,
          pendingDecision: {
            playerId: pd.playerId,
            request: pd.request,
            handlerIndex: pd.handlerIndex,
            triggerEvent: pd.triggerEvent,
          },
        };
        events.push(...phResult.events);
        return { state: newState, events };
      }
      newState = phResult.state;
      events.push(...phResult.events);

      // Handle Sisyphus: grant 4 point chips at race start
      for (const racer of newState.activeRacers) {
        if (racer.racerName === 'sisyphus' && racer.sisyphusChips) {
          const scores = { ...newState.scores };
          scores[racer.playerId] = (scores[racer.playerId] || 0) + racer.sisyphusChips;
          newState = { ...newState, scores };
          events.push({ type: 'POINT_CHIP_GAINED', playerId: racer.playerId, chipType: 'bronze', value: racer.sisyphusChips });
          events.push({ type: 'ABILITY_TRIGGERED', racerName: 'sisyphus', abilityName: '西西弗斯', description: `比赛开始获得${racer.sisyphusChips}枚分数筹码` });
        }
      }

      // Automatically begin the first turn (process TURN_START before player rolls)
      const turnResult = this.beginNextTurn(newState, events);
      return turnResult;
    }

    return { state: newState, events };
  }

  private handleRacingDecision(state: GameState, playerId: string, decision: DecisionResponse): ActionResult {
    // Case 1: Resuming from an ability decision
    if (state.pendingDecision && state.pendingDecision.handlerIndex !== undefined) {
      const resumeResult = this.eventEngine.resumeAfterDecision(
        state,
        decision,
        state.pendingDecision.handlerIndex,
        state.pendingDecision.triggerEvent!,
      );

      let newState: GameState = { ...resumeResult.state, pendingDecision: null };
      const events = [...resumeResult.events];

      // Check if another decision is needed from the chain
      if (resumeResult.pendingDecision) {
        const pd = resumeResult.pendingDecision;
        newState = {
          ...newState,
          pendingDecision: {
            playerId: pd.playerId,
            request: pd.request,
            handlerIndex: pd.handlerIndex,
            triggerEvent: pd.triggerEvent,
            turnPhase: state.pendingDecision.turnPhase,
            turnPlayerId: state.pendingDecision.turnPlayerId,
            diceValue: state.pendingDecision.diceValue,
          },
        };
        return { state: newState, events };
      }

      // No more decisions needed — continue the turn from where we left off
      // If turnPhase is undefined, this was a pre-race decision (Egg/Twin), just return
      if (!state.pendingDecision.turnPhase) {
        // Refresh copied handlers since Egg/Twin may have set copiedAbility
        this.refreshCopiedHandlers(newState);
        // After pre-race decisions, begin the first turn
        return this.beginNextTurn(newState, events);
      }
      return this.continueTurn(newState, events,
        state.pendingDecision.turnPhase,
        state.pendingDecision.turnPlayerId!,
        state.pendingDecision.diceValue,
      );
    }

    // Case 2: ROLL_DICE — dice + movement (TURN_START already processed)
    if (decision.type !== 'ROLL_DICE') {
      return { state, events: [], error: 'Expected ROLL_DICE decision' };
    }

    const currentPlayerId = state.turnOrder[state.currentTurnIndex];
    if (playerId !== currentPlayerId) {
      return { state, events: [], error: `Not your turn. Expected ${currentPlayerId}` };
    }

    // TURN_START was already processed in beginNextTurn, go straight to dice
    return this.executeDiceAndMovement(state, [], playerId, decision.value || undefined);
  }

  /**
   * Begin the next turn: process TURN_START abilities before the player rolls dice.
   * Called after finishTurn advances the turn index, or at the start of a race.
   */
  private beginNextTurn(state: GameState, priorEvents: GameEvent[]): ActionResult {
    const playerId = state.turnOrder[state.currentTurnIndex];
    let currentState = { ...state, skipMainMove: false };
    const allEvents = [...priorEvents];

    // Find racer
    const racer = currentState.activeRacers.find(
      r => r.playerId === playerId && !r.finished && !r.eliminated
    );
    if (!racer) {
      // No active racer — skip this turn entirely
      allEvents.push({ type: 'TURN_START', playerId }, { type: 'TURN_END', playerId });
      return this.finishTurn(currentState, allEvents, playerId);
    }

    // Record turn start position for Heckler
    currentState = {
      ...currentState,
      turnStartPositions: { ...currentState.turnStartPositions, [playerId]: racer.position },
    };

    // Tripped → skip & untrip (no dice roll needed)
    if (racer.tripped) {
      const activeRacers = currentState.activeRacers.map(r =>
        r.racerName === racer.racerName ? { ...r, tripped: false } : r
      );
      currentState = { ...currentState, activeRacers };
      allEvents.push({ type: 'TURN_START', playerId });

      // Process TURN_START through abilities (skills still fire even when tripped)
      const tsResult = this.processEventThroughEngine(currentState, { type: 'TURN_START', playerId });
      if (tsResult.pendingDecision) {
        return this.pauseForDecision(tsResult, allEvents, 'TURN_START', playerId, undefined);
      }
      currentState = tsResult.state;
      allEvents.push(...tsResult.events);

      allEvents.push({ type: 'TURN_END', playerId });
      // Process TURN_END through abilities
      const teResult = this.processEventThroughEngine(currentState, { type: 'TURN_END', playerId });
      currentState = teResult.state;
      allEvents.push(...teResult.events);

      return this.finishTurn(currentState, allEvents, playerId);
    }

    // === TURN_START ===
    allEvents.push({ type: 'TURN_START', playerId });
    const tsResult = this.processEventThroughEngine(currentState, { type: 'TURN_START', playerId });
    if (tsResult.pendingDecision) {
      return this.pauseForDecision(tsResult, allEvents, 'TURN_START', playerId, undefined);
    }
    currentState = tsResult.state;
    allEvents.push(...tsResult.events);

    // Refresh proxy handlers in case Copy Cat changed copiedAbility
    this.refreshCopiedHandlers(currentState);

    // If skipMainMove is set (Hare lead, Legs, Flip Flop swap), skip dice and end turn
    if (currentState.skipMainMove) {
      allEvents.push({ type: 'TURN_END', playerId });
      const teResult = this.processEventThroughEngine(currentState, { type: 'TURN_END', playerId });
      currentState = teResult.state;
      allEvents.push(...teResult.events);
      return this.finishTurn(currentState, allEvents, playerId);
    }

    // TURN_START resolved without issues — return state, client will show ROLL_DICE
    return { state: currentState, events: allEvents };
  }

  private executeDiceAndMovement(
    state: GameState,
    allEvents: GameEvent[],
    playerId: string,
    diceValue?: number,
  ): ActionResult {
    let currentState = state;

    // === DICE_ROLLED ===
    const dice = diceValue ?? rollDice();
    allEvents.push({ type: 'DICE_ROLLED', playerId, value: dice });
    const drResult = this.processEventThroughEngine(currentState, { type: 'DICE_ROLLED', playerId, value: dice });
    if (drResult.pendingDecision) {
      return this.pauseForDecision(drResult, allEvents, 'DICE_ROLLED', playerId, dice);
    }
    currentState = drResult.state;
    allEvents.push(...drResult.events);

    // Collect dice modifications — accumulate deltas from all modifiers
    let finalDice = dice;
    for (const ev of drResult.events) {
      if (ev.type === 'DICE_MODIFIED' && ev.playerId === playerId) {
        finalDice += ev.newValue - ev.originalValue;
      }
    }
    finalDice = Math.max(0, finalDice);

    return this.executeMovementPhase(currentState, allEvents, playerId, finalDice);
  }

  private executeMovementPhase(
    state: GameState,
    allEvents: GameEvent[],
    playerId: string,
    finalDice: number,
  ): ActionResult {
    let currentState = state;

    // === MOVEMENT ===
    if (finalDice > 0) {
      const moveResult = executeMovement(currentState, playerId, finalDice);
      currentState = moveResult.state;
      allEvents.push(...moveResult.events);

      // Process movement events through abilities
      for (const moveEvent of moveResult.events) {
        const evResult = this.processEventThroughEngine(currentState, moveEvent);
        if (evResult.pendingDecision) {
          return this.pauseForDecision(evResult, allEvents, 'MOVEMENT', playerId, finalDice);
        }
        currentState = evResult.state;
        allEvents.push(...evResult.events);
      }
    }

    // === TRACK EFFECT ===
    const updatedRacer = currentState.activeRacers.find(r => r.playerId === playerId);
    if (updatedRacer && !updatedRacer.finished) {
      const effectResult = applyTrackSpaceEffect(currentState, updatedRacer.racerName);
      currentState = effectResult.state;
      allEvents.push(...effectResult.events);
    }

    return this.executeTurnEnd(currentState, allEvents, playerId);
  }

  private executeTurnEnd(
    state: GameState,
    allEvents: GameEvent[],
    playerId: string,
  ): ActionResult {
    let currentState = state;

    // === TURN_END ===
    allEvents.push({ type: 'TURN_END', playerId });
    const teResult = this.processEventThroughEngine(currentState, { type: 'TURN_END', playerId });
    if (teResult.pendingDecision) {
      return this.pauseForDecision(teResult, allEvents, 'TURN_END', playerId, undefined);
    }
    currentState = teResult.state;
    allEvents.push(...teResult.events);

    return this.finishTurn(currentState, allEvents, playerId);
  }

  private processEventThroughEngine(state: GameState, event: GameEvent) {
    return this.eventEngine.processEvent(event, state);
  }

  private pauseForDecision(
    result: { state: GameState; events: GameEvent[]; pendingDecision?: { playerId: string; request: any; handlerIndex: number; triggerEvent: GameEvent } | null },
    priorEvents: GameEvent[],
    turnPhase: string,
    playerId: string,
    diceValue?: number,
  ): ActionResult {
    const pd = result.pendingDecision!;
    return {
      state: {
        ...result.state,
        pendingDecision: {
          playerId: pd.playerId,
          request: pd.request,
          handlerIndex: pd.handlerIndex,
          triggerEvent: pd.triggerEvent,
          turnPhase: turnPhase as any,
          turnPlayerId: playerId,
          diceValue,
        },
      },
      events: [...priorEvents, ...result.events],
    };
  }

  private finishTurn(state: GameState, events: GameEvent[], playerId: string): ActionResult {
    let newState = state;

    // Check race end
    if (checkRaceEnd(newState)) {
      const endResult = this.endRace(newState);
      newState = endResult.state;
      events.push(...endResult.events);
      return { state: newState, events };
    }

    // Handle extra turn (Genius) or Skipper insertion
    if (newState.extraTurnPlayerId) {
      const extraId = newState.extraTurnPlayerId;
      const idx = newState.turnOrder.indexOf(extraId);
      if (idx !== -1) {
        newState = { ...newState, currentTurnIndex: idx, extraTurnPlayerId: null };
      } else {
        newState = advanceTurn({ ...newState, extraTurnPlayerId: null });
      }
    } else if (newState.skipperNextPlayerId) {
      const skipperId = newState.skipperNextPlayerId;
      const idx = newState.turnOrder.indexOf(skipperId);
      if (idx !== -1) {
        newState = { ...newState, currentTurnIndex: idx, skipperNextPlayerId: null };
      } else {
        newState = advanceTurn({ ...newState, skipperNextPlayerId: null });
      }
    } else {
      newState = advanceTurn(newState);
    }
    newState = { ...newState, triggeredThisMove: new Set() };

    // Automatically begin the next turn (process TURN_START before dice roll)
    return this.beginNextTurn(newState, events);
  }

  private continueTurn(
    state: GameState,
    priorEvents: GameEvent[],
    turnPhase: string,
    playerId: string,
    diceValue?: number,
  ): ActionResult {
    switch (turnPhase) {
      case 'TURN_START': {
        // TURN_START abilities just resolved
        this.refreshCopiedHandlers(state);

        // Check skipMainMove after TURN_START abilities resolved
        if (state.skipMainMove) {
          const events = [...priorEvents];
          events.push({ type: 'TURN_END', playerId });
          const teResult = this.processEventThroughEngine(state, { type: 'TURN_END', playerId });
          return this.finishTurn(teResult.state, [...events, ...teResult.events], playerId);
        }
        // TURN_START resolved — return state, client will show ROLL_DICE
        return { state, events: priorEvents };
      }

      case 'DICE_ROLLED': {
        // Collect final dice from ability modifications — accumulate deltas
        let finalDice = diceValue ?? 0;
        for (const ev of priorEvents) {
          if (ev.type === 'DICE_MODIFIED' && ev.playerId === playerId) {
            finalDice += ev.newValue - ev.originalValue;
          }
        }
        finalDice = Math.max(0, finalDice);
        return this.executeMovementPhase(state, priorEvents, playerId, finalDice);
      }

      case 'MOVEMENT': {
        // Track effect + turn end
        const updatedRacer = state.activeRacers.find(r => r.playerId === playerId);
        if (updatedRacer && !updatedRacer.finished) {
          const effectResult = applyTrackSpaceEffect(state, updatedRacer.racerName);
          const newState = effectResult.state;
          priorEvents.push(...effectResult.events);
          return this.executeTurnEnd(newState, priorEvents, playerId);
        }
        return this.executeTurnEnd(state, priorEvents, playerId);
      }

      case 'TURN_END':
        return this.finishTurn(state, priorEvents, playerId);

      default:
        return this.finishTurn(state, priorEvents, playerId);
    }
  }

  /**
   * End current race: score and transition to RACE_END (pause for display).
   * Actual transition to RACE_SETUP or GAME_OVER happens via CONTINUE_FROM_RACE_END.
   */
  private endRace(state: GameState): { state: GameState; events: GameEvent[] } {
    const events: GameEvent[] = [];
    let currentState = state;

    // Auto-finish remaining active racers (M.O.U.T.H. rule: last racer standing gets next place)
    const active = currentState.activeRacers.filter(r => !r.finished && !r.eliminated);
    if (active.length > 0) {
      let finishCount = currentState.activeRacers.filter(r => r.finished).length;
      const activeRacers = currentState.activeRacers.map(r => {
        if (!r.finished && !r.eliminated) {
          finishCount++;
          events.push({ type: 'RACER_FINISHED', racerName: r.racerName, place: finishCount });
          return { ...r, finished: true, finishOrder: finishCount };
        }
        return r;
      });
      currentState = { ...currentState, activeRacers };
    }

    // Save final positions for next race turn order
    const lastRacePositions: Record<string, number> = {};
    for (const racer of currentState.activeRacers) {
      lastRacePositions[racer.playerId] = racer.eliminated ? -1 : racer.position;
    }

    // Assign chips
    const scoringResult = assignRaceChips(currentState);
    let newState = scoringResult.state;
    events.push(...scoringResult.events);

    // Pause at RACE_END — client will show results, then send CONTINUE_FROM_RACE_END
    newState = { ...newState, phase: 'RACE_END', lastRacePositions };
    events.push({ type: 'PHASE_CHANGED', phase: 'RACE_END' });

    return { state: newState, events };
  }

  /**
   * Handle CONTINUE_FROM_RACE_END: transition to next race setup or game over.
   */
  private handleContinueFromRaceEnd(state: GameState): ActionResult {
    if (state.phase !== 'RACE_END') {
      return { state, events: [], error: 'Not in RACE_END phase' };
    }

    const events: GameEvent[] = [];

    if (state.currentRace >= 4) {
      // Game over
      const winnerIds = getFinalWinners(state);
      const scores: Record<string, number> = {};
      for (const p of state.players) {
        scores[p.id] = state.scores[p.id] || 0;
      }
      const newState = { ...state, phase: 'GAME_OVER' as const };
      events.push({ type: 'GAME_ENDED', winnerIds, scores });
      events.push({ type: 'PHASE_CHANGED', phase: 'GAME_OVER' });
      return { state: newState, events };
    }

    // Next race
    const nextRace = state.currentRace + 1;
    const trackId = RACE_TRACK_SEQUENCE[nextRace - 1];
    const trackConfig = createTrack(trackId);
    const newState: GameState = {
      ...state,
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
      raceSetupChoices: {},
    };
    events.push({ type: 'PHASE_CHANGED', phase: 'RACE_SETUP' });
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
    // Register proxy handlers for any racers that already have copiedAbility
    this.refreshCopiedHandlers(state);
  }

  /**
   * Re-register proxy handlers for Copy Cat / Egg / Twin based on current copiedAbility.
   * Called after Egg/Twin decision and after Copy Cat's TURN_START.
   */
  private refreshCopiedHandlers(state: GameState): void {
    for (const racer of state.activeRacers) {
      if (racer.copiedAbility && !racer.finished && !racer.eliminated) {
        // Remove old proxy handlers for this copier before adding new ones
        this.eventEngine.removeProxyHandlersFor(racer.racerName);
        const proxies = createCopiedHandlers(racer.racerName, racer.copiedAbility);
        for (const proxy of proxies) {
          this.eventEngine.registerHandler(proxy);
        }
      }
    }
  }
}
