import { useState, useEffect, useCallback } from 'react';
import type { GameState, GameEvent } from '@magical-athlete/engine';

interface RoomInfo {
  id: string;
  hostId: string;
  players: { id: string; name: string; isAI: boolean }[];
  aiPlayers: { id: string; name: string; isAI: boolean; aiDifficulty?: string }[];
  gameStarted: boolean;
}

export function useGameState(on: (event: string, handler: (...args: any[]) => void) => () => void) {
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);

  useEffect(() => {
    const unsub1 = on('room_updated', (info: RoomInfo) => {
      setRoomInfo(info);
    });
    const unsub2 = on('game_state', (state: GameState) => {
      // Restore Set from array (serialization)
      state.triggeredThisMove = new Set(state.triggeredThisMove as any);
      setGameState(state);
    });
    const unsub3 = on('game_events', (newEvents: GameEvent[]) => {
      setEvents(prev => [...prev, ...newEvents]);
    });

    return () => { unsub1(); unsub2(); unsub3(); };
  }, [on]);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { roomInfo, gameState, events, clearEvents };
}
