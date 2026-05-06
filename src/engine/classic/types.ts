export type ArchetypeId =
  | 'FINISHER'
  | 'MAESTRO'
  | 'HUNTER'
  | 'ENGINE'
  | 'COLD_BLOOD'
  | 'DESTROYER'
  | 'VETERAN'
  | 'WILD'
  | 'BOX_INVADER';

export type EventType =
  | 'pass'
  | 'shot'
  | 'goal'
  | 'danger'
  | 'tackle'
  | 'interception'
  | 'corner'
  | 'foul'
  | 'pressure'
  | 'cross'
  | 'save'        // chute defendido pelo goleiro
  | 'post'        // bola na trave
  | 'wide'        // bola para fora
  | 'rebound';    // sobra após chute

/**
 * Subtipo de passe — diferencia a INTENÇÃO e o VISUAL.
 * - curto:      passe normal, bola viaja em velocidade média
 * - rapido:     1-toque sob pressão, bola voa rápido
 * - planejado:  MAESTRO/VETERAN escolhem com calma — linha de visão pulsa antes
 * - cruzamento: bola arqueia da ala pra área (parábola Y)
 */
export type PassSubtype = 'curto' | 'rapido' | 'planejado' | 'cruzamento';

/**
 * Fase tática da equipe — usada pelo micro-movimento do bloco.
 * O time não corre, mas se contrai/expande baseado em quem tem a bola e onde.
 */
export type TeamPhase =
  | 'BUILDUP'         // construção atrás, time mantém forma base
  | 'CONSOLIDATION'   // bola na linha do meio, leve avanço
  | 'ATTACKING'       // bola no terço final, time inteiro avança
  | 'DEFENDING'       // adversário no nosso terço final, time recua + contrai
  | 'TRANSITION';     // momento de virada, posição neutra

export interface ClassicPlayer {
  id: number;
  name: string;
  number: number;
  shortName: string;
  ovr: number; // overall rating 60-99
  position: { x: number; y: number }; // fixed logical coords 600x400
  archetype: ArchetypeId;
  team: 'home' | 'away';
  role: string;
  fatigue: number;   // 0-100, actively updated during match
  confidence: number; // 0-100, momentum tracker
  onFire?: boolean;  // confidence > 85 after a key action
  isStar?: boolean;
  /** Foto do jogador (formato card) — quando ausente, UI cai num placeholder. */
  portraitUrl?: string;
  /** Foto circular (token) — preferida pra nó no campo. */
  portraitTokenUrl?: string;
}

// Tipo de passe ativo — controla como a bola progride pelo campo
// LONGO: bola direta zona 1→4, poucos intermediários
// TIKTAK: circulação curta zona a zona, aciona muitos jogadores
// LATERAL: amplitude nos corredores, laterais e pontas
// COUNTER: transição rápida após recuperação, profundidade imediata
export type PassStyle = 'LONGO' | 'TIKTAK' | 'LATERAL' | 'COUNTER';

// Skill IDs that map to tactical triggers
export type ManagerSkillId = 'counter' | 'press' | 'offens' | 'cross';

// Last event context for chained event logic
export interface EventChainContext {
  lastType: EventType;
  lastTeam: 'home' | 'away';
  chainCount: number; // how many events in current chain
}

export interface BallState {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  opacity: number;
}

export interface MatchEvent {
  id: string;
  minute: number;
  type: EventType;
  team: 'home' | 'away';
  playerId?: number;       // portador / ator principal
  playerName?: string;
  archetype?: ArchetypeId;
  text: string;
  ballX: number;
  ballY: number;
  receiverPlayerId?: number; // receptor do passe — bola vai até ele
  passSubtype?: PassSubtype; // intenção do passe (visual + lógica)
  rationale?: string;        // racional da decisão — pra Coach AI futuro
}

export interface MatchStats {
  possession: { home: number; away: number };
  shots: { home: number; away: number };
  shotsOnTarget: { home: number; away: number };
  passes: { home: number; away: number };
  fouls: { home: number; away: number };
  corners: { home: number; away: number };
}

export interface MatchScore {
  home: number;
  away: number;
}

export interface SkillEntry {
  id: string;
  label: string;
  icon: string;
  cooldown: number; // seconds
  active: boolean;
  remaining: number; // cooldown remaining
}

export interface SubEntry {
  number: number;
  name: string;
  fatigue: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface QuickInstruction {
  id: string;
  label: string;
}

export interface ClassicMatchConfig {
  homeTeam: string;
  awayTeam: string;
  homeManager: string;
  awayManager: string;
  round: number;
  competition: string;
  /** Iniciais opcionais para os crests; se omitido, derivado do nome. */
  homeShort?: string;
  awayShort?: string;
  /** Brasão do time do coração (HOME) ou supporter crest (AWAY). */
  homeCrestUrl?: string | null;
  awayCrestUrl?: string | null;
}
