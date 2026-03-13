import type { AbilityHandler } from '../events.js';

// Sisyphus: When I roll a 6, instead of moving, warp to Start and lose 1 point chip.
export const sisyphusHandler: AbilityHandler = {
  racerName: 'sisyphus',
  eventTypes: ['DICE_ROLLED'],
  priority: 5,
  shouldTrigger(event, state) {
    if (event.type !== 'DICE_ROLLED') return false;
    const sisyphus = state.activeRacers.find(r => r.racerName === 'sisyphus');
    if (!sisyphus || sisyphus.playerId !== event.playerId || sisyphus.finished) return false;
    return event.value === 6;
  },
  execute(event, state) {
    if (event.type !== 'DICE_ROLLED') return { state, events: [] };
    const sisyphus = state.activeRacers.find(r => r.racerName === 'sisyphus')!;
    const fromPos = sisyphus.position;
    const chips = sisyphus.sisyphusChips ?? 0;
    const lostChip = chips > 0 ? 1 : 0;

    const activeRacers = state.activeRacers.map(r => {
      if (r.racerName === 'sisyphus') {
        return { ...r, position: 0, sisyphusChips: chips - lostChip };
      }
      return r;
    });

    const scores = { ...state.scores };
    if (lostChip > 0) {
      scores[sisyphus.playerId] = Math.max(0, (scores[sisyphus.playerId] || 0) - 1);
    }

    const events: import('../types.js').GameEvent[] = [
      { type: 'ABILITY_TRIGGERED', racerName: 'sisyphus', abilityName: '西西弗斯', description: '掷出6——传送回起点，失去1枚筹码' },
      { type: 'RACER_WARPED', racerName: 'sisyphus', from: fromPos, to: 0 },
    ];
    if (lostChip > 0) {
      events.push({ type: 'POINT_CHIP_LOST', playerId: sisyphus.playerId, value: 1 });
    }

    // Also emit DICE_MODIFIED to 0 to skip the normal movement
    events.push({ type: 'DICE_MODIFIED', playerId: event.playerId, originalValue: 6, newValue: 0, reason: 'Sisyphus' });

    return { state: { ...state, activeRacers, scores }, events };
  },
};
