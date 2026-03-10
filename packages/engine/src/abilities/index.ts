import type { AbilityHandler } from '../events.js';
import type { RacerName } from '../types.js';
import { alchemistHandler } from './alchemist.js';
import { blimpHandler } from './blimp.js';
import { coachHandler } from './coach.js';
import { gunkHandler } from './gunk.js';
import { hareMovementHandler, hareLeadHandler } from './hare.js';
import { lovableLoserHandler } from './lovable-loser.js';
import { sticklerHandler } from './stickler.js';
import { hecklerHandler } from './heckler.js';

// All registered ability handlers
const ALL_HANDLERS: AbilityHandler[] = [
  alchemistHandler,
  blimpHandler,
  coachHandler,
  gunkHandler,
  hareMovementHandler,
  hareLeadHandler,
  lovableLoserHandler,
  sticklerHandler,
  hecklerHandler,
];

/**
 * Get ability handlers for the given active racers.
 * Only returns handlers for racers that are actually in the race.
 */
export function getHandlersForRace(activeRacerNames: RacerName[]): AbilityHandler[] {
  return ALL_HANDLERS.filter(h => activeRacerNames.includes(h.racerName));
}

export { ALL_HANDLERS };
