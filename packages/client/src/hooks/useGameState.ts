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
  const isReconnectRef = useRef(false);
  const [skipAnimations, setSkipAnimations] = useState(false);

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

      // On reconnect, replace events entirely with server's phaseEvents
      if (isReconnectRef.current) {
        isReconnectRef.current = false;
        setSkipAnimations(true);
        setEvents(update.events);
        return;
      }

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

    // Handle reconnection: mark next game_update as a full state restore
    const unsub3 = on('reconnected', () => {
      seqRef.current = 0;
      isReconnectRef.current = true;
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on, emit]);

  const clearEvents = useCallback(() => setEvents([]), []);

  /** True when events were loaded from reconnect — skip animations, show instantly */
  const consumeSkipAnimations = useCallback(() => {
    if (skipAnimations) {
      setSkipAnimations(false);
      return true;
    }
    return false;
  }, [skipAnimations]);

  return { roomInfo, gameState, events, clearEvents, consumeSkipAnimations };
}
