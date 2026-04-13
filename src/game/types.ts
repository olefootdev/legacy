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
import type { InboxItem } from './inboxTypes';
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

export interface SavedTacticPlan {
  id: string;
  name: string;
  style: TeamTacticalStyle;
  createdAt: string;
  updatedAt: string;
}

export type IndividualTrainingType = 'fisico' | 'mental' | 'tatico' | 'atributos' | 'especial';
export type CollectiveTrainingType = 'formacao' | 'empatia' | 'fisico';
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

/** Passos do fluxo Admin «Player Creation» (Academia OLE → retrato → plantel). */
export type PlayerCreationStep =
  | 'awaiting_photo'
  | 'photo_uploaded'
  | 'validated'
  | 'approved'
  | 'launched';

/**
 * Demanda **Player Creation** (Academia OLE): jogador já existe no save; Admin cola retrato, valida, aprova e lança.
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
}

export interface OlefootGameState {
  version: 1;
  club: ClubEntity;
  /** Coleções NFT-style (off-chain): maxSupply global por coleção. */
  cardCollections: Record<string, CardCollection>;
  players: Record<string, PlayerEntity>;
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
  manager: {
    /** Formação tática do plantel (motor / catálogo de slots). */
    formationScheme: FormationSchemeId;
    tacticalMentality: number;
    defensiveLine: number;
    tempo: number;
    tacticalStyle: TeamTacticalStyle;
    savedTactics: SavedTacticPlan[];
    activeMatchTacticId: string | null;
    activeTrainingTacticId: string | null;
    trainingPlans: TrainingPlan[];
    staff: StaffState;
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
}

export type GameAction =
  | {
      type: 'SET_LINEUP';
      lineup: Record<string, string>;
      /** Se enviado, grava junto com a escalação (mesma formação nas próximas partidas). */
      formationScheme?: import('@/match-engine/types').FormationSchemeId;
    }
  | { type: 'START_LIVE_MATCH'; mode: import('@/engine/types').MatchMode }
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
      stats: Record<string, { passesOk: number; passesAttempt: number; tackles: number; km: number; shots: number; goals: number }>;
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
  | { type: 'END_MATCH_TO_POST' }
  /** Desistência em partida rápida/automática: 0–5 para o visitante e fase pós-jogo. */
  | { type: 'FORFEIT_MATCH'; mode: 'quick' | 'auto' | 'test2d' }
  | { type: 'FINALIZE_MATCH' }
  /** Quando `insertMatch` resolve — actualiza o snapshot em curso (evita mutar objecto já descartado). */
  | { type: 'SET_LIVE_MATCH_SUPABASE_ID'; matchId: string; matchClientNonce: number }
  | { type: 'MERGE_PLAYERS'; players: Record<string, PlayerEntity> }
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
      mode: 'live' | 'quick';
      currency: 'BRO' | 'EXP';
      /** BRO: valor em unidades BRO (ex.: 10.5). EXP: valor inteiro de EXP. */
      prizeAmount: number;
    }
  | { type: 'SEND_FRIEND_REQUEST'; managerId: string; clubName: string }
  | { type: 'ACCEPT_FRIEND_REQUEST'; requestId: string }
  | { type: 'DECLINE_FRIEND_REQUEST'; requestId: string }
  | { type: 'CANCEL_OUTGOING_FRIEND_REQUEST'; requestId: string }
  | { type: 'REMOVE_SOCIAL_FRIEND'; managerId: string }
  | { type: 'DISMISS_INBOX_ITEM'; id: string }
  | { type: 'SET_USER_SETTINGS'; partial: Partial<UserSettings> }
  | { type: 'SET_CLUB_NAME'; name: string }
  /** Substitui o estado por um save importado (JSON). Validação mínima em `persistence`. */
  | { type: 'IMPORT_GAME_STATE'; state: OlefootGameState }
  | { type: 'RESET' }
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
  | { type: 'ADMIN_SET_FORM'; form: import('@/entities/types').FormLetter[] }
  | { type: 'ADMIN_PATCH_CLUB'; partial: Partial<import('@/entities/types').ClubEntity> }
  /** Simula depósito fiat→BRO no SPOT (ledger FIAT_DEPOSIT + crédito SPOT). */
  | { type: 'ADMIN_SIMULATE_FIAT_DEPOSIT'; broCents: number; note?: string }
  /** Simula saque SPOT→fiat (ledger FIAT_WITHDRAWAL + débito SPOT). */
  | { type: 'ADMIN_SIMULATE_FIAT_WITHDRAWAL'; broCents: number; note?: string }
  /** Forçar KYC OLEXP no save (testes Admin). */
  | { type: 'ADMIN_SET_WALLET_KYC'; kycOlexpDone: boolean }
  | { type: 'ADMIN_SET_MANAGER_PROSPECT_CONFIG'; createCostExp: number }
  | { type: 'ADMIN_MARK_PROSPECT_ART_FULFILLED'; requestId: string }
  | { type: 'ADMIN_PLAYER_CREATION_SET_PHOTO'; requestId: string; portraitUrl: string }
  | { type: 'ADMIN_PLAYER_CREATION_VALIDATE'; requestId: string }
  | { type: 'ADMIN_PLAYER_CREATION_APPROVE'; requestId: string }
  | { type: 'ADMIN_PLAYER_CREATION_LAUNCH'; requestId: string }
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
  | {
      type: 'CREATE_MANAGER_PROSPECT';
      payload: import('@/entities/managerProspect').ManagerProspectCreatePayload;
    }
  | { type: 'LIST_MANAGER_PROSPECT'; playerId: string; priceExp: number }
  | { type: 'DELIST_MANAGER_PROSPECT'; listingId: string }
  | { type: 'BUY_MANAGER_NPC_OFFER'; listingId: string };
