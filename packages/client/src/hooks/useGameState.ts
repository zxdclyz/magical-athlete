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

    // Handle reconnection: reset events on reconnect
    const unsub3 = on('reconnected', () => {
      setEvents([]);
      seqRef.current = 0;
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, emit]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { roomInfo, gameState, events, clearEvents };
}
