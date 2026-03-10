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
import { bananaHandler } from './banana.js';
import { centaurHandler } from './centaur.js';
import { babaYagaHandler } from './baba-yaga.js';
import { duelistHandler } from './duelist.js';
import { mouthHandler } from './mouth.js';
import { romanticHandler } from './romantic.js';
import { hugeBabyHandler } from './huge-baby.js';
import { inchwormHandler } from './inchworm.js';
import { lackeyHandler } from './lackey.js';
import { skipperHandler } from './skipper.js';
import { sisyphusHandler } from './sisyphus.js';
import { dicemongerHandler } from './dicemonger.js';
import { flipFlopHandler } from './flip-flop.js';
import { legsHandler } from './legs.js';
import { hypnotistHandler } from './hypnotist.js';
import { cheerleaderHandler } from './cheerleader.js';
import { thirdWheelHandler } from './third-wheel.js';
import { partyAnimalHandler } from './party-animal.js';

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
  bananaHandler,
  centaurHandler,
  babaYagaHandler,
  duelistHandler,
  mouthHandler,
  romanticHandler,
  hugeBabyHandler,
  inchwormHandler,
  lackeyHandler,
  skipperHandler,
  sisyphusHandler,
  dicemongerHandler,
  flipFlopHandler,
  legsHandler,
  hypnotistHandler,
  cheerleaderHandler,
  thirdWheelHandler,
  partyAnimalHandler,
];

/**
 * Get ability handlers for the given active racers.
 * Only returns handlers for racers that are actually in the race.
 */
export function getHandlersForRace(activeRacerNames: RacerName[]): AbilityHandler[] {
  return ALL_HANDLERS.filter(h => activeRacerNames.includes(h.racerName));
}

export { ALL_HANDLERS };
