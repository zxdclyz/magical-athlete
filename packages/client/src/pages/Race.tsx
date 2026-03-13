import { useEffect, useRef, useState } from 'react';
import type { GameState, GameEvent, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { TrackBoard } from '../components/TrackBoard.tsx';
import { EventLog } from '../components/EventLog.tsx';
import { ScoreBoard } from '../components/ScoreBoard.tsx';
import { DecisionPanel } from '../components/DecisionPanel.tsx';
import { DiceRoll } from '../components/DiceRoll.tsx';
import type { DiceMode } from '../components/DiceRoll.tsx';
import { AbilityToast } from '../components/AbilityToast.tsx';
import { TurnBanner } from '../components/TurnBanner.tsx';
import { RaceEndModal } from '../components/RaceEndModal.tsx';
import { useAnimationQueue } from '../hooks/useAnimationQueue.ts';
import { getRacerImageUrl } from '../assets/racerImages.ts';

const PLAYER_COLORS = ['#e81e3c', '#3b82f6', '#2ecc40', '#ffd700', '#cc5de8'];

interface RaceProps {
  gameState: GameState;
  playerId: string;
  events: GameEvent[];
  onAction: (action: any) => void;
}

export function Race({ gameState, playerId, events, onAction }: RaceProps) {
  const isMyTurn = gameState.turnOrder[gameState.currentTurnIndex] === playerId;
  const currentPlayerId = gameState.turnOrder[gameState.currentTurnIndex];
  const currentPlayer = gameState.players.find(p => p.id === currentPlayerId);

  const { animState, enqueue, initPositions } = useAnimationQueue();
  const lastEventsLenRef = useRef(0);
  const raceInitRef = useRef<number>(0); // tracks which race we've initialized for

  // === Dice state ===
  const [myRollValue, setMyRollValue] = useState<number | null>(null);
  const rollEventsLenRef = useRef(0); // events.length at time of rolling
  const prevTurnIndexRef = useRef<number>(-1);

  // Reset dice state when a new turn starts (e.g. Skipper insertion or normal turn advance)
  // This prevents stale myRollValue from blocking the interactive dice.
  useEffect(() => {
    const turnIndex = gameState.currentTurnIndex;
    if (prevTurnIndexRef.current !== -1 && turnIndex !== prevTurnIndexRef.current) {
      setMyRollValue(null);
      rollEventsLenRef.current = 0;
    }
    prevTurnIndexRef.current = turnIndex;
  }, [gameState.currentTurnIndex]);

  // Shared lookup maps — recompute on every render to avoid stale data
  const playerNames: Record<string, string> = {};
  for (const p of gameState.players) playerNames[p.id] = p.name;

  const racerOwners: Record<string, string> = {};
  for (const r of gameState.activeRacers) racerOwners[r.racerName] = r.playerId;

  const playerIndex: Record<string, number> = {};
  gameState.players.forEach((p, i) => { playerIndex[p.id] = i; });

  const playerRacers: Record<string, RacerName> = {};
  for (const r of gameState.activeRacers) playerRacers[r.playerId] = r.racerName;

  // hasPendingAnims: true if animations are playing OR new events arrived but haven't been enqueued yet.
  // This fixes the timing gap between events arriving (render) and useEffect enqueueing them.
  const hasPendingAnims = animState.isPlaying || events.length > lastEventsLenRef.current;

  // Compute DiceMode purely from state — NO setState in render body
  const diceMode = ((): DiceMode => {
    // Priority 1: NPC dice animation
    if (animState.diceDisplay && animState.isPlaying && animState.diceDisplay.playerId !== playerId) {
      const pid = animState.diceDisplay.playerId;
      const name = pid ? playerNames[pid] : null;
      const racer = pid ? playerRacers[pid] : null;
      const racerCn = racer ? RACER_CARDS[racer]?.displayNameCn : null;
      return {
        type: 'animate',
        value: animState.diceDisplay.value,
        label: name ? `${name}${racerCn ? `（${racerCn}）` : ''}` : undefined,
        modified: animState.diceDisplay.modified ?? undefined,
      };
    }

    // Priority 2: Interactive dice — my turn, no pending decision, no animations,
    // and NOT waiting for server to process my roll
    const rolledAndWaiting = myRollValue !== null && events.length <= rollEventsLenRef.current;
    if (isMyTurn && !gameState.pendingDecision && !hasPendingAnims && !rolledAndWaiting) {
      return { type: 'interactive' };
    }

    // Priority 3: Show my last roll result
    if (myRollValue !== null) {
      return { type: 'result', value: myRollValue, label: '你的骰子' };
    }

    // Nothing yet (game just started, before first roll)
    // If there's a pending decision (e.g. Genius PREDICT_DICE), don't show interactive dice
    if (isMyTurn && !gameState.pendingDecision) {
      return { type: 'interactive' };
    }
    return { type: 'waiting', label: isMyTurn ? undefined : `等待 ${playerNames[currentPlayerId] ?? '其他玩家'} 掷骰…` };
  })();
  const diceAnimId = animState.diceDisplay?.stepId ?? 0;

  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);

  // Initialize positions — for a new race, start all at position 0 so animations
  // play from the beginning. Triggers when currentRace or activeRacers change.
  useEffect(() => {
    if (gameState.activeRacers.length === 0) return;
    if (gameState.phase !== 'RACING' && gameState.phase !== 'RACE_END') return;

    const isNewRace = raceInitRef.current !== gameState.currentRace;
    if (!isNewRace) return;

    raceInitRef.current = gameState.currentRace;
    // New race: start all at position 0, let enqueued animations move them
    const startRacers = gameState.activeRacers
      .filter(r => !r.eliminated)
      .map(r => ({ ...r, position: 0, finished: false }));
    initPositions(startRacers, gameState.track.length, lastEventsLenRef.current);
  }, [gameState.currentRace, gameState.activeRacers.length, gameState.phase]);

  // Enqueue new events — pass startIndex for event-log sync
  useEffect(() => {
    if (events.length > lastEventsLenRef.current) {
      const startIndex = lastEventsLenRef.current;
      const newEvents = events.slice(startIndex);
      lastEventsLenRef.current = events.length;
      enqueue(newEvents, startIndex);
    }
  }, [events.length]);

  // Game over screen
  if (gameState.phase === 'GAME_OVER') {
    const sorted = [...gameState.players].sort(
      (a, b) => (gameState.scores[b.id] ?? 0) - (gameState.scores[a.id] ?? 0)
    );
    return (
      <div className="page game-over-page">
        <div className="rainbow-bar" />
        <h1 style={{ color: '#ffd700', fontWeight: 900 }}>游戏结束！</h1>
        <div className="game-over-list">
          {sorted.map((p, i) => {
            const racer = gameState.activeRacers.find(r => r.playerId === p.id);
            const card = racer ? RACER_CARDS[racer.racerName] : null;
            return (
              <div key={p.id} className={`game-over-row ${i === 0 ? 'winner' : ''} ${p.id === playerId ? 'is-me' : ''}`}>
                <span className="game-over-rank">
                  {i === 0 ? '🏆' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <div className="game-over-info">
                  <span className="game-over-name">{p.name}{p.id === playerId ? ' (你)' : ''}</span>
                  {card && <span className="game-over-racer">{card.displayNameCn}</span>}
                </div>
                <span className="game-over-score">{gameState.scores[p.id] ?? 0} 分</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Race setup
  if (gameState.phase === 'RACE_SETUP') {
    const me = gameState.players.find(p => p.id === playerId);
    const myAvailable = me ? me.hand.filter(r => !me.usedRacers.includes(r)) : [];
    const myChoice = (gameState as any).raceSetupChoices?.[playerId];
    const hasChosen = !!myChoice;
    const chosenCount = Object.keys((gameState as any).raceSetupChoices ?? {}).length;
    const totalPlayers = gameState.players.length;

    return (
      <div className="page">
        <div className="rainbow-bar" />
        <h1 style={{ color: '#ffd700', fontWeight: 900 }}>第 {gameState.currentRace}/4 场比赛 — 选择角色</h1>
        {hasChosen ? (
          <div className="setup-waiting">
            <div className="setup-waiting-text">已选择角色！</div>
            <div className="setup-waiting-sub">等待其他玩家… ({chosenCount}/{totalPlayers})</div>
          </div>
        ) : (
          <div className="setup-pick">
            <h3 style={{ fontWeight: 800 }}>从手牌中选择一位角色参赛：</h3>
            <div className="setup-racer-grid">
              {myAvailable.map(name => {
                const card = RACER_CARDS[name];
                return (
                  <button key={name} type="button" className="setup-racer-card" onClick={() => onAction({
                    type: 'MAKE_DECISION',
                    decision: { type: 'CHOOSE_RACE_RACER', racerName: name },
                  })}>
                    <img src={getRacerImageUrl(name)} alt={card.displayNameCn} className="setup-racer-img" width={140} height={140} />
                    <div className="setup-racer-name">{card.displayNameCn}</div>
                    <div className="setup-racer-ability">{card.abilityTextCn}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <ScoreBoard gameState={gameState} playerId={playerId} />
      </div>
    );
  }

  // Racing phase (also serves as background when RACE_END modal is shown)
  const showRaceEndModal = gameState.phase === 'RACE_END' && !hasPendingAnims;
  const isHost = gameState.players[0]?.id === playerId;

  return (
    <div className="race-page">
      <div className="rainbow-bar" />
      {/* Turn banner — shows whose turn is being animated, or current turn */}
      <TurnBanner
        key={animState.animatedTurnPlayerId ?? currentPlayerId}
        playerNames={playerNames}
        playerIndex={playerIndex}
        playerRacers={playerRacers}
        currentPlayerId={animState.animatedTurnPlayerId ?? currentPlayerId}
        isMyTurn={!animState.animatedTurnPlayerId && isMyTurn}
      />

      {/* Track area */}
      <div className="track-area">
        <div className="track-header">
          <h3>第 {gameState.currentRace}/4 场 — {gameState.trackConfig.name} ({gameState.trackConfig.side === 'mild' ? 'A面' : 'B面'})</h3>
        </div>
        <TrackBoard
          gameState={gameState}
          playerId={playerId}
          animPositions={animState.animPositions}
          playerIndex={playerIndex}
          activeEffects={animState.activeEffects}
        />
        <AbilityToast toasts={animState.toasts} />
      </div>

      {/* Bottom panel: 3 columns */}
      <div className="bottom-panel">
        {/* Left: dice area + my decisions */}
        <div className="panel-left">
          {/* Single dice component — always mounted, mode drives display */}
          <DiceRoll
            mode={diceMode}
            animId={diceAnimId}
            onRollComplete={(value) => {
              setMyRollValue(value);
              rollEventsLenRef.current = events.length;
              onAction({ type: 'MAKE_DECISION', decision: { type: 'ROLL_DICE', value } });
            }}
          />

          <DecisionPanel gameState={gameState} playerId={playerId} onAction={onAction} />
        </div>

        {/* Center: event log (wide) */}
        <div className="panel-center">
          <EventLog
            events={events}
            visibleEventCount={animState.visibleEventCount}
            playerNames={playerNames}
            racerOwners={racerOwners}
            playerIndex={playerIndex}
          />
        </div>

        {/* Right: player cards */}
        <div className="panel-right">
          <h4 className="panel-title">参赛角色</h4>
          <div className="player-grid">
            {gameState.players.map((p, idx) => {
              const racer = gameState.activeRacers.find(r => r.playerId === p.id);
              const card = racer ? RACER_CARDS[racer.racerName] : null;
              const isCurrentTurn = p.id === (animState.animatedTurnPlayerId ?? currentPlayerId);
              const isMe = p.id === playerId;
              const pColor = PLAYER_COLORS[idx] ?? '#888';
              const isExpanded = expandedPlayer === p.id;

              return (
                <div key={p.id}
                  className={`player-card ${isCurrentTurn ? 'active-turn' : ''} ${isMe ? 'is-me' : ''}`}
                  style={{ '--player-color': pColor } as React.CSSProperties}
                  onClick={() => setExpandedPlayer(isExpanded ? null : p.id)}
                >
                  {racer && (
                    <div className="player-card-avatar-wrap">
                      <img src={getRacerImageUrl(racer.racerName)} alt={card?.displayNameCn} className="player-card-avatar" width={48} height={48} />
                      {isCurrentTurn && <div className="avatar-turn-ring" />}
                    </div>
                  )}
                  <div className="player-card-info">
                    <div className="player-card-name">
                      <span style={{ color: pColor }}>{p.name}</span>
                      {isMe && <span className="badge-me">你</span>}
                    </div>
                    {card && <div className="player-card-racer">{card.displayNameCn}</div>}
                  </div>
                  <div className="player-card-score">{gameState.scores[p.id] ?? 0}</div>
                  {racer && (
                    <div className="player-card-status">
                      {racer.finished ? (
                        <span className="status-finished">🏁 #{racer.finishOrder}</span>
                      ) : racer.tripped ? (
                        <span className="status-tripped">💥 绊倒</span>
                      ) : racer.eliminated ? (
                        <span className="status-eliminated">☠️ 淘汰</span>
                      ) : (
                        <span className="status-pos">📍 {racer.position}</span>
                      )}
                    </div>
                  )}
                  {isCurrentTurn && <span className="badge-turn">回合中</span>}

                  {/* Ability — expand on click */}
                  {card && isExpanded && (
                    <div className="ability-detail-card">
                      <div className="ability-tag">⚡ {card.taglineCn}</div>
                      <div className="ability-detail">{card.abilityTextCn}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showRaceEndModal && (
        <RaceEndModal
          gameState={gameState}
          playerId={playerId}
          isHost={isHost}
          onContinue={() => onAction({ type: 'CONTINUE_FROM_RACE_END' })}
        />
      )}
    </div>
  );
}
