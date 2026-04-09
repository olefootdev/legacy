/**
 * Caixa de entrada = centro de gestão do clube (não placares — isso fica em histórico/liga).
 * Sem importar `./types` (evita ciclo com `OlefootGameState` → `InboxItem`).
 */

export type InboxCategory =
  | 'PLANTEL'
  | 'TREINO'
  | 'STAFF'
  | 'FINANCEIRO'
  | 'CLUBE'
  | 'COMPETIÇÃO'
  | 'MISSÃO'
  | 'TORCIDA'
  | 'EMPRESA'
  | 'CONTA';

/** Identificador estável para analytics / filtros. */
export type InboxMessageType =
  | 'PLAYER_SOLD'
  | 'PLAYER_BOUGHT'
  | 'PLAYER_LOAN_OUT'
  | 'PLAYER_LOAN_IN'
  | 'PLAYER_INJURY'
  | 'PLAYER_RETURN'
  | 'PLAYER_SUSPENSION'
  | 'PLAYER_MORALE'
  | 'PLAYER_CONTRACT'
  | 'LINEUP_ISSUE'
  | 'TRAINING_STARTED'
  | 'TRAINING_COMPLETED'
  | 'TRAINING_CANCELLED'
  | 'STAFF_LEVEL_UP'
  | 'FINANCE_EXP_GAIN'
  | 'FINANCE_EXP_SPENT'
  | 'FINANCE_BRO_MOVEMENT'
  | 'FINANCE_ESCROW'
  | 'FINANCE_ESCROW_RELEASED'
  | 'FINANCE_TREASURY_FEE'
  | 'STRUCTURE_UPGRADED'
  | 'STRUCTURE_LOCKED'
  | 'FIXTURE_REMINDER'
  | 'LEAGUE_POSITION'
  | 'PROMOTION_RELEGATION'
  | 'CUP_DRAW'
  | 'SEASON_MILESTONE'
  | 'MATCH_ADMIN_VOID'
  | 'MISSION_NEW'
  | 'MISSION_PROGRESS'
  | 'MISSION_COMPLETED'
  | 'MISSION_EXPIRED'
  | 'CROWD_MOOD'
  | 'REPUTATION'
  | 'COMPANY_ANNOUNCEMENT'
  | 'LEGAL_TERMS'
  | 'MAINTENANCE'
  | 'ACCOUNT_KYC'
  | 'ACCOUNT_SECURITY'
  | 'TACTIC_SAVED'
  | 'TACTIC_TRAINING_FOCUS'
  | 'TRAINING_SLOT_BLOCKED'
  | 'TRAINING_PLAN_STARTED'
  | 'TRAINING_PLANS_COMPLETED'
  | 'TRAINING_SESSION_LIGHT'
  | 'TRAINING_SESSION_FAIL'
  | 'MARKET_SCOUT_REPORT'
  | 'SHOP_PACK'
  | 'SHOP_PACK_FAIL'
  | 'STAFF_UPGRADE_FAIL'
  | 'STRUCTURE_UPGRADE_FAIL'
  | 'WALLET_OLEXP'
  | 'WALLET_OLEXP_FAIL'
  | 'WALLET_CLAIM_FAIL'
  | 'WALLET_SPONSOR_FAIL'
  | 'WALLET_GAT_FAIL'
  | 'FRIENDLY_CHALLENGE'
  | 'FRIENDLY_CHALLENGE_FAIL'
  | 'SOCIAL_FRIEND_INVITE'
  | 'SOCIAL_FRIEND_ACCEPTED'
  | 'SOCIAL_INVITE_SENT'
  | 'SOCIAL_INVITE_ACCEPTED_NOTICE'
  | 'STAFF_ADVICE';

export type SuggestedActionKind = 'OPEN_TRAINING' | 'APPLY_PRESET';

/** Alinhado a `TrainingMode` / tipos de treino do reducer (strings para evitar ciclo de imports). */
export interface SuggestedAction {
  kind: SuggestedActionKind;
  trainingMode?: 'individual' | 'coletivo';
  trainingType?: string;
  playerIds?: string[];
  group?: 'defensivo' | 'criativo' | 'ataque' | 'all';
  presetId?: string;
}

export interface InboxItem {
  id: string;
  messageType: InboxMessageType;
  category: InboxCategory;
  /** Etiqueta na UI — por defeito igual a `category`; pode ser mais específica. */
  tag: string;
  title: string;
  body?: string;
  timeLabel: string;
  read?: boolean;
  deepLink?: string;
  colorClass: string;
  kind?: 'news' | 'friend_invite';
  friendRequestId?: string;
  /** Papel do staff (`StaffRoleId` em runtime). */
  staffRole?: string;
  relatedPlayerIds?: string[];
  suggestedAction?: SuggestedAction;
  /** Rótulo narrativo (ex.: médico via canal nutrição). */
  advisorLabel?: string;
  /**
   * Quando true, não entra no painel "Notificações" da HOME.
   * Usado para pós-jogo (EXP/staff) — placar e desfecho ficam no histórico de jogos / liga.
   */
  hideFromHomeFeed?: boolean;
}

export const INBOX_CATEGORY_LABELS: Record<InboxCategory, string> = {
  PLANTEL: 'Plantel',
  TREINO: 'Treino',
  STAFF: 'Staff',
  FINANCEIRO: 'Financeiro',
  CLUBE: 'Clube',
  COMPETIÇÃO: 'Competição',
  MISSÃO: 'Missão',
  TORCIDA: 'Torcida',
  EMPRESA: 'Empresa',
  CONTA: 'Conta',
};

/**
 * Notificações antigas que só repetem placar (gravadas no localStorage antes do modelo atual).
 * Ex.: tag PARTIDA + título "Resultado: OLE 2-1 TITANS".
 */
export function isLegacyPlacarInboxNotification(item: InboxItem): boolean {
  const tag = (item.tag ?? '').trim().toUpperCase();
  if (tag === 'PARTIDA') return true;
  if (/^Resultado\s*:/i.test(item.title)) return true;
  return false;
}

/**
 * Itens que não devem aparecer no feed "Notificações" da HOME (pós-partida / recompensa de jornada).
 * Inclui legado sem `hideFromHomeFeed` gravado.
 */
export function isHiddenFromHomeInboxFeed(item: InboxItem): boolean {
  if (isLegacyPlacarInboxNotification(item)) return true;
  if (item.hideFromHomeFeed) return true;
  if (item.messageType === 'FINANCE_EXP_GAIN' && /creditados pela jornada/i.test(item.title)) {
    return true;
  }
  if (
    item.messageType === 'STAFF_ADVICE' &&
    /^(staff-gr|staff-mental|staff-fis|staff-tat|staff-head)-/.test(item.id)
  ) {
    return true;
  }
  return false;
}

export function inboxHasVisibleHomeFeedItem(items: InboxItem[]): boolean {
  return items.some((i) => !isHiddenFromHomeInboxFeed(i));
}

export function inboxCategoryColorClass(c: InboxCategory): string {
  const map: Record<InboxCategory, string> = {
    PLANTEL: 'text-sky-400',
    TREINO: 'text-neon-yellow',
    STAFF: 'text-violet-400',
    FINANCEIRO: 'text-emerald-400',
    CLUBE: 'text-amber-400',
    COMPETIÇÃO: 'text-blue-400',
    MISSÃO: 'text-fuchsia-400',
    TORCIDA: 'text-orange-400',
    EMPRESA: 'text-gray-300',
    CONTA: 'text-cyan-400',
  };
  return map[c];
}
