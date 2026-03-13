import { useState, useRef, useCallback } from 'react';
import type { GameEvent, RacerName } from '@magical-athlete/engine';

export interface AnimStep {
  type: 'hop' | 'dice' | 'ability' | 'swap' | 'warp' | 'trip' | 'finish' | 'eliminate' | 'pause';
  duration: number; // ms
  // Hop (single cell movement)
  racerName?: RacerName;
  to?: number;
  // Dice
  diceValue?: number;
  diceModified?: { original: number; newValue: number; reason: string };
  dicePlayerId?: string;
  // Ability toast
  abilityName?: string;
  description?: string;
  // Swap
  racer1?: RacerName;
  racer2?: RacerName;
  from?: number; // used by warp
  // Finish
  place?: number;
  // Visual effect class to apply to token
  effect?: string;
  // Source event index — for syncing event log
  eventIndex?: number;
}

const HOP_DURATION = 300; // ms per cell
const DICE_DURATION = 1500; // ms — enough for roll anim (~500ms) + pause to read result
const DICE_STANDALONE_DURATION = 1800;
const TURN_PAUSE = 600; // pause between different players' turns

/** Convert a batch of GameEvents into animation steps */
export function eventsToAnimSteps(events: GameEvent[], startIndex: number): AnimStep[] {
  const steps: AnimStep[] = [];

  let lastDicePlayerId: string | undefined;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const eventIndex = startIndex + i;

    switch (e.type) {
      case 'DICE_ROLLED': {
        // Insert a pause between different players' turns
        if (lastDicePlayerId && lastDicePlayerId !== e.playerId) {
          steps.push({ type: 'pause', duration: TURN_PAUSE });
        }
        lastDicePlayerId = e.playerId;

        // Look ahead: if the next event is RACER_MOVING, merge dice + hops
        const next = events[i + 1];
        if (next && next.type === 'RACER_MOVING') {
          const moveEventIndex = startIndex + i + 1;
          steps.push({
            type: 'dice',
            diceValue: e.value,
            dicePlayerId: e.playerId,
            duration: DICE_DURATION,
            eventIndex,
          });
          // Generate hop steps for each cell
          const dir = next.to > next.from ? 1 : -1;
          const count = Math.abs(next.to - next.from);
          for (let h = 0; h < count; h++) {
            const pos = next.from + dir * (h + 1);
            steps.push({
              type: 'hop',
              racerName: next.racerName,
              to: pos,
              duration: HOP_DURATION,
              // Only the last hop carries the eventIndex (for event log sync)
              eventIndex: h === count - 1 ? moveEventIndex : undefined,
              effect: 'racer-hopping',
            });
          }
          i++; // skip the RACER_MOVING event
        } else {
          steps.push({
            type: 'dice',
            diceValue: e.value,
            dicePlayerId: e.playerId,
            duration: DICE_STANDALONE_DURATION,
            eventIndex,
          });
        }
        break;
      }

      case 'RACER_MOVING': {
        // Standalone move (not merged with dice) — still hop-by-hop
        const dir = e.to > e.from ? 1 : -1;
        const count = Math.abs(e.to - e.from);
        for (let h = 0; h < count; h++) {
          const pos = e.from + dir * (h + 1);
          steps.push({
            type: 'hop',
            racerName: e.racerName,
            to: pos,
            duration: HOP_DURATION,
            eventIndex: h === count - 1 ? eventIndex : undefined,
            effect: 'racer-hopping',
          });
        }
        break;
      }

      case 'DICE_MODIFIED':
        steps.push({
          type: 'dice',
          diceValue: e.newValue,
          diceModified: { original: e.originalValue, newValue: e.newValue, reason: e.reason },
          dicePlayerId: e.playerId,
          duration: DICE_STANDALONE_DURATION,
          eventIndex,
        });
        break;

      case 'ABILITY_TRIGGERED':
        steps.push({
          type: 'ability',
          racerName: e.racerName,
          abilityName: e.abilityName,
          description: e.description,
          duration: 1000,
          effect: 'racer-glow',
          eventIndex,
        });
        break;

      case 'RACER_SWAPPED':
        steps.push({
          type: 'swap',
          racer1: e.racer1,
          racer2: e.racer2,
          duration: 1000,
          effect: 'racer-swap',
          eventIndex,
        });
        break;

      case 'RACER_WARPED':
        steps.push({
          type: 'warp',
          racerName: e.racerName,
          from: e.from,
          to: e.to,
          duration: 800,
          effect: 'racer-warp',
          eventIndex,
        });
        break;

      case 'RACER_TRIPPED':
        steps.push({
          type: 'trip',
          racerName: e.racerName,
          duration: 700,
          effect: 'racer-tripped-anim',
          eventIndex,
        });
        break;

      case 'RACER_FINISHED':
        steps.push({
          type: 'finish',
          racerName: e.racerName,
          place: e.place,
          duration: 1200,
          effect: 'racer-finish',
          eventIndex,
        });
        break;

      case 'RACER_ELIMINATED':
        steps.push({
          type: 'eliminate',
          racerName: e.racerName,
          duration: 1000,
          effect: 'racer-eliminate',
          eventIndex,
        });
        break;

      case 'TURN_ORDER_DECIDED':
        // Insert a pause so the turn-order event is visible before the first dice animation
        steps.push({
          type: 'pause',
          duration: 1200,
          eventIndex,
        });
        break;
    }
  }

  return steps;
}

export interface AnimationState {
  currentStep: AnimStep | null;
  isPlaying: boolean;
  animPositions: Record<string, number>;
  /** Active CSS effect classes on racers: racerName → class */
  activeEffects: Record<string, string>;
  toasts: Array<{ id: number; racerName: RacerName; abilityName: string; description: string }>;
  diceDisplay: { value: number; playerId?: string; modified?: { original: number; newValue: number; reason: string }; stepId: number } | null;
  visibleEventCount: number;
  animatedTurnPlayerId: string | null;
}

export function useAnimationQueue() {
  const [animState, setAnimState] = useState<AnimationState>({
    currentStep: null,
    isPlaying: false,
    animPositions: {},
    activeEffects: {},
    toasts: [],
    diceDisplay: null,
    visibleEventCount: 0,
    animatedTurnPlayerId: null,
  });

  const queueRef = useRef<AnimStep[]>([]);
  const playingRef = useRef(false);
  const toastIdRef = useRef(0);
  const diceStepIdRef = useRef(0);

  const playNext = useCallback(() => {
    if (queueRef.current.length === 0) {
      playingRef.current = false;
      setAnimState(prev => ({
        ...prev,
        currentStep: null,
        isPlaying: false,
        animatedTurnPlayerId: null,
        activeEffects: {},
        diceDisplay: null,
      }));
      return;
    }

    const step = queueRef.current.shift()!;
    playingRef.current = true;

    setAnimState(prev => {
      const next: AnimationState = {
        ...prev,
        currentStep: step,
        isPlaying: true,
        activeEffects: { ...prev.activeEffects },
      };

      // Sync event log
      if (step.eventIndex !== undefined) {
        next.visibleEventCount = step.eventIndex + 1;
      }

      // Apply visual effect class to racer token
      if (step.effect) {
        if (step.racerName) {
          next.activeEffects[step.racerName] = step.effect;
        }
        if (step.racer1) next.activeEffects[step.racer1] = step.effect;
        if (step.racer2) next.activeEffects[step.racer2] = step.effect;
      }

      // --- Position updates ---
      if (step.type === 'hop' && step.racerName && step.to !== undefined) {
        next.animPositions = { ...prev.animPositions, [step.racerName]: step.to };
      }

      if (step.type === 'swap' && step.racer1 && step.racer2) {
        const pos1 = prev.animPositions[step.racer1];
        const pos2 = prev.animPositions[step.racer2];
        if (pos1 !== undefined && pos2 !== undefined) {
          next.animPositions = {
            ...prev.animPositions,
            [step.racer1]: pos2,
            [step.racer2]: pos1,
          };
        }
      }

      if (step.type === 'warp' && step.racerName && step.to !== undefined) {
        // Warp: delay position update to halfway through (fade out then in)
        // Set immediately for now, CSS handles the visual fade
        next.animPositions = { ...prev.animPositions, [step.racerName]: step.to };
      }

      // --- Toasts ---
      if (step.type === 'ability' && step.racerName && step.abilityName && step.description) {
        const id = ++toastIdRef.current;
        next.toasts = [...prev.toasts, {
          id,
          racerName: step.racerName,
          abilityName: step.abilityName,
          description: step.description,
        }];
        setTimeout(() => {
          setAnimState(p => ({ ...p, toasts: p.toasts.filter(t => t.id !== id) }));
        }, 4000);
      }

      // --- Dice ---
      if (step.type === 'dice') {
        const stepId = ++diceStepIdRef.current;
        next.diceDisplay = {
          value: step.diceValue!,
          playerId: step.dicePlayerId,
          modified: step.diceModified,
          stepId,
        };
        if (step.dicePlayerId) {
          next.animatedTurnPlayerId = step.dicePlayerId;
        }
      }

      return next;
    });

    // Clear effect after step completes, then advance
    setTimeout(() => {
      // Clear effects from this step
      if (step.effect) {
        setAnimState(prev => {
          const effects = { ...prev.activeEffects };
          if (step.racerName && effects[step.racerName] === step.effect) {
            delete effects[step.racerName];
          }
          if (step.racer1 && effects[step.racer1] === step.effect) {
            delete effects[step.racer1];
          }
          if (step.racer2 && effects[step.racer2] === step.effect) {
            delete effects[step.racer2];
          }
          return { ...prev, activeEffects: effects };
        });
      }
      playNext();
    }, step.duration);
  }, []);

  const enqueue = useCallback((events: GameEvent[], startIndex: number) => {
    const steps = eventsToAnimSteps(events, startIndex);
    if (steps.length === 0) return;

    queueRef.current.push(...steps);

    if (!playingRef.current) {
      playNext();
    }
  }, [playNext]);

  const initPositions = useCallback((
    racers: Array<{ racerName: RacerName; position: number; finished: boolean }>,
    trackLength: number,
    totalEvents: number,
  ) => {
    const positions: Record<string, number> = {};
    for (const r of racers) {
      positions[r.racerName] = r.finished ? trackLength - 1 : r.position;
    }
    setAnimState(prev => ({ ...prev, animPositions: positions, visibleEventCount: totalEvents }));
  }, []);

  const clearDice = useCallback(() => {
    setAnimState(prev => ({ ...prev, diceDisplay: null }));
  }, []);

  return {
    animState,
    enqueue,
    initPositions,
    clearDice,
  };
}
