import type { GameState, Player } from './types.js';
import { ALL_RACER_NAMES } from './racers.js';
import { createTrack, RACE_TRACK_SEQUENCE } from './track.js';

const DRAFTS_PER_PLAYER: Record<number, number> = {
  2: 5,
  3: 4,
  4: 3,
  5: 2,
};

export function getDraftsPerPlayer(playerCount: number): number {
  const count = DRAFTS_PER_PLAYER[playerCount];
  if (count === undefined) {
    throw new Error(`Unsupported player count: ${playerCount}. Must be 2-5.`);
  }
  return count;
}

export function generateDraftOrder(playerIds: string[], draftsPerPlayer: number): string[] {
  const order: string[] = [];
  for (let round = 0; round < draftsPerPlayer; round++) {
    if (round % 2 === 0) {
      order.push(...playerIds);
    } else {
      order.push(...[...playerIds].reverse());
    }
  }
  return order;
}

export function createInitialState(players: Player[]): GameState {
  const trackId = RACE_TRACK_SEQUENCE[0];
  const trackConfig = createTrack(trackId);
  const scores: Record<string, number> = {};
  for (const p of players) {
    scores[p.id] = 0;
  }

  return {
    phase: 'LOBBY',
    players,

    // 选角
    draftOrder: [],
    draftCurrentIndex: 0,
    availableRacers: [...ALL_RACER_NAMES],

    // 赛道
    track: trackConfig.spaces,
    trackConfig,
    currentRace: 1,

    // 比赛中
    activeRacers: [],
    turnOrder: [],
    currentTurnIndex: 0,

    // 计分 - 金色筹码递减，银色筹码递减
    scores,
    goldChipValues: [7, 6, 5, 4],
    silverChipValues: [4, 3, 2, 1],
    raceWinners: [],

    // 事件
    eventLog: [],

    // 防无限循环
    triggeredThisMove: new Set(),

    // 等待决策
    pendingDecision: null,

    // 特殊回合
    extraTurnPlayerId: null,
    skipperNextPlayerId: null,

    // 回合开始位置
    turnStartPositions: {},
  };
}
