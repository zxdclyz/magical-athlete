import {
  GameController,
  createInitialState,
  makeAIDecision,
  type GameState,
  type GameEvent,
  type Player,
  type DecisionRequest,
  type RacerName,
} from '@magical-athlete/engine';

export interface RoomState {
  id: string;
  hostId: string;
  players: Map<string, { socketId: string; name: string }>;
  aiPlayers: Player[];
  gameState: GameState | null;
  controller: GameController;
}

let nextAIId = 1;

export function createRoom(roomId: string, hostSocketId: string, hostName: string): RoomState {
  return {
    id: roomId,
    hostId: hostSocketId,
    players: new Map([[hostSocketId, { socketId: hostSocketId, name: hostName }]]),
    aiPlayers: [],
    gameState: null,
    controller: new GameController(),
  };
}

export function addPlayer(room: RoomState, socketId: string, name: string): void {
  room.players.set(socketId, { socketId, name });
}

export function removePlayer(room: RoomState, socketId: string): void {
  room.players.delete(socketId);
}

export function addAI(room: RoomState, difficulty: 'easy' | 'normal'): Player {
  const aiId = `ai_${nextAIId++}`;
  const ai: Player = {
    id: aiId,
    name: `AI ${difficulty === 'easy' ? '(Easy)' : '(Normal)'}`,
    isAI: true,
    aiDifficulty: difficulty,
    hand: [],
    usedRacers: [],
  };
  room.aiPlayers.push(ai);
  return ai;
}

export function removeAI(room: RoomState, aiId: string): void {
  room.aiPlayers = room.aiPlayers.filter(p => p.id !== aiId);
}

export function startGame(room: RoomState): { state: GameState; events: GameEvent[] } | { error: string } {
  const allPlayers: Player[] = [];

  // Add human players
  for (const [socketId, info] of room.players) {
    allPlayers.push({
      id: socketId,
      name: info.name,
      isAI: false,
      hand: [],
      usedRacers: [],
    });
  }

  // Add AI players
  allPlayers.push(...room.aiPlayers);

  if (allPlayers.length < 2 || allPlayers.length > 5) {
    return { error: 'Need 2-5 players' };
  }

  const initialState = createInitialState(allPlayers);
  const result = room.controller.processAction(initialState, allPlayers[0].id, { type: 'START_GAME' });
  if (result.error) return { error: result.error };

  room.gameState = result.state;
  return { state: result.state, events: result.events };
}

/**
 * Process a player action and auto-execute AI decisions.
 */
export function processPlayerAction(
  room: RoomState,
  socketId: string,
  action: { type: string; [key: string]: any },
): { state: GameState; events: GameEvent[] } | { error: string } {
  if (!room.gameState) return { error: 'Game not started' };

  const result = room.controller.processAction(room.gameState, socketId, action as any);
  if (result.error) return { error: result.error };

  room.gameState = result.state;
  const allEvents = [...result.events];

  // Auto-execute AI decisions
  const aiResults = executeAITurns(room);
  allEvents.push(...aiResults.events);

  return { state: room.gameState, events: allEvents };
}

/**
 * Execute AI turns until a human player needs to act.
 */
function executeAITurns(room: RoomState): { events: GameEvent[] } {
  if (!room.gameState) return { events: [] };
  const events: GameEvent[] = [];
  let maxIterations = 100; // Safety limit

  while (maxIterations-- > 0) {
    const state = room.gameState;
    const aiAction = getNextAIAction(state, room);
    if (!aiAction) break;

    const result = room.controller.processAction(state, aiAction.playerId, aiAction.action);
    if (result.error) break;

    room.gameState = result.state;
    events.push(...result.events);
  }

  return { events };
}

/**
 * Check if the next action should be taken by an AI player.
 */
function getNextAIAction(
  state: GameState,
  room: RoomState,
): { playerId: string; action: any } | null {
  const aiPlayerIds = new Set(room.aiPlayers.map(p => p.id));

  switch (state.phase) {
    case 'DRAFTING': {
      const currentPlayerId = state.draftOrder[state.draftCurrentIndex];
      if (!aiPlayerIds.has(currentPlayerId)) return null;
      const ai = room.aiPlayers.find(p => p.id === currentPlayerId)!;
      const decision = makeAIDecision(state, {
        type: 'DRAFT_PICK',
        availableRacers: state.availableRacers,
      }, ai.aiDifficulty || 'easy');
      return { playerId: currentPlayerId, action: { type: 'MAKE_DECISION', decision } };
    }

    case 'RACE_SETUP': {
      // Check if any AI hasn't chosen yet
      for (const ai of room.aiPlayers) {
        const hasChosen = state.activeRacers.some(r => r.playerId === ai.id);
        if (hasChosen) continue;
        const player = state.players.find(p => p.id === ai.id);
        if (!player) continue;
        const available = player.hand.filter(r => !player.usedRacers.includes(r));
        if (available.length === 0) continue;
        const decision = makeAIDecision(state, {
          type: 'CHOOSE_RACE_RACER',
          availableRacers: available,
        }, ai.aiDifficulty || 'easy');
        return { playerId: ai.id, action: { type: 'MAKE_DECISION', decision } };
      }
      return null;
    }

    case 'RACING': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      if (!aiPlayerIds.has(currentPlayerId)) return null;
      const ai = room.aiPlayers.find(p => p.id === currentPlayerId)!;
      const decision = makeAIDecision(state, { type: 'ROLL_DICE' }, ai.aiDifficulty || 'easy');
      return { playerId: currentPlayerId, action: { type: 'MAKE_DECISION', decision } };
    }

    default:
      return null;
  }
}

/**
 * Get the player view of the state (hide other players' hands).
 */
export function getPlayerView(state: GameState, playerId: string): any {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      hand: p.id === playerId ? p.hand : p.hand.map(() => 'hidden' as any),
    })),
    // Convert Set to array for serialization
    triggeredThisMove: [...state.triggeredThisMove],
  };
}
