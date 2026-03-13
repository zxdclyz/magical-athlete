# Network Reliability Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make multiplayer reliable with persistent player identity, ack-based messaging, reconnection with full game recovery, and AI takeover for disconnected players.

**Architecture:** Decouple playerId from socketId. Server keeps players in the room on disconnect (marked `connected: false`), AI takes their turns. Client stores identity in sessionStorage and passes it via Socket.io `auth` on reconnect. Replace separate `game_state`/`game_events` emissions with a single atomic `game_update` message carrying a sequence number.

**Tech Stack:** Socket.io (existing), Node.js crypto (randomUUID), sessionStorage (client)

---

## Chunk 1: Server-Side Player Identity & Room Refactor

### Task 1: Refactor RoomState to use persistent playerId

**Files:**
- Modify: `packages/server/src/room.ts`

This task changes the `RoomState` type and all room functions to use a server-generated `playerId` (UUID) instead of `socketId` as the player key. The `players` map entry gains `socketId` and `connected` fields.

- [ ] **Step 1: Update RoomState type and PlayerInfo**

In `packages/server/src/room.ts`, replace the `RoomState` interface and add `PlayerInfo`:

```ts
import { randomUUID } from 'crypto';

export interface PlayerInfo {
  playerId: string;
  name: string;
  socketId: string | null;
  connected: boolean;
}

export interface RoomState {
  id: string;
  hostId: string;           // now a playerId, not socketId
  players: Map<string, PlayerInfo>;  // key = playerId
  aiPlayers: Player[];
  gameState: GameState | null;
  controller: GameController;
  seq: number;              // monotonic sequence number for game_update
  cleanupTimer: ReturnType<typeof setTimeout> | null;
}
```

- [ ] **Step 2: Update createRoom**

```ts
export function createRoom(roomId: string, hostSocketId: string, hostName: string): RoomState {
  const playerId = randomUUID();
  return {
    id: roomId,
    hostId: playerId,
    players: new Map([[playerId, { playerId, name: hostName, socketId: hostSocketId, connected: true }]]),
    aiPlayers: [],
    gameState: null,
    controller: new GameController(),
    seq: 0,
    cleanupTimer: null,
  };
}
```

Note: `createRoom` now returns the room; the caller extracts `playerId` from the room's `hostId`.

- [ ] **Step 3: Update addPlayer to generate playerId**

```ts
export function addPlayer(room: RoomState, socketId: string, name: string): string {
  const playerId = randomUUID();
  room.players.set(playerId, { playerId, name, socketId, connected: true });
  return playerId;
}
```

Returns the generated `playerId`.

- [ ] **Step 4: Update removePlayer to use playerId**

```ts
export function removePlayer(room: RoomState, playerId: string): void {
  room.players.delete(playerId);
}
```

- [ ] **Step 5: Add helper functions for socket/player lookup**

```ts
/** Find playerId by current socketId */
export function findPlayerBySocket(room: RoomState, socketId: string): string | null {
  for (const [pid, info] of room.players) {
    if (info.socketId === socketId) return pid;
  }
  return null;
}

/** Mark player as disconnected */
export function disconnectPlayer(room: RoomState, playerId: string): void {
  const info = room.players.get(playerId);
  if (info) {
    info.socketId = null;
    info.connected = false;
  }
}

/** Reconnect player with new socket */
export function reconnectPlayer(room: RoomState, playerId: string, newSocketId: string): boolean {
  const info = room.players.get(playerId);
  if (!info) return false;
  info.socketId = newSocketId;
  info.connected = true;
  return true;
}

/** Check if any human player is still connected */
export function hasConnectedHumans(room: RoomState): boolean {
  for (const info of room.players.values()) {
    if (info.connected) return true;
  }
  return false;
}

/** Check if a player is currently disconnected */
export function isPlayerDisconnected(room: RoomState, playerId: string): boolean {
  const info = room.players.get(playerId);
  return info ? !info.connected : true;
}
```

- [ ] **Step 6: Update startGame to use playerId keys**

In `startGame`, the human players loop needs to use `playerId` from the map instead of `socketId`:

```ts
export function startGame(room: RoomState): { state: GameState; events: GameEvent[] } | { error: string } {
  const allPlayers: Player[] = [];

  for (const [playerId, info] of room.players) {
    allPlayers.push({
      id: playerId,  // use playerId, not socketId
      name: info.name,
      isAI: false,
      hand: [],
      usedRacers: [],
    });
  }
  // ... rest unchanged
}
```

- [ ] **Step 7: Update processPlayerAction signature**

Change parameter name from `socketId` to `playerId` for clarity (callers will be updated in socket-handlers task):

```ts
export function processPlayerAction(
  room: RoomState,
  playerId: string,  // was socketId
  action: { type: string; [key: string]: any },
): { state: GameState; events: GameEvent[] } | { error: string } {
  // body unchanged — it already passes the id to controller.processAction
}
```

- [ ] **Step 8: Extend getNextAIAction to cover disconnected humans**

Modify the function to also act for disconnected human players:

```ts
function getNextAIAction(
  state: GameState,
  room: RoomState,
): { playerId: string; action: any } | null {
  const aiPlayerIds = new Set(room.aiPlayers.map(p => p.id));

  // Also treat disconnected humans as AI-controlled
  const aiControlled = new Set(aiPlayerIds);
  for (const [pid, info] of room.players) {
    if (!info.connected) aiControlled.add(pid);
  }

  // Replace all occurrences of `aiPlayerIds` with `aiControlled` in the switch cases
  // Also need to handle aiDifficulty for disconnected humans (default 'easy'):
  switch (state.phase) {
    case 'DRAFTING': {
      const currentPlayerId = state.draftOrder[state.draftCurrentIndex];
      if (!aiControlled.has(currentPlayerId)) return null;
      const ai = room.aiPlayers.find(p => p.id === currentPlayerId);
      const difficulty = ai?.aiDifficulty || 'easy';
      const decision = makeAIDecision(state, {
        type: 'DRAFT_PICK',
        availableRacers: state.availableRacers,
      }, difficulty);
      return { playerId: currentPlayerId, action: { type: 'MAKE_DECISION', decision } };
    }

    case 'RACE_SETUP': {
      // AI players
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
      // Disconnected humans
      for (const [pid, info] of room.players) {
        if (info.connected) continue;
        if (hasPlayerChosen(state, pid)) continue;
        const player = state.players.find(p => p.id === pid);
        if (!player) continue;
        const available = player.hand.filter(r => !player.usedRacers.includes(r));
        if (available.length === 0) continue;
        const decision = makeAIDecision(state, {
          type: 'CHOOSE_RACE_RACER',
          availableRacers: available,
        }, 'easy');
        return { playerId: pid, action: { type: 'MAKE_DECISION', decision } };
      }
      return null;
    }

    case 'RACING': {
      const currentPlayerId = state.turnOrder[state.currentTurnIndex];
      if (!aiControlled.has(currentPlayerId)) return null;
      const ai = room.aiPlayers.find(p => p.id === currentPlayerId);
      const difficulty = ai?.aiDifficulty || 'easy';
      const decision = makeAIDecision(state, { type: 'ROLL_DICE' }, difficulty);
      return { playerId: currentPlayerId, action: { type: 'MAKE_DECISION', decision } };
    }

    default:
      return null;
  }
}
```

- [ ] **Step 9: Update getPlayerView and getRoomInfo**

`getPlayerView` stays the same (already uses `playerId` param).

Update `getRoomInfo` in `socket-handlers.ts` (done in Task 2), but the `room.ts` export of `getPlayerView` needs no change since it takes a `playerId` string.

- [ ] **Step 10: Run type check**

Run: `cd packages/server && npx tsc --noEmit`
Expected: May have errors in `socket-handlers.ts` (will be fixed in Task 2). The `room.ts` file itself should have no internal errors.

- [ ] **Step 11: Commit**

```bash
git add packages/server/src/room.ts
git commit -m "refactor(server): decouple playerId from socketId in RoomState"
```

---

### Task 2: Rewrite socket-handlers for new identity model + unified game_update

**Files:**
- Modify: `packages/server/src/socket-handlers.ts`

This task rewrites the socket event handlers to:
1. Use `playerId` (UUID) instead of `socketId` for game logic
2. Handle reconnection via `auth` field
3. Emit unified `game_update` instead of separate `game_state`+`game_events`
4. Add ack callbacks to `game_action`
5. Add `request_sync` event
6. Handle disconnect gracefully (mark offline, AI takeover, cleanup timer)

- [ ] **Step 1: Rewrite the full socket-handlers.ts**

```ts
import type { Server, Socket } from 'socket.io';
import {
  createRoom,
  addPlayer,
  findPlayerBySocket,
  disconnectPlayer,
  reconnectPlayer,
  hasConnectedHumans,
  isPlayerDisconnected,
  startGame,
  processPlayerAction,
  getPlayerView,
  type RoomState,
} from './room.js';

const rooms = new Map<string, RoomState>();

/** Map playerId → roomId for fast lookup during reconnect */
const playerRoomMap = new Map<string, string>();

const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export function setupSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    let currentPlayerId: string | null = null;
    let currentRoomId: string | null = null;

    // --- Reconnection check ---
    const authPlayerId = socket.handshake.auth?.playerId as string | undefined;
    const authRoomId = socket.handshake.auth?.roomId as string | undefined;

    if (authPlayerId && authRoomId) {
      const room = rooms.get(authRoomId);
      if (room && room.players.has(authPlayerId)) {
        // Reconnect!
        const reconnected = reconnectPlayer(room, authPlayerId, socket.id);
        if (reconnected) {
          currentPlayerId = authPlayerId;
          currentRoomId = authRoomId;
          socket.join(authRoomId);

          // Cancel cleanup timer
          if (room.cleanupTimer) {
            clearTimeout(room.cleanupTimer);
            room.cleanupTimer = null;
          }

          // Send current state
          socket.emit('reconnected', { playerId: authPlayerId, roomId: authRoomId });
          io.to(authRoomId).emit('room_updated', getRoomInfo(room));
          if (room.gameState) {
            const view = getPlayerView(room.gameState, authPlayerId);
            socket.emit('game_update', { state: view, events: [], seq: room.seq });
          }
        }
      }
    }

    // --- Create room ---
    socket.on('create_room', (data: { playerName: string }, callback) => {
      const roomId = generateRoomId();
      const room = createRoom(roomId, socket.id, data.playerName);
      rooms.set(roomId, room);
      currentRoomId = roomId;
      currentPlayerId = room.hostId;
      playerRoomMap.set(currentPlayerId, roomId);
      socket.join(roomId);
      callback({ roomId, playerId: currentPlayerId });
      io.to(roomId).emit('room_updated', getRoomInfo(room));
    });

    // --- Join room ---
    socket.on('join_room', (data: { roomId: string; playerName: string }, callback) => {
      const room = rooms.get(data.roomId);
      if (!room) { callback({ error: 'Room not found' }); return; }
      if (room.gameState) { callback({ error: 'Game already started' }); return; }
      if (room.players.size + room.aiPlayers.length >= 5) { callback({ error: 'Room is full' }); return; }

      const playerId = addPlayer(room, socket.id, data.playerName);
      currentRoomId = data.roomId;
      currentPlayerId = playerId;
      playerRoomMap.set(playerId, data.roomId);
      socket.join(data.roomId);
      callback({ roomId: data.roomId, playerId });
      io.to(data.roomId).emit('room_updated', getRoomInfo(room));
    });

    // --- Add AI ---
    socket.on('add_ai', (data: { difficulty: 'easy' | 'normal' }) => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== currentPlayerId) return;
      addAI(room, data.difficulty);
      io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
    });

    // --- Remove AI ---
    socket.on('remove_ai', (data: { aiId: string }) => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== currentPlayerId) return;
      removeAI(room, data.aiId);
      io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
    });

    // --- Start game ---
    socket.on('start_game', () => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room || room.hostId !== currentPlayerId) return;

      const result = startGame(room);
      if ('error' in result) {
        socket.emit('error', { message: result.error });
        return;
      }

      room.seq++;
      broadcastGameUpdate(io, room, result.events);
    });

    // --- Game action (with ack) ---
    socket.on('game_action', (action: any, callback?: (res: any) => void) => {
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
      room.seq++;
      broadcastGameUpdate(io, room, result.events);
    });

    // --- Request sync ---
    socket.on('request_sync', () => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room || !room.gameState) return;

      const view = getPlayerView(room.gameState, currentPlayerId);
      socket.emit('game_update', { state: view, events: [], seq: room.seq });
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      if (!currentRoomId || !currentPlayerId) return;
      const room = rooms.get(currentRoomId);
      if (!room) return;

      if (room.gameState) {
        // Game in progress: mark disconnected, AI takes over
        disconnectPlayer(room, currentPlayerId);
        io.to(currentRoomId).emit('room_updated', getRoomInfo(room));

        // Execute AI turns for the now-disconnected player if it's their turn
        const aiResult = triggerAIForDisconnected(room);
        if (aiResult.events.length > 0) {
          room.seq++;
          broadcastGameUpdate(io, room, aiResult.events);
        }

        // Start cleanup timer if no humans connected
        if (!hasConnectedHumans(room)) {
          room.cleanupTimer = setTimeout(() => {
            cleanupRoom(room.id);
          }, CLEANUP_TIMEOUT_MS);
        }
      } else {
        // Pre-game: remove player entirely
        room.players.delete(currentPlayerId);
        playerRoomMap.delete(currentPlayerId);

        if (room.players.size === 0) {
          rooms.delete(currentRoomId);
        } else {
          if (room.hostId === currentPlayerId) {
            const [newHostId] = room.players.keys();
            room.hostId = newHostId;
          }
          io.to(currentRoomId).emit('room_updated', getRoomInfo(room));
        }
      }
    });
  });
}

// --- Import addAI/removeAI (needed for socket handlers) ---
import { addAI, removeAI } from './room.js';

/**
 * After a player disconnects mid-game, run AI turns if it's their turn.
 * Uses the same executeAITurns logic from room.ts.
 */
function triggerAIForDisconnected(room: RoomState): { events: import('@magical-athlete/engine').GameEvent[] } {
  // Re-run processPlayerAction won't work directly; instead import executeAITurns
  // Actually, the simplest approach: call processPlayerAction won't help since the
  // disconnected player isn't acting. We need to import and call executeAITurns.
  // But executeAITurns is not exported. We should export it in Task 1.
  // For now, we'll handle this by exporting executeAITurns from room.ts.
  return executeAITurns(room);
}

import { executeAITurns } from './room.js';

function getRoomInfo(room: RoomState) {
  return {
    id: room.id,
    hostId: room.hostId,
    players: [...room.players.entries()].map(([playerId, info]) => ({
      id: playerId,
      name: info.name,
      isAI: false,
      connected: info.connected,
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

function broadcastGameUpdate(io: Server, room: RoomState, events: import('@magical-athlete/engine').GameEvent[]) {
  if (!room.gameState) return;

  for (const [playerId, info] of room.players) {
    if (!info.socketId) continue; // disconnected
    const view = getPlayerView(room.gameState, playerId);
    io.to(info.socketId).emit('game_update', { state: view, events, seq: room.seq });
  }
}

function cleanupRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;
  // Clean up player mappings
  for (const pid of room.players.keys()) {
    playerRoomMap.delete(pid);
  }
  rooms.delete(roomId);
}
```

Note: This requires `executeAITurns` to be exported from `room.ts`. Add `export` to the existing function:

In `packages/server/src/room.ts`, change:
```ts
function executeAITurns(room: RoomState): { events: GameEvent[] } {
```
to:
```ts
export function executeAITurns(room: RoomState): { events: GameEvent[] } {
```

- [ ] **Step 2: Run type check**

Run: `cd packages/server && npx tsc --noEmit`
Expected: PASS (or only client-side errors if client hasn't been updated yet)

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/socket-handlers.ts packages/server/src/room.ts
git commit -m "feat(server): unified game_update, ack callbacks, reconnection, AI takeover"
```

---

## Chunk 2: Client-Side Changes

### Task 3: Update useSocket with auth and reconnection config

**Files:**
- Modify: `packages/client/src/hooks/useSocket.ts`

- [ ] **Step 1: Rewrite useSocket.ts**

```ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Restore session from sessionStorage for reconnection
    const savedPlayerId = sessionStorage.getItem('ma_playerId');
    const savedRoomId = sessionStorage.getItem('ma_roomId');

    const socket = io(SERVER_URL, {
      auth: {
        playerId: savedPlayerId || undefined,
        roomId: savedRoomId || undefined,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => {
      socket.disconnect();
    };
  }, []);

  const emit = useCallback((event: string, data?: any, callback?: (res: any) => void) => {
    socketRef.current?.emit(event, data, callback);
  }, []);

  const on = useCallback((event: string, handler: (...args: any[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  /** Save session identity for reconnection */
  const saveSession = useCallback((playerId: string, roomId: string) => {
    sessionStorage.setItem('ma_playerId', playerId);
    sessionStorage.setItem('ma_roomId', roomId);
    // Update auth for future reconnections within this socket
    if (socketRef.current) {
      socketRef.current.auth = { playerId, roomId };
    }
  }, []);

  /** Clear session (e.g., on leaving room) */
  const clearSession = useCallback(() => {
    sessionStorage.removeItem('ma_playerId');
    sessionStorage.removeItem('ma_roomId');
    if (socketRef.current) {
      socketRef.current.auth = {};
    }
  }, []);

  return { connected, emit, on, saveSession, clearSession };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/hooks/useSocket.ts
git commit -m "feat(client): add session persistence and reconnection config to useSocket"
```

---

### Task 4: Update useGameState for unified game_update

**Files:**
- Modify: `packages/client/src/hooks/useGameState.ts`

- [ ] **Step 1: Rewrite useGameState.ts**

Replace `game_state` + `game_events` listeners with single `game_update`:

```ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameState, GameEvent } from '@magical-athlete/engine';

interface RoomInfo {
  id: string;
  hostId: string;
  players: { id: string; name: string; isAI: boolean; connected?: boolean }[];
  aiPlayers: { id: string; name: string; isAI: boolean; aiDifficulty?: string }[];
  gameStarted: boolean;
}

export function useGameState(
  on: (event: string, handler: (...args: any[]) => void) => () => void,
  emit: (event: string, data?: any, callback?: (res: any) => void) => void,
) {
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const seqRef = useRef(0);

  useEffect(() => {
    const unsub1 = on('room_updated', (info: RoomInfo) => {
      setRoomInfo(info);
    });

    const unsub2 = on('game_update', (update: { state: GameState; events: GameEvent[]; seq: number }) => {
      // Restore Set from array (serialization)
      update.state.triggeredThisMove = new Set(update.state.triggeredThisMove as any);

      // Detect seq gap → request full sync
      if (update.seq > seqRef.current + 1 && seqRef.current > 0) {
        emit('request_sync');
      }
      seqRef.current = update.seq;

      setGameState(update.state);

      if (update.events.length > 0) {
        // Clear events on phase transitions to prevent unbounded growth
        const hasPhaseChange = update.events.some(e => e.type === 'PHASE_CHANGED');
        if (hasPhaseChange) {
          setEvents(update.events);
        } else {
          setEvents(prev => [...prev, ...update.events]);
        }
      }
    });

    // Handle reconnection: server sends game_update after reconnect
    const unsub3 = on('reconnected', () => {
      // Reset events on reconnect — we get fresh state
      setEvents([]);
      seqRef.current = 0;
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, emit]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { roomInfo, gameState, events, clearEvents };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/hooks/useGameState.ts
git commit -m "feat(client): handle unified game_update message with seq tracking"
```

---

### Task 5: Update App.tsx for session management and reconnection

**Files:**
- Modify: `packages/client/src/App.tsx`

- [ ] **Step 1: Rewrite App.tsx**

Key changes:
- Use `saveSession` / `clearSession` from useSocket
- Pass `emit` to `useGameState` (needed for `request_sync`)
- Restore `playerId`/`roomId` from sessionStorage on mount
- Handle `reconnected` event to restore local state
- Add ack callback to `game_action`

```tsx
import { useState, useEffect } from 'react';
import { useSocket } from './hooks/useSocket.ts';
import { useGameState } from './hooks/useGameState.ts';
import { Lobby } from './pages/Lobby.tsx';
import { Room } from './pages/Room.tsx';
import { Draft } from './pages/Draft.tsx';
import { Race } from './pages/Race.tsx';

export function App() {
  const { connected, emit, on, saveSession, clearSession } = useSocket();
  const { roomInfo, gameState, events } = useGameState(on, emit);
  const [playerId, setPlayerId] = useState<string | null>(
    () => sessionStorage.getItem('ma_playerId')
  );
  const [roomId, setRoomId] = useState<string | null>(
    () => sessionStorage.getItem('ma_roomId')
  );

  // Listen for reconnection confirmation
  useEffect(() => {
    return on('reconnected', (data: { playerId: string; roomId: string }) => {
      setPlayerId(data.playerId);
      setRoomId(data.roomId);
    });
  }, [on]);

  const handleCreateRoom = (playerName: string) => {
    emit('create_room', { playerName }, (res: any) => {
      if (res.error) return alert(res.error);
      setPlayerId(res.playerId);
      setRoomId(res.roomId);
      saveSession(res.playerId, res.roomId);
    });
  };

  const handleJoinRoom = (joinRoomId: string, playerName: string) => {
    emit('join_room', { roomId: joinRoomId, playerName }, (res: any) => {
      if (res.error) return alert(res.error);
      setPlayerId(res.playerId);
      setRoomId(res.roomId);
      saveSession(res.playerId, res.roomId);
    });
  };

  const handleAddAI = (difficulty: 'easy' | 'normal') => {
    emit('add_ai', { difficulty });
  };

  const handleRemoveAI = (aiId: string) => {
    emit('remove_ai', { aiId });
  };

  const handleStartGame = () => {
    emit('start_game');
  };

  const handleGameAction = (action: any) => {
    emit('game_action', action, (res: any) => {
      if (res?.error) {
        console.error('Action error:', res.error);
      }
    });
  };

  // Determine which page to show
  if (!connected) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h2>连接服务器中...</h2>
        <p style={{ color: '#888', marginTop: '12px' }}>如果长时间无法连接，请刷新页面</p>
      </div>
    );
  }

  if (!roomId) {
    return <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />;
  }

  if (!gameState) {
    return (
      <Room
        roomInfo={roomInfo}
        playerId={playerId}
        onAddAI={handleAddAI}
        onRemoveAI={handleRemoveAI}
        onStartGame={handleStartGame}
      />
    );
  }

  if (gameState.phase === 'DRAFTING') {
    return (
      <Draft
        gameState={gameState}
        playerId={playerId!}
        onAction={handleGameAction}
      />
    );
  }

  return (
    <Race
      gameState={gameState}
      playerId={playerId!}
      events={events}
      onAction={handleGameAction}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/App.tsx
git commit -m "feat(client): session restore, reconnection handling, ack callbacks"
```

---

### Task 6: Update Room.tsx to show connection status

**Files:**
- Modify: `packages/client/src/pages/Room.tsx`

- [ ] **Step 1: Add connected indicator to player list**

In the `RoomInfo` interface, add `connected?: boolean` to the player type. Then in the player list rendering, show a disconnected indicator:

Update the player `<li>` to show connection status:

```tsx
{roomInfo.players.map(p => (
  <li key={p.id} style={{ padding: '10px 12px', borderBottom: '2px solid #35303b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span style={{ color: p.connected === false ? '#666' : '#fff' }}>{p.name}</span>
    {p.connected === false && <span style={{ background: '#666', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>离线</span>}
    {p.id === roomInfo.hostId && <span style={{ background: '#e81e3c', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>房主</span>}
    {p.id === playerId && <span style={{ background: '#3b82f6', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 800 }}>你</span>}
  </li>
))}
```

Also update the `RoomInfo` interface in this file:

```ts
interface RoomInfo {
  id: string;
  hostId: string;
  players: { id: string; name: string; isAI: boolean; connected?: boolean }[];
  aiPlayers: { id: string; name: string; isAI: boolean; aiDifficulty?: string }[];
  gameStarted: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/pages/Room.tsx
git commit -m "feat(client): show player connection status in room lobby"
```

---

## Chunk 3: Integration & Verification

### Task 7: Type check and fix integration issues

**Files:**
- Possibly modify: any file with type errors

- [ ] **Step 1: Run full type check on server**

Run: `cd packages/server && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full type check on client**

Run: `cd packages/client && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Fix any type errors found**

Address each error. Common issues:
- `useGameState` signature change (now takes `emit` as second param)
- Missing imports for new functions from `room.ts`
- `connected` field added to room info type

- [ ] **Step 4: Run existing engine tests to make sure nothing broke**

Run: `cd packages/engine && npx vitest run`
Expected: All tests pass (engine is not modified in this plan)

- [ ] **Step 5: Commit fixes if any**

```bash
git add -A
git commit -m "fix: resolve type errors from network reliability refactor"
```

---

### Task 8: Manual integration testing

- [ ] **Step 1: Start dev server**

Run: `pnpm dev` (or equivalent — start both server and client in dev mode)

- [ ] **Step 2: Test basic flow**

1. Open browser → Lobby appears
2. Create room → get roomId + playerId, both stored in sessionStorage
3. Open second browser tab → join same room
4. Start game, play through draft
5. Verify dice rolls work with ack (no stuck states)

- [ ] **Step 3: Test reconnection**

1. During a game, disconnect one player (close tab)
2. Re-open tab with same URL → should auto-reconnect to game
3. Verify game state is restored, can continue playing

- [ ] **Step 4: Test AI takeover**

1. During a game, close one player's tab when it's their turn
2. AI should immediately take their turn
3. Reconnect the tab → player regains control on next turn

- [ ] **Step 5: Test cleanup**

1. Disconnect all human players
2. Wait 5 minutes (or temporarily reduce timeout for testing)
3. Verify room is cleaned up

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: network reliability overhaul — reconnection, ack, AI takeover"
```
