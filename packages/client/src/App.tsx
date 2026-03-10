import { useState } from 'react';
import { useSocket } from './hooks/useSocket.ts';
import { useGameState } from './hooks/useGameState.ts';
import { Lobby } from './pages/Lobby.tsx';
import { Room } from './pages/Room.tsx';
import { Draft } from './pages/Draft.tsx';
import { Race } from './pages/Race.tsx';

export function App() {
  const { connected, emit, on } = useSocket();
  const { roomInfo, gameState, events } = useGameState(on);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  const handleCreateRoom = (playerName: string) => {
    emit('create_room', { playerName }, (res: any) => {
      if (res.error) return alert(res.error);
      setPlayerId(res.playerId);
      setRoomId(res.roomId);
    });
  };

  const handleJoinRoom = (joinRoomId: string, playerName: string) => {
    emit('join_room', { roomId: joinRoomId, playerName }, (res: any) => {
      if (res.error) return alert(res.error);
      setPlayerId(res.playerId);
      setRoomId(res.roomId);
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
    emit('game_action', action);
  };

  // Determine which page to show
  if (!connected) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '100px' }}>
        <h2>Connecting to server...</h2>
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
