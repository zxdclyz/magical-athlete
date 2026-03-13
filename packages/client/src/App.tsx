import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './hooks/useSocket.ts';
import { useGameState } from './hooks/useGameState.ts';
import { Lobby } from './pages/Lobby.tsx';
import { Room } from './pages/Room.tsx';
import { Draft } from './pages/Draft.tsx';
import { Race } from './pages/Race.tsx';

function getRoomIdFromUrl(): string | null {
  const match = window.location.pathname.match(/^\/room\/([A-Za-z0-9]+)$/);
  return match ? match[1].toUpperCase() : null;
}

export function App() {
  const { connected, emit, on, saveSession, clearSession } = useSocket();
  const { roomInfo, gameState, events } = useGameState(on, emit);

  // Derive roomId from URL — single source of truth
  const [roomId, setRoomId] = useState<string | null>(getRoomIdFromUrl);
  const [playerId, setPlayerId] = useState<string | null>(() => {
    const rid = getRoomIdFromUrl();
    return rid ? sessionStorage.getItem(`ma_player_${rid}`) : null;
  });

  // Keep roomId in sync with URL (browser back/forward)
  useEffect(() => {
    const handlePopState = () => {
      const rid = getRoomIdFromUrl();
      setRoomId(rid);
      setPlayerId(rid ? sessionStorage.getItem(`ma_player_${rid}`) : null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Listen for reconnection confirmation from server
  useEffect(() => {
    const unsub1 = on('reconnected', (data: { playerId: string; roomId: string }) => {
      setPlayerId(data.playerId);
      setRoomId(data.roomId);
    });
    const unsub2 = on('session_invalid', () => {
      const rid = getRoomIdFromUrl();
      if (rid) clearSession(rid);
      setPlayerId(null);
      setRoomId(null);
      window.history.replaceState(null, '', '/');
    });
    return () => { unsub1(); unsub2(); };
  }, [on, clearSession]);

  const navigateToRoom = useCallback((rid: string) => {
    window.history.pushState(null, '', `/room/${rid}`);
    setRoomId(rid);
  }, []);

  const navigateToLobby = useCallback(() => {
    window.history.pushState(null, '', '/');
    setRoomId(null);
    setPlayerId(null);
  }, []);

  const handleCreateRoom = (playerName: string) => {
    emit('create_room', { playerName }, (res: any) => {
      if (res.error) return alert(res.error);
      setPlayerId(res.playerId);
      saveSession(res.playerId, res.roomId);
      navigateToRoom(res.roomId);
    });
  };

  const handleJoinRoom = (joinRoomId: string, playerName: string) => {
    emit('join_room', { roomId: joinRoomId, playerName }, (res: any) => {
      if (res.error) return alert(res.error);
      setPlayerId(res.playerId);
      saveSession(res.playerId, res.roomId);
      navigateToRoom(res.roomId);
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

  // URL has a room but we don't have a playerId yet — need to join
  if (roomId && !playerId) {
    return <Lobby onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} prefillRoomId={roomId} />;
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
