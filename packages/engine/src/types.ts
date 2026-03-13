// ============ 游戏阶段 ============
export type GamePhase =
  | 'LOBBY'
  | 'DRAFTING'
  | 'RACE_SETUP'
  | 'RACING'
  | 'RACE_END'
  | 'GAME_OVER';

// ============ 赛道 ============
export type TrackSpaceType = 'normal' | 'start' | 'finish' | 'arrow' | 'trip' | 'star';

export interface TrackSpace {
  index: number;
  type: TrackSpaceType;
  arrowDistance?: number;
}

export interface TrackConfig {
  name: string;
  side: 'mild' | 'wild';
  spaces: TrackSpace[];
  secondCornerIndex: number;
}

// ============ 角色 ============
export type RacerName =
  | 'alchemist' | 'baba_yaga' | 'banana' | 'blimp' | 'centaur'
  | 'cheerleader' | 'coach' | 'copy_cat' | 'dicemonger' | 'duelist'
  | 'egg' | 'flip_flop' | 'genius' | 'gunk' | 'hare'
  | 'heckler' | 'hypnotist' | 'huge_baby' | 'inchworm' | 'lackey'
  | 'legs' | 'leaptoad' | 'lovable_loser' | 'mouth' | 'magician'
  | 'mastermind' | 'party_animal' | 'rocket_scientist' | 'romantic'
  | 'third_wheel' | 'twin' | 'scoocher' | 'skipper' | 'suckerfish'
  | 'sisyphus' | 'stickler';

export interface RacerCard {
  name: RacerName;
  displayName: string;
  displayNameCn: string;
  abilityText: string;
  abilityTextCn: string;
  tagline: string;
  taglineCn: string;
}

// ============ 玩家 ============
export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  aiDifficulty?: 'easy' | 'normal';
  hand: RacerName[];
  usedRacers: RacerName[];
}

// ============ 赛场上的角色实例 ============
export interface ActiveRacer {
  racerName: RacerName;
  playerId: string;
  position: number;
  tripped: boolean;
  finished: boolean;
  finishOrder: number | null;
  eliminated: boolean;
  copiedAbility?: RacerName;
  mastermindPrediction?: string;
  geniusPrediction?: number;
  sisyphusChips?: number;
}

// ============ 游戏事件 ============
export type GameEvent =
  | { type: 'PHASE_CHANGED'; phase: GamePhase }
  | { type: 'DRAFT_ORDER_ROLLED'; rolls: Array<{ playerId: string; value: number }>; order: string[] }
  | { type: 'TURN_START'; playerId: string }
  | { type: 'TURN_END'; playerId: string }
  | { type: 'DICE_ROLLED'; playerId: string; value: number }
  | { type: 'DICE_MODIFIED'; playerId: string; originalValue: number; newValue: number; reason: string }
  | { type: 'RACER_MOVING'; racerName: RacerName; from: number; to: number; isMainMove: boolean }
  | { type: 'RACER_PASSED'; movingRacer: RacerName; passedRacer: RacerName; space: number }
  | { type: 'RACER_STOPPED'; racerName: RacerName; space: number }
  | { type: 'RACER_TRIPPED'; racerName: RacerName }
  | { type: 'RACER_WARPED'; racerName: RacerName; from: number; to: number }
  | { type: 'RACER_SWAPPED'; racer1: RacerName; racer2: RacerName }
  | { type: 'RACER_ELIMINATED'; racerName: RacerName; byRacer: RacerName }
  | { type: 'RACER_FINISHED'; racerName: RacerName; place: number }
  | { type: 'ABILITY_TRIGGERED'; racerName: RacerName; abilityName: string; description: string }
  | { type: 'POINT_CHIP_GAINED'; playerId: string; chipType: 'gold' | 'silver' | 'bronze'; value: number }
  | { type: 'POINT_CHIP_LOST'; playerId: string; value: number }
  | { type: 'TURN_ORDER_DECIDED'; turnOrder: string[] }
  | { type: 'RACE_ENDED'; raceNumber: number }
  | { type: 'GAME_ENDED'; winnerIds: string[]; scores: Record<string, number> }
  | { type: 'DECISION_REQUIRED'; playerId: string; decision: DecisionRequest }
  | { type: 'DECISION_MADE'; playerId: string; decision: DecisionResponse };

// ============ 决策系统 ============
export type DecisionRequest =
  | { type: 'DRAFT_PICK'; availableRacers: RacerName[] }
  | { type: 'CHOOSE_RACE_RACER'; availableRacers: RacerName[] }
  | { type: 'USE_ABILITY'; racerName: RacerName; abilityDescription: string }
  | { type: 'CHOOSE_TARGET_RACER'; racerName: RacerName; targets: RacerName[]; reason: string }
  | { type: 'CHOOSE_TARGET_SPACE'; racerName: RacerName; spaces: number[]; reason: string }
  | { type: 'PREDICT_DICE'; racerName: RacerName }
  | { type: 'PREDICT_WINNER'; racerName: RacerName; candidates: RacerName[] }
  | { type: 'CHOOSE_COPIED_ABILITY'; racerName: RacerName; candidates: RacerName[] }
  | { type: 'REROLL_DICE'; currentValue: number; rerollsLeft: number }
  | { type: 'ROLL_DICE' };

export type DecisionResponse =
  | { type: 'DRAFT_PICK'; racerName: RacerName }
  | { type: 'CHOOSE_RACE_RACER'; racerName: RacerName }
  | { type: 'USE_ABILITY'; use: boolean }
  | { type: 'CHOOSE_TARGET_RACER'; targetRacer: RacerName }
  | { type: 'CHOOSE_TARGET_SPACE'; targetSpace: number }
  | { type: 'PREDICT_DICE'; prediction: number }
  | { type: 'PREDICT_WINNER'; targetRacer: RacerName }
  | { type: 'CHOOSE_COPIED_ABILITY'; racerName: RacerName }
  | { type: 'REROLL_DICE'; reroll: boolean }
  | { type: 'ROLL_DICE'; value: number };

// ============ 游戏状态 ============
export interface GameState {
  phase: GamePhase;
  players: Player[];

  // 选角
  draftOrder: string[];
  draftCurrentIndex: number;
  availableRacers: RacerName[];

  // 赛道
  track: TrackSpace[];
  trackConfig: TrackConfig;
  currentRace: number;

  // 比赛中
  activeRacers: ActiveRacer[];
  turnOrder: string[];
  currentTurnIndex: number;

  // 计分
  scores: Record<string, number>;
  goldChipValues: number[];
  silverChipValues: number[];
  raceWinners: RacerName[];

  // 事件
  eventLog: GameEvent[];

  // 防无限循环
  triggeredThisMove: Set<string>;

  // 等待决策
  pendingDecision: {
    playerId: string;
    request: DecisionRequest;
    // Ability resume context (set by EventEngine)
    handlerIndex?: number;
    triggerEvent?: GameEvent;
    // Turn resume context (which step of the turn we paused at)
    turnPhase?: 'TURN_START' | 'DICE_ROLLED' | 'MOVEMENT' | 'TRACK_EFFECT' | 'TURN_END';
    turnPlayerId?: string;
    diceValue?: number;
  } | null;

  // Genius 额外回合
  extraTurnPlayerId: string | null;

  // Skipper 插队
  skipperNextPlayerId: string | null;

  // 回合开始时的位置（用于 Heckler 判定）
  turnStartPositions: Record<string, number>;

  // 比赛选人（同时选、同时揭示）
  raceSetupChoices: Record<string, RacerName>;

  // 上场比赛结束时各角色的位置（用于决定下场先手）
  lastRacePositions: Record<string, number>;

  // 当前回合是否因技能跳过主移动
  skipMainMove: boolean;
}

// ============ 玩家动作 ============
export type PlayerAction =
  | { type: 'JOIN_ROOM'; playerName: string }
  | { type: 'ADD_AI'; difficulty: 'easy' | 'normal' }
  | { type: 'REMOVE_AI'; playerId: string }
  | { type: 'START_GAME' }
  | { type: 'MAKE_DECISION'; decision: DecisionResponse }
  | { type: 'CONTINUE_FROM_RACE_END' };
