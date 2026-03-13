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
 * Get token from URL query param: ?t=xxxx
 */
function getTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('t');
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const urlRoomId = getRoomIdFromUrl();
    const urlToken = getTokenFromUrl();

    const socket = io(SERVER_URL, {
      auth: {
        token: urlToken || undefined,
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

  /** Update socket auth for reconnection (token + roomId) */
  const saveSession = useCallback((token: string, roomId: string) => {
    if (socketRef.current) {
      socketRef.current.auth = { token, roomId };
    }
  }, []);

  /** Clear socket auth */
  const clearSession = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.auth = {};
    }
  }, []);

  return { connected, emit, on, saveSession, clearSession };
}
