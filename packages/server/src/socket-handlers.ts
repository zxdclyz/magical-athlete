import type { Server, Socket } from 'socket.io';
import {
  createRoom,
  addPlayer,
  removePlayer,
  addAI,
  removeAI,
  startGame,
  processPlayerAction,
  getPlayerView,
  type RoomState,
} from './room.js';

const rooms = new Map<string, RoomState>();

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    let currentRoomId: string | null = null;

    socket.on('create_room', (data: { playerName: string }, callback) => {
      const roomId = generateRoomId();
      const room = createRoom(roomId, socket.id, data.playerName);
      rooms.set(roomId, room);
      currentRoomId = roomId;
      socket.join(roomId);
      callback({ roomId, playerId: socket.id });
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

      addPlayer(room, socket.id, data.playerName);
      currentRoomId = data.roomId;
      socket.join(data.roomId);
      callback({ roomId: data.roomId, playerId: socket.id });
      io.to(data.roomId).emit('room_updated', getRoomInfo(room));
    });

    socket.on('add_ai', (data: { difficulty: 'easy' | 'normal' }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== socket.id) return;

      const ai = addAI(room, data.difficulty);
      io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
    });

    socket.on('remove_ai', (data: { aiId: string }) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== socket.id) return;

      removeAI(room, data.aiId);
      io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
    });

    socket.on('start_game', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== socket.id) return;

      const result = startGame(room);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }

      // Send each player their own view
      broadcastState(io, room);
      io.to(currentRoomId).emit('game_events', result.events);
    });

    socket.on('game_action', (action: any) => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      const result = processPlayerAction(room, socket.id, action);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }

      broadcastState(io, room);
      io.to(currentRoomId).emit('game_events', result.events);
    });

    socket.on('disconnect', () => {
      if (!currentRoomId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      removePlayer(room, socket.id);

      if (room.players.size === 0) {
        rooms.delete(currentRoomId);
      } else {
        // Transfer host if needed
        if (room.hostId === socket.id) {
          const [newHostId] = room.players.keys();
          room.hostId = newHostId;
        }
        io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
      }
    });
  });
}

function getRoomInfo(room: RoomState) {
  return {
    id: room.id,
    hostId: room.hostId,
    players: [...room.players.entries()].map(([id, info]) => ({
      id,
      name: info.name,
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

function broadcastState(io: Server, room: RoomState) {
  if (!room.gameState) return;

  for (const [socketId] of room.players) {
    const view = getPlayerView(room.gameState, socketId);
    io.to(socketId).emit('game_state', view);
  }
}
