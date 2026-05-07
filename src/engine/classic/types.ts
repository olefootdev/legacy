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

/**
 * As 3 zonas verticais do CLASSIC. Toda decisão e todo movimento
 * resolve a partir disto + ataque/defesa.
 *   - defense:  GK, LB, CB, RB → constrói saída ou recupera/limpa
 *   - creative: DM, CM         → conecta defesa ↔ ataque, é onde o jogo acontece
 *   - attack:   LW, ST, RW     → finaliza (sem tocar pra trás) ou pressiona alto
 */
export type PlayerZone = 'defense' | 'creative' | 'attack';

export function zoneFromRole(role: string): PlayerZone {
  const r = (role ?? '').toUpperCase();
  if (r === 'GK' || r === 'LB' || r === 'RB' || r === 'CB') return 'defense';
  if (r === 'DM' || r === 'CM' || r === 'AM' || r === 'MEI') return 'creative';
  return 'attack'; // LW, RW, ST, fallback
}

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
  | 'rebound'     // sobra após chute
  | 'blocked'     // chute bloqueado por defensor (calibração real)
  | 'duel';       // duelo defensivo — defensor luta pela bola sem sair do lugar

/**
 * Gatilho tático especial — identifica a mecânica que gerou o evento.
 * Usado para narração específica e acumulação de stats individuais.
 */
export type TacticalTrigger =
  | 'tiktak'       // meio de campo toca de primeira
  | 'long_ball'    // lateral cruza de um lado ao outro
  | 'false9'       // falso 9 segura e chuta de primeira pro meio
  | 'forced_shot'  // atacante na zona de ataque obrigado a finalizar
  | 'duel_win'     // defensor ganha duelo sem sair do lugar
  | null;

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

/**
 * Estado mental do agente — DERIVADO de lastInvolvedMinute + anxiousScore +
 * confidence/fatigue. Não é armazenado independentemente: é computado a cada
 * evento. Gera bias na decisão e visual sutil no campo.
 *
 *   idle:       não envolvido recentemente (>5min)
 *   aware:      recebeu bola ou foi alvo nos últimos 2-5min
 *   engaged:    sequência ativa (3+ envolvimentos nos últimos 2min)
 *   anxious:    adversário pressionando há vários eventos (anxiousScore > 60)
 *   on_fire:    confidence alta + recentemente envolvido
 *   recovering: após chute/falta sofrida (recovers in 1-2min)
 */
export type PlayerMentalState =
  | 'idle'
  | 'aware'
  | 'engaged'
  | 'anxious'
  | 'on_fire'
  | 'recovering';

/** Tracking individual leve — só campos persistentes; o `state` é derivado. */
export interface PlayerMental {
  /** Último minuto que o jogador foi ator OU receptor de algum evento. */
  lastInvolvedMinute: number;
  /** Eventos nos últimos 2 minutos (proxy de "engagement"). */
  recentInvolvement: number;
  /** Pressão sofrida acumulada (0-100, decai com tempo). */
  anxiousScore: number;
  /** Último chute do jogador — entra em 'recovering' por 1-2min. */
  lastShotMinute: number;
}

/** Métricas individuais acumuladas durante a partida — exibidas no pós-jogo. */
export interface PlayerMatchStats {
  goals: number;
  shots: number;
  passes: number;
  tackles: number;
  interceptions: number;
  fouls: number;
  /** Duelos defensivos ganhos (sem sair do lugar). */
  duelsWon: number;
  /** Tik-tak de primeira executados. */
  tikTakCount: number;
  /** Bolas longas cruzadas de lateral a lateral. */
  longBallCount: number;
}

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
  /** Métricas individuais acumuladas durante a partida. */
  matchStats?: PlayerMatchStats;
  /** Tracking mental leve — alimenta o estado FSM derivado. */
  mental?: PlayerMental;
  /** Foto do jogador (formato card) — quando ausente, UI cai num placeholder. */
  portraitUrl?: string;
  /** Foto circular (token) — preferida pra nó no campo. */
  portraitTokenUrl?: string;
}

export function emptyPlayerMatchStats(): PlayerMatchStats {
  return { goals:0, shots:0, passes:0, tackles:0, interceptions:0, fouls:0, duelsWon:0, tikTakCount:0, longBallCount:0 };
}

export function emptyPlayerMental(): PlayerMental {
  return { lastInvolvedMinute: -10, recentInvolvement: 0, anxiousScore: 0, lastShotMinute: -10 };
}

/**
 * Deriva o estado mental atual a partir do tracking + atributos do jogador.
 * Pure function — testável.
 */
export function deriveMentalState(
  player: ClassicPlayer,
  currentMinute: number,
): PlayerMentalState {
  const m = player.mental;
  if (!m) return 'idle';

  // Recovering: chutou recentemente (1-2min)
  if (currentMinute - m.lastShotMinute < 2) return 'recovering';

  // On fire: confidence alta + envolvido recentemente
  if (player.onFire && currentMinute - m.lastInvolvedMinute < 4) return 'on_fire';

  // Anxious: pressão sofrida sustentada
  if (m.anxiousScore > 60) return 'anxious';

  // Engaged: 3+ envolvimentos nos últimos 2min
  if (m.recentInvolvement >= 3 && currentMinute - m.lastInvolvedMinute < 2) return 'engaged';

  // Aware: envolvido nos últimos 5min
  if (currentMinute - m.lastInvolvedMinute < 5) return 'aware';

  return 'idle';
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
  tacticalTrigger?: TacticalTrigger; // gatilho tático especial que gerou o evento
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
