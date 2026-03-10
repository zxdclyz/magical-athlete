import type { GameState, Player, RacerName } from './types.js';
import { ALL_RACER_NAMES } from './racers.js';
import { createTrack, RACE_TRACK_SEQUENCE } from './track.js';

/**
 * Draft rules (page 12):
 * - 3-6 players: everyone gets 4 racers total, via 2 rounds of snake draft
 * - Each round flips 2×N cards, snake draft so each player picks 2
 * - Second round starts with the player to the left of the first round's starter
 * - 2 players (page 26): flip 8, ABBAABBA snake, flip 8 more reversed, 8 each
 */

/** How many cards to flip per draft round */
export function getFlipCount(playerCount: number): number {
  return playerCount * 2;
}

/** Number of draft rounds */
export function getDraftRounds(playerCount: number): number {
  if (playerCount === 2) return 2; // 2-player variant: 2 rounds of 8
  return 2; // Standard: 2 rounds for all 3-6 player counts
}

/**
 * Generate a single snake-draft round order.
 * For N players, this is A→B→C→...→N→N→...→C→B→A (each player picks twice).
 */
export function generateSnakeDraftOrder(playerIds: string[]): string[] {
  return [...playerIds, ...[...playerIds].reverse()];
}

/**
 * Generate the full draft order for all rounds.
 * Round 2 starts with the next player in line.
 */
export function generateFullDraftOrder(playerIds: string[], playerCount: number): string[] {
  if (playerCount === 2) {
    // 2-player variant (page 26): ABBAABBA then BAABABBA
    const [a, b] = playerIds;
    const round1 = [a, b, b, a, a, b, b, a]; // ABBAABBA
    const round2 = [b, a, a, b, b, a, a, b]; // reversed start
    return [...round1, ...round2];
  }

  // Standard 3-6 players: 2 rounds of snake draft
  const round1 = generateSnakeDraftOrder(playerIds);
  // Round 2: rotate start player left by 1
  const rotated = [...playerIds.slice(1), playerIds[0]];
  const round2 = generateSnakeDraftOrder(rotated);
  return [...round1, ...round2];
}

/**
 * Flip a random subset of racer cards for a draft round.
 */
export function flipDraftCards(allRacers: RacerName[], alreadyDrafted: RacerName[], count: number): RacerName[] {
  const remaining = allRacers.filter(r => !alreadyDrafted.includes(r));
  // Shuffle and take `count`
  const shuffled = [...remaining].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
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
    availableRacers: [], // will be set when draft starts (flipped cards)

    // 赛道
    track: trackConfig.spaces,
    trackConfig,
    currentRace: 1,

    // 比赛中
    activeRacers: [],
    turnOrder: [],
    currentTurnIndex: 0,

    // 计分
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

    // 比赛选人
    raceSetupChoices: {},
  };
}
