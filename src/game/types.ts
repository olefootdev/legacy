import type { LiveMatchSnapshot } from '@/engine/types';
import type {
  CardCollection,
  ClubEntity,
  ClubLogisticsState,
  CrowdState,
  FinanceState,
  Fixture,
  FormLetter,
  PastResult,
  PlayerEntity,
} from '@/entities/types';
import type { InboxItem, InboxCategory } from './inboxTypes';
import type { ClubStructuresState, ClubStructureId } from '@/clubStructures/types';
import type { TeamTacticalStyle } from '@/tactics/playingStyle';
import type { LeagueSeasonState } from '@/match/leagueSeason';
import type { LeagueScheduleState } from '@/match/leagueSchedule';
import type { AdminLeagueConfig } from '@/match/adminLeagues';
import type { FormationSchemeId } from '@/match-engine/types';
import type { SocialState } from '@/social/types';
import type { BannerSlotId, UiBannerEntry, UiBannersState } from '@/ui/banners';
import type {
  ManagerProspectHeritageBrief,
  ManagerProspectVisualBrief,
} from '@/entities/managerProspect';
import type { PlayerAttributes } from '@/entities/types';
import type { ExpExchangeState } from '@/economy/expExchange';
import type { PlayerSeasonLedgerMap } from '@/team/playerSeasonLedger';
import type { PlayerEvolutionTimelineMap } from '@/team/playerEvolutionTimeline';
import type { ShopCatalogItem } from './shopCatalog';
import type { CoachAction } from '@/coach/types';
import type { QuickMatchStreak } from './quickMatchStreak';
import type { DailyChallengesState } from './dailyChallenges';
import type { GlobalLeagueState } from '@/match/globalMatch';
import type { CompetitiveRankingState } from './competitiveRanking';
import type { CoachAgent } from '@/coach/types';
import type { PlayerHealth } from '@/systems/playerHealth/types';
import type { ConsequenceStoreState, PersistentConsequence } from '@/systems/consequences/types';
import type { LoginBonusClaimResult, ManagerPresence } from '@/systems/engagement/types';

export type { ExpExchangeOrder, ExpExchangeState } from '@/economy/expExchange';
export type { InboxItem, InboxCategory } from './inboxTypes';

export interface SavedTacticPlan {
  id: string;
  name: string;
  style: TeamTacticalStyle;
  createdAt: string;
  updatedAt: string;
}

export type IndividualTrainingType = 'fisico' | 'mental' | 'tatico' | 'atributos' | 'especial' | 'descanso';
export type CollectiveTrainingType = 'formacao' | 'empatia' | 'fisico' | 'descanso';
export type TrainingGroup = 'defensivo' | 'criativo' | 'ataque' | 'all';
export type TrainingMode = 'individual' | 'coletivo';

export interface TrainingPlan {
  id: string;
  mode: TrainingMode;
  trainingType: IndividualTrainingType | CollectiveTrainingType;
  playerIds: string[];
  group: TrainingGroup;
  startedAt: string;
  endAt: string;
  status: 'running' | 'completed';
}

/** Tratamento médico em slot (paralelo aos planos de treino). */
export interface TreatmentPlan {
  id: string;
  playerId: string;
  startedAt: string;
  endAt: string;
  status: 'running' | 'completed';
}

export type StaffRoleId =
  | 'preparador_fisico'
  | 'mental'
  | 'nutricao'
  | 'tatico'
  | 'treinador'
  | 'olheiro'
  | 'preparador_goleiros';

export type GraphicQualityId = 'low' | 'medium' | 'high';

/** Preferência de animação: sistema = respeita `prefers-reduced-motion` do SO. */
export type ReduceMotionPreference = 'system' | 'reduce' | 'noReduce';

/** Dados do onboarding / cadastro (opcional). */
export interface ManagerProfileRegistration {
  firstName: string;
  lastName: string;
  email: string;
  /** E.164 sugerido, ex. +5511987654321 */
  phoneE164: string;
}

/** Clube real favorito (API-Football / api-sports). */
export interface FavoriteRealTeamRef {
  id: number;
  name: string;
  logo: string | null;
}

export interface UserSettings {
  soundEnabled: boolean;
  graphicQuality: GraphicQualityId;
  language: 'pt-BR';
  reduceMotion: ReduceMotionPreference;
  /** Se true, o mundo do jogo avança também com o separador em segundo plano (~1 min). */
  worldSimulateInBackground: boolean;
  /** Foto do treinador no menu (JPEG em data URL, redimensionada no cliente). */
  trainerAvatarDataUrl: string | null;
  /** Brasão do clube/manager (PNG com alpha, data URL) — matchday e ecrãs de jogo. */
  managerCrestPngDataUrl: string | null;
  /** Preenchido no fluxo de cadastro (opcional). */
  managerProfile?: ManagerProfileRegistration | null;
  /** Time do coração — escudo via API-Football quando disponível. */
  favoriteRealTeam?: FavoriteRealTeamRef | null;
  /**
   * @deprecated Removido em 2026-05-18 — use `hasDoneOnboarding` + tabela
   * Supabase `welcome_pack_grants`. Mantido no tipo apenas para hidratar
   * saves antigos sem quebrar parsing; sempre ignorado em runtime.
   */
  welcomeGenesisPackVersion?: number;
  /**
   * Passo atual do tutorial inicial. `0` = ativo no passo 0; `-1` = concluído/pulado.
   * Omitido = ainda não iniciado (dispara no primeiro boot pós-cadastro).
   */
  tutorialStep?: number;
  /** Assistente flutuante ativo fora de partidas. Default: true após o primeiro boot. */
  assistantEnabled?: boolean;
  /**
   * Daily bonus — timestamp do último claim e dia atual da streak (1..7).
   * Streak quebra se o gap exceder 48h (ver `src/onboarding/dailyBonus.ts`).
   */
  dailyBonus?: {
    lastClaimMs?: number;
    streakDay?: number;
  };
  /**
   * Dia do manager desde o cadastro (Dia 1, Dia 2...).
   * Incrementa às 23:59 BRT (02:59 UTC). Nunca zera — só cresce.
   */
  managerDay?: number;
  /** Data do último reset de dia (YYYY-MM-DD em UTC). */
  lastDayResetDate?: string;
  /**
   * Flag permanente: cerimônia de onboarding já foi concluída.
   * Impede que o fluxo de boas-vindas dispare novamente após o Dia 1.
   */
  hasDoneOnboarding?: boolean;
}

export interface StaffState {
  roles: Record<StaffRoleId, number>;
  assignedByPlayer: Record<string, StaffRoleId[]>;
  assignedCollective: Record<'defensivo' | 'criativo' | 'ataque', StaffRoleId[]>;
}

/** Anúncio EXP do teu prospect `managerCreated`. */
export interface ManagerOwnListing {
  listingId: string;
  playerId: string;
  priceExp: number;
  listedAtIso: string;
}

/** Snapshot de prospect de outro manager (NPC) à venda por EXP. */
export interface ManagerNpcMarketOffer {
  listingId: string;
  snapshot: PlayerEntity;
  priceExp: number;
}

export interface ManagerProspectMarketState {
  ownListings: ManagerOwnListing[];
  npcOffers: ManagerNpcMarketOffer[];
}

/** Custo EXP da Academia OLE (configurável no Admin). */
export interface ManagerProspectConfig {
  createCostExp: number;
}

/** Passos do fluxo Admin «Academy players» (Academia OLE → retrato → plantel). */
export type PlayerCreationStep =
  | 'awaiting_photo'
  | 'photo_uploaded'
  | 'validated'
  | 'approved'
  | 'launched';

/**
 * Demanda **Academy players** (Academia OLE): jogador já existe no save; Admin cola retrato, valida, aprova e lança.
 * Diferente de **Create player** (#create-player): wizard que minta carta do zero com GameSpirit.
 */
export interface ManagerProspectArtRequest {
  id: string;
  playerId: string;
  createdAtIso: string;
  playerCreationStep: PlayerCreationStep;
  /** Saves antigos: `pending` | `fulfilled` antes de `playerCreationStep`. */
  legacyStatus?: 'pending' | 'fulfilled';
  adminArtPrompt: string;
  attributesSnapshot: PlayerAttributes;
  visualBrief?: ManagerProspectVisualBrief;
  heritage: ManagerProspectHeritageBrief;
  /** Rascunho do retrato (data URL ou https) antes de «Lançar». */
  draftPortraitUrl?: string | null;
  /**
   * URL pública (Pinata) da selfie que o manager mandou no modo concierge.
   * Admin usa como referência pra criar a carta premium externamente.
   * Ausente em saves antigos / fluxo legacy.
   */
  selfieUrl?: string;
  /**
   * URL do "card promocional" que o admin sobe junto com a carta de jogo.
   * Versão social-media-ready (com texto/branding) pro manager compartilhar
   * em Instagram/X. Aparece no inbox quando a carta é lançada.
   */
  promotionalCardUrl?: string;
  /** Após «Lançar no jogo» + mercado: metadados da listagem local / Supabase. */
  marketListingId?: string;
  marketPriceExp?: number;
  marketListedAtIso?: string;
}

export interface OlefootGameState {
  version: 1;
  club: ClubEntity;
  /** Coleções NFT-style (off-chain): maxSupply global por coleção. */
  cardCollections: Record<string, CardCollection>;
  players: Record<string, PlayerEntity>;
  /**
   * Single Source of Truth para fadiga / lesão / suspensão / risco.
   * Lido por TODOS os modos (quick, auto, test2d, global, penalty, friendly).
   * Migrado a partir de `players[id].fatigue/injuryRisk/outForMatches` em persistence.
   */
  playerHealth: Record<string, PlayerHealth>;
  /**
   * SSOT de moral/momentum por jogador. Alimentado por resultados em todas as ligas
   * (LEGACY, OLEFOOT, amistoso). Lido pelo coach e por sistemas de gameplay.
   */
  playerMoral?: Record<string, import('@/systems/playerMoral/types').PlayerMoral>;
  /**
   * Liga OLEFOOT Ranqueada — competição assíncrona com ELO (paralela à LEGACY).
   * Distinta da `olefootLeague` (3 divisões, sistema de pontos corridos).
   * Opcional: clientes legados que não inicializaram o módulo recebem `undefined`.
   */
  olefootRanked?: import('@/olefootLeague/types').OlefootRankedState;
  /** slotId → playerId (mesmas chaves que Team.tsx) */
  lineup: Record<string, string>;
  finance: FinanceState;
  crowd: CrowdState;
  form: FormLetter[];
  results: PastResult[];
  /** Contagem simples da liga principal (persistida com cada FINALIZE_MATCH). */
  leagueSeason: LeagueSeasonState;
  /** Calendário oficial (7 jogos/dia 09–21 de 2 em 2 h; treinos oficiais 10–22) por liga em pontos corridos. */
  leagueSchedule: LeagueScheduleState;
  /** Ligas e tabelas configuráveis (Admin + persistência). */
  adminLeagues: AdminLeagueConfig[];
  /** Liga cujo cartão principal sincroniza estatísticas com `leagueSeason`. */
  adminPrimaryLeagueId: string;
  inbox: InboxItem[];
  nextFixture: Fixture;
  liveMatch: LiveMatchSnapshot | null;
  /**
   * Obediência tática do time (30–100). Cresce com uso de voz em partida;
   * decaí em partidas sem comando. Multiplica a obediência individual.
   */
  tacticalObedience?: number;
  /**
   * Relação manager↔jogador (0–100) por playerId. Usada como `relacaoManager`
   * em `computeIndividualObedience`. Evolui com tiers: accept sobe, refuse/protest cai.
   * Persiste entre partidas (save).
   */
  managerRelationByPlayer?: Record<string, number>;
  manager: {
    /** Formação tática do plantel (motor / catálogo de slots). */
    formationScheme: FormationSchemeId;
    tacticalMentality: number;
    defensiveLine: number;
    tempo: number;
    tacticalStyle: TeamTacticalStyle;
    /** Sprint L4 — Instruções contextuais de prensa (granular por contexto). */
    pressing?: {
      triggers: {
        /** Prensar imediatamente ao perder a bola (counter-press). */
        onTurnover: boolean;
        /** Prensa intensifica quando estamos atrás no placar. */
        whenLosing: boolean;
        /** Prensa intensifica quando ganhando (defesa apertada). */
        whenLeading: boolean;
      };
      /** Zona principal de prensa: alta (campo adversário), meia, baixa (atrás da bola). */
      zone: 'high' | 'mid' | 'low';
      /** Intensidade base 0-100. */
      intensity: number;
    };
    /** Sprint L4 — Marcação individual: jogador da casa (id) → adversário designado (id). */
    markingAssignments?: Record<string, string>;
    savedTactics: SavedTacticPlan[];
    activeMatchTacticId: string | null;
    activeTrainingTacticId: string | null;
    trainingPlans: TrainingPlan[];
    /** Planos de tratamento do departamento médico (slots por nível da estrutura). */
    treatmentPlans: TreatmentPlan[];
    staff: StaffState;
    /** Coach Agent: assistente técnico que conhece todo o sistema e aprende com o manager */
    coach?: CoachAgent;
  };
  /** Último instante real usado para simulação contínua */
  lastWorldRealMs: number;
  clubLogistics: ClubLogisticsState;
  /** Níveis das estruturas do clube (1-5). */
  structures: ClubStructuresState;
  /**
   * Troféus memoráveis (liga, copa, supercopa) — só títulos de competição, não missões.
   * IDs em `MEMORABLE_TROPHY_SLOTS` (`src/trophies/memorableCatalog.ts`).
   */
  memorableTrophyUnlockedIds: string[];
  /** Rede de amigos do manager (convites, lista) — visível só no perfil privado. */
  social: SocialState;
  /** Preferências de UI e simulação (persistidas com o save). */
  userSettings: UserSettings;
  /** Banners por zona (Admin). */
  uiBanners: UiBannersState;
  /** Academia OLE: listagens do plantel + ofertas NPC no mercado EXP. */
  managerProspectMarket: ManagerProspectMarketState;
  managerProspectConfig: ManagerProspectConfig;
  /** Pedidos de retrato pendentes (prompt + atributos) para o fluxo Admin. */
  managerProspectArtQueue: ManagerProspectArtRequest[];
  /** Livro de ordens EXP ↔ BRO (mercado secundário). */
  expExchange: ExpExchangeState;
  /** Estatísticas agregadas por jogador na temporada (jogos, treinos, disciplina) — UI Meu Time. */
  playerSeasonLedger: PlayerSeasonLedgerMap;
  /**
   * Histórico compacto por jogador (pós-jogo / treino) para gráficos «Linha evolutiva».
   * Mantém os últimos N pontos por `playerId`.
   */
  playerEvolutionTimeline: PlayerEvolutionTimelineMap;
  /** Itens à venda na loja (editável no Admin). */
  shopCatalog: ShopCatalogItem[];
  /** Inventário local de consumíveis comprados (`itemId` → quantidade). */
  shopInventory: Record<string, number>;
  /** Streak de vitórias consecutivas no modo Quick Match. */
  quickMatchStreak?: QuickMatchStreak;
  /** Ranking competitivo da Partida Rápida (modo ranqueado). */
  competitiveRanking?: CompetitiveRankingState;
  /** Desafios diários com recompensas. */
  dailyChallenges?: DailyChallengesState;
  /** Desafios semanais de streak (Sprint 3). */
  streakChallenges?: import('@/match/quickStreakChallenges').StreakChallengesState;
  /** Intensidade tática atual na partida rápida (Sprint 2). */
  quickMatchIntensity?: import('@/match/quickTacticalIntensity').TacticalIntensityState;
  /** Estado da Liga Global (Match Global — rodadas automáticas simultâneas). */
  globalLeague?: GlobalLeagueState;
  /** Estado da OLEFOOT LIGA (sistema completo de liga com tabela e múltiplas rodadas). */
  olefootLeague?: import('@/match/olefootLeague').OlefootLeagueState;
  /** Estado da Liga Global MVP (sistema de playoffs + divisões + promoção/rebaixamento). */
  globalLeagueMVP?: import('@/match/globalLeagueMVP').GlobalLeagueMVPState;
  /**
   * IDs dos marcos da Liga Global já reclamados pelo manager (ex.: `gl_matches_10`).
   * Persistido em `manager_game_state` pra evitar duplo claim cross-browser.
   */
  globalLeagueMilestonesClaimed?: string[];
  /** Última rodada da Liga Global processada pelo consequences sync. Persistido para evitar reprocessamento. */
  lastProcessedGlobalRound?: string;
  /**
   * LIGA CLASSIC + FAST LIGA — cumulativas, pontos somam partida a partida
   * nos modos CLASSIC e QUICK respectivamente. Persistido cross-browser.
   */
  localLeagues?: import('@/match/localLeagues').LocalLeaguesState;
  /** Fila de ofertas de reforço emergencial (lesão grave em titular na Liga Global). Máx 3. */
  emergencyTransferOffers?: Array<{
    injuredPlayerId: string;
    injuredPlayerName: string;
    zone: import('@/entities/types').TacticalZone;
    createdAt: number;
  }>;
  /**
   * OLEFOOT PYTHON MODE — Consequências persistentes ativas no clube.
   * Cada PersistentConsequence tem expires_at em ms epoch; UI/engine
   * consomem via `applyOverlay` pra obter snapshots vivos.
   */
  consequenceStore?: ConsequenceStoreState;
  /** OLEFOOT PYTHON MODE — Presença do manager (ausência + bonus 3h/1h). */
  managerPresence?: ManagerPresence;
  /** Último resultado de claim de login bonus — UI consome após dispatch. */
  lastLoginBonusClaim?: LoginBonusClaimResult;
}

export type GameAction =
  | {
      /**
       * Aplica eventos de UMA partida ao mapa SSOT `playerHealth`.
       * Despachado por todos os modos (quick/auto/test2d/global/penalty/friendly).
       * É o ÚNICO ponto que muta playerHealth a partir de partidas.
       */
      type: 'APPLY_MATCH_CONSEQUENCES';
      events: import('@/systems/playerHealth/types').MatchOutcomeEvent[];
    }
  | {
      /**
       * Onboarding — concede pacote inicial atomicamente:
       *   - merge dos 25 jogadores Genesis
       *   - +EXP da roleta inicial
       *   - lineup default
       *   - hasDoneOnboarding=true (gate único — welcomeGenesisPackVersion descontinuado)
       */
      type: 'GRANT_ONBOARDING_PACKAGE';
      players: Record<string, import('@/entities/types').PlayerEntity>;
      lineup: Record<string, string>;
      formationScheme?: import('@/match-engine/types').FormationSchemeId;
      starterExpAmount: number;
    }
  | {
      /**
       * Daily bonus — registra um claim, atualiza streakDay e lastClaimMs.
       * EXP/packs são dispatched separadamente pelo caller (composável).
       */
      type: 'CLAIM_DAILY_BONUS';
      streakDay: number;
      claimMs: number;
    }
  | {
      type: 'SET_LINEUP';
      lineup: Record<string, string>;
      /** Se enviado, grava junto com a escalação (mesma formação nas próximas partidas). */
      formationScheme?: import('@/match-engine/types').FormationSchemeId;
    }
  | {
      type: 'START_LIVE_MATCH';
      mode: import('@/engine/types').MatchMode;
      /** Seed partilhado (ex.: desafio amistoso aceite online) para alinhar RNG do motor. */
      simulationSeed?: number;
    }
  | { type: 'BEGIN_PLAY_FROM_PREGAME' }
  | { type: 'TICK_MATCH_MINUTE' }
  /** TESTE 2D: após coreografia bola (causal→visual), revela `deferredFeedEvent` no feed. */
  | { type: 'COMMIT_TEST2D_VISUAL_BEAT_FEED' }
  /** ultralive2d: idem com `ultralive2dStagedPlay`. */
  | { type: 'COMMIT_ULTRALIVE2D_STAGED_FEED' }
  | { type: 'TICK_MATCH_BULK'; steps: number }
  | {
      type: 'SIM_SYNC';
      minute: number;
      homeScore: number;
      awayScore: number;
      possession: import('@/engine/types').PossessionSide;
      events: import('@/engine/types').MatchEventEntry[];
      stats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; shots: number; goals: number; shotsOn?: number; shotsOff?: number; saves?: number; dribblesOk?: number }>;
      carrierId: string | null;
      fullTime: boolean;
      clockPeriod: import('@/engine/types').LiveMatchClockPeriod;
    }
  | { type: 'CLEAR_SPIRIT_PENDING_RESTART' }
  | { type: 'SET_SPIRIT_OVERLAY'; overlay: import('@/engine/types').SpiritOverlay | null }
  | { type: 'DISMISS_SPIRIT_OVERLAY' }
  | {
      type: 'APPLY_SPIRIT_OUTCOME';
      payload: { kind: 'penalty_advance' } | { kind: 'penalty_resolve'; rng?: number };
    }
  | { type: 'COACH_TECHNICAL_COMMAND'; text: string }
  /** Partida ao vivo: troca dois titulares de posição (slot ↔ slot); atualiza `lineup` + `liveMatch.homePlayers`. */
  | { type: 'LIVE_MATCH_SWAP_HOME_SLOTS'; slotA: string; slotB: string }
  /** Partida ao vivo: muda esquema tático mantendo os 11 em campo; recalcula posições no snapshot. */
  | { type: 'LIVE_MATCH_SET_FORMATION'; formationScheme: import('@/match-engine/types').FormationSchemeId }
  | { type: 'REGENERATE_LIVE_SECOND_HALF_STORY'; topPlayerImpactScore?: number }
  | { type: 'MATCH_SUBSTITUTE'; outPlayerId: string; inPlayerId: string }
  | { type: 'RECALCULATE_TEAM_STRENGTH'; reason?: string; minute?: number }
  | { type: 'QUICK_ENFORCE_CARD_RULES'; playerId: string; reason?: 'injury_red' | 'two_yellows' | 'direct_red' }
  /** Lesão leve: manager decide arriscar — recoloca o jogador em campo e limpa o quickInjurySub. */
  | { type: 'CANCEL_QUICK_INJURY_SUB' }
  /** Adiciona um evento narrativo ao feed da partida ao vivo (feedback tático, estado emocional, etc.). */
  | { type: 'ADD_LIVE_MATCH_EVENT'; text: string; kind?: import('@/engine/types').MatchEventEntry['kind'] }
  /** Penalty interativo: manager escolhe o batedor antes do kick. */
  | { type: 'PENALTY_SET_TAKER'; playerId: string; name: string }
  | { type: 'END_MATCH_TO_POST' }
  /** Desistência em partida rápida/automática: 0–5 para o visitante e fase pós-jogo. */
  | { type: 'FORFEIT_MATCH'; mode: 'quick' | 'auto' | 'test2d' }
  | {
      type: 'AWARD_LIVE_PENALTY';
      attackingSide: 'home' | 'away';
      takerId: string;
      takerName: string;
      minute: number;
    }
  /** Sprint L3 — escanteio/falta interativo: dispara overlay no manager. */
  | {
      type: 'AWARD_SET_PIECE';
      mode: 'corner' | 'free_kick';
      side: 'home' | 'away';
      cornerSide?: 'left' | 'right';
      distance?: number;
      zone?: 'center' | 'left' | 'right';
    }
  /** Manager confirmou a batida: aplica resultado + adiciona narrativa. */
  | {
      type: 'RESOLVE_SET_PIECE';
      takerId: string;
      takerName: string;
      deliveryType: 'short' | 'near_post' | 'far_post' | 'direct_shot' | 'cross' | 'short_pass';
      targetId?: string;
      targetName?: string;
      /** Outcome calculado (caller que computa probabilidade). */
      outcome: 'goal' | 'shot_saved' | 'cleared' | 'recycled';
    }
  /** Cancela set-piece pendente (timeout, etc). */
  | { type: 'CANCEL_SET_PIECE' }
  /** Sprint L4 — Atualiza instruções de prensa (parcial). */
  | {
      type: 'SET_PRESSING_CONTEXT';
      patch: Partial<{
        triggers: Partial<{
          onTurnover: boolean;
          whenLosing: boolean;
          whenLeading: boolean;
        }>;
        zone: 'high' | 'mid' | 'low';
        intensity: number;
      }>;
    }
  /** Sprint L4 — Designa/remove marcação individual. opponentId === null remove. */
  | {
      type: 'SET_MARKING_ASSIGNMENT';
      homePlayerId: string;
      opponentId: string | null;
    }
  /** Sprint L4 — Limpa todas as marcações individuais. */
  | { type: 'CLEAR_MARKING_ASSIGNMENTS' }
  | {
      /** Injeta comando de voz num jogador da casa. */
      type: 'VOICE_COMMAND_ISSUED';
      playerId: string;
      intent: import('@/voiceCommand/types').VoiceIntent;
      effectiveObedience: number;
      tier: import('@/voiceCommand/types').ObedienceTier;
      rawText: string;
      assistantEffectiveness?: number;
      payload?: Record<string, unknown>;
    }
  | { type: 'VOICE_COMMAND_EXPIRED'; playerId: string }
  | { type: 'VOICE_COMMANDS_SWEEP'; nowMs: number }
  | { type: 'TEAM_OBEDIENCE_BUMP'; delta: number }
  | { type: 'REFEREE_WARNING_LANGUAGE'; minute: number }
  | {
      type: 'REFEREE_RED_FOR_LANGUAGE';
      minute: number;
      expelledPlayerId: string;
      expelledPlayerName: string;
    }
  | { type: 'FINALIZE_MATCH' }
  /** Quando `insertMatch` resolve — actualiza o snapshot em curso (evita mutar objecto já descartado). */
  | { type: 'SET_LIVE_MATCH_SUPABASE_ID'; matchId: string; matchClientNonce: number }
  /** Sprint 1: Trigger momento interativo na partida rápida */
  | { type: 'TRIGGER_QUICK_INTERACTIVE_MOMENT'; moment: import('@/match/quickInteractiveMoments').QuickInteractiveMoment }
  /** Sprint 1: Resolver escolha do momento interativo */
  | { type: 'RESOLVE_QUICK_INTERACTIVE_MOMENT'; momentId: string; choiceId: string | null }
  /** Sprint 2: Mudar intensidade tática */
  | { type: 'SET_TACTICAL_INTENSITY'; level: import('@/match/quickTacticalIntensity').TacticalIntensityLevel }
  /** Atualizar arco narrativo da partida rápida em andamento */
  | { type: 'SET_NARRATIVE_ARC'; arc: import('@/match/quickNarrativeArcs').NarrativeArcState }
  /** Sprint 3: Atualizar progresso dos desafios semanais */
  | { type: 'UPDATE_STREAK_CHALLENGES'; currentStreak: number; won: boolean }
  /** Sprint 3: Renovar desafios semanais */
  | { type: 'REFRESH_STREAK_CHALLENGES' }
  | { type: 'MERGE_PLAYERS'; players: Record<string, PlayerEntity> }
  /** Substitui o plantel (ex.: sincronizar só com genesis_market_players); sanitiza escalação e mercado. */
  | { type: 'SET_PLAYERS_RECORD'; players: Record<string, PlayerEntity> }
  | { type: 'UPSERT_CARD_COLLECTION'; collection: CardCollection }
  | { type: 'SET_MANAGER_SLIDERS'; partial: Partial<OlefootGameState['manager']> }
  | { type: 'SET_PLAYING_STYLE_PRESET'; presetId: import('@/tactics/playingStyle').PlayingStylePresetId }
  | { type: 'SAVE_TACTIC_PLAN'; name: string }
  | { type: 'START_TACTIC_TRAINING'; tacticId: string }
  | {
      type: 'START_TEAM_TRAINING_PLAN';
      mode: TrainingMode;
      trainingType: IndividualTrainingType | CollectiveTrainingType;
      playerIds: string[];
      group?: TrainingGroup;
      durationHours: number;
    }
  | { type: 'COMPLETE_DUE_TRAININGS'; nowIso?: string }
  | { type: 'START_TREATMENT_PLAN'; playerId: string }
  | { type: 'UPGRADE_STAFF_ROLE'; roleId: StaffRoleId }
  | { type: 'ASSIGN_STAFF_TO_PLAYER'; playerId: string; roleIds: StaffRoleId[] }
  | { type: 'ASSIGN_STAFF_TO_COLLECTIVE'; group: 'defensivo' | 'criativo' | 'ataque'; roleIds: StaffRoleId[] }
  | { type: 'WORLD_CATCH_UP'; nowMs: number }
  | { type: 'TRAINING_SESSION' }
  | { type: 'BUY_OLE_PACK' }
  | { type: 'SELL_SCOUT_INTEL' }
  | { type: 'UPGRADE_STRUCTURE'; structureId: ClubStructureId }
  /** Ações rápidas na Cidade (custo EXP + efeito em plantel / finanças / treino). */
  | { type: 'CITY_QUICK_MEDICAL_MUTIRAO' }
  | { type: 'CITY_QUICK_STORE_CAMPAIGN' }
  | { type: 'CITY_QUICK_TRAINING_INTENSIVO' }
  | { type: 'WALLET_COMPLETE_KYC' }
  | { type: 'WALLET_SAVE_SWAP_KYC'; profile: import('@/wallet/types').WalletKycProfile }
  | { type: 'WALLET_CREATE_OLEXP'; planId: import('@/wallet/types').OlexpPlanId; amountCents: number }
  | { type: 'WALLET_CLAIM_OLEXP'; positionId: string }
  | { type: 'WALLET_OLEXP_EARLY_TO_SPOT'; positionId: string }
  | { type: 'WALLET_SET_SPONSOR'; sponsorId: string }
  /** Sincroniza o código de indicação local com o autoritativo do servidor. */
  | { type: 'WALLET_SYNC_REFERRAL_CODE'; code: string }
  /** Envio de SPOT BRO para outro utilizador pelo código de indicação (MVP cliente). */
  | { type: 'WALLET_TRANSFER_BRO_BY_CODE'; recipientCode: string; amountCents: number }
  | { type: 'WALLET_ACCRUE_DAILY'; dateIso: string }
  | {
      type: 'WALLET_GAT_PURCHASE';
      category: import('@/wallet/types').GatCategory;
      amountCents: number;
      /** Opcional: nome do ativo na UI (ex.: relatório de scouting). */
      assetLabel?: string;
    }
  | {
      type: 'START_FRIENDLY_CHALLENGE';
      opponentName: string;
      opponentId: string;
      mode: 'live' | 'quick' | 'penalty';
      currency: 'BRO' | 'EXP';
      /** BRO: valor em unidades BRO (ex.: 10.5). EXP: valor inteiro de EXP. */
      prizeAmount: number;
    }
  /** Reverte escrow de `START_FRIENDLY_CHALLENGE` (convite recusado / expirado / cancelado). */
  | {
      type: 'REFUND_FRIENDLY_CHALLENGE';
      opponentName: string;
      mode: 'live' | 'quick' | 'penalty';
      currency: 'BRO' | 'EXP';
      prizeAmount: number;
    }
  | { type: 'SEND_FRIEND_REQUEST'; managerId: string; clubName: string }
  | { type: 'ACCEPT_FRIEND_REQUEST'; requestId: string }
  | { type: 'DECLINE_FRIEND_REQUEST'; requestId: string }
  | { type: 'CANCEL_OUTGOING_FRIEND_REQUEST'; requestId: string }
  | { type: 'REMOVE_SOCIAL_FRIEND'; managerId: string }
  | { type: 'DISMISS_INBOX_ITEM'; id: string }
  /** Insere item no topo da caixa; substitui item com o mesmo `id` se já existir. */
  | { type: 'INBOX_PREPEND'; item: InboxItem }
  | { type: 'SET_USER_SETTINGS'; partial: Partial<UserSettings> }
  | { type: 'SET_CLUB_NAME'; name: string }
  /** Substitui o estado por um save importado (JSON). Validação mínima em `persistence`. */
  | { type: 'IMPORT_GAME_STATE'; state: OlefootGameState }
  | { type: 'RESET' }
  // Global League — resultado real da liga atualiza torcida local
  | { type: 'GLOBAL_LEAGUE_MATCH_RESULT'; win: boolean; draw: boolean; goalsFor: number; goalsAgainst: number }
  // Coach Agent Actions
  | { type: 'COACH_ADD_PENDING_ACTION'; action: CoachAction }
  | { type: 'COACH_GENERATE_HEALTH_ACTIONS' }
  | { type: 'COACH_GENERATE_TRAINING_ACTIONS' }
  | { type: 'COACH_GENERATE_TACTICAL_ACTIONS'; opponentContext?: string }
  | { type: 'COACH_GENERATE_BRIEFING'; opponentContext?: string }
  | {
      type: 'OLEFOOT_RECORD_MATCH';
      matchId: string;
      homeManagerId: string;
      homeManagerName: string;
      awayManagerId: string;
      awayManagerName: string;
      homeGoals: number;
      awayGoals: number;
      /** IDs dos jogadores que atuaram (atualizam moral). */
      homePlayerIds: string[];
      awayPlayerIds: string[];
    }
  | { type: 'CONSUME_SHOP_BOOSTER'; itemId: string; targetPlayerId?: string }
  | { type: 'COACH_APPROVE_ACTION'; actionId: string }
  | { type: 'COACH_REJECT_ACTION'; actionId: string }
  | { type: 'COACH_EXECUTE_ACTION'; actionId: string }
  | { type: 'COACH_CLEAR_EXECUTED_ACTIONS' }
  | { type: 'COACH_ADD_MESSAGE'; message: import('@/coach/types').ConversationMessage }
  | {
      type: 'COACH_ADD_INSTRUCTION';
      instruction: string;
      context?: string;
      priority?: 'high' | 'medium' | 'low';
      category?: 'training' | 'staff' | 'lineup' | 'tactics' | 'general';
    }
  | { type: 'COACH_TOGGLE_INSTRUCTION'; index: number; active: boolean }
  | { type: 'COACH_REMOVE_INSTRUCTION'; index: number }
  | { type: 'COACH_SET_ONBOARDING_STEP'; step: number }
  | { type: 'ADMIN_UPSERT_LEAGUE'; league: AdminLeagueConfig }
  | { type: 'ADMIN_REMOVE_LEAGUE'; id: string }
  | { type: 'ADMIN_SET_PRIMARY_LEAGUE'; id: string }
  | {
      type: 'ADMIN_GRANT_RESOURCES';
      /** EXP com lifetime (conquistas / perfil). */
      earnedExp?: number;
      /** Ajuste direto ao saldo EXP (sem lifetime). */
      oleDelta?: number;
      /** BRO jogo (finance.broCents). */
      broCentsDelta?: number;
      /** BRO no SPOT da wallet. */
      spotBroCentsDelta?: number;
    }
  | { type: 'ADMIN_POST_INBOX'; title: string; body?: string; deepLink?: string }
  | { type: 'ADMIN_SIMULATE_FRIEND_REQUEST'; managerId: string; clubName: string }
  | { type: 'ADMIN_ADD_FRIEND'; managerId: string; clubName: string }
  | { type: 'ADMIN_SET_LEAGUE_SEASON'; partial: Partial<import('@/match/leagueSeason').LeagueSeasonState> }
  | { type: 'APPLY_CASUAL_RESULT_TO_LEAGUE'; result: { scoreHome: number; scoreAway: number; result: 'win' | 'draw' | 'loss' } }
  | { type: 'ADMIN_SET_FORM'; form: import('@/entities/types').FormLetter[] }
  | { type: 'ADMIN_PATCH_CLUB'; partial: Partial<import('@/entities/types').ClubEntity> }
  /** Simula depósito fiat→BRO no SPOT (ledger FIAT_DEPOSIT + crédito SPOT). */
  | { type: 'ADMIN_SIMULATE_FIAT_DEPOSIT'; broCents: number; note?: string }
  /** Simula saque SPOT→fiat (ledger FIAT_WITHDRAWAL + débito SPOT). */
  | { type: 'ADMIN_SIMULATE_FIAT_WITHDRAWAL'; broCents: number; note?: string }
  /** Forçar KYC OLEXP no save (testes Admin). */
  | { type: 'ADMIN_SET_WALLET_KYC'; kycOlexpDone: boolean }
  /** Match Global: Define o estado da liga global */
  | { type: 'SET_GLOBAL_LEAGUE_STATE'; payload: import('@/match/globalMatch').GlobalLeagueState }
  | { type: 'SET_OLEFOOT_LEAGUE'; payload: import('@/match/olefootLeague').OlefootLeagueState }
  | { type: 'FINALIZE_OLEFOOT_ROUND'; roundNumber: number; fixtures: import('@/match/globalMatch').GlobalFixture[] }
  | { type: 'ADVANCE_OLEFOOT_ROUND' }
  /** Match Global Scheduler: Ciclo de vida automático das rodadas */
  | { type: 'CREATE_GLOBAL_ROUND'; scheduledKickoffMs: number }
  | { type: 'START_COMMAND_WINDOW' }
  | { type: 'START_GLOBAL_ROUND' }
  | { type: 'UPDATE_LIVE_ROUND'; nowMs: number }
  | { type: 'FINISH_GLOBAL_ROUND'; nowMs: number }
  | { type: 'ADVANCE_GLOBAL_ROUND'; nowMs: number }
  /** Partida Rápida Competitiva: Atualiza ranking após partida */
  | { type: 'UPDATE_COMPETITIVE_RANKING'; homeScore: number; awayScore: number; isCompetitive: boolean }
  | { type: 'ADMIN_SET_MANAGER_PROSPECT_CONFIG'; createCostExp: number }
  | { type: 'ADMIN_MARK_PROSPECT_ART_FULFILLED'; requestId: string }
  | { type: 'ADMIN_PLAYER_CREATION_SET_PHOTO'; requestId: string; portraitUrl: string }
  | { type: 'ADMIN_PLAYER_CREATION_SET_PROMOTIONAL'; requestId: string; promotionalCardUrl: string }
  | { type: 'ADMIN_PLAYER_CREATION_VALIDATE'; requestId: string }
  | { type: 'ADMIN_PLAYER_CREATION_APPROVE'; requestId: string }
  | { type: 'ADMIN_PLAYER_CREATION_LAUNCH'; requestId: string; priceExp?: number }
  | { type: 'ADMIN_PATCH_PLAYER'; playerId: string; partial: Partial<import('@/entities/types').PlayerEntity> }
  | { type: 'ADMIN_REMOVE_PLAYER'; playerId: string }
  | {
      type: 'ADMIN_PATCH_NEXT_FIXTURE';
      partial: {
        id?: string;
        kickoffLabel?: string;
        venue?: string;
        competition?: string;
        homeName?: string;
        awayName?: string;
        isHome?: boolean;
        opponent?: Partial<import('@/entities/types').OpponentStub>;
      };
    }
  | { type: 'ADMIN_SET_STRUCTURE_LEVEL'; structureId: ClubStructureId; level: number }
  | { type: 'ADMIN_PATCH_CROWD'; partial: Partial<import('@/entities/types').CrowdState> }
  | { type: 'ADMIN_PATCH_CLUB_LOGISTICS'; partial: Partial<import('@/entities/types').ClubLogisticsState> }
  | { type: 'ADMIN_SET_MEMORABLE_TROPHIES'; ids: string[] }
  | { type: 'ADMIN_SET_RESULTS'; results: import('@/entities/types').PastResult[] }
  | { type: 'ADMIN_CLEAR_LIVE_MATCH' }
  | { type: 'ADMIN_REMOVE_CARD_COLLECTION'; id: string }
  | {
      type: 'ADMIN_PATCH_WALLET_BALANCES';
      spotBroCents?: number;
      spotExpBalance?: number;
      sponsorId?: string | null;
    }
  | { type: 'ADMIN_CLEAR_TRAINING_PLANS' }
  | { type: 'ADMIN_PATCH_STAFF_ROLES'; roles: Partial<Record<StaffRoleId, number>> }
  | { type: 'ADMIN_SET_UI_BANNER'; slot: BannerSlotId; entry: UiBannerEntry }
  | { type: 'ADMIN_SET_PLAYER_LISTED'; playerId: string; listed: boolean }
  | { type: 'ADMIN_SET_PLAYER_COLLECTION'; playerId: string; collectionId: string | undefined }
  | { type: 'ADMIN_SET_COACH'; coach: import('@/coach/types').CoachAgent }
  | { type: 'ADMIN_REMOVE_COACH' }
  | {
      type: 'CREATE_MANAGER_PROSPECT';
      payload: import('@/entities/managerProspect').ManagerProspectCreatePayload;
    }
  | {
      type: 'RENEW_MANAGER_PROSPECT_CONTRACT';
      playerId: string;
      contractMatches: import('@/playerContracts/playerContracts').ManagerProspectContractGames;
    }
  | { type: 'LIST_MANAGER_PROSPECT'; playerId: string; priceExp: number }
  | { type: 'DELIST_MANAGER_PROSPECT'; listingId: string }
  | { type: 'MARKET_MAKER_ACCEPT'; playerId: string; offerExp: number }
  | {
      type: 'BUY_GENESIS_MARKET_PLAYER';
      player: import('@/entities/types').PlayerEntity;
      priceExp: number;
      genesisCatalogId: string;
      mintOverall: number;
    }
  | {
      // Compra de Academia OLE de OUTRO manager — server já fez a transferência
      // cross-user (academy_managers listed=false, manager_squad atualizado,
      // wallet_credits criado pro vendedor). Este action só atualiza o estado
      // local do comprador: adiciona ao plantel e debita EXP.
      type: 'BUY_MANAGER_PROSPECT';
      player: import('@/entities/types').PlayerEntity;
      priceExp: number;
      listingId: string;
    }
  | {
      type: 'BUY_LEGACY_PLAYER';
      player: import('@/entities/types').PlayerEntity;
      priceExp: number;
    }
  | {
      /** Recruta uma promessa da categoria de base — desconta BRO e adiciona ao plantel. */
      type: 'RECRUIT_YOUTH_PROSPECT';
      player: import('@/entities/types').PlayerEntity;
      priceBroCents: number;
    }
  | {
      /** Aplica progresso acumulado de mentorias — merge max(base, base+learned capped at legacy). */
      type: 'APPLY_LEGACY_LEARNED';
      updates: Array<{
        studentPlayerId: string;
        learnedAttributes: Record<string, number>;
        legacyAttributes: Record<string, number>;
        taughtAttributes?: string[];
        legacyPositionKnowledge?: import('@/gamespirit/legacy/positionKnowledgeTypes').PositionKnowledge;
      }>;
    }
  | { type: 'BUY_MANAGER_NPC_OFFER'; listingId: string }
  /** Gera ofertas NPC no mercado EXP (olheiro afecta qualidade e preço). */
  | { type: 'REFRESH_MANAGER_NPC_MARKET' }
  /** Ganho de EXP “canónico” (missões, prémios) — actualiza saldo + lifetime + histórico. */
  | { type: 'GRANT_EARNED_EXP'; amount: number; historySource?: string }
  /** Anunciar venda de EXP por BRO (EXP retido até venda ou cancelamento). */
  | { type: 'EXP_EXCHANGE_ANNOUNCE_SELL'; expAmount: number; broCents: number }
  | { type: 'EXP_EXCHANGE_CANCEL_SELL'; orderId: string }
  /** Comprar lote do livro (ordens NPC; P2P quando existir match de clube). */
  | { type: 'EXP_EXCHANGE_BUY'; orderId: string }
  | { type: 'SHOP_PURCHASE_ITEM'; itemId: string; currency: 'exp' | 'bro' }
  | { type: 'CONSUME_SHOP_ITEM'; itemId: string; playerId?: string }
  | { type: 'ADMIN_SET_SHOP_CATALOG'; items: ShopCatalogItem[] }
  | { type: 'ADMIN_GRANT_SHOP_ITEM'; itemId: string; qty: number }
  | { type: 'RESET_DAILY_CHALLENGES' }
  | { type: 'UPDATE_CHALLENGE_PROGRESS'; challengeType: import('./dailyChallenges').ChallengeType; increment?: number }
  | { type: 'CLAIM_CHALLENGE_REWARD'; challengeId: string }
  // Global League MVP Actions
  | { type: 'HYDRATE_GLOBAL_LEAGUE_MVP'; payload: import('@/match/globalLeagueMVP').GlobalLeagueMVPState }
  | { type: 'INIT_GLOBAL_LEAGUE_MVP' }
  | { type: 'REGISTER_GLOBAL_TEAM'; managerId: string; clubName: string; clubShort: string; overall: number }
  | { type: 'CLAIM_GLOBAL_LEAGUE_MILESTONES'; milestoneIds: string[] }
  | { type: 'CLAIM_GLOBAL_LEAGUE_MILESTONES_SILENT'; milestoneIds: string[] }
  | {
      type: 'RECORD_LOCAL_LEAGUE_RESULT';
      league: import('@/match/localLeagues').LocalLeagueId;
      result: import('@/match/localLeagues').LocalLeagueResult;
      goalsFor: number;
      goalsAgainst: number;
    }
  | { type: 'ADMIN_START_GLOBAL_PLAYOFFS' }
  | { type: 'SET_GLOBAL_LEAGUE_MVP_MIN_TEAMS'; minTeams: number }
  | { type: 'START_GLOBAL_PLAYOFF_ROUND'; roundNumber: number }
  | { type: 'UPDATE_GLOBAL_PLAYOFF_LIVE'; nowMs: number }
  | { type: 'RESCHEDULE_PLAYOFF_ROUND'; roundNumber: number; scheduledKickoffMs: number }
  | { type: 'FINISH_GLOBAL_PLAYOFF_ROUND'; roundNumber: number; finishedFixtures: import('@/match/globalMatch').GlobalFixture[] }
  | { type: 'START_GLOBAL_LEAGUE_ROUND'; roundNumber: number }
  | { type: 'UPDATE_GLOBAL_LEAGUE_LIVE'; nowMs: number }
  | { type: 'FINISH_GLOBAL_LEAGUE_ROUND'; roundNumber: number; finishedFixtures: import('@/match/globalMatch').GlobalFixture[] }
  | { type: 'APPLY_GLOBAL_PROMOTION_RELEGATION' }
  | { type: 'RESET_GLOBAL_LEAGUE_MVP' }
  | {
      type: 'APPLY_GLOBAL_ROUND_MORAL';
      result: import('@/systems/playerMoral/types').MatchResult;
      playerIds: string[];
    }
  | { type: 'TICK_HEALTH_RECOVERY' }
  | {
      type: 'UPDATE_PLAYER_FORM_STREAK';
      updates: Array<{ playerId: string; good: boolean }>;
    }
  | {
      type: 'PUSH_INBOX_ITEMS';
      items: import('./inboxTypes').InboxItem[];
    }
  | {
      type: 'SET_EMERGENCY_TRANSFER_OFFER';
      offer: {
        injuredPlayerId: string;
        injuredPlayerName: string;
        zone: import('@/entities/types').TacticalZone;
        createdAt: number;
      };
    }
  | {
      type: 'DISMISS_EMERGENCY_TRANSFER';
    }
  | {
      type: 'SET_LAST_PROCESSED_GLOBAL_ROUND';
      roundKey: string;
    }
  /**
   * OLEFOOT PYTHON MODE — Registra presença do manager. Atualiza
   * `managerPresence.lastLoginAt`, incrementa sessões. UI dispara no mount.
   */
  | { type: 'RECORD_CHECK_IN'; managerId: string }
  /**
   * OLEFOOT PYTHON MODE — Tenta resgatar bonus de login (3h/1h cycle).
   * Resultado fica em `state.lastLoginBonusClaim` pra UI consumir.
   */
  | { type: 'CLAIM_LOGIN_BONUS' }
  /** OLEFOOT PYTHON MODE — Limpa lastLoginBonusClaim após UI ler. */
  | { type: 'CLEAR_LAST_BONUS_CLAIM' }
  /** OLEFOOT PYTHON MODE — Adiciona consequências (chamado por FINALIZE_MATCH e cronos). */
  | { type: 'ADD_CONSEQUENCES'; consequences: PersistentConsequence[] }
  /** OLEFOOT PYTHON MODE — Remove consequências expiradas (idempotente). */
  | { type: 'TICK_CONSEQUENCES' };
