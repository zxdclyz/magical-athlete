import { useEffect, useRef, useMemo } from 'react';
import type { GameEvent, RacerName } from '@magical-athlete/engine';
import { RACER_CARDS } from '@magical-athlete/engine';
import { getRacerImageUrl } from '../assets/racerImages.ts';

const PLAYER_COLORS = ['#e81e3c', '#3b82f6', '#2ecc40', '#ffd700', '#cc5de8'];

interface RichEvent {
  id: number;
  icon: string;
  /** Player color for this event */
  color: string;
  text: string;
  detail?: string;
  racerImage?: string;
}

interface EventLogProps {
  events: GameEvent[];
  /** How many events to actually show (synced with animation) */
  visibleEventCount: number;
  playerNames: Record<string, string>;
  racerOwners: Record<string, string>;
  playerIndex: Record<string, number>;
}

/** Format: "玩家名（角色名）" */
function nameTag(racerName: string, playerNames: Record<string, string>, racerOwners: Record<string, string>): string {
  const card = RACER_CARDS[racerName as keyof typeof RACER_CARDS];
  const pid = racerOwners[racerName];
  const pName = pid ? playerNames[pid] : null;
  const rName = card ? card.displayNameCn : racerName;
  return pName ? `${pName}（${rName}）` : rName;
}

function formatRichEvent(
  event: GameEvent,
  idx: number,
  playerNames: Record<string, string>,
  racerOwners: Record<string, string>,
  playerIndex: Record<string, number>,
): RichEvent | null {
  const nt = (rn: string) => nameTag(rn, playerNames, racerOwners);
  const pidColor = (pid: string) => PLAYER_COLORS[playerIndex[pid] ?? 0] ?? '#888';
  const ownerColor = (rn: string) => {
    const pid = racerOwners[rn];
    return pid ? pidColor(pid) : '#888';
  };

  switch (event.type) {
    case 'DRAFT_ORDER_ROLLED': {
      const lines = event.rolls.map(r => {
        const name = playerNames[r.playerId] ?? '?';
        return `${name} 🎲${r.value}`;
      });
      return {
        id: idx, icon: '🎲', color: '#888',
        text: `选人顺序：${lines.join('，')}`,
      };
    }
    case 'DICE_ROLLED': {
      const name = playerNames[event.playerId] ?? '玩家';
      return {
        id: idx, icon: '🎲', color: pidColor(event.playerId),
        text: `${name} 掷出了 ${event.value}`,
      };
    }
    case 'DICE_MODIFIED': {
      const name = playerNames[event.playerId] ?? '玩家';
      return {
        id: idx, icon: '✨', color: pidColor(event.playerId),
        text: `${name} 骰子修正 ${event.originalValue} → ${event.newValue}`,
        detail: event.reason,
      };
    }
    case 'RACER_MOVING':
      return {
        id: idx, icon: '👟', color: ownerColor(event.racerName),
        racerImage: getRacerImageUrl(event.racerName as RacerName),
        text: `${nt(event.racerName)} 移动 ${event.from} → ${event.to}`,
      };
    case 'RACER_PASSED':
      return {
        id: idx, icon: '💨', color: ownerColor(event.movingRacer),
        text: `${nt(event.movingRacer)} 超过了 ${nt(event.passedRacer)}`,
      };
    case 'RACER_TRIPPED':
      return {
        id: idx, icon: '💥', color: ownerColor(event.racerName),
        racerImage: getRacerImageUrl(event.racerName as RacerName),
        text: `${nt(event.racerName)} 被绊倒了！`,
      };
    case 'RACER_WARPED':
      return {
        id: idx, icon: '🌀', color: ownerColor(event.racerName),
        racerImage: getRacerImageUrl(event.racerName as RacerName),
        text: `${nt(event.racerName)} 传送 ${event.from} → ${event.to}`,
      };
    case 'RACER_SWAPPED':
      return {
        id: idx, icon: '🔄', color: ownerColor(event.racer1),
        text: `${nt(event.racer1)} ↔ ${nt(event.racer2)} 交换位置`,
      };
    case 'RACER_ELIMINATED':
      return {
        id: idx, icon: '☠️', color: ownerColor(event.racerName),
        text: `${nt(event.racerName)} 被 ${nt(event.byRacer)} 淘汰！`,
      };
    case 'RACER_FINISHED': {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = medals[event.place - 1] ?? `#${event.place}`;
      return {
        id: idx, icon: medal, color: ownerColor(event.racerName),
        racerImage: getRacerImageUrl(event.racerName as RacerName),
        text: `${nt(event.racerName)} 第${event.place}名完赛！`,
      };
    }
    case 'ABILITY_TRIGGERED':
      return {
        id: idx, icon: '⚡', color: ownerColor(event.racerName),
        racerImage: getRacerImageUrl(event.racerName as RacerName),
        text: `${nt(event.racerName)} 发动技能`,
        detail: event.description,
      };
    case 'POINT_CHIP_GAINED': {
      const name = playerNames[event.playerId] ?? '玩家';
      const chipLabel = event.chipType === 'gold' ? '金' : event.chipType === 'silver' ? '银' : '铜';
      return {
        id: idx, icon: event.chipType === 'gold' ? '🥇' : event.chipType === 'silver' ? '🥈' : '🥉',
        color: pidColor(event.playerId),
        text: `${name} 获得${chipLabel}筹码（${event.value}分）`,
      };
    }
    case 'TURN_ORDER_DECIDED': {
      const names = event.turnOrder.map(pid => playerNames[pid] ?? '?');
      return {
        id: idx, icon: '🏃', color: '#888',
        text: `回合顺序：${names.join(' → ')}`,
      };
    }
    case 'RACE_ENDED':
      return {
        id: idx, icon: '🏁', color: '#888',
        text: `第 ${event.raceNumber} 场比赛结束`,
      };
    case 'GAME_ENDED':
      return {
        id: idx, icon: '🎉', color: '#ffd700',
        text: '游戏结束！',
      };
    default:
      return null;
  }
}

export function EventLog({ events, visibleEventCount, playerNames, racerOwners, playerIndex }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Only show events up to visibleEventCount (synced with animation)
  const visibleEvents = events.slice(0, visibleEventCount);

  const richEvents = useMemo(() => {
    return visibleEvents
      .map((e, i) => formatRichEvent(e, i, playerNames, racerOwners, playerIndex))
      .filter((e): e is RichEvent => e !== null)
      .slice(-50);
  }, [visibleEvents.length, playerNames, racerOwners, playerIndex]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [richEvents.length]);

  return (
    <div className="event-log" ref={scrollRef}>
      <h4>事件日志</h4>
      {richEvents.length === 0 ? (
        <div className="event-log-empty">等待比赛开始…</div>
      ) : (
        richEvents.map((ev) => (
          <div key={ev.id} className="event-card" style={{ '--ev-color': ev.color } as React.CSSProperties}>
            <span className="event-icon">{ev.icon}</span>
            <div className="event-body">
              <span className="event-text">{ev.text}</span>
              {ev.detail && <span className="event-detail">{ev.detail}</span>}
            </div>
            {ev.racerImage && (
              <img src={ev.racerImage} alt="" className="event-racer-img" width={28} height={28} />
            )}
          </div>
        ))
      )}
    </div>
  );
}
