# Network Reliability Overhaul — Design Spec

## Goal

Make the multiplayer experience reliable: ack-based messaging, persistent player identity, reconnection with full game state recovery, and AI takeover for disconnected players.

## Current Problems

1. **No message acknowledgment**: `game_action` is fire-and-forget. If the message is lost, the client gets stuck (e.g., dice rolled but server never responds).
2. **No reconnection**: `disconnect` removes the player from the room. Any network blip kills the game.
3. **State and events sent separately**: `broadcastState()` and `emit('game_events')` are two independent messages that can arrive out of order or one can be lost.
4. **Events accumulate infinitely**: `setEvents(prev => [...prev, ...newEvents])` never clears, growing unbounded.
5. **socketId = playerId**: Player identity is tied to the socket connection, making reconnection impossible.

## Design

### 1. Persistent Player Identity

- On `create_room` / `join_room`, server generates a `playerId` (UUID) and returns it to the client.
- Client stores `playerId` + `roomId` in `sessionStorage`.
- `RoomState.players` key changes from `socketId` to `playerId`. Each entry tracks `{ name, socketId: string | null, connected: boolean }`.
- `hostId` uses `playerId` instead of `socketId`.

### 2. Connection & Reconnection

- Client passes `{ playerId?, roomId? }` in Socket.io `auth` field on connect.
- Server `connection` handler checks `auth.playerId`:
  - If matches an existing disconnected player in a room → **rejoin**: update socketId mapping, join socket to room, emit full `game_update` with current state.
  - Otherwise → treat as new connection (normal flow).
- Socket.io client config: `reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000`.
- On `disconnect`, server marks player `connected: false` but does NOT remove them.

### 3. Disconnect → AI Takeover

- When a player disconnects mid-game, immediately check if it's their turn.
- If it is their turn (or becomes their turn while disconnected), execute AI decisions on their behalf using `makeAIDecision` with `'easy'` difficulty.
- When the player reconnects, they regain control from the next action onward.
- The `getNextAIAction` function in `room.ts` already handles AI turn execution — extend it to also cover disconnected human players.

### 4. Unified Game Update Message

- Replace separate `game_state` + `game_events` emissions with a single `game_update` message:
  ```ts
  { state: GameState, events: GameEvent[], seq: number }
  ```
- `seq` is a monotonically increasing sequence number per room, allowing the client to detect missed updates.
- Client receives one atomic message — no split-brain between state and events.

### 5. Action Acknowledgment

- `game_action` uses Socket.io's ack callback:
  ```ts
  socket.emit('game_action', action, (response) => {
    if (response.error) { /* show error, re-enable UI */ }
    // success: state update comes via game_update
  });
  ```
- Server responds with `{ ok: true }` or `{ error: string }` via the ack.
- Client-side: if no ack received within 5 seconds (timeout), show a "connection issue" indicator and let Socket.io's built-in reconnection handle recovery.

### 6. Client State Sync

- Add a `request_sync` event: client can request the full current state at any time.
- Server responds with `game_update` containing current state + empty events array.
- Client sends `request_sync` on reconnect and when it detects a seq gap.

### 7. Event Accumulation Fix

- Client clears events array on phase transitions (`PHASE_CHANGED` events).
- Alternatively, only keep events from the current phase (server can scope events per update).

### 8. Room Cleanup

- Timer: if all human players are disconnected for >5 minutes, destroy the room.
- On last human disconnect, start a cleanup timer. On any reconnect, cancel it.

## Files Affected

### Server
- `packages/server/src/room.ts` — RoomState type, player identity, reconnect logic, AI takeover for disconnected players
- `packages/server/src/socket-handlers.ts` — connection/reconnection handling, unified `game_update` emission, ack callbacks, `request_sync`, room cleanup timers

### Client
- `packages/client/src/hooks/useSocket.ts` — auth field, reconnection config
- `packages/client/src/hooks/useGameState.ts` — handle `game_update` (replacing `game_state` + `game_events`), seq tracking, request_sync
- `packages/client/src/pages/Room.tsx` — store/restore playerId+roomId from sessionStorage

## Non-Goals

- Spectator mode
- Mid-game player join (new players after game start)
- Server-side event replay / persistence across server restarts
