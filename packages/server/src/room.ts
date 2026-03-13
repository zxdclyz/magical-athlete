import { randomUUID, randomBytes } from 'node:crypto';
import {
  GameController,
  createInitialState,
  makeAIDecision,
  hasPlayerChosen,
  type GameState,
  type GameEvent,
  type Player,
  type DecisionRequest,
  type RacerName,
} from '@magical-athlete/engine';

export interface PlayerInfo {
  playerId: string;
  token: string;       // short token for URL-based reconnection
  name: string;
  socketId: string | null;
  connected: boolean;
}

export interface RoomState {
  id: string;
  hostId: string;
  players: Map<string, PlayerInfo>;
  aiPlayers: Player[];
  gameState: GameState | null;
  controller: GameController;
  seq: number;
  /** Accumulated events for the current phase — sent to reconnecting players */
  phaseEvents: GameEvent[];
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}

let nextAIId = 1;

const AI_NAMES = [
  '小明', '阿花', '大壮', '豆豆', '小白',
  '阿宝', '铁柱', '翠花', '狗蛋', '小芳',
  '阿强', '旺财', '秀兰', '大毛', '小胖',
];

function generateToken(): string {
  return randomBytes(6).toString('base64url'); // 8 chars, URL-safe
}

export function createRoom(roomId: string, hostSocketId: string, hostName: string): RoomState {
  const playerId = randomUUID();
  const token = generateToken();
  return {
    id: roomId,
    hostId: playerId,
    players: new Map([[playerId, { playerId, token, name: hostName, socketId: hostSocketId, connected: true }]]),
    aiPlayers: [],
    gameState: null,
    controller: new GameController(),
    seq: 0,
    phaseEvents: [],
    cleanupTimer: null,
  };
}

export function addPlayer(room: RoomState, socketId: string, name: string): { playerId: string; token: string } {
  const playerId = randomUUID();
  const token = generateToken();
  room.players.set(playerId, { playerId, token, name, socketId, connected: true });
  return { playerId, token };
}

export function removePlayer(room: RoomState, playerId: string): void {
  room.players.delete(playerId);
}

/** Find playerId by reconnection token */
export function findPlayerByToken(room: RoomState, token: string): string | null {
  for (const [pid, info] of room.players) {
    if (info.token === token) return pid;
  }
  return null;
}

// --- Helper functions ---

export function findPlayerBySocket(room: RoomState, socketId: string): string | null {
  for (const [pid, info] of room.players) {
    if (info.socketId === socketId) return pid;
  }
  return null;
}

/**
 * Mark player as disconnected, but ONLY if the given socketId matches.
 * This prevents a stale socket's disconnect from overriding a fresh reconnection.
 */
export function disconnectPlayer(room: RoomState, playerId: string, socketId: string): boolean {
  const info = room.players.get(playerId);
  if (!info) return false;
  // Only disconnect if this socket is still the active one
  if (info.socketId !== socketId) return false;
  info.socketId = null;
  info.connected = false;
  return true;
}

export function reconnectPlayer(room: RoomState, playerId: string, newSocketId: string): boolean {
  const info = room.players.get(playerId);
  if (!info) return false;
  info.socketId = newSocketId;
  info.connected = true;
  return true;
}

export function hasConnectedHumans(room: RoomState): boolean {
  for (const info of room.players.values()) {
    if (info.connected) return true;
  }
  return false;
}

export function isPlayerDisconnected(room: RoomState, playerId: string): boolean {
  const info = room.players.get(playerId);
  return info ? !info.connected : false;
}

// --- Existing functions ---

export function addAI(room: RoomState, difficulty: 'easy' | 'normal'): Player {
  const aiId = `ai_${nextAIId++}`;
  const usedNames = new Set(room.aiPlayers.map(p => p.name));
  const available = AI_NAMES.filter(n => !usedNames.has(n));
  const name = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : `玩家${nextAIId}`;
  const ai: Player = {
    id: aiId,
    name,
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

  // Add human players (keyed by playerId, not socketId)
  for (const [playerId, info] of room.players) {
    allPlayers.push({
      id: playerId,
      name: info.name,
      isAI: false,
      hand: [],
      usedRacers: [],
    });
  }

  // Add AI players
  allPlayers.push(...room.aiPlayers);

  // Auto-fill with AI to reach minimum 3 players
  while (allPlayers.length < 3) {
    const ai = addAI(room, 'easy');
    allPlayers.push(ai);
  }

  if (allPlayers.length > 5) {
    return { error: 'Too many players (max 5)' };
  }

  const initialState = createInitialState(allPlayers);
  const result = room.controller.processAction(initialState, allPlayers[0].id, { type: 'START_GAME' });
  if (result.error) return { error: result.error };

  room.gameState = result.state;
  const allEvents = [...result.events];

  // Auto-execute AI turns (e.g. if AI drafts first)
  const aiResults = executeAITurns(room);
  allEvents.push(...aiResults.events);

  return { state: room.gameState, events: allEvents };
}

/**
 * Process a player action and auto-execute AI decisions.
 */
export function processPlayerAction(
  room: RoomState,
  playerId: string,
  action: { type: string; [key: string]: any },
): { state: GameState; events: GameEvent[] } | { error: string } {
  if (!room.gameState) return { error: 'Game not started' };

  const result = room.controller.processAction(room.gameState, playerId, action as any);
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
export function executeAITurns(room: RoomState): { events: GameEvent[] } {
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
 * Check if the next action should be taken by an AI player or a disconnected human.
 */
function getNextAIAction(
  state: GameState,
  room: RoomState,
): { playerId: string; action: any } | null {
  const aiPlayerIds = new Set(room.aiPlayers.map(p => p.id));

  // Helper: check if a player should be AI-controlled
  // (either a real AI or a disconnected human)
  function isAIControlled(pid: string): boolean {
    return aiPlayerIds.has(pid) || isPlayerDisconnected(room, pid);
  }

  function getDifficulty(pid: string): 'easy' | 'normal' {
    const ai = room.aiPlayers.find(p => p.id === pid);
    return ai?.aiDifficulty || 'easy';
  }

  switch (state.phase) {
    case 'DRAFTING': {
      const currentPlayerId = state.draftOrder[state.draftCurrentIndex];
      if (!isAIControlled(currentPlayerId)) return null;
      const decision = makeAIDecision(state, {
        type: 'DRAFT_PICK',
        availableRacers: state.availableRacers,
      }, getDifficulty(currentPlayerId));
      return { playerId: currentPlayerId, action: { type: 'MAKE_DECISION', decision } };
    }

    case 'RACE_SETUP': {
      // Simultaneous selection: AI-controlled players that haven't chosen yet
      // Check actual AI players
      for (const ai of room.aiPlayers) {
        if (hasPlayerChosen(state, ai.id)) continue;
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
      // Check disconnected human players
      for (const [playerId, info] of room.players) {
        if (info.connected) continue;
        if (hasPlayerChosen(state, playerId)) continue;
        const player = state.players.find(p => p.id === playerId);
        if (!player) continue;
        const available = player.hand.filter(r => !player.usedRacers.includes(r));
        if (available.length === 0) continue;
        const decision = makeAIDecision(state, {
          type: 'CHOOSE_RACE_RACER',
          availableRacers: available,
        }, 'easy');
        return { playerId, action: { type: 'MAKE_DECISION', decision } };
      }
      return null;
    }

    case 'RACING': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      if (!isAIControlled(currentPlayerId)) return null;
      const decision = makeAIDecision(state, { type: 'ROLL_DICE' }, getDifficulty(currentPlayerId));
      return { playerId: currentPlayerId, action: { type: 'MAKE_DECISION', decision } };
    }

    default:
      return null;
  }
}

/**
 * Get the player view of the state (hide other players' hands and choices).
 */
export function getPlayerView(state: GameState, playerId: string): any {
  return {
    ...state,
    players: state.players.map(p => ({
      ...p,
      // During draft, everyone can see all hands (public info in the board game)
      hand: state.phase === 'DRAFTING' || p.id === playerId
        ? p.hand
        : p.hand.map(() => 'hidden' as any),
    })),
    // Hide other players' race setup choices (only show that they've chosen)
    raceSetupChoices: Object.fromEntries(
      Object.entries(state.raceSetupChoices).map(([pid, racer]) =>
        [pid, pid === playerId ? racer : 'chosen']
      )
    ),
    // Convert Set to array for serialization
    triggeredThisMove: [...state.triggeredThisMove],
  };
}
