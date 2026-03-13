import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const SERVER_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
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

  const saveSession = useCallback((playerId: string, roomId: string) => {
    sessionStorage.setItem('ma_playerId', playerId);
    sessionStorage.setItem('ma_roomId', roomId);
    if (socketRef.current) {
      socketRef.current.auth = { playerId, roomId };
    }
  }, []);

  const clearSession = useCallback(() => {
    sessionStorage.removeItem('ma_playerId');
    sessionStorage.removeItem('ma_roomId');
    if (socketRef.current) {
      socketRef.current.auth = {};
    }
  }, []);

  return { connected, emit, on, saveSession, clearSession };
}
