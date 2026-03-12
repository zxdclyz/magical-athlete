import type { AbilityHandler } from '../events.js';
import type { RacerName, GameState } from '../types.js';
import { alchemistHandler } from './alchemist.js';
import { blimpHandler } from './blimp.js';
import { coachHandler } from './coach.js';
import { gunkHandler } from './gunk.js';
import { hareMovementHandler, hareLeadHandler } from './hare.js';
import { lovableLoserHandler } from './lovable-loser.js';
import { sticklerHandler, sticklerMovementHandler } from './stickler.js';
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
import { partyAnimalMoveHandler, partyAnimalBonusHandler } from './party-animal.js';
import { magicianHandler, magicianSecondRerollHandler } from './magician.js';
import { rocketScientistHandler } from './rocket-scientist.js';
import { geniusHandler, geniusDiceCheckHandler } from './genius.js';
import { mastermindHandler, mastermindCheckHandler } from './mastermind.js';
import { copyCatHandler } from './copy-cat.js';
import { leaptoadHandler } from './leaptoad.js';
import { suckerfishHandler } from './suckerfish.js';
import { eggHandler } from './egg.js';
import { twinHandler } from './twin.js';
import { scoocherHandler } from './scoocher.js';

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
  sticklerMovementHandler,
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
  partyAnimalMoveHandler,
  partyAnimalBonusHandler,
  magicianHandler,
  magicianSecondRerollHandler,
  rocketScientistHandler,
  geniusHandler,
  geniusDiceCheckHandler,
  mastermindHandler,
  mastermindCheckHandler,
  copyCatHandler,
  leaptoadHandler,
  suckerfishHandler,
  eggHandler,
  twinHandler,
  scoocherHandler,
];

/**
 * Get ability handlers for the given active racers.
 * Only returns handlers for racers that are actually in the race.
 */
export function getHandlersForRace(activeRacerNames: RacerName[]): AbilityHandler[] {
  return ALL_HANDLERS.filter(h => activeRacerNames.includes(h.racerName));
}

/**
 * Create proxy handlers that apply a copied racer's abilities to the copier.
 * Used by Copy Cat, Egg, and Twin when they have copiedAbility set.
 */
export function createCopiedHandlers(copierName: RacerName, copiedName: RacerName): AbilityHandler[] {
  // Get all handlers for the copied racer
  const originalHandlers = ALL_HANDLERS.filter(h => h.racerName === copiedName);

  return originalHandlers.map(original => ({
    racerName: copierName,
    eventTypes: original.eventTypes,
    priority: original.priority,
    isProxy: true,
    shouldTrigger(event, state) {
      // Replace the original racer name check with copier's name in context
      // We build a "virtual" state where the copier pretends to be the copied racer
      const copier = state.activeRacers.find(r => r.racerName === copierName);
      if (!copier || copier.finished || copier.eliminated) return false;

      // Create a modified state where the copier appears as the copied racer for shouldTrigger checks
      const virtualState: GameState = {
        ...state,
        activeRacers: state.activeRacers.map(r => {
          if (r.racerName === copierName) return { ...r, racerName: copiedName };
          return r;
        }),
      };

      // Swap event references too
      let virtualEvent = event;
      if ('playerId' in event) {
        // For events tied to the copier's player, adjust racerName references
        // No change needed — shouldTrigger checks playerId against the racer, not racerName in event
      }
      if ('racerName' in event && (event as any).racerName === copierName) {
        virtualEvent = { ...event, racerName: copiedName } as any;
      }

      return original.shouldTrigger(virtualEvent, virtualState);
    },
    getDecisionRequest: original.getDecisionRequest ? (event, state) => {
      const virtualState: GameState = {
        ...state,
        activeRacers: state.activeRacers.map(r => {
          if (r.racerName === copierName) return { ...r, racerName: copiedName };
          return r;
        }),
      };
      let virtualEvent = event;
      if ('racerName' in event && (event as any).racerName === copierName) {
        virtualEvent = { ...event, racerName: copiedName } as any;
      }
      const req = original.getDecisionRequest!(virtualEvent, virtualState);
      // Fix racerName in the request back to copier
      if (req && 'racerName' in req) {
        return { ...req, racerName: copierName };
      }
      return req;
    } : undefined,
    execute(event, state, decision) {
      // Run execute with virtual state, then map results back
      const virtualState: GameState = {
        ...state,
        activeRacers: state.activeRacers.map(r => {
          if (r.racerName === copierName) return { ...r, racerName: copiedName };
          return r;
        }),
      };
      let virtualEvent = event;
      if ('racerName' in event && (event as any).racerName === copierName) {
        virtualEvent = { ...event, racerName: copiedName } as any;
      }

      const result = original.execute(virtualEvent, virtualState, decision);

      // Map the copiedName back to copierName in the results
      const mappedState: GameState = {
        ...result.state,
        activeRacers: result.state.activeRacers.map(r => {
          if (r.racerName === copiedName) {
            // Find if this was originally the copier
            const wasOriginal = state.activeRacers.some(orig => orig.racerName === copiedName);
            if (!wasOriginal) return { ...r, racerName: copierName };
          }
          return r;
        }),
      };

      // Map racerName references in events
      const mappedEvents = result.events.map(ev => {
        if ('racerName' in ev && (ev as any).racerName === copiedName) {
          const wasOriginal = state.activeRacers.some(orig => orig.racerName === copiedName);
          if (!wasOriginal) return { ...ev, racerName: copierName } as typeof ev;
        }
        return ev;
      });

      return { state: mappedState, events: mappedEvents };
    },
  }));
}

export { ALL_HANDLERS };
