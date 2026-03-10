import type { GameState, DecisionRequest, DecisionResponse, RacerName } from './types.js';

// Simple tier list for Normal AI draft picks (higher = better)
const RACER_TIERS: Partial<Record<RacerName, number>> = {
  hare: 9, blimp: 8, centaur: 8, leaptoad: 8, legs: 7,
  rocket_scientist: 7, magician: 7, flip_flop: 7,
  mouth: 6, genius: 6, banana: 6, coach: 6,
  hypnotist: 5, party_animal: 5, cheerleader: 5, copy_cat: 5,
  alchemist: 4, duelist: 4, baba_yaga: 4, romantic: 4,
  suckerfish: 3, third_wheel: 3, lackey: 3, skipper: 3,
  heckler: 3, stickler: 3, lovable_loser: 3, scoocher: 3,
  gunk: 2, huge_baby: 2, inchworm: 2, egg: 2,
  mastermind: 2, dicemonger: 2, twin: 2, sisyphus: 1,
};

export type AIDifficulty = 'easy' | 'normal';

/**
 * Make an AI decision for the given request.
 */
export function makeAIDecision(
  state: GameState,
  request: DecisionRequest,
  difficulty: AIDifficulty,
): DecisionResponse {
  if (difficulty === 'easy') {
    return makeEasyDecision(state, request);
  }
  return makeNormalDecision(state, request);
}

function makeEasyDecision(state: GameState, request: DecisionRequest): DecisionResponse {
  switch (request.type) {
    case 'DRAFT_PICK': {
      const idx = Math.floor(Math.random() * request.availableRacers.length);
      return { type: 'DRAFT_PICK', racerName: request.availableRacers[idx] };
    }
    case 'CHOOSE_RACE_RACER': {
      const idx = Math.floor(Math.random() * request.availableRacers.length);
      return { type: 'CHOOSE_RACE_RACER', racerName: request.availableRacers[idx] };
    }
    case 'USE_ABILITY':
      return { type: 'USE_ABILITY', use: Math.random() > 0.5 };
    case 'CHOOSE_TARGET_RACER': {
      const idx = Math.floor(Math.random() * request.targets.length);
      return { type: 'CHOOSE_TARGET_RACER', targetRacer: request.targets[idx] };
    }
    case 'CHOOSE_TARGET_SPACE': {
      const idx = Math.floor(Math.random() * request.spaces.length);
      return { type: 'CHOOSE_TARGET_SPACE', targetSpace: request.spaces[idx] };
    }
    case 'PREDICT_DICE':
      return { type: 'PREDICT_DICE', prediction: Math.floor(Math.random() * 6) + 1 };
    case 'PREDICT_WINNER': {
      const idx = Math.floor(Math.random() * request.candidates.length);
      return { type: 'PREDICT_WINNER', targetRacer: request.candidates[idx] };
    }
    case 'CHOOSE_COPIED_ABILITY': {
      const idx = Math.floor(Math.random() * request.candidates.length);
      return { type: 'CHOOSE_COPIED_ABILITY', racerName: request.candidates[idx] };
    }
    case 'REROLL_DICE':
      return { type: 'REROLL_DICE', reroll: Math.random() > 0.5 };
    case 'ROLL_DICE':
      return { type: 'ROLL_DICE', value: Math.floor(Math.random() * 6) + 1 };
  }
}

function makeNormalDecision(state: GameState, request: DecisionRequest): DecisionResponse {
  switch (request.type) {
    case 'DRAFT_PICK': {
      // Pick highest tier available
      const sorted = [...request.availableRacers].sort(
        (a, b) => (RACER_TIERS[b] ?? 0) - (RACER_TIERS[a] ?? 0)
      );
      return { type: 'DRAFT_PICK', racerName: sorted[0] };
    }
    case 'CHOOSE_RACE_RACER': {
      // Pick highest tier from available hand
      const sorted = [...request.availableRacers].sort(
        (a, b) => (RACER_TIERS[b] ?? 0) - (RACER_TIERS[a] ?? 0)
      );
      return { type: 'CHOOSE_RACE_RACER', racerName: sorted[0] };
    }
    case 'USE_ABILITY': {
      // Generally say yes to abilities (Alchemist move 4, Rocket Scientist double, etc.)
      // Exception: Rocket Scientist — only double if close to finish
      if (request.racerName === 'rocket_scientist') {
        const racer = state.activeRacers.find(r => r.racerName === 'rocket_scientist');
        const finishIndex = state.track.length - 1;
        if (racer && finishIndex - racer.position <= 6) {
          return { type: 'USE_ABILITY', use: true };
        }
        return { type: 'USE_ABILITY', use: false };
      }
      return { type: 'USE_ABILITY', use: true };
    }
    case 'CHOOSE_TARGET_RACER': {
      // For Hypnotist: pull the leader. For others: pick the leader.
      const activeRacers = state.activeRacers.filter(
        r => request.targets.includes(r.racerName) && !r.finished && !r.eliminated
      );
      if (activeRacers.length === 0) {
        return { type: 'CHOOSE_TARGET_RACER', targetRacer: request.targets[0] };
      }
      // Pick the one furthest ahead
      const sorted = [...activeRacers].sort((a, b) => b.position - a.position);
      return { type: 'CHOOSE_TARGET_RACER', targetRacer: sorted[0].racerName };
    }
    case 'CHOOSE_TARGET_SPACE': {
      // Pick the furthest space
      const sorted = [...request.spaces].sort((a, b) => b - a);
      return { type: 'CHOOSE_TARGET_SPACE', targetSpace: sorted[0] };
    }
    case 'PREDICT_DICE':
      // Predict 3 or 4 (most likely to be useful)
      return { type: 'PREDICT_DICE', prediction: Math.random() > 0.5 ? 3 : 4 };
    case 'PREDICT_WINNER': {
      // Pick the one furthest ahead
      const activeRacers = state.activeRacers.filter(
        r => request.candidates.includes(r.racerName) && !r.finished && !r.eliminated
      );
      if (activeRacers.length === 0) {
        return { type: 'PREDICT_WINNER', targetRacer: request.candidates[0] };
      }
      const sorted = [...activeRacers].sort((a, b) => b.position - a.position);
      return { type: 'PREDICT_WINNER', targetRacer: sorted[0].racerName };
    }
    case 'CHOOSE_COPIED_ABILITY': {
      // Pick highest tier
      const sorted = [...request.candidates].sort(
        (a, b) => (RACER_TIERS[b] ?? 0) - (RACER_TIERS[a] ?? 0)
      );
      return { type: 'CHOOSE_COPIED_ABILITY', racerName: sorted[0] };
    }
    case 'REROLL_DICE': {
      // Reroll if current value below average (3.5)
      return { type: 'REROLL_DICE', reroll: request.currentValue < 4 };
    }
    case 'ROLL_DICE':
      return { type: 'ROLL_DICE', value: Math.floor(Math.random() * 6) + 1 };
  }
}
