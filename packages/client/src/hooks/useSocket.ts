import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

/**
 * Get the roomId from the current URL path: /room/:roomId
 */
function getRoomIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Get saved playerId for a specific room.
 * Each room has its own playerId so multiple tabs with different rooms don't conflict.
 */
function getSavedPlayerId(roomId: string): string | null {
  return sessionStorage.getItem(`ma_player_${roomId}`);
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const urlRoomId = getRoomIdFromUrl();
    const savedPlayerId = urlRoomId ? getSavedPlayerId(urlRoomId) : null;

    const socket = io(SERVER_URL, {
      auth: {
        playerId: savedPlayerId || undefined,
        roomId: urlRoomId || undefined,
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

  /** Save playerId for a specific room */
  const saveSession = useCallback((playerId: string, roomId: string) => {
    sessionStorage.setItem(`ma_player_${roomId}`, playerId);
    if (socketRef.current) {
      socketRef.current.auth = { playerId, roomId };
    }
  }, []);

  /** Clear playerId for a specific room */
  const clearSession = useCallback((roomId: string) => {
    sessionStorage.removeItem(`ma_player_${roomId}`);
    if (socketRef.current) {
      socketRef.current.auth = {};
    }
  }, []);

  return { connected, emit, on, saveSession, clearSession };
}
