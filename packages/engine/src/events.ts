import type { GameState, GameEvent, RacerName, DecisionRequest, DecisionResponse } from './types.js';

export interface AbilityHandler {
  racerName: RacerName;
  eventTypes: GameEvent['type'][];
  priority: number; // lower = triggers first
  shouldTrigger(event: GameEvent, state: GameState): boolean;
  getDecisionRequest?(event: GameEvent, state: GameState): DecisionRequest | null;
  execute(event: GameEvent, state: GameState, decision?: DecisionResponse): {
    state: GameState;
    events: GameEvent[];
  };
}

interface ProcessResult {
  state: GameState;
  events: GameEvent[];
  pendingDecision?: {
    playerId: string;
    request: DecisionRequest;
    handlerIndex: number;
    triggerEvent: GameEvent;
  } | null;
}

const MAX_CHAIN_DEPTH = 50;

export class EventEngine {
  private handlers: AbilityHandler[] = [];

  registerHandler(handler: AbilityHandler): void {
    this.handlers.push(handler);
    // Keep sorted by priority
    this.handlers.sort((a, b) => a.priority - b.priority);
  }

  clearHandlers(): void {
    this.handlers = [];
  }

  /**
   * Process an event through all registered handlers.
   * Handles chain triggering with infinite loop prevention.
   */
  processEvent(
    event: GameEvent,
    state: GameState,
  ): ProcessResult {
    const allEvents: GameEvent[] = [];
    const triggered = new Set<string>(state.triggeredThisMove);
    let currentState = state;
    const eventQueue: GameEvent[] = [event];
    let depth = 0;

    while (eventQueue.length > 0 && depth < MAX_CHAIN_DEPTH) {
      const currentEvent = eventQueue.shift()!;
      depth++;

      for (const handler of this.handlers) {
        // Only trigger for racers in the active race
        const activeRacer = currentState.activeRacers.find(
          r => r.racerName === handler.racerName && !r.eliminated
        );
        if (!activeRacer) continue;

        // Check event type match
        if (!handler.eventTypes.includes(currentEvent.type)) continue;

        // Infinite loop prevention: same handler + same event type
        const key = `${handler.racerName}:${currentEvent.type}`;
        if (triggered.has(key)) continue;

        // Check shouldTrigger
        if (!handler.shouldTrigger(currentEvent, currentState)) continue;

        // Mark as triggered
        triggered.add(key);

        // Check if decision is needed
        if (handler.getDecisionRequest) {
          const decisionReq = handler.getDecisionRequest(currentEvent, currentState);
          if (decisionReq) {
            return {
              state: { ...currentState, triggeredThisMove: triggered },
              events: allEvents,
              pendingDecision: {
                playerId: activeRacer.playerId,
                request: decisionReq,
                handlerIndex: this.handlers.indexOf(handler),
                triggerEvent: currentEvent,
              },
            };
          }
        }

        // Execute handler
        const result = handler.execute(currentEvent, currentState);
        currentState = result.state;
        allEvents.push(...result.events);

        // Queue any new events for chain processing
        for (const newEvent of result.events) {
          eventQueue.push(newEvent);
        }
      }
    }

    return {
      state: { ...currentState, triggeredThisMove: triggered },
      events: allEvents,
      pendingDecision: null,
    };
  }

  /**
   * Resume processing after a decision has been made.
   */
  resumeAfterDecision(
    state: GameState,
    decision: DecisionResponse,
    handlerIndex: number,
    triggerEvent: GameEvent,
  ): ProcessResult {
    const handler = this.handlers[handlerIndex];
    if (!handler) {
      return { state, events: [], pendingDecision: null };
    }

    const result = handler.execute(triggerEvent, state, decision);
    const allEvents = [...result.events];
    let currentState = result.state;

    // Process any chained events from the decision handler
    for (const newEvent of result.events) {
      const chainResult = this.processEvent(newEvent, currentState);
      currentState = chainResult.state;
      allEvents.push(...chainResult.events);
      if (chainResult.pendingDecision) {
        return {
          state: currentState,
          events: allEvents,
          pendingDecision: chainResult.pendingDecision,
        };
      }
    }

    return { state: currentState, events: allEvents, pendingDecision: null };
  }
}
