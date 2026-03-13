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

  // Listen for reconnection confirmation from server
  useEffect(() => {
    const unsub1 = on('reconnected', (data: { playerId: string; roomId: string }) => {
      setPlayerId(data.playerId);
      setRoomId(data.roomId);
    });
    // If server says our session is stale, clear it and go back to lobby
    const unsub2 = on('session_invalid', () => {
      clearSession();
      setPlayerId(null);
      setRoomId(null);
    });
    return () => { unsub1(); unsub2(); };
  }, [on, clearSession]);

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
