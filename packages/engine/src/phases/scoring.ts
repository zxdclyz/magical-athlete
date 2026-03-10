import type { GameState, GameEvent, RacerName } from '../types.js';

/**
 * Get race results (1st and 2nd place).
 */
export function getRaceResults(state: GameState): { first: RacerName | null; second: RacerName | null } {
  const finishers = state.activeRacers
    .filter(r => r.finished && r.finishOrder !== null)
    .sort((a, b) => a.finishOrder! - b.finishOrder!);

  return {
    first: finishers[0]?.racerName ?? null,
    second: finishers[1]?.racerName ?? null,
  };
}

/**
 * Assign gold and silver chips based on race results.
 * Gold chip values: [7, 6, 5, 4] for races 1-4.
 * Silver chip values: [4, 3, 2, 1] for races 1-4.
 */
export function assignRaceChips(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const scores = { ...state.scores };
  const raceIndex = state.currentRace - 1; // 0-based

  const results = getRaceResults(state);

  if (results.first) {
    const firstRacer = state.activeRacers.find(r => r.racerName === results.first)!;
    const goldValue = state.goldChipValues[raceIndex] ?? 0;
    scores[firstRacer.playerId] = (scores[firstRacer.playerId] || 0) + goldValue;
    events.push({ type: 'POINT_CHIP_GAINED', playerId: firstRacer.playerId, chipType: 'gold', value: goldValue });
  }

  if (results.second) {
    const secondRacer = state.activeRacers.find(r => r.racerName === results.second)!;
    const silverValue = state.silverChipValues[raceIndex] ?? 0;
    scores[secondRacer.playerId] = (scores[secondRacer.playerId] || 0) + silverValue;
    events.push({ type: 'POINT_CHIP_GAINED', playerId: secondRacer.playerId, chipType: 'silver', value: silverValue });
  }

  const raceWinners = [...state.raceWinners];
  if (results.first) {
    raceWinners.push(results.first);
  }

  events.push({ type: 'RACE_ENDED', raceNumber: state.currentRace });

  return {
    state: { ...state, scores, raceWinners },
    events,
  };
}

/**
 * Get the final winner (player with highest total score).
 */
export function getFinalWinner(state: GameState): string {
  let maxScore = -1;
  let winnerId = '';
  for (const [playerId, score] of Object.entries(state.scores)) {
    if (score > maxScore) {
      maxScore = score;
      winnerId = playerId;
    }
  }
  return winnerId;
}
