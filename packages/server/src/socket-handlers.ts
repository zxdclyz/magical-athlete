import type { Server, Socket } from 'socket.io';
import {
  createRoom,
  addPlayer,
  removePlayer,
  findPlayerBySocket,
  disconnectPlayer,
  reconnectPlayer,
  hasConnectedHumans,
  addAI,
  removeAI,
  startGame,
  processPlayerAction,
  getPlayerView,
  executeAITurns,
  type RoomState,
} from './room.js';

/** All active rooms keyed by roomId */
const rooms = new Map<string, RoomState>();

/** Fast lookup: playerId -> roomId (for reconnect) */
const playerRoomMap = new Map<string, string>();

const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomInfo(room: RoomState) {
  return {
    id: room.id,
    hostId: room.hostId,
    players: [...room.players.entries()].map(([id, info]) => ({
      id,
      name: info.name,
      connected: info.connected,
      isAI: false,
    })),
    aiPlayers: room.aiPlayers.map(p => ({
      id: p.id,
      name: p.name,
      isAI: true,
      aiDifficulty: p.aiDifficulty,
    })),
    gameStarted: !!room.gameState,
  };
}

/**
 * Send a unified game_update to every connected human player in the room.
 * Each player receives their own filtered view of the state.
 */
function broadcastGameUpdate(io: Server, room: RoomState, events: any[]): void {
  if (!room.gameState) return;
  room.seq++;

  for (const [playerId, info] of room.players) {
    if (!info.connected || !info.socketId) continue;
    const view = getPlayerView(room.gameState, playerId);
    io.to(info.socketId).emit('game_update', {
      state: view,
      events,
      seq: room.seq,
    });
  }
}

/**
 * Start a cleanup timer if no humans are connected.
 * If they don't reconnect within CLEANUP_TIMEOUT_MS, destroy the room.
 */
function startCleanupTimer(io: Server, room: RoomState): void {
  if (room.cleanupTimer) return; // already running
  room.cleanupTimer = setTimeout(() => {
    destroyRoom(room.id);
  }, CLEANUP_TIMEOUT_MS);
}

function cancelCleanupTimer(room: RoomState): void {
  if (room.cleanupTimer) {
    clearTimeout(room.cleanupTimer);
    room.cleanupTimer = null;
  }
}

function destroyRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  cancelCleanupTimer(room);
  // Remove all player->room mappings
  for (const playerId of room.players.keys()) {
    playerRoomMap.delete(playerId);
  }
  rooms.delete(roomId);
}

/**
 * Transfer host to another connected human if the current host leaves / disconnects.
 * Returns true if a new host was assigned.
 */
function transferHostIfNeeded(room: RoomState, departedPlayerId: string): boolean {
  if (room.hostId !== departedPlayerId) return false;
  for (const [pid, info] of room.players) {
    if (pid !== departedPlayerId && info.connected) {
      room.hostId = pid;
      return true;
    }
  }
  // No connected humans; pick any remaining human
  for (const pid of room.players.keys()) {
    if (pid !== departedPlayerId) {
      room.hostId = pid;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const auth = socket.handshake.auth as { playerId?: string; roomId?: string } | undefined;

    // -----------------------------------------------------------------------
    // Reconnection attempt
    // -----------------------------------------------------------------------
    if (auth?.playerId) {
      const roomId = auth.roomId ?? playerRoomMap.get(auth.playerId);
      const room = roomId ? rooms.get(roomId) : undefined;
      if (room && roomId && room.players.has(auth.playerId)) {
        const ok = reconnectPlayer(room, auth.playerId, socket.id);
        if (ok) {
          cancelCleanupTimer(room);
          socket.join(roomId);
          socket.emit('reconnected', { playerId: auth.playerId, roomId });
          io.to(roomId).emit('room_updated', getRoomInfo(room));

          // If game is in progress, send current state
          if (room.gameState) {
            room.seq++;
            const view = getPlayerView(room.gameState, auth.playerId);
            socket.emit('game_update', { state: view, events: [], seq: room.seq });
          }

          // Bind all room events for this socket
          bindRoomEvents(io, socket, auth.playerId, roomId);
          return;
        }
      }
      // Reconnect failed — tell client to clear stale session
      socket.emit('session_invalid');
    }

    // -----------------------------------------------------------------------
    // Fresh connection — no room yet
    // -----------------------------------------------------------------------
    let currentRoomId: string | null = null;
    let currentPlayerId: string | null = null;

    socket.on('create_room', (data: { playerName: string }, callback) => {
      const roomId = generateRoomId();
      const room = createRoom(roomId, socket.id, data.playerName);
      rooms.set(roomId, room);
      currentRoomId = roomId;

      // The host's playerId is the first key in the map
      const [hostPlayerId] = room.players.keys();
      currentPlayerId = hostPlayerId;
      playerRoomMap.set(hostPlayerId, roomId);

      socket.join(roomId);
      callback({ roomId, playerId: hostPlayerId });
      io.to(roomId).emit('room_updated', getRoomInfo(room));
    });

    socket.on('join_room', (data: { roomId: string; playerName: string }, callback) => {
      const room = rooms.get(data.roomId);
      if (!room) {
        callback({ error: 'Room not found' });
        return;
      }
      if (room.gameState) {
        callback({ error: 'Game already started' });
        return;
      }
      if (room.players.size + room.aiPlayers.length >= 5) {
        callback({ error: 'Room is full' });
        return;
      }

      const playerId = addPlayer(room, socket.id, data.playerName);
      currentRoomId = data.roomId;
      currentPlayerId = playerId;
      playerRoomMap.set(playerId, data.roomId);

      socket.join(data.roomId);
      callback({ roomId: data.roomId, playerId });
      io.to(data.roomId).emit('room_updated', getRoomInfo(room));
    });

    // Host-only: add AI
    socket.on('add_ai', (data: { difficulty: 'easy' | 'normal' }) => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== currentPlayerId) return;

      addAI(room, data.difficulty);
      io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
    });

    // Host-only: remove AI
    socket.on('remove_ai', (data: { aiId: string }) => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== currentPlayerId) return;

      removeAI(room, data.aiId);
      io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
    });

    // Host-only: start game
    socket.on('start_game', (_data: unknown, callback?: (res: { ok: boolean } | { error: string }) => void) => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== currentPlayerId) return;

      const result = startGame(room);
      if ('error' in result) {
        callback?.({ error: result.error });
        socket.emit('error', { message: result.error });
        return;
      }

      callback?.({ ok: true });
      broadcastGameUpdate(io, room, result.events);
    });

    // Player action with ack callback
    socket.on('game_action', (action: any, callback?: (res: { ok: boolean } | { error: string }) => void) => {
      if (!currentRoomId || !currentPlayerId) {
        callback?.({ error: 'Not in a room' });
        return;
      }
      const room = rooms.get(currentRoomId);
      if (!room) {
        callback?.({ error: 'Room not found' });
        return;
      }

      const result = processPlayerAction(room, currentPlayerId, action);
      if ('error' in result) {
        callback?.({ error: result.error });
        return;
      }

      callback?.({ ok: true });
      broadcastGameUpdate(io, room, result.events);
    });

    // Client can request current state (e.g. after reconnect hiccup)
    socket.on('request_sync', (callback?: (res: any) => void) => {
      if (!currentRoomId || !currentPlayerId) {
        callback?.({ error: 'Not in a room' });
        return;
      }
      const room = rooms.get(currentRoomId);
      if (!room || !room.gameState) {
        callback?.({ error: 'No game in progress' });
        return;
      }

      const view = getPlayerView(room.gameState, currentPlayerId);
      const payload = { state: view, events: [], seq: room.seq };
      if (callback) {
        callback(payload);
      } else {
        socket.emit('game_update', payload);
      }
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      if (room.gameState) {
        // ----- During game: mark disconnected, AI takes over -----
        // Only if this socket is still the active one (not a stale pre-reconnect socket)
        const didDisconnect = disconnectPlayer(room, currentPlayerId, socket.id);
        if (!didDisconnect) return; // stale socket, player already reconnected with new socket
        io.to(currentRoomId).emit('room_updated', getRoomInfo(room));

        // Execute AI turns for the now-disconnected player
        const aiResult = executeAITurns(room);
        if (aiResult.events.length > 0) {
          broadcastGameUpdate(io, room, aiResult.events);
        }

        // If no humans left, start cleanup timer
        if (!hasConnectedHumans(room)) {
          startCleanupTimer(io, room);
        }
      } else {
        // ----- Pre-game: remove player entirely -----
        removePlayer(room, currentPlayerId);
        playerRoomMap.delete(currentPlayerId);

        if (room.players.size === 0) {
          destroyRoom(currentRoomId);
        } else {
          transferHostIfNeeded(room, currentPlayerId);
          io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
        }
      }
    });
  });
}

/**
 * Bind room events for a reconnected socket.
 * Mirrors the same handlers as fresh connections but uses known playerId/roomId.
 */
function bindRoomEvents(io: Server, socket: Socket, playerId: string, roomId: string): void {
  // Host-only: add AI
  socket.on('add_ai', (data: { difficulty: 'easy' | 'normal' }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== playerId) return;

    addAI(room, data.difficulty);
    io.to(roomId).emit('room_updated', getRoomInfo(room));
  });

  // Host-only: remove AI
  socket.on('remove_ai', (data: { aiId: string }) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== playerId) return;

    removeAI(room, data.aiId);
    io.to(roomId).emit('room_updated', getRoomInfo(room));
  });

  // Host-only: start game
  socket.on('start_game', (_data: unknown, callback?: (res: { ok: boolean } | { error: string }) => void) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== playerId) return;

    const result = startGame(room);
    if ('error' in result) {
      callback?.({ error: result.error });
      socket.emit('error', { message: result.error });
      return;
    }

    callback?.({ ok: true });
    broadcastGameUpdate(io, room, result.events);
  });

  // Player action with ack callback
  socket.on('game_action', (action: any, callback?: (res: { ok: boolean } | { error: string }) => void) => {
    const room = rooms.get(roomId);
    if (!room) {
      callback?.({ error: 'Room not found' });
      return;
    }

    const result = processPlayerAction(room, playerId, action);
    if ('error' in result) {
      callback?.({ error: result.error });
      return;
    }

    callback?.({ ok: true });
    broadcastGameUpdate(io, room, result.events);
  });

  // Client can request current state
  socket.on('request_sync', (callback?: (res: any) => void) => {
    const room = rooms.get(roomId);
    if (!room || !room.gameState) {
      callback?.({ error: 'No game in progress' });
      return;
    }

    const view = getPlayerView(room.gameState, playerId);
    const payload = { state: view, events: [], seq: room.seq };
    if (callback) {
      callback(payload);
    } else {
      socket.emit('game_update', payload);
    }
  });

  // Disconnect handling for reconnected player
  socket.on('disconnect', () => {
    const room = rooms.get(roomId);
    if (!room) return;

    if (room.gameState) {
      const didDisconnect = disconnectPlayer(room, playerId, socket.id);
      if (!didDisconnect) return; // stale socket
      io.to(roomId).emit('room_updated', getRoomInfo(room));

      const aiResult = executeAITurns(room);
      if (aiResult.events.length > 0) {
        broadcastGameUpdate(io, room, aiResult.events);
      }

      if (!hasConnectedHumans(room)) {
        startCleanupTimer(io, room);
      }
    } else {
      removePlayer(room, playerId);
      playerRoomMap.delete(playerId);

      if (room.players.size === 0) {
        destroyRoom(roomId);
      } else {
        transferHostIfNeeded(room, playerId);
        io.to(roomId).emit('room_updated', getRoomInfo(room));
      }
    }
  });
}
