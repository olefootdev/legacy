import type { AgentSnapshot, PassOption } from '@/simulation/InteractionResolver';
import type { GoalContext } from '@/match/goalContext';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import type { MatchCognitiveArchetype } from '@/match/playerInMatch';

// ---------------------------------------------------------------------------
// Player Profile — defines personality and tendencies
// ---------------------------------------------------------------------------

export type PlayerArchetype =
  | 'creative'
  | 'conservative'
  | 'dribbler'
  | 'playmaker'
  | 'target_man'
  | 'box_to_box'
  | 'destroyer'
  | 'winger'
  | 'fullback_offensive'
  | 'anchor'
  | 'poacher';

export interface PlayerProfile {
  archetype: PlayerArchetype;
  /** 0–1: tendency to attempt risky actions (through balls, dribbles, long shots) */
  riskAppetite: number;
  /** 0–1: how often the player looks for vertical/forward options */
  verticality: number;
  /** 0–1: preference for retaining possession vs accelerating play */
  possessionBias: number;
  /** 0–1: tendency to dribble when space is available */
  dribbleTendency: number;
  /** 0–1: first-touch play tendency (one-touch passes, flick-ons) */
  firstTouchPlay: number;
  /** 0–1: composure under pressure (affects error rate, decision speed) */
  composure: number;
  /** 0–1: vision — affects quality of pass options perceived */
  vision: number;
  /** 0–1: work rate — affects off-ball movement intensity */
  workRate: number;
}

// ---------------------------------------------------------------------------
// Decision state machine
// ---------------------------------------------------------------------------

export type DecisionPhase =
  | 'idle'
  | 'pre_receiving'
  | 'receiving'
  | 'deliberating'
  | 'scanning'
  | 'deciding'
  | 'executing'
  | 'recovering';

// ---------------------------------------------------------------------------
// Context reading — what the player perceives
// ---------------------------------------------------------------------------

export interface PressureReading {
  nearestOpponentDist: number;
  opponentsInZone: number;
  pressureDirection: { x: number; z: number };
  intensity: 'none' | 'low' | 'medium' | 'high' | 'extreme';
  /** Speed of the nearest opponent — high value means they're closing in */
  closingSpeed: number;
}

export interface TeammateOption {
  snapshot: AgentSnapshot;
  distance: number;
  angle: number;
  isForward: boolean;
  isOpen: boolean;
  /** Distância do adversário mais próximo a este colega — maior = mais “livre”. */
  closestOppDist: number;
  quality: number;
}

export interface SpaceReading {
  forwardSpaceDepth: number;
  lateralSpaceLeft: number;
  lateralSpaceRight: number;
  canConductForward: boolean;
  canConductLateral: boolean;
}

export type TeamPhase = 'buildup' | 'progression' | 'attack' | 'transition_def' | 'transition_att';

export type FieldZone = 'own_box' | 'def_third' | 'def_mid' | 'mid' | 'att_mid' | 'att_third' | 'opp_box';

/** Pressão coerente com o pedido: passiva → pressão crítica. */
export type PressureBand = 'passive' | 'moderate' | 'high' | 'critical';

/** Zona espacial macro para decisão (perigo / construção / seguro). */
export type SpatialBand = 'danger' | 'construction' | 'safe';

export interface ContextReading {
  pressure: PressureReading;
  space: SpaceReading;
  availableTeammates: TeammateOption[];
  bestTeammate: TeammateOption | null;
  fieldZone: FieldZone;
  teamPhase: TeamPhase;
  attackDirection: 1 | -1;
  distToGoal: number;
  /** Angle in radians from self to goal center. */
  angleToGoal: number;
  /** 0–1: how clear the shot line to goal is. */
  lineOfSightScore: number;
  /** 0–1: progress toward opponent goal (0=own goal, 1=opp goal). */
  progressToGoal: number;
  scoreDiff: number;
  minute: number;
  mentality: number;
  /** 0–1: how close the attacking team is to a scoring chance */
  threatLevel: number;
  /** Is the play maturing, being neutralized, or stable? */
  threatTrend: 'rising' | 'stable' | 'falling';
  pressureBand: PressureBand;
  spatialBand: SpatialBand;
}

// ---------------------------------------------------------------------------
// Pre-reception intent
// ---------------------------------------------------------------------------

export type PreReceptionIntent =
  | 'scan_shoulder'
  | 'adjust_body_forward'
  | 'adjust_body_safety'
  | 'attack_space'
  | 'decelerate'
  | 'approach_pass'
  | 'evade_marker'
  | 'signal_return'
  | 'prepare_first_touch';

export interface PreReceptionResult {
  intent: PreReceptionIntent;
  bodyAngle: number;
  receiveFree: boolean;
  anticipatedAction: OnBallAction | null;
}

// ---------------------------------------------------------------------------
// Reception outcomes
// ---------------------------------------------------------------------------

export type ReceptionType =
  | 'clean_forward'
  | 'clean_hold'
  | 'oriented_forward'
  | 'oriented_strong_side'
  | 'cushion_protect'
  | 'let_run'
  | 'body_shield'
  | 'first_touch_pass'
  | 'first_touch_shot'
  | 'turn_after_control'
  | 'freeze_assess'
  | 'fumble';

export interface ReceptionResult {
  type: ReceptionType;
  success: boolean;
  /** Time spent in reception phase before player is ready to act */
  durationSec: number;
  /** Ball displacement from error */
  errorDisplacement: { dx: number; dz: number };
}

// ---------------------------------------------------------------------------
// On-ball actions (carrier)
// ---------------------------------------------------------------------------

export type OnBallAction =
  // Passes
  | { type: 'short_pass_safety'; option: PassOption }
  | { type: 'lateral_pass'; option: PassOption }
  | { type: 'vertical_pass'; option: PassOption }
  | { type: 'switch_play'; option: PassOption }
  | { type: 'long_ball'; option: PassOption }
  | { type: 'one_two'; option: PassOption }
  | { type: 'through_ball'; option: PassOption }
  // Dribble / carry
  | { type: 'simple_carry'; targetX: number; targetZ: number }
  | { type: 'aggressive_carry'; targetX: number; targetZ: number }
  | { type: 'beat_marker'; targetX: number; targetZ: number }
  | { type: 'progressive_dribble'; targetX: number; targetZ: number }
  | { type: 'hold_ball' }
  | { type: 'shield_ball' }
  | { type: 'turn_on_marker'; targetX: number; targetZ: number }
  | { type: 'retreat_reorganize'; targetX: number; targetZ: number }
  // Crossing
  | { type: 'low_cross'; targetX: number; targetZ: number }
  | { type: 'high_cross'; targetX: number; targetZ: number }
  // Shooting
  | { type: 'shoot' }
  | { type: 'shoot_long_range' }
  // Other
  | { type: 'cut_inside'; targetX: number; targetZ: number }
  | { type: 'run_to_byline'; targetX: number; targetZ: number }
  | { type: 'enter_box'; targetX: number; targetZ: number }
  | { type: 'draw_foul' }
  | { type: 'clearance'; targetX: number; targetZ: number };

// ---------------------------------------------------------------------------
// Off-ball actions
// ---------------------------------------------------------------------------

export type OffBallAction =
  // Attacking support
  | { type: 'offer_short_line'; targetX: number; targetZ: number }
  | { type: 'offer_diagonal_line'; targetX: number; targetZ: number }
  | { type: 'open_width'; targetX: number; targetZ: number }
  | { type: 'attack_depth'; targetX: number; targetZ: number }
  | { type: 'infiltrate'; targetX: number; targetZ: number }
  | { type: 'overlap_run'; targetX: number; targetZ: number }
  | { type: 'drop_to_create_space'; targetX: number; targetZ: number }
  | { type: 'drag_marker'; targetX: number; targetZ: number }
  | { type: 'anticipate_second_ball'; targetX: number; targetZ: number }
  | { type: 'prepare_rebound'; targetX: number; targetZ: number }
  // Defending
  | { type: 'press_carrier'; targetX: number; targetZ: number }
  | { type: 'close_passing_lane'; targetX: number; targetZ: number }
  | { type: 'mark_zone'; targetX: number; targetZ: number }
  | { type: 'mark_man'; targetId: string; targetX: number; targetZ: number }
  | { type: 'cover_central'; targetX: number; targetZ: number }
  | { type: 'recover_behind_ball'; targetX: number; targetZ: number }
  | { type: 'defensive_cover'; targetX: number; targetZ: number }
  | { type: 'delay_press'; targetX: number; targetZ: number }
  // Neutral
  | { type: 'move_to_slot'; targetX: number; targetZ: number }
  | { type: 'idle' };

// ---------------------------------------------------------------------------
// Unified action output (what TacticalSimLoop consumes)
// ---------------------------------------------------------------------------

export type PlayerAction =
  | { kind: 'on_ball'; action: OnBallAction }
  | { kind: 'off_ball'; action: OffBallAction }
  | { kind: 'receiving'; reception: ReceptionResult }
  | { kind: 'pre_receiving'; intent: PreReceptionResult }
  | { kind: 'idle' };

// ---------------------------------------------------------------------------
// Decision timing
// ---------------------------------------------------------------------------

export type DecisionSpeed = 'instant' | 'fast' | 'normal' | 'slow';

export interface DecisionTiming {
  speed: DecisionSpeed;
  delaySec: number;
  elapsed: number;
}

// ---------------------------------------------------------------------------
// Decision outcome
// ---------------------------------------------------------------------------

export type DecisionOutcome =
  | 'success'
  | 'technical_error'
  | 'reading_error'
  | 'intercepted'
  | 'advantage_created'
  | 'dangerous_loss'
  | 'acceleration'
  | 'deceleration';

export interface DecisionResult {
  action: OnBallAction | OffBallAction;
  outcome: DecisionOutcome;
  executionQuality: number;
}

// ---------------------------------------------------------------------------
// Play intention — what the player wants to achieve before choosing how
// ---------------------------------------------------------------------------

export type PlayIntention =
  | 'maintain_possession'
  | 'progress'
  | 'accelerate'
  | 'attack_space'
  | 'reorganize'
  | 'protect_result'
  | 'break_line'
  | 'relieve_pressure'
  | 'create_chance'
  | 'finish';

// ---------------------------------------------------------------------------
// Ball sector — which corridor the ball is in
// ---------------------------------------------------------------------------

export type BallSector = 'left' | 'center' | 'right';

// ---------------------------------------------------------------------------
// Prethinking — intenção antecipada curta (leitura → prethinking → execução)
// ---------------------------------------------------------------------------

/** Intenção que o jogador mantém antes do evento; atualizada com o contexto. */
export type PrethinkingIntent =
  | 'receber_e_girar'
  | 'passe_rapido'
  | 'proteger_bola'
  | 'atacar_espaco'
  | 'finalizar_rapido'
  | 'tabela'
  | 'cobertura_defensiva'
  | 'pressionar_portador'
  | 'interceptar_linha'
  | 'matar_jogada'
  | 'disputar_rebote'
  /** Sem intenção tática forte — mantém encaixe coletivo. */
  | 'encaixe';

/** Rapidez com que a intenção é revista e traduzida em execução após o gatilho. */
export type PrethinkingSpeed = 'fast' | 'normal' | 'slow';

export interface PrethinkingState {
  prethinkingIntent: PrethinkingIntent;
  speed: PrethinkingSpeed;
  validUntil: number;
  possessionSide: 'home' | 'away' | null;
  carrierId: string | null;
  anchorX: number;
  anchorZ: number;
  ballX: number;
  ballZ: number;
  pressureIntensity: PressureReading['intensity'];
  /** Distância ao adversário mais próximo no momento do snapshot (invalidação se mudar muito). */
  nearestOppDist: number;
  /** 0–1: força do compromisso com a intenção (ajuste fino na execução). */
  conviction01: number;
  /** Evita intenção “travada” ao mudar o papel no lance (ex.: passa a ser alvo de passe). */
  snapIsReceiver: boolean;
  snapIsCarrier: boolean;
  /** Ameaça percebida no snapshot — jogada que acelera ou esfria força re-leitura. */
  threatLevel01: number;
}

// ---------------------------------------------------------------------------
// Decision context (superset of old BrainContext)
// ---------------------------------------------------------------------------

export interface DecisionContext {
  self: AgentSnapshot;
  teammates: AgentSnapshot[];
  opponents: AgentSnapshot[];
  ballX: number;
  ballZ: number;
  isCarrier: boolean;
  isReceiver: boolean;
  ballFlightProgress: number;
  possession: 'home' | 'away' | null;
  attackDir: 1 | -1;
  /** 1.º/2.º tempo — zonas IFAB e profundidade tática. */
  clockHalf?: 1 | 2;
  /** Orçamento de remate: há muito tempo sem tentativa — próxima ação elegível favorece finalização. */
  shootBudgetForce?: boolean;
  /** Posse longa no último terço sem progressão — boost de remate. */
  offensiveStallShotBoost?: boolean;
  /** Callbacks opcionais (motor / telemetria). */
  noteShootChosen?: () => void;
  noteShootCandidate?: () => void;
  noteCarrierDecisionDebug?: (payload: { zoneTags: string; top3: string; pickedId: string }) => void;
  slotX: number;
  slotZ: number;
  scoreDiff: number;
  minute: number;
  mentality: number;
  tacticalDefensiveLine?: number;
  tacticalPressing?: number;
  tacticalWidth?: number;
  tacticalTempo?: number;
  tacticalStyle?: TeamTacticalStyle;
  stamina?: number;
  decisionDebug?: boolean;
  profile: PlayerProfile;
  teamPhase: TeamPhase;
  /** Current ball carrier id (any team) */
  carrierId: string | null;
  /** True the frame possession changed to this team */
  carrierJustChanged: boolean;
  /** Which lateral sector the ball is in */
  ballSector: BallSector;
  /** 0–1: current goal threat for the attacking team */
  threatLevel: number;
  /** Is the threat rising, stable, or falling? */
  threatTrend: 'rising' | 'stable' | 'falling';
  /**
   * Player ids this carrier must not receive a pass to (anti flip-flop after turnover).
   * Filled by the sim loop for a short window after a tackle.
   */
  passBlocklist?: string[];
  /**
   * Acabou de soltar um passe ao portador atual (ou bola a caminho dele) — “troca de setor” /
   * continuidade ofensiva (não ficar no mesmo corredor; terceiro homem).
   */
  offensivePassMobility?: { forward: boolean };
  /** Spatial orientation toward the attacked goal (derived from side + half). */
  goalContext?: GoalContext;
  /**
   * Cada chamada devolve o próximo [0,1) da cadeia determinística do tick (seed + tempo + jogador).
   * Usado em vez de `Math.random` nas decisões táticas para alinhar ao `ActionResolver`.
   */
  roll01?: () => number;
  /**
   * 0–1: após execução excecional (ex.: passe crítico a receber) — decisão ligeiramente mais rápida.
   */
  decisionExecutionBoost01?: number;
  /** Perfil cognitivo em jogo (opcional; away pode omitir). */
  cognitiveArchetype?: MatchCognitiveArchetype;
  /**
   * Estado de prethinking do jogador (intenção + velocidade cognitiva), preenchido pelo engine.
   */
  prethinking?: PrethinkingState | null;
  /**
   * GameSpirit: `spiritMomentumClamp01` do live match (0–1). Só enviesa tendências de intenção, não decide ações.
   */
  gameSpiritHomeMomentum01?: number | null;
}
